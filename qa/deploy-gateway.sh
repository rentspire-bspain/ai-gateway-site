#!/bin/bash
# qa/deploy-gateway.sh — deploy gateway-chat with a MANDATORY post-deploy health gate.
# v363 (owner directive 2026-11-27: "add a post-deploy health check that runs even when
# prelaunch is skipped"). The v338 incident: a broken bundle shipped and 500'd every
# request for ~8 minutes because SKIP_PRELAUNCH bypassed every gate. This gate is
# UNCONDITIONAL: it runs after every deploy of this script, no env var disables it.
#
# Usage: bash qa/deploy-gateway.sh   (from repo root; stages from supabase/functions,
#        injects the GATEWAY_TOKEN_B bundle fallback from /tmp/gtb.txt, deploys, then
#        health-checks a real authenticated ask; exits non-zero and files a GitHub
#        issue on failure.)
set -uo pipefail
cd "$(dirname "$0")/.."
SLUG=gateway-chat
PROJ=bnxermyboeigvwonfrzx
STAGE=/tmp/dep-gw-live
B=$(cat /tmp/gtb.txt 2>/dev/null || echo "")

echo "[deploy] staging from supabase/functions"
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp -r supabase/functions "$STAGE/functions"
echo '{"entrypoint_path": "functions/gateway-chat/index.ts", "verify_jwt": false, "name": "gateway-chat"}' > "$STAGE/metadata.json"

if [ -n "$B" ]; then
python3 - "$STAGE" "$B" <<'EOF'
import sys
p = sys.argv[1] + "/functions/gateway-chat/index.ts"
s = open(p).read()
a = 'const CM_TOKEN: string = Deno.env.get("GATEWAY_TOKEN_B") || GW_TOKEN;'
assert a in s, "token anchor line not found — check the bundle patch"
open(p, "w").write(s.replace(a, 'const CM_TOKEN: string = Deno.env.get("GATEWAY_TOKEN_B") || "%s";' % sys.argv[2], 1))
EOF
echo "[deploy] token fallback injected"
fi

cd "$STAGE"
ARGS=()
for f in $(find functions -type f \( -name '*.ts' -o -name '*.js' \) | sort); do
  d=$(sha256sum "$f" | cut -d' ' -f1)
  ARGS+=(-F "file=@$f;filename=$f;x-digest=$d")
done
echo "[deploy] deploying $SLUG"
RESP=$(pplx credentials run custom-cred:d2732368-0d3a-4666-a914-1a195e4180d9@api.supabase.com -- \
  curl -sS -m 600 -X POST "https://api.supabase.com/v1/projects/$PROJ/functions/deploy?slug=$SLUG" \
  -F "metadata=<metadata.json;type=application/json" "${ARGS[@]}")
echo "$RESP" | grep -o '"version":[0-9]*' | head -1
if ! echo "$RESP" | grep -q "ACTIVE" || echo "$RESP" | grep -q "Failed to bundle"; then echo "[deploy] FAILED: $RESP"; exit 1; fi

# ---------- MANDATORY POST-DEPLOY HEALTH GATE (cannot be skipped) ----------
cd - >/dev/null
echo "[health] waiting for cold start, then live smoke ask"
until OUT=$(python3 - <<'EOF'
import sys, json
sys.path.insert(0, "qa")
import prelaunch
tok = prelaunch.mint_token()
st, body, _ = prelaunch.http("https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/gateway-chat", 90,
    json.dumps({"messages":[{"role":"user","content":"Health check: what is 17 times 23?"}],"thread_id":"deploy-health","mode":"concise"}).encode(),
    {"Authorization": f"Bearer {tok}", "apikey": prelaunch.ANON, "content-type": "application/json"})
print(st)
print(body[:400])
EOF
) && [ "$(echo "$OUT" | head -1)" = "200" ]; do sleep 10; done
if ! echo "$OUT" | grep -q "391"; then
  echo "[health] FAIL — gateway did not answer correctly:"
  echo "$OUT"
  gh issue create -t "P0: gateway-chat deploy health gate FAILED" -b "Post-deploy smoke ask failed. Response attached. Deploy was via qa/deploy-gateway.sh; investigate immediately — the warden fast lane has also detected this within 60s." 2>/dev/null || true
  exit 1
fi
echo "[health] PASS — gateway answered correctly (391)"
