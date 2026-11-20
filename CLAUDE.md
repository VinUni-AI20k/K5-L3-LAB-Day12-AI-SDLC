# Đảo Đèn Lồng — agent guide

3D web game (TypeScript + Three.js) with a headless CLI graded by hidden tests. Correct > pretty.

## Commands
- Install/build: `npm ci && npm run build` (headless → `dist/headless.js`, web → `dist/web`)
- Verify (run before claiming done): `npm run verify` = typecheck + build:headless + vitest
- Headless: `node dist/headless.js --seed 1 --night 1..3 --ticks 600 --out out/run.jsonl [--scenario f] [--inputs f]`
- Play: `npm run dev` (dev) or `npm run play` (built preview)

## Layout
- `src/sim/` pure game logic (`sim.ts` rules, `maps.ts` per-night data and ground heights, `config.ts` numbers). NO imports of three/DOM. Shared by web and headless.
- `src/headless/` contract CLI. `src/web/` renderer + HUD that only READ sim state and push inputs.
- `tests/` vitest; `tests/scenarios/` headless scenario fixtures with assertions.
- Spec, newest wins: `docs/spec/ticket-03.md` (v1.2) > `ticket-02.md` (v1.1) > `contract-v1.md` (v1.0). Numbers are fixed by
  the customer. Do not re-fetch the lab board. Design decisions: `docs/adr/`. Assumptions: `docs/notes/assumptions.md`.
  Current phase plan: `docs/notes/handoff-phase3.md`. Breaking changes go in `CHANGELOG.md`.
- Per-night data (maps, spawn points, lanterns, pads) lives in `src/sim/maps.ts`; headless takes `--night 1|2|3`.

## Hard rules
- Contract output format is exact: field names, event names, tick model, 3-decimal rounding, exit code 2 on bad files.
- Determinism: only `createRng(seed)` from `src/sim/rng.ts`; no Math.random/Date/performance in `src/sim`;
  iterate entities in id order; fixed dt 1/60; round output via `r3()`.
- Gameplay numbers live ONLY in `src/sim/config.ts`; mirror any change in `game.contract.json` (a test checks).
- Never hand-edit expected outputs or weaken an assertion to make a test pass. If a requirement changed,
  update the test AND log the reason in `docs/notes/changes.md`.
- Don't invent requirements. If the spec is silent, follow `docs/notes/assumptions.md` or ask.
- Extras/creative features must not change headless output (web-only or off in headless).
- Small commits, one concern each. Never commit `.env`/keys.

## Harness (details: `docs/notes/harness.md`)
- Workflow per phase: `/phase kickoff N` (criteria + scenarios before code) → build → `/phase release N`.
- New check = new folder in `tests/scenarios/` (format: `tests/scenarios/README.md`), not new test code.
  `"pending"` scenarios were written before the code: un-pend when built, never edit their expected values. Release = zero pending.
- Hooks: Stop blocks finishing while `npm run verify` is red; PreToolUse blocks force-push / tag delete.
- `verify` skill writes evidence to `docs/proof/phase-N/`; `contract-reviewer` subagent reviews (writer never self-approves).
- Screenshots: start "game" from `.claude/launch.json` in the browser pane.
