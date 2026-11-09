#!/usr/bin/env bash
# Local smoke test: starts uvicorn with a random token, hits /health, then navigate+read example.com.
set -euo pipefail
cd "$(dirname "$0")"
TOKEN="$(python3 -c 'import secrets;print(secrets.token_hex(16))')"
PORT="${PORT:-$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')}"
BROWSER_SERVICE_TOKEN="$TOKEN" python3 -m uvicorn main:app --host 127.0.0.1 --port "$PORT" >/tmp/browser-service.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for i in $(seq 1 40); do curl -sf -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep 0.5; done
H=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
B="http://127.0.0.1:$PORT"
echo "health (no auth):  $(curl -s -o /dev/null -w '%{http_code}' $B/health)"
echo "health (auth):     $(curl -s "${H[@]}" $B/health)"
SID=$(curl -s "${H[@]}" -X POST $B/session -d '{}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["session_id"])')
echo "navigate:          $(curl -s "${H[@]}" -X POST $B/navigate -d "{\"session_id\":\"$SID\",\"url\":\"https://example.com\"}")"
echo "read:              $(curl -s "${H[@]}" -X POST $B/read -d "{\"session_id\":\"$SID\"}" | head -c 300)"
echo "extract a:         $(curl -s "${H[@]}" -X POST $B/extract -d "{\"session_id\":\"$SID\",\"selector\":\"a\"}")"
echo "ssrf navigate:     $(curl -s "${H[@]}" -X POST $B/navigate -d "{\"session_id\":\"$SID\",\"url\":\"http://169.254.169.254/\"}")"
echo "bad selector:      $(curl -s "${H[@]}" -X POST $B/click -d "{\"session_id\":\"$SID\",\"selector\":\"text=More\"}")"
echo "click a:           $(curl -s "${H[@]}" -X POST $B/click -d "{\"session_id\":\"$SID\",\"selector\":\"a\"}")"
