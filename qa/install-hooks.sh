#!/usr/bin/env bash
# Install the pre-launch gate as a git pre-push hook (run once per clone):
#   bash qa/install-hooks.sh
mkdir -p .git/hooks
cat > .git/hooks/pre-push << 'HOOK'
#!/usr/bin/env bash
# Pre-launch regression gate: every push to master must pass the fleet.
# Bypass (emergencies only): SKIP_PRELAUNCH=1 git push ...
[ -n "${SKIP_PRELAUNCH:-}" ] && exit 0
PRELAUNCH_SKIP_INTEGRITY=1 exec "$(git rev-parse --show-toplevel)/qa/run.sh" --hook pre-push
HOOK
chmod +x .git/hooks/pre-push
echo "pre-push gate installed"
