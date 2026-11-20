# Đảo Đèn Lồng

> **Demo video:** _(added at v1.0.0)_

A small 3D third-person game, built for the Day 12 AI-SDLC lab. You play Mây, a young lantern keeper. Gather fireflies and relight the Great Lanterns before dawn, while avoiding the Bóng Mực (ink shades).

Lab brief and rules: [docs/lab/](docs/lab/README.md). Contract summary: [docs/spec/contract-v1.md](docs/spec/contract-v1.md).

## Run (Node ≥ 20)
```bash
npm ci
npm run build
npm run play
```

## Headless (Test Contract v1.0)
```bash
node dist/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

## Tests
Run `npm run verify`. It does a typecheck, builds the headless bundle, runs the unit and scenario tests, and runs the determinism checks.

## Controls
| Key | Action |
|---|---|
| W A S D | Move (relative to the camera) |
| Space | Jump (vertical only; it does not avoid shades) |
| E | Deposit carried fireflies into the nearest unlit lantern within 3 m |
| F | Light pulse: costs 1 carried firefly, stuns and pushes shades within 6 m |
| ← → or drag the mouse | Turn the camera |
| R / "Chơi lại" button | Play again after a win or loss |

Fireflies are picked up automatically when you walk within 1.5 m (up to 10 carried, in firefly-id order).

## Scoring
Values are in `game.contract.json` → `tuning.score` (and `src/sim/config.ts`).
- +10 per firefly **deposited** (not on pickup), +100 when a lantern is lit, +20 per shade stunned by a pulse.
- On a **win only**: +2 per whole second left (rounded down) and +50 per flame left, added on the tick of `game_over`. A loss gets no bonus, so `end.score` is the final score.
- Score is always an integer.

## Rules and assumptions (the PRD leaves these open; full list in [docs/notes/assumptions.md](docs/notes/assumptions.md))
- One night of 300 s on a round island of radius 40 m. Five lanterns L1..L5 on a ring of radius 25 m, 72° apart (L1 at (0,0,25)). 3 flames, 30 fireflies (one more every 4 s if fewer than 30).
- **Pickup:** automatic, in firefly-id order. When carrying 10 you walk through fireflies without picking them up.
- **Deposit:** `min(carried, 5 - deposited)`; the rest stays with you. A lantern needs 5.
- **Hit:** a shade within 1 m costs 1 flame and drops `floor(carried × 0.5)` fireflies (lost, not re-scattered). Then 1.5 s of invulnerability. Stunned shades cannot hit.
- **Pulse:** needs 1 carried firefly and no cooldown (1 s). Shades within 6 m are stunned 2 s and pushed 4 m away. A pulse with nobody in range still happens and still costs. Stunning an already-stunned shade scores again.
- **Shades:** first one at 5 s, then every 30 s, up to 5, at the island edge. They chase on the ground plane at 4 m/s. They cannot enter 6 m around a **lit** lantern; if one is inside when the lantern lights (or a pulse pushes it in), it is moved to the nearest point outside every lit zone.
- **Falling:** off (`fall_enabled: false`). The island edge is a wall.
- **End:** all lit = win, else no flames = loss, else dawn (time 0) = loss, checked in that order.
- Concepts we do not have: `dash` (accepted in inputs and ignored). No tuning value is `null`.

## Sáng tạo của tôi
_Phase 1: nothing beyond the core yet._ Web-only polish that does not touch `src/sim` or headless output: the island and sky warm up as lanterns are lit, a ring of light on a pulse, a red flash on a hit.

## Project notes
- Assumptions: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Changes: [docs/notes/changes.md](docs/notes/changes.md)
- AI log: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Retro: [docs/notes/retro.md](docs/notes/retro.md)
- Evidence: [docs/proof/](docs/proof/)
- AI harness: [docs/notes/harness.md](docs/notes/harness.md) lists every piece, when it's used and how it changed.
  - [CLAUDE.md](CLAUDE.md)
  - Hooks in `.claude/settings.json`: a Stop hook that runs `npm run verify`, and a git guard
  - Skills: `.claude/skills/phase`, `.claude/skills/verify`
  - Subagent: `.claude/agents/contract-reviewer.md`
  - Scenario runner: [tests/scenarios/](tests/scenarios/README.md)
