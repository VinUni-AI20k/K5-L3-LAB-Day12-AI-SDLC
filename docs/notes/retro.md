# Evaluation and retro

## Per-phase evaluation (written at each `/phase release N`)
Three to five lines per phase:
- Which requirements pass and which don't
- Whether anything from earlier phases broke
- Where the AI went wrong
- What to adjust next phase

### Phase 1
- Passing: all 43 scenario folders (42 `p1-*` + `p0-smoke`) plus contract/CLI tests (49/49 green); web game playable with HUD, win/lose and replay. Not done: manual full play-through, tag. `contract-reviewer` found 1 high (overlapping safe zones) and 1 medium bug (duplicate shade ids); both fixed test-first.
- First kickoff pass used only the condensed spec and missed the deliverables list in PRD-0 (README, "Sáng tạo của tôi"); caught when the user asked. Reading the board once at kickoff is cheaper than a late fix.
- One test premise was wrong, not the code: "last lantern lit and last flame lost in the same step" cannot happen under the safe-zone expel rule. Replaced with a test of the rule itself.
- Process slip: a helper of mine truncated `changes.md` and `retro.md` while editing them; noticed during release and rebuilt from the session. Lesson: use read-then-write, check `git diff`/size after doc edits.
- Next: ask the TA about the remaining Q6..Q9, Q11, Q13..Q15 before Phase 2 so they stop being guesses.

### Phase 2
### Phase 3
### Phase 4

## Project retro (at CP5)
- **Numbers:**
  - requirements passed / total
  - tests and scenarios count
  - commits
  - % of the 5-hour limit used, per phase and total
- **What worked and what didn't when working with AI:**
- **AI mistakes and how they were caught** (details in [ai-log.md](ai-log.md)):
- **Most useful harness piece, and why:**
- **Token savings that worked:**
- **What I'd change next time:**
