#!/usr/bin/env bash
# Claude Code PreToolUse(Bash) hook: block history/tag rewriting (RULES §7, SUBMISSION §5).
# Exit 2 + stderr => the command is refused and the agent is told why. Humans can still run these themselves.
cmd="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command??"")}catch{}})')"
[ -z "$cmd" ] && exit 0
block() { echo "BLOCKED by guard-git hook: $1. Tags/history must not be rewritten by the agent; ask the user to do it manually if truly needed." >&2; exit 2; }
# Look only at git invocations (split on ; && || |).
while IFS= read -r part; do
  part="$(printf '%s' "$part" | sed -E 's/^[[:space:]]+//')"
  case "$part" in git\ *|*\ git\ *) ;; *) continue ;; esac
  if printf '%s' "$part" | grep -Eq 'git([[:space:]]+-[^[:space:]]+)*[[:space:]]+push\b'; then
    printf '%s' "$part" | grep -Eq '(^|[[:space:]])(--force(-with-lease)?(=[^[:space:]]*)?|-f|--mirror|--delete|-d|--prune)([[:space:]]|$)' && block "force/delete push"
    printf '%s' "$part" | grep -Eq '[[:space:]]\+[^[:space:]]+|[[:space:]]:[^[:space:]]+' && block "force refspec (+ref) or remote delete (:ref)"
  fi
  if printf '%s' "$part" | grep -Eq 'git([[:space:]]+-[^[:space:]]+)*[[:space:]]+tag\b'; then
    printf '%s' "$part" | grep -Eq '(^|[[:space:]])(-d|--delete|-f|--force)([[:space:]]|$)' && block "tag delete/overwrite"
  fi
done < <(printf '%s\n' "$cmd" | sed -E 's/(&&|\|\||;|\|)/\n/g')
exit 0
