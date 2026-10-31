# Streaming and latency measurements (2026-10-31)

Method: a temporary harness (since removed) signed in as a throwaway non-owner user and called the live gateway-chat with 4 questions, once non-streaming and once streaming. Times are wall-clock from the request start. Raw output: live_run.json. One run each, so treat as indicative, not statistical.

| Question | Non-stream total | Stream: first signal | Stream: first answer text | Stream total |
|---|---|---|---|---|
| Anomaly agent checks | 15.5 s | 0.8 s | 11.9 s | 13.9 s |
| Fleet agent count | 3.8 s | 0.9 s | 1.2 s | 1.9 s |
| Scoring band recalibration | 39.4 s | 1.0 s | 15.8 s | 26.9 s |
| Default gateway model | 3.3 s | 0.9 s | 1.1 s | 2.7 s |

Findings
- Retrieval is not the cost: pre_model is 1 to 21 ms server-side.
- The model call dominates and is highly variable (1.1 s to 38.7 s). DeepSeek V4.1 Flash reasons before answering; on harder questions the first answer text arrives after 12 to 16 s of reasoning even when streaming.
- Streaming gives a visible "Thinking..." signal in about 0.8 to 1.0 s on every question and the answer text appears as it is produced, so perceived wait drops sharply on long answers. On short questions answer text starts at about 1.1 s versus 3 to 4 s.
- The auth hop for owners (/auth/v1/user) measured 234 to 257 ms. It cannot be parallelized (the tier decides retrieval), so a 60 s per-token positive cache was added; it saves about 235 ms on an owner's follow-up questions.
- Largest remaining lever: model reasoning time. Limiting reasoning effort would cut the 12 to 39 s cases but changes answer quality, so it needs the held-out eval (eval/heldout) before shipping. Not done here.
