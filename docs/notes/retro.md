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
- Passing: contract v1.3, bench (avg 275 fps, 1% low 146 fps, load 0.6 s on an Apple M1), soak (0 crashes, memory ratio 1.165 after the fix below), leaderboard, accessibility, packaging; 135 tests, 79 scenario folders, 0 pending, and no Phase 1-3 scenario touched. Open and the author's: demo video, GitHub Release v1.0.0.
- Soak: the first run gave a memory ratio of 2.48 (limit 1.2). Looking at heap versus RSS showed the growth was the V8 optimizing compiler's native memory, not game data; the soak now turns that compiler off and the ratio is 1.165. The margin is small and the pass depends on that setup choice, which is written down.
- Where the AI went wrong: picked an Electron version whose installer fails on this Node; the bench ran at devicePixelRatio 2 on a Retina screen until the reviewer asked (re-measured); bench numbers changed a lot with machine load.
- Next: re-run the bench and soak on a second machine before relying on the numbers.


## Project retro (at CP5)
_Drafted by Claude from `ai-log.md`, `changes.md`, `harness.md` and the proof files; the author must check it, especially the usage percentages._

- **Numbers:**
  - Requirements: 108 acceptance rows across the four proof summaries (50 + 27 + 17 + 14); 106 pass, 2 are open and the author's (GitHub Release, demo video). Some rows are "PASS (manual, self-reported)": audio, play-throughs, accessibility states set with the debug handle.
  - Tests: 135 tests, 79 headless scenario folders (each run twice and byte-compared), 0 pending; unit tests for the pure modules (bench stats and scene, soak, leaderboard, keymap, contract, perf).
  - Commits: 45 on `main`, one concern each, tags `phase-1` to `phase-4`.
  - Usage (Claude Pro, 5-hour window): CP0 8%; end of Phase 1 26%; Phase 2 57%; Phase 3 77%; the window reset before Phase 4, which ended at 13% of the new window (weekly 11% → 15%). The kickoff sessions on Opus are not measured separately. Tokens and cost were **not computed**: only context sizes were recorded (about 257k at Phase 1, 764k at Phase 4), and those are not billing figures.
- **What worked and what didn't when working with AI:**
  - Worked: writing the acceptance scenarios (with hand-derived numbers) before the code; a handoff file with a fixed build order for the cheaper model; one commit per step with `verify` before it; an independent reviewer subagent per phase, which found a real bug in every phase (overlapping safe zones, L6/L7 ids, the soak and bench definitions); a data-driven scenario runner, so a new check is a folder, not new test code.
  - Didn't: screenshots had to use a debug handle to reach states, so they are weaker evidence than play; several defaults (Q-numbers) stayed unconfirmed by the TA; bench numbers depend on the machine; the first kickoff worked from a condensed spec and missed deliverables.
- **AI mistakes and how they were caught** (details in [ai-log.md](ai-log.md)): the first kickoff skipped the PRD (the user asked); a helper emptied two doc files (noticed when grepping); a search-and-replace changed a second key (contract test); the handoff put an event in the wrong step (a scenario failed); an Electron version that cannot install on Node 21 (install error); the soak memory ratio, where the first instinct was to look for a way to pass, which was corrected by looking at heap versus RSS and by writing the literal number down first; a bench at the wrong pixel ratio (reviewer).
- **Most useful harness piece, and why:** the scenario folders plus the Stop hook (`npm run verify`): every rule change turned specific scenarios red, so Phases 2 and 3 re-derived old tests by arithmetic instead of weakening them, and every re-derivation is logged. The `contract-reviewer` subagent is a close second because the writer never approved its own work.
- **Token savings that worked:** a short CLAUDE.md; hooks that print only on failure; Opus only for kickoff decisions and Sonnet for building from a handoff; scenarios as data; condensed spec files instead of re-reading the board.
- **What I'd change next time:**
  - Ask the TA the open questions in the first minutes of each phase, not at the end.
  - Record real token counts and cost per phase instead of context sizes.
  - Test the full game by hand early and record it, instead of relying on debug-handle screenshots.
  - Run bench and soak on a second machine, and decide measurement definitions (soak memory, bench pixel ratio) before the first run.
  - Keep one session per working folder so a Stop hook is not triggered by another session's half-finished work.
