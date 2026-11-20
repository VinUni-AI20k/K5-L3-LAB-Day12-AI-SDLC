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

## Headless (Test Contract v1.1)
```bash
node dist/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```
`--night` is 1, 2 or 3. Bad scenario/inputs files exit with code 2.

## Tests
Run `npm run verify`: typecheck, headless build, then all tests: 65 scenario folders under `tests/scenarios/` (each run twice and byte-compared), contract hygiene, CLI checks and a performance test (a full Night 3 in about 0.4 s; limit 30 s).

## Controls
| Key | Action |
|---|---|
| W A S D | Move (relative to the camera) |
| Space | Jump (only when on the ground) |
| Shift | Dash: 14 m/s for 0.2 s (2.8 m) in the move direction, or the facing direction when standing still; 1.5 s cooldown |
| E | Deposit carried fireflies into the nearest unlit lantern within 2 m |
| F | Light pulse: costs 3 fireflies, 3 s cooldown, stuns and pushes shades within 5 m |
| Esc / P | Pause menu (Continue, Replay night, Settings, Back to menu) |
| ← → or drag the mouse | Turn the camera (sensitivity in Settings) |
| F3 | FPS counter |
| R | Replay the night after a loss |

Fireflies are picked up automatically within 1 m (and 1.5 m in height), up to 10 carried, in firefly-id order. Volume and mouse sensitivity are saved in the browser.

## The three nights
| Night | Island | Lanterns | Time | Extras |
|---|---|---|---|---|
| 1 Đảo Bến | round, r 40 | 5 | 300 s | |
| 2 Đảo Cau | two islands r 28 joined by a bamboo bridge | 6 | 330 s | launch pads, Gió Lạc drifters, Bùa Gió charm |
| 3 Đảo Chuông | r 45 with 3 tiers, ramps, bell tower | 7 | 360 s | wind gusts, drifters, 2 charms, launch pad to the top tier |

Winning Night 3 shows the Dawn screen with the total of the nights won. A lost night can be replayed.

## Scoring
Values are in `game.contract.json` → `tuning.score` (and `src/sim/config.ts`).
- +10 per firefly **deposited**, +100 per lantern lit, +5 per shade hit by a pulse (every time, also stunned ones).
- On a **win only**: `floor(seconds left) × 2 + 50 × flames left`, added on the tick of `game_over`. A loss gets no bonus.
- Score per night is an integer; the web game sums the nights won.

## Rules and assumptions (Ticket-02 fixes the numbers; where it is silent see [docs/notes/assumptions.md](docs/notes/assumptions.md))
- **Hit:** a non-stunned shade within 1 m (and 1.5 m in height) costs 1 flame, drops `floor(carried / 2)` fireflies onto a 1.5–2.5 m ring (they live 480 ticks and can be picked up again), then 90 ticks of invulnerability. The shade recoils 2 m. A fall (below Y −10) costs 1 flame and all carried fireflies, waits 60 ticks, then respawns at the start with 90 ticks of invulnerability.
- **Shades:** `spawning` (60 ticks, harmless) → `wander` (stays put) → `chase` within 12 m, give up beyond 18 m; `recoil` and `stunned` as above. 2 spawn at 5 s, then one per 8 / 7 / 6 s (cap 6 / 8 / 10) on fixed points at least 15 m away. They cannot enter 6 m around a **lit** lantern; one already inside is pushed out at 0.2 m per tick, harmlessly.
- **Pulse:** hits shades whose 3D distance from Mây's feet + 0.8 m is at most 5; stun 120 ticks, 4 m push over 15 ticks.
- **Charm:** 600 ticks of 7.2 m/s running and no dash cooldown; respawns 2700 ticks after pickup.
- **Drifters (Nights 2–3):** at most 2, spawn at ticks 1200k. Chase Mây when carrying ≥ 5 within 15 m, steal 3 once, flee; a pulse makes a chasing one flee and makes a fleeing one drop what it stole.
- **Wind (Night 3):** a 5 s gust every 30 s (from tick 1800) pushes Mây at 2 m/s.
- **End:** no flames = loss, else all lit = win (even on the dawn tick), else dawn = loss.
- **Pause:** `tick` keeps counting but time, timers and spawns stop (`sim_tick` shows the frozen game clock).
- No tuning value is `null`.

## Sáng tạo của tôi
Nothing is added beyond the ticket's requirements. Web-only polish that does not touch `src/sim` or headless output: the sky and fog warm up as lanterns are lit, a ring of light on a pulse, a red flash on a hit, a blinking warning on dropped fireflies about to vanish.

## Known gaps
- Audio (synthesised with WebAudio, `src/web/audio.ts`) was never listened to by the author's agent: see the manual check list in `docs/proof/phase-2/summary.md`.
- No gust warning (leaves) is drawn before a wind gust.

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
