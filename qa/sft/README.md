# Rule 15c — LoRA-first SFT pass (executable pipeline, v1)

**Status: PIPELINE COMPLETE — awaiting the owner's one decision: the GPU path.**

## What is ready
- `train_qlora.py` — one-command QLoRA training on any CUDA box (RunPod / Vast / Modal / Fly GPU / Hetzner GPU):
  `python3 train_qlora.py --dataset sft-dataset.jsonl --base Qwen/Qwen3.5-30B-A3B --out out/`
- Dataset: `/home/user/workspace/qa-private/bench/sft-dataset.jsonl` — 466 verified-correct examples
  (browsecomp 93, dsqa 79, frames 95, simpleqa 199), chat format (system/user/assistant),
  exported by `qa/sft-export.py` from graded archives — grows ~100/round.
- Serving: vLLM with the adapter (`--enable-lora --lora-modules sft=<path>`), then register the
  endpoint in call-model (OpenAI-compatible) — zero gateway changes.
- Eval: run the strict grader (`qa/ruthless-bench.py`) against the fine-tuned endpoint; the adapter
  ships only if it beats the incumbent on the strict grader (rule 15c's own bar).

## The one owner decision — the GPU path (three options, all server-side)
1. **Approve the Hetzner Cloud credential** (vault shows `custom-cred:...@api.hetzner.cloud`) —
   rent a GPU server, run the pipeline, ~$50-100.
2. **Provide a GPU-provider key** (RunPod / Vast.ai / Modal) — the pipeline runs on any of them.
3. **Authorize OpenAI fine-tuning** on the existing OpenAI credential (gpt-oss-20b open-weight base,
   fine-tuning API, ~$5-20, no GPU provisioning — OpenAI hosts the training).

Any of the three executes the full chain: dataset -> LoRA SFT -> eval vs incumbent -> serve if it wins.

## Recipe (documented in the master doc §30c)
- QLoRA: 4-bit NF4, rank 16, alpha 32, all-linear targets, 2 epochs, lr 2e-4, paged_adamw_8bit
- The strict grader IS the reward function (RL rung = GRPO with grader-as-reward, later)
- Full SFT+RL rung stays as the ~$1-2K option; LoRA-first is the ~$100 rung
