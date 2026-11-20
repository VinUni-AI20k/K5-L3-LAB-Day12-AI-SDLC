# AI usage log

**Tool:** Claude Code (desktop).

**Plan:** Claude Pro. Usage is limited by a 5-hour window, so the main metric is the **% of the 5-hour limit** from Settings → Usage, read at the start and end of each phase.

**API-equivalent prices**, used for the approximate cost column (per 1M tokens, input / output):

| Model | Input | Output |
|---|---|---|
| Opus 5.5 | $4 | $20 |
| Sonnet 5.5 | $2 | $10 |
| Haiku 5.5 | $0.10 | $0.50 |

**Model policy:** see [harness.md](harness.md). Sonnet is the default. Opus is used only for kickoff and sim-rule work.

| Phase | Models used | % of 5-hour limit (start → end) | Tokens, approx (in / out) | Approx API-equivalent cost | Main prompts / tasks | Savings applied |
|---|---|---|---|---|---|---|
| CP0 prep | Opus 5.5 | 0 → 8% (planning and scaffold) | | | read the lab docs and the PRD-0 board, plan, scaffold, harness | spec condensed into one file; CLAUDE.md is 40 lines or fewer; hooks print only on failure |
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |

## Main prompts (short)
Record the opening prompt of each phase and any prompt that redirected the agent.

## AI mistakes caught
| When | What the AI got wrong | How it was detected | Harness change |
|---|---|---|---|
| Phase 1 kickoff | Wrote acceptance scenarios from the condensed spec without reading PRD-0 on the board | User asked "have you read PRD-0?" | Kickoff now reads the board once (the user-approved exception to "do not re-fetch"); noted in `assumptions.md` |
| Phase 1 build | Scenario `p1-end-priority-flames` assumed a case the TA's safe-zone rule makes impossible | Scenario failed while the sim was right; checked the geometry | Replaced with `p1-lit-expels-shade`, logged in `changes.md` |
| Phase 1 release | A doc-edit helper opened files for writing before reading, emptying `changes.md` and `retro.md` | Noticed when grepping the retro text (empty file) | Rebuilt both; checking file sizes after doc edits |
| Phase 1 release | Counted 36 `p1-*` scenarios when there were 35 | Summary generator listed 36 folders including `p0-smoke` | Docs corrected |
