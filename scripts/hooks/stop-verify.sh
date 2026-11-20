#!/usr/bin/env bash
# Claude Code Stop hook: block the agent from finishing while `npm run verify` is red.
# Exit 2 + stderr => Claude is told to keep working. Prints nothing when green (saves tokens).
input="$(cat)"
cd "$(dirname "$0")/../.." || exit 0
# Avoid an endless loop: if we already blocked once this turn, let it stop but keep the warning visible.
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  npm run verify --silent >/dev/null 2>&1 || echo "verify still RED — report this honestly to the user." >&2
  exit 0
fi
# Skip when nothing in code/tests changed since HEAD (pure planning/chat turns).
if git diff --quiet HEAD -- src tests game.contract.json package.json 2>/dev/null \
   && [ -z "$(git ls-files --others --exclude-standard src tests)" ]; then
  exit 0
fi
if ! out="$(npm run verify --silent 2>&1)"; then
  printf 'npm run verify is RED. Fix it before finishing (do not weaken tests):\n%s\n' "$(printf '%s' "$out" | tail -40)" >&2
  exit 2
fi
exit 0
