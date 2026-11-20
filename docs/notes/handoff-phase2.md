# Phase 2 handoff: build with Sonnet

Kickoff was done on Opus. It produced:
- the spec: `docs/spec/ticket-02.md`
- the decisions and acceptance criteria: `docs/notes/assumptions.md` → Phase 2
- 21 scenarios written before the code: `tests/scenarios/p2-*`, all marked `pending`

Nothing in `src/` has changed yet.

## How to start
1. In Claude Code: `/clear`, then `/model sonnet`. Keep effort at medium.
2. Paste the prompt below.
3. Watch the first 2–3 commits. If it drifts (inventing rules, editing expected values, touching `src/web` before the sim is done), stop it and point at this file.
4. Switch to Opus (`/model opus`) only if one sim bug survives two Sonnet attempts. Switch back right after.

## Prompt to paste (Sonnet)
```
Phase 2 build. Read docs/notes/handoff-phase2.md, docs/spec/ticket-02.md and docs/notes/assumptions.md (Phase 2 section) first.
The decisions there are final — do not re-decide them or invent rules; if something is truly unspecified, pick the simplest option,
add it to the Phase 2 "New or updated assumptions" list and tell me.
Follow the build order in the handoff file exactly, one commit per step, running `npm run verify` before each commit.
For each p2 scenario: remove its "pending" flag only when the feature is built, never change its expected values
(if you think one is wrong, stop and tell me why, with the arithmetic). Re-derive p1 scenarios from the v1.1 numbers by
arithmetic, never by pasting program output; log every changed/deleted p1 scenario in docs/notes/changes.md.
Headless correctness first (steps 1–7), web after. Stop after step 7 and show me the verify result before starting step 8.
```

## Build order (one commit each; time boxes assume the 1h mark is now)
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | **Contract v1.1 numbers.** Set TUNING to the standard values (table below). Bump `game.contract.json` to 1.1 with the same values. Update `contract.test.ts` to expect "1.1" and the 5 new keys. Move per-night data into a new `src/sim/maps.ts` (below). | `config.ts`, `maps.ts`, `game.contract.json`, `tests/contract.test.ts` | contract test green (p1 scenarios may go red; that's step 7) |
| 2 | **Map and physics core.** Add `groundHeight(night, x, z)` returning a number or `null`, plus wall blocking (step up > 0.25 m is blocked), the bell tower, the bridge, ramps and tiers. Add instant-velocity running, jump only when grounded, gravity, and fall below Y −10 with a 60-tick wait then respawn. Add dash with facing, launch pads and wind. Keep all counters in ticks (see assumptions → Timers). | `sim.ts`, `maps.ts` | `p2-dash`, `p2-fall`, `p2-launch-pad`, `p2-wind` un-pended and green |
| 3 | **Motes and charms.** Fixed spawn points (20 of them, seeded sample), respawn at 240k on an empty point if random motes < 30, `kind` and `ttl_s`, pickup with the height rule, and charms (speed 7.2, no dash cooldown, 2700-tick respawn). | `sim.ts` | `p2-pickup-radius`, `p2-charm`, `p2-night2-map`, `p2-night3-map` |
| 4 | **Lanterns, pulse and shades.** Interact radius 2 with the id tie-break. Safe-zone push-out at 0.2 m/tick with no damage. Pulse v1.1 (3D, cost 3, push over 15 ticks, refresh on re-hit, +5). Shade states `spawning` (60 ticks after a scheduled spawn: no damage, no move) `→ wander ↔ chase`, plus `recoil` and `stunned`. Scenario shades skip `spawning` and start in `wander`, unless the scenario sets `state`. Spawn schedule per night on points ≥ 15 m away. Hits with the dropped-mote ring and recoil. End order: no_flames → all_lit → dawn. | `sim.ts` | `p2-lantern-cost`, `p2-deposit-tie`, `p2-pulse-*`, `p2-hit-drop-ring`, `p2-safe-zone-pushout`, `p2-end-win-at-dawn`, `p2-n1-schedule` |
| 5 | **Drifters.** States idle/chase/flee/removed, steal, pulse effects, spawns at 1200k with a max of 2 alive, ids D1… | `sim.ts` | `p2-drifter-steal`, `p2-drifter-pulse-drop` |
| 6 | **Pause.** It runs before everything else in the step (see the tick order in the spec). Add `sim_tick` separate from `tick` and `state: "paused"`. | `sim.ts`, `cli.ts` | `p2-pause` |
| 7 | **Contract I/O v1.1.** `--night 1..3`. Snapshot fields: `night`, `wind`, `player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, and the `motes`/`drifters`/`charms` arrays. Scenario fields and validation (exit 2). Inputs `dash`/`pause`. All the new events, including `night_start` at tick 1. Add `tests/perf.test.ts`: a Night 3 run of 21,600 ticks in under 30 s. **Then re-derive every `p1-*` scenario for the v1.1 numbers.** Delete `p1-island-clamp` (replaced by falling) and log it. Pickup boundary is now 1.0/1.05, lantern cost 10, pulse cost 3 / radius 5 (3D) / cooldown 180 ticks / +5, interact 2.0, motes 20, and so on. | `files.ts`, `cli.ts`, `tests/` | **zero pending**, `npm run verify` green, then show the user |
| 8 | **Web: nights and menus.** Menu → intro (island name and a line from Ông Đăng) → play → result → next night. Dawn screen after Night 3 with the total score. Replay a lost night. Pause menu (Esc/P). Settings saved in `localStorage`. Render the Night 2/3 geometry (bridge, tiers, ramps, tower, pads), drifters and charms. | `src/web/*` | screenshots P2-W1/W2/W3 |
| 9 | **Web: HUD, palette, audio, FPS.** Full HUD layout. Palette constants in `src/web/palette.ts` (exact hex values from the spec). Ambient intensity = 0.15 + 0.55·lit/total. Synthesise all audio with WebAudio (no files). Add an FPS counter (press `F3`) and measure at 1280×720. | `src/web/*`, `CREDITS.md` | screenshots P2-W5/W6/W7 |
| 10 | Run `/phase release 2`. | notes, proof | tag commands given to the user |

**If time runs short:** steps 1–7 are the hidden tests, worth 30 points and re-run in every later phase. Never cut them. Cut from step 9 first: audio variety, then the off-screen arrow. Then from step 8: Ông Đăng's text can be one line per night. Write anything cut as **NOT DONE** in the proof.

## Standard tuning (`game.contract.json` v1.1 = `TUNING`)
| Key | Value | Key | Value |
|---|---|---|---|
| `player_speed` | 6 | `invuln_s` | 1.5 |
| `carry_capacity` | 10 | `hit_drop_ratio` | 0.5 |
| `lantern_cost` | 10 | `pulse_stun_s` | 2 |
| `lantern_count_night1` | 5 | `pulse_push_m` | 4 |
| `pickup_radius` | 1 | `pulse_cooldown_s` | 3 |
| `interact_radius` | 2 | `safe_radius` | 6 |
| `pulse_cost` | 3 | `shade_speed` | 4 |
| `pulse_radius` | 5 | `shade_hit_radius` | 1 |
| `night1_duration_s` | 300 | `fall_enabled` | **true** |
| `night2_duration_s` | 330 | `night3_duration_s` | 360 |
| `flames` | 3 | | |
| `dash_speed` | 14 | `dash_duration_s` | 0.2 |
| `dash_cooldown_s` | 1.5 | | |

`score`:

| Key | Value |
|---|---|
| `per_mote` | 10 |
| `per_lantern` | 100 |
| `per_stun` | 5 |
| `per_second_left` | 2 |
| `per_flame_left` | 50 |

## Suggested `src/sim/maps.ts` shape
```ts
export interface NightDef {
  night: 1 | 2 | 3; duration_s: number; start: Vec3; startFacing: [number, number];
  lanterns: Vec3[];                 // id = L{i+1}
  moteSpawns: Vec3[]; shadeSpawns: Vec3[]; charmSpawns: Vec3[];
  shadeInterval: number; shadeMax: number; shadeSpeed: number;   // ticks, count, m/s
  drifters: boolean; wind: boolean;
  pads: Array<{ center: Vec3; vy: number; vh: number; target: [number, number] | "minusZ" }>;
  groundHeight(x: number, z: number): number | null;             // null = no ground (falls)
  blocked(x: number, z: number): boolean;                        // bell tower
}
```
Start points (TA answers):

| Night | Start | Facing |
|---|---|---|
| 1 | (0,0,0) | +Z |
| 2 | (0,0,0) | +Z |
| 3 | **(0,0,−15)** | +Z |

`player.invuln` in a snapshot is a **boolean**. The scenario field is `invuln_ticks`.

Points are generated from the ticket's (radius, angle) lists. Angles are measured from +X, counter-clockwise seen from above, so a point is `(r·cos a, y, r·sin a)`. **Check the sign** with Night 1 L2 (23.8, 0, 7.7), which is r 25 at 18°: cos 18°·25 = 23.78 and sin 18°·25 = 7.73.

## Guard rails (already in the harness)
- The Stop hook blocks finishing while verify is red. Pending scenarios are skipped but listed in every run.
- The git guard blocks force-push and tag deletion.
- Before tagging, `/phase release 2` runs the `contract-reviewer` subagent, a separate reviewer from the agent that wrote the code.
