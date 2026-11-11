#!/usr/bin/env bash
# ai.spaincos.com LAUNCH GATE — run this before every push and after every deploy.
#   ./qa/run.sh                 # against LIVE https://ai.spaincos.com
#   ./qa/run.sh --local         # against a local build (http://localhost:8765)
#   ./qa/run.sh --hook pre-push # quiet mode for the git hook (summary only)
# Exit 0 = all green. Exit 1 = red: FIX FIRST, do not push/deploy.
set -uo pipefail
cd "$(dirname "$0")/.."
BASE="https://ai.spaincos.com"
QUIET=""
case "${1:-}" in
  --local) BASE="http://localhost:8765" ;;
  --hook)  QUIET="1" ;;
esac
if [ -n "$QUIET" ]; then
  OUT=$(python3 qa/prelaunch.py --base "$BASE" 2>&1); EC=$?
  echo "$OUT" | tail -5
  [ $EC -ne 0 ] && { echo "PRE-LAUNCH GATE: RED — push blocked. Full log:"; echo "$OUT"; exit 1; }
  echo "PRE-LAUNCH GATE: GREEN"; exit 0
fi
exec python3 qa/prelaunch.py --base "$BASE"
