#!/usr/bin/env bash
# ai.spaincos.com LAUNCH GATE — run this before every push and after every deploy.
#   ./qa/run.sh                           # prelaunch gate against LIVE https://ai.spaincos.com
#   ./qa/run.sh --local                   # against a local build (http://localhost:8765)
#   ./qa/run.sh --hook pre-push           # quiet mode for the git hook (summary only)
#   ./qa/run.sh --eval-replay [DEPLOY_ID] # 10-query gateway regression gate only (+ history append)
#   ./qa/run.sh --post-deploy [DEPLOY_ID] # post-deploy battery: prelaunch.py + 10-query eval-replay.py
# Exit 0 = all green. Exit 1 = red: FIX FIRST, do not push/deploy.
set -uo pipefail
cd "$(dirname "$0")/.."
BASE="https://ai.spaincos.com"
QUIET=""
MODE="prelaunch"
DEPLOY_ID="${DEPLOY_ID:-}"
case "${1:-}" in
  --local)        BASE="http://localhost:8765" ;;
  --hook)         QUIET="1" ;;
  --eval-replay)  MODE="eval-replay"; DEPLOY_ID="${2:-$DEPLOY_ID}" ;;
  --post-deploy)  MODE="post-deploy"; DEPLOY_ID="${2:-$DEPLOY_ID}" ;;
esac
if [ "$MODE" = "eval-replay" ]; then
  exec python3 qa/eval-replay.py ${DEPLOY_ID:+--deploy-id "$DEPLOY_ID"}
fi
if [ "$MODE" = "post-deploy" ]; then
  python3 qa/prelaunch.py --base "$BASE"; EC1=$?
  python3 qa/eval-replay.py ${DEPLOY_ID:+--deploy-id "$DEPLOY_ID"}; EC2=$?
  [ $EC1 -ne 0 ] || [ $EC2 -ne 0 ] && { echo "POST-DEPLOY BATTERY: RED (prelaunch=$EC1, eval-replay=$EC2)"; exit 1; }
  echo "POST-DEPLOY BATTERY: GREEN"; exit 0
fi
if [ -n "$QUIET" ]; then
  OUT=$(python3 qa/prelaunch.py --base "$BASE" 2>&1); EC=$?
  echo "$OUT" | tail -5
  [ $EC -ne 0 ] && { echo "PRE-LAUNCH GATE: RED — push blocked. Full log:"; echo "$OUT"; exit 1; }
  echo "PRE-LAUNCH GATE: GREEN"; exit 0
fi
exec python3 qa/prelaunch.py --base "$BASE"
