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
- Passing: all 65 scenario folders (23 `p2-*`, 41 `p1-*` re-derived or kept, `p0-smoke`) and 73 tests green; perf 0.4 s for a full Night 3; 3-night web flow, pause, settings, full HUD, palette, 60 FPS at 1280x720. Audio and a full play-through were checked by the author by hand (self-reported); no wind visual.
- Phase 1 held up: every p1 scenario was re-derived by arithmetic from the v1.1 numbers (22 changed, 1 deleted) and nothing was weakened.
- Where the AI went wrong: step 4 needed `night_start` that the handoff scheduled for step 7; the working directory changed after a `cd` in a command; web teleports were used for screenshots. See `ai-log.md`.
- Next: ask the TA about the open defaults before Phase 3, and have a human play a full night.
### Phase 3
- Passing: all 79 scenario folders (15 `p3-*`) and 87 tests green; fuel model, dawn win rule, drain shades, v1.2 contract, web fuel bars and colour-blind mode. Author playtested by hand (self-reported); real drain was verified in headless scenarios only.
- Earlier phases: 17 scenarios re-derived by arithmetic and 1 deleted because the ticket replaced the rules; each has a line in `changes.md`. The p3 expected values were never changed.
- Where the AI went wrong: my `per_mote` search-and-replace also changed `fuel_per_mote` (caught by the contract test); the perf test still assumed 21,600 ticks.
- Next: ask the TA about Q3-1..Q3-8.
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
