#!/usr/bin/env python3
"""Rule 15c LoRA-first SFT pass — the executable training script (v1).

Runs on ANY CUDA GPU box (RunPod / Vast.ai / Modal / Fly GPU machine / Hetzner GPU server).
One command, no other setup:

    python3 train_qlora.py \
        --dataset /path/to/sft-dataset.jsonl \
        --base Qwen/Qwen3.5-30B-A3B \
        --out /path/to/adapter-out

Base model (the recipe's candidates, all Apache/permissive):
  - Qwen/Qwen3.5-30B-A3B   (default — fast MoE, cheap to serve)
  - deepseek-ai/DeepSeek-V4-Flash
  - zai-org/GLM-4.7-Flash

Requirements (auto-checked): torch, transformers, peft, bitsandbytes, datasets.
QLoRA config: 4-bit NF4, rank 16, alpha 32, dropout 0.05, targets = all linear.
The strict grader IS the reward function: the assistant turns are verified-correct
answers (466 examples: browsecomp 93, dsqa 79, frames 95, simpleqa 199).
"""
import argparse, json, sys
from pathlib import Path

def check_deps():
    missing = []
    for m in ("torch", "transformers", "peft", "bitsandbytes"):
        try: __import__(m)
        except ImportError: missing.append(m)
    if missing:
        sys.exit(f"missing deps: {missing} — pip install {' '.join(missing)}")

def load_dataset(path):
    rows = [json.loads(l) for l in open(path) if l.strip()]
    # every row must be a complete verified conversation (system/user/assistant)
    ok = [r for r in rows if {m["role"] for m in r["messages"]} >= {"system", "user", "assistant"}]
    print(f"[sft] {len(ok)}/{len(rows)} verified conversations loaded")
    return ok

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="/data/sft-dataset.jsonl")
    ap.add_argument("--base", default="Qwen/Qwen3.5-30B-A3B")
    ap.add_argument("--out", default="/data/adapter-out")
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--batch", type=int, default=1)
    ap.add_argument("--grad-accum", type=int, default=8)
    args = ap.parse_args()

    check_deps()
    import torch
    from datasets import Dataset
    from transformers import (AutoModelForCausalLM, AutoTokenizer,
                              BitsAndBytesConfig, TrainingArguments)
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

    rows = load_dataset(args.dataset)
    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None: tok.pad_token = tok.eos_token

    def fmt(r):
        # chat-template the conversation; label only the assistant turn
        return tok.apply_chat_template(r["messages"], tokenize=False, add_generation_prompt=False)

    ds = Dataset.from_dict({"text": [fmt(r) for r in rows]})

    def tokenize(batch):
        out = tok(batch["text"], truncation=True, max_length=2048, padding="max_length")
        out["labels"] = [list(t) for t in out["input_ids"]]
        return out
    ds = ds.map(tokenize, batched=True, remove_columns=["text"])

    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                             bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
    model = AutoModelForCausalLM.from_pretrained(args.base, quantization_config=bnb,
                                                device_map="auto", torch_dtype=torch.bfloat16)
    model = prepare_model_for_kbit_training(model)
    lora = LoraConfig(r=args.rank, lora_alpha=args.rank * 2, lora_dropout=0.05, bias="none",
                      task_type="CAUSAL_LM",
                      target_modules="all-linear")
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    targs = TrainingArguments(
        output_dir=args.out, num_train_epochs=args.epochs, per_device_train_batch_size=args.batch,
        gradient_accumulation_steps=args.grad_accum, learning_rate=args.lr,
        logging_steps=10, save_strategy="epoch", bf16=True, warmup_ratio=0.03,
        lr_scheduler_type="cosine", report_to=[], optim="paged_adamw_8bit",
    )
    from transformers import Trainer
    Trainer(model=model, args=targs, train_dataset=ds,
            data_collator=lambda f: {
                "input_ids": torch.tensor([x["input_ids"] for x in f]),
                "attention_mask": torch.tensor([x["attention_mask"] for x in f]),
                "labels": torch.tensor([x["labels"] for x in f])}).train()

    model.save_pretrained(args.out + "/adapter")
    tok.save_pretrained(args.out + "/adapter")
    print(f"[sft] adapter saved to {args.out}/adapter — serve with vLLM "
          f"(vllm serve {args.base} --enable-lora --lora-modules sft={args.out}/adapter) "
          f"then eval via qa/ruthless-bench.py against the strict grader")

if __name__ == "__main__":
    main()
