# Answer-body visual parity audit

Status: BLOCKED, not a parity pass. No production files were modified and no commits were pushed.

## Live evidence

- Perplexity: the homepage returned Cloudflare “Performing security verification” with no query field. Its landing typography was not accessible either. The mobile-host retry failed DNS. The captured challenge text is not valid reference answer typography.
- ai.spaincos.com: both submitted prompts displayed “Sign in required” and “Sign in to ask a question.” No generated `.answer-content p`, heading, list, or code was rendered.
- Method: Python Playwright Chromium, 1440 × 1100, device scale 1, light preferred scheme, DOMContentLoaded navigation, explicit selectors and bounded waits. Both branded font faces loaded in the AI browser context.
- Follow-up stylesheet extraction probe: the Perplexity challenge document had zero `link[rel=stylesheet]` elements and zero `document.fonts` entries. Only Cloudflare inline system-font styles were present. See `perplexity-stylesheet-probe.json`; the claim that this challenge loads Perplexity answer CSS is not supported by the observed page.

## Human-visible priorities and exact CSS ownership

There are zero defensible visual DIFF verdicts because reference answers were unavailable. Exact replacement values cannot honestly be prescribed from this run. Do not copy Cloudflare’s system font or 24px line height into the app.

- P0, unblock reference evidence: obtain an accessible Perplexity answer and an authenticated AI session, then rerun the same prompts at the same viewport. This is not a CSS fix.
- P1, font and paragraph rhythm: `index.html`, `.answer-content`, `.answer-content p`, and `--font-sans`. Preserve measured values below until actual reference values are available. Font-family declaration alone is not proof of matching glyph rasterization.
- P1, answer column width: measure the real rendered answer parent chain after authentication. Synthetic container width is explicitly not production evidence.
- P2, markdown headings/list rhythm: `index.html`, `.answer-content h1`, `.answer-content h2`, `.answer-content li`, and shared heading margins. Later override rules around lines 1410–1417 supersede the earlier answer block around lines 930–977.
- P2, code: `index.html`, `.answer-content code`, `.answer-content pre`, and `.answer-content pre code`. Compare both inline code and fenced code only after reference capture.

## Deployed CSS specimen, not an answer

An explicitly labeled temporary DOM fixture was inserted into the live AI page in a separate browser session. This did not alter any production file or server state. It measures what the deployed stylesheet does to representative elements, not model output or markdown parser behavior.

| Selector | Size | Line height | Weight | Top / bottom margin | Primary family |
|---|---|---|---|---|---|
| `.question-header` | 16px | 24px | 400 | 0px / 16px | pplxSans |
| `.answer-content` | 16px | 25.6px | 400 | 0px / 0px | pplxSans |
| `.answer-content p` | 16px | 25.6px | 400 | 0px / 16px | pplxSans |
| `.answer-content h1` | 24px | 31.2px | 600 | 24px / 8px | pplxSans |
| `.answer-content h2` | 20px | 27px | 600 | 24px / 8px | pplxSans |
| `.answer-content li` | 16px | 25.6px | 400 | 0px / 4px | pplxSans |
| `.answer-content pre` | 13.5px | 20.925px | 400 | 0px / 14px | "SF Mono" |
| `.answer-content pre code` | 13.5px | 20.925px | 400 | 0px / 0px | ui-monospace |
| `.answer-content li code` | 14px | 16.8px | 400 | 0px / 0px | ui-monospace |

## Files

- `side-by-side.html`: requested side-by-side, with honest BLOCKED verdicts.
- `perplexity-answer.png`: actual challenge screenshot, not an answer.
- `ai-answer.png`, `ai-markdown.png`: actual query submission auth gates.
- `ai-synthetic-fixture.png`: labeled deployed-CSS specimen.
- `measurements.json`, `fixture-measurements.json`: exact raw computed styles.
- `measure.py`, `fixture.py`, `build-report.py`: reproducible capture and report scripts.

## Acceptance criteria

Do not sign off until real answer screenshots can be compared side by side. Font size and line height must match exactly; primary font family must match and actually load; colors should be compared perceptually in the same theme. Inspect wrapping, paragraph gaps, list indentation, heading hierarchy, and code padding by eye at native scale.

## UPDATE — authenticated real-answer measurements (2026-11-11, orchestrator lane)

The auth gate was bypassed with the eval account; real answers were rendered on live
ai.spaincos.com and measured (ai-computed.json, ai-answer.png, ai-markdown.png). These
supersede the synthetic fixture and match it exactly:

| Element | Live measured |
|---|---|
| .question-header | pplxSans 16px / 24px / w400, color rgb(15,17,17) |
| .answer-content p | pplxSans 16px / 25.6px (1.6) / w400, margin-bottom 16px, 720px column |
| .answer-content h1/h2 | 24/31.2 and 20/27, w600, margins 24px/8px |
| .answer-content li | 16px / 25.6px, margin-bottom 4px |
| .answer-content code | ui-monospace 14px / 16.8px |

## Status: UNVERIFIED — Perplexity ground truth still missing

- ai.spaincos.com serves Perplexity's own webfont file (frontend-cdn.perplexity.ai
  PPLX-Sans-Beta-R6-VF.woff2), so glyph shapes are identical where it loads.
- Computed metrics above match the Perplexity values recorded earlier in this repo's
  design notes, but Perplexity was unreachable from the sandbox today (Cloudflare),
  so no fresh side-by-side ground truth exists yet.
- The owner reports the typography still looks different in his browser. Two open
  explanations: (a) his tab serves stale CSS — check the sidebar footer for
  "build v156"; any tab without it is stale; (b) genuine differences in elements not
  captured here. NEXT STEP: capture Perplexity reference answers from a logged-in
  human browser (the owner's) or an unblocked environment, then re-run the diff.
