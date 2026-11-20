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
| 1 | Sonnet 5.5 (build) + `contract-reviewer` subagent | CP0 ended at 8%; end of Phase 1 = **26%** (read from the usage API on 2026-11-20; the start of this window was not measured) | context ≈ 257k tokens at release (not a billing figure) | not computed | kickoff with 43 scenarios before code, sim + headless, web client, release with independent review | scenarios as data folders (no new test code); read-only reviewer; condensed spec |
| 2 | Opus 5.5 (kickoff, earlier session) + Sonnet 5.5 (build, release) + `contract-reviewer` | Phase 1 ended at 26%; at Phase 2 release = **57%** (read from the usage API; includes everything in the window since, the kickoff session is not separately measured) | context ≈ 500k tokens at release (not a billing figure) | not computed | steps 1-9 of the handoff: contract v1.1, maps/physics, motes/charms, lanterns/pulse/shades, drifters, pause, I/O, web nights/menus, HUD/audio | handoff file with a fixed build order; scenarios written before code; one commit per step |
| 3 | Opus 5.5 (kickoff, earlier) + Sonnet 5.5 (build, release) + `contract-reviewer` | Phase 2 ended at 57%; at Phase 3 release = **77%** (usage API; same window, kickoff not separately measured) | context ≈ 615k tokens at release (not a billing figure) | not computed | steps 1-4 of the handoff: contract v1.2, fuel/dawn model, shades, web | handoff file with a fixed build order; ADR decided the model before coding; scenarios written first |
| 4 | Opus 5.5 (kickoff, earlier) + Sonnet 5.5 (build, release) + `contract-reviewer` | the 5-hour window reset between Phase 3 and 4, so there is no continuous %: Phase 3 ended at 77% of the old window; at Phase 4 release the new window shows **13%**, and the weekly limit went from 11% (Phase 3) to **15%** | context ≈ 764k tokens at release (not a billing figure) | not computed | steps 1-6 of the handoff: contract v1.3, soak, Electron bench, leaderboard, accessibility, packaging and docs | handoff with a fixed build order; tests written before pure modules; hand-computed expectations |

## Main prompts (short)
Record the opening prompt of each phase and any prompt that redirected the agent.

## AI mistakes caught
| When | What the AI got wrong | How it was detected | Harness change |
|---|---|---|---|
| Phase 1 kickoff | Wrote acceptance scenarios from the condensed spec without reading PRD-0 on the board | User asked "have you read PRD-0?" | Kickoff now reads the board once (the user-approved exception to "do not re-fetch"); noted in `assumptions.md` |
| Phase 1 build | Scenario `p1-end-priority-flames` assumed a case the TA's safe-zone rule makes impossible | Scenario failed while the sim was right; checked the geometry | Replaced with `p1-lit-expels-shade`, logged in `changes.md` |
| Phase 1 release | A doc-edit helper opened files for writing before reading, emptying `changes.md` and `retro.md` | Noticed when grepping the retro text (empty file) | Rebuilt both; checking file sizes after doc edits |
| Phase 1 release | Counted 36 `p1-*` scenarios when there were 35 | Summary generator listed 36 folders including `p0-smoke` | Docs corrected |
| Phase 2 step 4 | Handoff listed `p2-n1-schedule` in step 4 but it needs `night_start` from step 7 | Scenario failed on a missing event | Pulled that one event forward and noted it in changes.md |
| Phase 2 step 8 | A `cd` into docs/ left the shell in the wrong directory for later commands | Environment notice | Use absolute paths or a subshell |
| Phase 3 step 1 | A search-and-replace of `per_mote: 10` also changed `fuel_per_mote` | Contract test failed (config vs json) | Check substring hits after bulk edits |
| Phase 4 step 1 | Picked Electron 45.2.3 (newest allowed) without checking the installer on this Node | `ERR_REQUIRE_ESM` on install | Pinned 39.8.10; recorded in assumptions.md |
| Phase 4 step 2 | Soak memory ratio came out at 2.48; first instinct was to look for a way to pass | Reviewed heap vs RSS, then reported the literal number as NOT MET | Author decision recorded |
| Phase 4 step 6 | Bench re-runs gave half the committed fps | Re-ran in repo and clone | Documented the variance, did not replace bench.json |
