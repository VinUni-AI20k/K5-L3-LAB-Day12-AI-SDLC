---
name: phase
description: Run the per-phase SDLC loop. "kickoff N" when a new ticket (PRD-0 / Ticket-0N) is released, to turn it into assumptions, acceptance criteria and a scenario list before any code. "release N" before tagging phase-N, to verify, record evidence, notes and tokens, and tag. Use whenever the user mentions a new phase/ticket or tagging a phase.
---

# Phase loop

Arguments: `kickoff N` or `release N`. Ask for the ticket text if the user hasn't pasted it. Never fetch the lab board yourself.

## kickoff N (target: ≤ 12 min, no production code)
1. Save the ticket as a condensed summary in `docs/spec/ticket-0N.md`. Keep every number, name, CLI flag and output field exactly as written. For Phase 1 the spec is `docs/spec/contract-v1.md`.
2. Compare it with `docs/notes/assumptions.md` and the current contract. List under "Phase N":
   - what is **new**;
   - what is **clarified** (an old assumption is confirmed or overturned);
   - what **replaces** an old rule. For each replaced rule, list the tests, scenarios and docs it affects.
3. List the remaining ambiguities as questions for the phase TA, each with the default you'll assume.
4. Write acceptance criteria as rows in the format "do A → see B". Give each one an ID (`P{N}-01`…) and a planned scenario folder or unit test.
5. Create the scenario folders (`tests/scenarios/p{N}-*/`) **before** any implementation. Expected values must be derived from the spec and tuning, never copied from program output. Use the format in `tests/scenarios/README.md`.
6. If the contract changed, update `docs/spec/`, `game.contract.json`, `src/sim/config.ts` and the headless output together.
7. Log any rule change in `docs/notes/changes.md`. Any old test that the change makes wrong gets fixed or retired **with the reason**.
8. Stop and show the user the criteria list and the questions. Wait for approval before building.

## release N (target: ≤ 8 min)
1. Run `npm run verify`. It must be green, or the failures must be written up honestly as FAIL / NOT DONE.
2. Run the `verify` skill for phase N. It writes `docs/proof/phase-N/summary.md` and includes a regression check of every earlier phase's scenarios.
3. Ask the `contract-reviewer` subagent to review `phase-(N-1)..HEAD`, or the whole tree for N=1. Fix any high-severity findings or record them.
4. For visual requirements, use `.claude/launch.json` ("game") in the browser pane and save 1–3 screenshots into `docs/proof/phase-N/img/`. Name each screenshot after the requirement it proves.
5. Update the notes:
   - README: controls, scoring, the "Sáng tạo của tôi" section, and any null tuning.
   - `retro.md` → Phase N evaluation (3–5 lines).
   - `ai-log.md` → this phase's row. Ask the user for the % of the 5-hour limit used, and add any AI mistakes.
   - `harness.md` → harness changes this phase, if any.
6. Commit, then give the user the exact tag commands: `git tag phase-N && git push origin HEAD phase-N`. Tagging is done only with the user's approval.
