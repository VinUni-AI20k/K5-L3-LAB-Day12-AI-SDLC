# AI harness: what it is, when it's used, how it changed

Tool: Claude Code (desktop, Pro plan). All harness files are kept in the repo and in git history (RULES §7).

| Piece | File | When it is used | Why it exists |
|---|---|---|---|
| Agent guide | `CLAUDE.md` | Loaded automatically in every session | Commands, layout, and hard rules (contract exactness, determinism, no weakening tests). Kept to 40 lines or fewer to save context. |
| Stop hook | `.claude/settings.json` → `scripts/hooks/stop-verify.sh` | Every time the agent tries to finish a turn after src/tests changed | Blocks "done" while `npm run verify` is red. It is silent when green, to save tokens. |
| Git guard hook | `.claude/settings.json` → `scripts/hooks/guard-git.sh` | Before every Bash command | Blocks force-push and tag deletion or rewrite (RULES §7: no history rewrite after tagging). Retagging before a deadline is done by the human. |
| `phase` skill | `.claude/skills/phase/SKILL.md` | `/phase kickoff N` when a ticket is released, and `/phase release N` before tagging | The same SDLC loop runs 4 times. One skill keeps the steps identical and avoids re-typing long prompts. |
| `verify` skill | `.claude/skills/verify/SKILL.md` | Called by `/phase release`, or on demand | Runs all tests and scenarios plus a determinism double-run, and writes `docs/proof/phase-N/summary.md`. |
| `contract-reviewer` subagent | `.claude/agents/contract-reviewer.md` (Sonnet) | After building, before tagging | Independent review against the spec. The writer doesn't approve its own work. |
| Scenario runner | `tests/scenarios/<name>/` + `tests/scenarios.test.ts` | `npm run verify` / CI | Each acceptance criterion is a data folder (scenario, inputs, expect). Adding a case needs no new test code. |
| Preview config | `.claude/launch.json` | When the agent needs screenshots of the real game | Lets the agent start the game in the in-app browser and save visual evidence itself. |
| CI | `.github/workflows/ci.yml` | Every push | Same verify, plus a headless determinism check, independent of anyone's memory. |

Not used on purpose: MCP servers and plugins. Each one adds context cost, and none was needed.

## Model policy (Pro plan, 5-hour window)
- **Sonnet 5.5** is the default for building, rendering, docs, and release.
- **Opus 5.5** is used only for ticket kickoff and the sim-rule core (Phase 1) and rule replacement (Phase 3).
- **`/clear`** at every phase boundary. The handoff is the phase section in `assumptions.md`.

## Harness change history
| Phase | Change | Trigger (what went wrong / why) |
|---|---|---|
| CP0 | Initial: CLAUDE.md, Stop hook, verify skill, contract-reviewer | Plan: enforce verification and independent review from the start |
| CP0 | Added phase skill, git guard hook, scenario runner, launch.json, this file | Review of rubric B/C gaps before the lab started |
| 1 | Scenario runner: global event-before-snapshot check, `absent_snapshots` key | The `contract-reviewer` found the runner could not assert a missing snapshot or event order |
| 2 | Scenario runner: `night`, `pending` (skipped but listed; release requires zero), `$range` matcher | Phase 2 scenarios are written before the code and must not turn verify red, so the Stop hook doesn't block. Some ticket rules only give bounds |
| 2 | CLAUDE.md: v1.1 spec, `maps.ts`, the `--night` flag, the pending rule. Phase skill: zero-pending release, handoff file | DoD: the agent guide and skills must be updated for the new scope |
| 2 | New `docs/notes/handoff-phase2.md`: Opus does the kickoff, Sonnet builds from a fixed order and prompt | Pro quota: 26% used in Phase 1. Keeps the expensive model on decisions only |
| 3 | CLAUDE.md: spec precedence (v1.2 > v1.1 > v1.0), `docs/adr/`, `CHANGELOG.md`, current handoff | Phase 3 replaces rules. The agent must know which spec wins |
| 3 | Lesson (not yet fixed): with two sessions in one folder, each session's Stop hook fires on the other's half-done work. The Opus kickoff session was blocked by the Sonnet session's red p1 scenarios | Seen during the Phase 2 build, while Phase 3 waited for kickoff. Fix options: run the kickoff session in its own git worktree, or have the hook check only files that session touched |
