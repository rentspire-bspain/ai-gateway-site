# browser-service

Headless Chromium (Playwright) microservice behind ai.spaincos.com's `browser_step` gateway tool (Tier 2 browsing). Text only; no screenshots are ever returned.

## Endpoints
All require `Authorization: Bearer <BROWSER_SERVICE_TOKEN>`; all JSON.

| Route | Body | Returns |
|---|---|---|
| `GET /health` | | `{ok: true}` |
| `POST /session` | `{session_id?}` | `{session_id, created}` |
| `POST /navigate` | `{session_id, url}` | `{url, title, status}` |
| `POST /read` | `{session_id}` | `{text}` (max 8,000 chars; also `url`, `truncated`) |
| `POST /click` | `{session_id, selector}` | `{clicked: true, url}` |
| `POST /fill` | `{session_id, selector, value}` | `{filled: true}` |
| `POST /extract` | `{session_id, selector}` | `{items: [{text, href?}]}` (max 50) |

Errors return `{error}` with 400 (bad input / blocked), 401, 404 (unknown session), 502/504 (browser failure/timeout), 503 (token not configured).

## Behaviour and guards
- One browser, one isolated context (cookie jar) per `session_id`. Max 20 contexts, LRU-evicted; idle contexts are closed after 5 minutes.
- http(s) only; localhost, 127., 10., 192.168., 169.254., 172.16-31., `.local`, `.internal`, `0.0.0.0`, `::1` and URLs with credentials are rejected. The same check runs on every sub-request and redirect, and on DNS results, so a public name resolving to a private IP is blocked too.
- Selectors must be plain CSS (no `text=`, `xpath=`, `role=`, `>>`, or Playwright pseudo-classes). Password fields cannot be filled.
- Navigate 15s, click/fill/extract 10s, read 8s. CORS is limited to `https://ai.spaincos.com`.
- Logs contain only the access line (method, route, status). No URLs, selectors, values or page text are logged.

## Environment variables
| Var | Required | Notes |
|---|---|---|
| `BROWSER_SERVICE_TOKEN` | yes | Long random string. If unset, every route returns 503. |
| `PORT` | no | Defaults to 8000 (Render sets it automatically). |

## Deploy on Render
1. New Web Service, runtime Docker, root directory `ai-gateway-site/browser-service` (uses the `Dockerfile`).
2. Instance: at least 1 GB RAM (Starter 512 MB is tight for Chromium with several contexts; 2 GB is comfortable).
3. Env vars: `BROWSER_SERVICE_TOKEN` (generate with `openssl rand -hex 32`). `PORT` is injected by Render.
4. Leave the health check path empty (default port check). `/health` requires the bearer token, which Render's health probe cannot send.
5. Single instance only: sessions live in process memory, so do not scale horizontally.
6. Set these on the Supabase gateway (Edge Function secrets): `BROWSER_SERVICE_URL` (e.g. `https://browser-service-xxxx.onrender.com`, no trailing slash) and `BROWSER_SERVICE_TOKEN` (same value).

Render free/starter services spin down when idle; the first call after a sleep can take 30s+ and will time out in the gateway (10s per tool). Use an always-on plan.

## Local run and smoke test
```bash
pip install -r requirements.txt && playwright install chromium
./smoke_test.sh   # random token and free port; health, navigate+read example.com, SSRF and selector checks
# or manually:
BROWSER_SERVICE_TOKEN=devtoken python3 -m uvicorn main:app --port 8000
```
