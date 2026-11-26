# IFEval gap plan — exact per-instruction failure breakdown (2026-11-26)

Round: results-v272-ifeval-r4 (latest, 56/100 row-level strict). Instruction-level: 43/154 fail (27.9%). Trend: r1 51% → r2 57% → r3 56% → r4 56% (row-level, noise floor ±5 at n=100).

## Exact failures by instruction type (official checker, offline regrade)

| Instruction | Fail rate | Failure signature |
|---|---|---|
| detectable_format:number_highlighted_sections | 6/6 (100%) | House style bolds freely; never emits `*highlight*` sections on demand |
| length_constraints:number_paragraphs | 5/5 (100%) | Paragraphs joined with blank lines only; never uses the `***` divider the checker wants |
| detectable_content:number_placeholders | 3/3 (100%) | Never emits `[placeholder]` brackets on request |
| detectable_format:number_bullet_lists | 7/8 (87.5%) | Emits `* **bold**` markdown; checker wants plain `- ` or `* ` bullets exactly N times |
| detectable_format:title | 6/7 (85.7%) | Emits `TITLE>>` art instead of `<<title>>` literal |
| detectable_format:json_format | 3/4 (75%) | Prefixes the word "JSON" before the fenced object; checker requires response to BE the JSON |
| keywords:forbidden_words | 4/12 (33.3%) | Forbidden word appears in preamble ("Plan") or follow-ups, not the body |
| combination:repeat_prompt | 2/7 (28.6%) | Repeat-before-answer requirement collides with preamble stripping |
| startend:end_checker | 2/7 (28.6%) | "Suggested Follow-ups" section sits AFTER the required end phrase |
| keywords:frequency | 1/6; change_case:capital 1/6; lowercase 1/11; no_comma 1/10 | Residual edge cases |
| constrained_response | 1/1 | "Answer with one of: yes/no/maybe" — model elaborated past it |
| All others (sentence/word counts, letter frequency, quotations, postscript, two_responses, existence, first-word, multiple_sections, language) | 0% | Clean |

## Root cause (one sentence)
The failure mass is NOT reasoning — it is our writer's house-format contract (bold bullets, `TITLE>>` art, preambles, Suggested Follow-ups, concise-mode rewriting) overriding the prompt's literal format instructions in 6 instruction families that are 75-100% of their category.

## Closure plan (ordered, each step measured by a full IFEval round, gains claimed only beyond ±5% noise)

1. **Literal-format passthrough (highest yield, ~20+ rows of headroom):** extend the writer prompt with a format-contract clause — when the user's prompt explicitly demands a literal format (<<title>>, *highlight*, [placeholder], *** dividers, N plain bullets, "wrap in JSON", "end with EXACT PHRASE", constrained yes/no), produce that format VERBATIM and suppress ALL house style for that answer: no preamble, no Suggested Follow-ups, no bold bullets, no title art.
2. **End-of-answer discipline:** when an end_checker instruction is detected, the required phrase must be the literal last line — gate it with the existing final-line enforcement used for FINAL ANSWER.
3. **Forbidden-words scope:** forbidden-word checks must scan the ENTIRE response; add a post-write self-check that rejects responses containing forbidden tokens anywhere (including follow-ups) and retries once.
4. **Constrained-response short-circuit:** yes/no/maybe-class prompts bypass the writer contract entirely and echo only the allowed token(s).
5. **Re-round (r5, n=100, same seed grid):** target ≥70 row-level; per-tag regrade like this one to find the next tranche. Frontier is 80-90+; realistic honest ceiling with current stack to be established by r5-r6 flip analysis.
6. **Writer model swap evaluation (last):** if r5-r6 plateau below 75, evaluate a GLM-class writer on the 6 failing format families only — per Benchmark Gospel, a full round before any claim.
