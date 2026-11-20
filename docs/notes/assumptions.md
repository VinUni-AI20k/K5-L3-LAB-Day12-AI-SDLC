# Assumptions and acceptance criteria

Status: **Phase 1 built (CP1)**. The CP1 TA answers (2026-11-20) confirmed Q1, Q2, Q3, Q4, Q10 and the optional choices in Q5; Q6..Q9, Q11 are still our own defaults. A changed answer goes to `changes.md`.
Numbers live in `src/sim/config.ts` and are mirrored in `game.contract.json`.

## Phase 1 — PRD-0

### Phase 1 delta (spec: `docs/spec/contract-v1.md`)
- **New:** everything. Phase 1 is the first spec; the repo only has the CP0 stub (`src/headless/cli.ts` writes a fixed 0-tick file).
- **Clarified (spec confirms an assumption):**
  - tick model, `dist <= r` for every radius, XZ-only distances, setup emits no events and no score;
  - the `dash` input field exists. We have no dash: accept it, ignore it (scenario `p1-inputs-accept-dash`);
  - `fall_enabled=false` is allowed, so no `fall` events.
  - PRD-0 was read in full from the lab board on 2026-11-20 after the first kickoff pass (which used only the condensed spec). No contradiction with `contract-v1.md`. It adds:
    - "Có thể chơi lại sau khi thắng hoặc thua" → replay = play again after win/lose (closes Q12);
    - `random_motes:false` = "không tự sinh đom đóm" → no respawn in that mode (half of Q6);
    - the scenario example has a shade at y=0 and the snapshot example a shade at y=1.0 → the sim must keep the y given in a scenario, not force 1.0;
    - snapshot `motes` array is recommended in v1.0 → we will include it;
    - deliverables not in `contract-v1.md`: README install/run in ≤ 3 commands, controls, scoring method, a "Sáng tạo của tôi" section, evidence, harness files; `team` format is "mssv-ho-ten".
- **Overturned:** nothing.
- **Replaces an old rule:** nothing. The CP0 tuning stays as is (`config.ts` = `game.contract.json`); no contract change, so no config edit this kickoff.
- **Not in the spec, so assumed (listed in Q1..Q12):** island radius, ring direction of L2..L5, jump physics, stun/invuln/cooldown boundaries, when `per_mote` is scored, mote respawn, replay.

### Open questions for the TA (ask in the first 5 minutes)
| # | Question | Default if "not specified" | Scenario that depends on it |
|---|---|---|---|
| Q1 | Does `safe_radius` apply around every lantern or only lit ones? | lit lanterns only | p1-shade-safe-radius (uses a lit lantern, so it holds either way) |
| Q2 | Is a `pulse` event emitted when no shade is in range? | yes, `stunned_ids: []`, cost is still paid | p1-pulse-empty, p1-pulse-cooldown |
| Q3 | Are `per_second_left` / `per_flame_left` awarded only on a win? | only on a win, at the `game_over` tick | p1-win-score, p1-end-priority-dawn, p1-lose-* |
| Q4 | Are dropped motes lost or re-scattered? | lost | p1-hit-drop |
| Q5 | Is `per_mote` scored when a mote is picked up or when it is deposited? | on deposit (`amount × per_mote`), so dropped motes never score | p1-deposit-*, p1-interact-edge, p1-win-score |
| Q6 | (PRD-0 says `random_motes:false` spawns nothing, so respawn is off there.) With `random_motes:true` + a `motes` list, is the list the start set and respawn on? Is the respawn clock global (every 240 steps) or per picked mote? | list = start set + respawn on; global clock | p1-mote-respawn |
| Q7 | First shade at "5 s": spawn event at tick 300 (elapsed time after the step = 5.0 s)? | tick 300; then 2100, 3900, … (every 1800) | p1-default-world |
| Q8 | `safe_radius` boundary: may a shade stand exactly at distance 6, and how is the entry blocked (stop vs slide)? | standing at 6 is allowed; the move that would go below 6 is blocked | p1-shade-safe-radius |
| Q9 | Stun length 2 s: stunned in snapshots t1..t120, `chase` again from t121? Invulnerability 1.5 s: hittable again from t91? Cooldown 1 s: next pulse from t61? | an effect that starts on tick t lasts N ticks counted from t: stun t..t+119 (back to `chase` at t+120), invulnerability blocks steps with tick < t+90, cooldown blocks steps with tick < t+60 | p1-pulse-stun-push (only checks t60 and t130; the exact edge is our choice), p1-hit-drop (only t80) |
| Q10 | Is `pulse_cost` paid from `carried` motes ("light")? | yes, 1 carried mote per pulse; no pulse when `carried < pulse_cost` | p1-pulse-* |
| Q11 | Island radius, and is `snapshot-every` also written for the last tick when it is not a multiple? | radius 40, clamped; only multiples of N (the `end` line carries the final state) | p1-island-clamp |
| Q13 | Is the win time bonus `per_second_left × whole seconds left` or × fractional seconds? | whole seconds (floor), so the score is always an integer | p1-win-score, p1-win-bonus-fraction |
| Q14 | Does a pulse pay `per_stun` again for a shade that is already stunned? | yes, every shade in range pays each pulse | none (documented only; costs 1 mote per pulse and a 1 s cooldown) |
| Q15 | Scenario values that break invariants: `carried` above capacity, `deposited` above `lantern_cost`, a full lantern marked `lit:false`? | `carried` is echoed as given; `deposited > lantern_cost` is a malformed file (exit 2); `deposited == lantern_cost` means lit | p1-bad-scenario-deposited |
| ~~Q12~~ | ~~What does "replay" mean?~~ Closed by PRD-0: play again after win/lose. | web only: a "Chơi lại" button that restarts. No effect on headless | P1-W3 |

Also decided (review): when lit zones overlap, a shade inside goes to the nearest point outside all of them (edge projection or the intersection of two edges); with three or more mutually covering zones it stays put (cannot happen with the default ring). Scenario `random_motes` omitted + a `motes` list: the list is the start set and respawn stays on (Q6).

Also assumed, not asked (cannot be tested from the contract): `motes_active` = motes on the ground; lantern ring goes clockwise (L2 = 72° from L1 towards +X); jump uses no tuning key so jump height is not asserted.

### TA answers at CP1 (2026-11-20)
- Pickup/deposit/pulse/hit rules are ours to choose; the constraints are `carried` ≤ capacity, `deposited` ≤ cost, `amount` equals what really moved, `dropped` ≤ carried, no silent loss of motes.
- Pulse not affordable → no `pulse` event. Pulse that really happens → event with `stunned_ids`.
- Within one tick events come before the snapshot; the game-over tick still gets a snapshot only if it falls on the `--snapshot-every` schedule; `end` is always last.
- Win bonus is added on the `game_over` tick so `end.score` matches the last snapshot. Loss bonus is our choice (none).
- `safe_radius`: lit lanterns only; a shade inside when the lantern lights is pushed out (we project it radially to the edge). Afterwards no shade may be inside.

### Mechanics assumptions
- Island radius is 40 m. `fall_enabled = false`, so the player is clamped to the island and no `fall` events occur.
- Lanterns L1..L5 sit on a ring of r = 25, 72° apart, with L1 at (0,0,25).
- Motes are picked up automatically within `pickup_radius`, in id order, up to `carry_capacity`.
- Deposit happens on an `interact` edge. It goes into the nearest unlit lantern within `interact_radius`, and the amount is `min(carried, lantern_cost − deposited)`. The lantern is lit when `deposited == lantern_cost`.
- Pulse happens on a `pulse` edge if `carried >= pulse_cost` and the cooldown is ready. Shades within `pulse_radius` are stunned for `pulse_stun_s`, pushed `pulse_push_m` away from the player, and score `per_stun` each.
- Shades chase in XZ at `shade_speed` with y = 1.0 (centre). They cannot enter `safe_radius` of a lit lantern. Their states are `chase` and `stunned`.
- A hit happens when a non-stunned shade is within `shade_hit_radius` and the player is not invulnerable. It costs −1 flame, drops `floor(carried × hit_drop_ratio)` motes, and starts `invuln_s` of invulnerability.
- Default spawns:
  - 30 seeded motes, with 1 respawned every 4 s up to 30.
  - Shades: the first at 5 s, then one every 30 s, up to 5, at the island edge, each emitting `shade_spawned`.
- Jumping is vertical only and does not avoid hits, since distances are measured in XZ.
- There is no dash.
- Step order:
  1. Input
  2. Player move
  3. Pickup
  4. Interact
  5. Pulse
  6. Shade spawn
  7. Shade move
  8. Hits
  9. Mote respawn
  10. Time
  11. End check: `all_lit`, then `no_flames`, then `dawn`

### Acceptance criteria → verification
Scenario folders live in `tests/scenarios/`. Expected values are derived by hand (arithmetic in each `expect.json` → `requirement`).

| ID | Criterion ("do A → see B") | Verified by |
|---|---|---|
| P1-01 | Run any scenario → tick-0 snapshot has the contract shape, last line is `end` | `tests/scenarios/p0-smoke/` |
| P1-02 | Scenario with pre-lit L2, `time_left_s` 100 → no events, score 0; time 99.983 at t1, 99 at t60 | `tests/scenarios/p1-setup-time-model/` |
| P1-03 | `--ticks 0` → one snapshot (tick 0) and `end` ticks 0 | `tests/scenarios/p1-ticks-zero/` |
| P1-04 | Hold move [1,0] 30 ticks, then [0.5,0] → x = 3.0, then 4.5; stops on [0,0] | `tests/scenarios/p1-move-straight/` |
| P1-05 | Move [1,1] → normalised, 6 m in 60 ticks (4.243, 4.243) | `tests/scenarios/p1-move-diagonal/` |
| P1-06 | cam_yaw 90° maps [1,0] to −Z; fields not in a frame persist | `tests/scenarios/p1-move-cam-yaw/` |
| P1-07 | Walk off the island edge → clamped at 40 m, no `player_hit` | `tests/scenarios/p1-island-clamp/` |
| P1-08 | Jump → back on the ground at the same XZ by t120 | `tests/scenarios/p1-jump-lands/` |
| P1-09 | Inputs contain `dash` → accepted, no effect | `tests/scenarios/p1-inputs-accept-dash/` |
| P1-10 | Run with no scenario → 30 motes, 5 unlit lanterns, no shades; `shade_spawned` at t300 | `tests/scenarios/p1-default-world/` |
| P1-11 | Pick the only mote, wait → respawn at t240 (pending Q6) | `tests/scenarios/p1-mote-respawn/` |
| P1-12 | Mote at 1.5 m is picked, 1.501 m is not (<=) | `tests/scenarios/p1-pickup-boundary/` |
| P1-13 | Carried 9 with 3 motes in range → only 1 picked, capacity 10 | `tests/scenarios/p1-pickup-capacity/` |
| P1-14 | Interact at 3 m with 5 carried → deposit 5, `lantern_lit`, score 150 | `tests/scenarios/p1-deposit-lights/` |
| P1-15 | Interact with 3 carried → deposit 3, not lit, score 30 | `tests/scenarios/p1-deposit-partial/` |
| P1-16 | Lantern holds 2, carried 10 → amount 3, lit, carried 7, score 130 | `tests/scenarios/p1-deposit-remaining/` |
| P1-17 | Lantern at 3.001 m → nothing happens | `tests/scenarios/p1-deposit-out-of-range/` |
| P1-18 | Hold interact → one deposit; re-press → next unlit lantern; nearest first | `tests/scenarios/p1-interact-edge/` |
| P1-19 | Light the last lantern at t60 → won/all_lit, score 500, run stops | `tests/scenarios/p1-win-score/` |
| P1-20 | Last lantern lit in the same step as dawn → won, not lost | `tests/scenarios/p1-end-priority-dawn/` |
| P1-21 | Shade inside the zone of a lantern that was just lit is pushed out, so it cannot hit that step (TA rule) | `tests/scenarios/p1-lit-expels-shade/` |
| P1-22 | Shade takes the last flame → lost/no_flames at t1, score 0 | `tests/scenarios/p1-lose-no-flames/` |
| P1-23 | Time runs out → lost/dawn at t60, score 0 | `tests/scenarios/p1-lose-dawn/` |
| P1-24 | Shades chase at 4 m/s, y stays 1 (straight and diagonal) | `tests/scenarios/p1-shade-chase/` |
| P1-25 | Shade cannot enter safe_radius of a lit lantern | `tests/scenarios/p1-shade-safe-radius/` |
| P1-26 | Shade contact → −1 flame, drop floor(5×0.5)=2, invulnerable ≥ 80 ticks | `tests/scenarios/p1-hit-drop/` |
| P1-27 | Pulse → cost 1, stun in range, push 4 m, +20, stun lasts 2 s | `tests/scenarios/p1-pulse-stun-push/` |
| P1-28 | Pulse radius is <= 6 (6 in, 6.001 out) | `tests/scenarios/p1-pulse-boundary/` |
| P1-29 | Pulse with 0 carried → nothing | `tests/scenarios/p1-pulse-no-light/` |
| P1-30 | Pulse with nobody in range → event with `[]`, cost paid (pending Q2) | `tests/scenarios/p1-pulse-empty/` |
| P1-31 | Pulse cooldown 1 s: blocked at t10, works at t100 | `tests/scenarios/p1-pulse-cooldown/` |
| P1-32 | Pulse before hit: stunned shade at 0.5 m does not hit | `tests/scenarios/p1-pulse-prevents-hit/` |
| P1-33 | Inputs not JSON → exit 2 + stderr | `tests/scenarios/p1-bad-inputs-json/` |
| P1-34 | Frame ticks not strictly increasing → exit 2 | `tests/scenarios/p1-bad-inputs-order/` |
| P1-35 | `move` component outside [−1,1] → exit 2 | `tests/scenarios/p1-bad-inputs-move-range/` |
| P1-36 | Scenario with wrong type → exit 2 | `tests/scenarios/p1-bad-scenario-type/` |
| P1-40 | Two overlapping lit zones: a shade inside ends outside both | `tests/scenarios/p1-safe-zone-overlap/` |
| P1-41 | A pulse push into a lit zone leaves the shade on the zone edge | `tests/scenarios/p1-pulse-push-into-zone/` |
| P1-42 | Shade ids stay unique when a scenario mixes id-less and explicit ids | `tests/scenarios/p1-shade-ids-unique/` |
| P1-43 | Win bonus uses whole seconds left (5.4833 s → 5) | `tests/scenarios/p1-win-bonus-fraction/` |
| P1-44 | Last flame lost in the same step time runs out → no_flames, not dawn | `tests/scenarios/p1-end-priority-flames-dawn/` |
| P1-45 | Default shade schedule: t300, then t2100 | `tests/scenarios/p1-shade-spawn-schedule/` |
| P1-46 | `deposited` above `lantern_cost` in a scenario → exit 2 | `tests/scenarios/p1-bad-scenario-deposited/` |
| P1-37 | Same seed + scenario + inputs → byte-identical output (every scenario runs twice) | `deterministic` default in `tests/scenarios.test.ts`, plus the full-night double run in the `verify` skill |
| P1-38 | `game.contract.json` tuning equals `src/sim/config.ts`; required keys present | `tests/contract.test.ts` (exists) |
| P1-39 | `npm ci && npm run build` produces `dist/headless.js` and `dist/web`; `run_cmd` opens the game | verify skill (build) + screenshot |
| P1-W1 | Web: WASD/arrows move, Space jumps, mouse/arrow camera orbit, 3D third-person view | screenshot `docs/proof/phase-1/img/p1-w1-*.png` |
| P1-W2 | Web HUD shows flames, carried/capacity, lit lanterns x/5, time left, score | screenshot `p1-w2-hud.png` |
| P1-W3 | Web win/lose overlay with score and a replay button (PRD-0: play again) | screenshot `p1-w3-end.png` |
| P1-W4 | Web uses `src/sim` only (no gameplay rules in `src/web`); extras do not change headless output | review by `contract-reviewer` + grep for `three` in `src/sim` |

---

## Phase 2: Ticket-02 (spec: `docs/spec/ticket-02.md`, Contract v1.1)

### What the ticket adds or changes vs Phase 1
- **Replaced (our Phase 1 choices → customer standard).** All tuning now comes from the ticket:
  - pickup 1.5 → 1.0, plus a height check ≤ 1.5
  - lantern_cost 5 → 10
  - interact 3 → 2, with ties going to the smaller id
  - pulse cost 1 → 3, radius 6 XZ → 5 in **3D** from feet + 0.8
  - pulse cooldown 1 → 3 s
  - pulse push: instant → 4 m spread over 15 ticks
  - per_stun 20 → 5
  - fall_enabled false → **true** (the island clamp is gone)
  - dropped motes: lost → a ring 1.5–2.5 m with TTL 480
  - invuln 1.5 s → 90 ticks (same length)
  - motes: 30 random → 20 on fixed spawn points, cap 30
  - shade schedule: 5 s + 30 s ×5 → 2 at t300, then every 8/7/6 s, cap 6/8/10, on fixed points ≥ 15 m away
  - shade states: chase/stunned → spawning/wander/chase/recoil/stunned
  - safe-zone expel: instant projection → pushed out over ≤ 30 ticks with no damage
  - lantern ring → fixed positions
  - **end-check order:** all_lit → no_flames → dawn becomes **no_flames → all_lit → dawn**
- **New:** nights 2 and 3 (maps, tiers, ramps, launch pads, bell tower, wind), dash, fall/respawn, drifters, charms, pause, and the v1.1 snapshot, scenario, input and event fields. Web adds the 3-night chain, menus, settings, audio, full HUD, palette and the ambient formula.
- **Clarified:** "after setup, before input" is still tick 0. Scoring is still on deposit. The win bonus formula is unchanged.

### Open questions for the Phase 2 TA (defaults are used now; update when answered)
| # | Question | Default we implement |
|---|---|---|
| Q2-1 | How long does a shade stay `spawning`, and what does `wander` do? | **TA answer:** `spawning` lasts 1.0 s (60 ticks). The shade deals no damage and fades in, then switches to `wander`. Scenario shades skip `spawning` and start in `wander`, unless the scenario gives `state`. Our default: `wander` stays where it is (it doesn't move). → `chase` when XZ ≤ 12, back to `wander` when XZ > 18 |
| Q2-2 | Which tick carries `night_start`? | **TA answer:** tick 1. Tick 0 is the state after setup with no events, and the first step's events carry tick 1. It is emitted with or without a scenario. Hidden tests compare times with a **±2 tick tolerance**, but we stay exact to our convention |
| Q2-3 | Is `player.invuln` a boolean or seconds? | **TA answer:** boolean, `true` while invulnerable. The ticks left only exist in a scenario, as `player.invuln_ticks` |
| Q2-4 | Night 2 and 3 start points? (0,0,0) is inside the Night 3 bell tower | **TA answer:** Night 2 starts at (0,0,0) (centre of island A), facing +Z. Night 3 starts at (0,0,−15), facing +Z (tier 0) |
| Q2-5 | Does the 30-mote cap include dropped motes? | Only `random` motes count toward the cap and fill spawn points; dropped motes are extra |
| Q2-6 | On the resume tick, does logic run? | Yes. Only the step that **pauses** stops early; the resume step runs fully |
| Q2-7 | Acceleration "≤ 0.1 s" | Instant: velocity = target each tick (0 s ≤ 0.1 s) |
| Q2-8 | First wind gust, and `dir_deg` when inactive | Gusts at ticks 1800k for 300 ticks; seeded direction. `dir_deg` = current or next gust direction |
| Q2-9 | Drifter "fog points" and idle glide | Fog points = that night's shade spawn points. Idle glides at 2 m/s towards a seeded fog point and picks a new one on arrival |
| Q2-10 | Shades on Night 3 tiers and walls | Shades fly: y = ground height under them + 1.0; tier walls don't block them; the bell tower (r 2) does |

### New or updated assumptions
- **Timers** are integer tick counters set when triggered and decremented in step phase 2 of every **later** step. A counter set to N at step k blocks steps k+1 … k+N−1, so the action is ready again at step k+N.
  - Snapshot `*_s` value = `ticks_left / 60`, rounded to 3 decimals.
- **Dash:**
  - Starts in phase 3 of the step that reads the edge and moves in that same step: 12 steps × 14/60 = **2.8 m**.
  - Facing = the last non-zero move direction (initially +Z).
  - A dash in the air sets vy = 0 and skips gravity while dashing.
- **Charm:** speed 7.2 applies from the step after pickup.
- **Ground height function** per night (islands, bridge, tiers, ramps). If there's no ground under the feet, Mây falls with gravity.
  - Walking into a higher surface by more than 0.25 m is blocked (walls, tower). A ramp rises 0.05 m per tick at run speed, so it passes.
- **Falling:**
  - Triggers when feet Y < −10: `player_hit {by:"fall", flames, dropped: 0, lost: carried}`.
  - Then 60 ticks inert, then respawn at the night start with 90 ticks invulnerable.
  - If flames reach 0, end with `no_flames` that tick.
- **Shades:**
  - Hit check: XZ ≤ 1.0 and |shade centre Y − feet Y| ≤ 1.5. A hit puts the shade into `recoil` for 60 ticks, moving 2 m away from Mây horizontally (2/60 m per tick). A shade in recoil can't hit.
  - Pushes (pulse, recoil, safe-zone expel) are clamped to the island or ground edge: "stop at obstacles" = don't leave the ground.
- **Safe zone:** a shade inside a just-lit zone moves radially outward at 0.2 m/tick (6 m in ≤ 30 ticks) and can't hit until it is outside. A shade outside a lit zone never ends a step inside it.
- **Dropped motes:**
  - Ring positions are seeded: radius 1.5 + rng, angle 2π·rng.
  - Y = ground height there, or Mây's ground Y if no ground.
  - `ttl_s` = ticks left / 60. A random mote's `ttl_s` is `null`.
- **Drifters:**
  - Pulse checks the 3D distance to the drifter centre (ground + 1.0).
  - Pulse doesn't add score and doesn't put the drifter in `stunned_ids`.
  - A removed drifter stays in the snapshot with `state: "removed"`, but doesn't count toward the max of 2.
- **Charms snapshot:** `respawn_s` is 0 while available.
- **Score** is per night in headless runs. The web game sums the nights won.

### Acceptance criteria → verification
Scenario folders: `tests/scenarios/p2-*/`. A folder with `"pending"` in `expect.json` is skipped until built. **Release requires zero pending.**

| ID | Criterion ("do A → see B") | Verified by |
|---|---|---|
| P2-01 | `game.contract.json` is v1.1 with every standard number and the 5 new keys | `tests/contract.test.ts` |
| P2-02 | `--night 2`/`3` load their map: lanterns 6/7 at the exact positions, time 330/360, charms, 20 motes | `p2-night2-map`, `p2-night3-map` |
| P2-03 | Default Night 1: 20 motes at t0, +1 at t240 and t480; S1+S2 at t300, S3 at t780 | `p2-n1-schedule` |
| P2-04 | Pickup at XZ 1.0 yes, 1.05 no | `p2-pickup-radius` |
| P2-05 | Deposit is min(carried, missing) into the nearest unlit lantern; ties go to the smaller id; cost 10 | `p2-deposit-tie`, `p2-lantern-cost` |
| P2-06 | Pulse with < 3 carried does nothing; with 3: cost 3, stun 120 ticks, 4 m push by t15, +5 | `p2-pulse-cost`, `p2-pulse-stun-push` |
| P2-07 | **Dash**: 2.8 m in 12 ticks from standing (facing +Z); blocked during the 90-tick cooldown | `p2-dash` |
| P2-08 | Shade hit: −1 flame, floor(5/2) = 2 motes dropped as `dropped`, shade in `recoil`, carried 3 | `p2-hit-drop-ring` |
| P2-09 | **Fall**: walking off Night 1 → `player_hit` by fall with `lost`, respawn at the start with 0 carried | `p2-fall` |
| P2-10 | Lantern lit with a shade inside its zone → no hit while it is pushed out | `p2-safe-zone-pushout` |
| P2-11 | Last lantern lit on the dawn tick → won (score 10+100+150 = 260) | `p2-end-win-at-dawn` |
| P2-12 | **Pause**: tick runs, `sim_tick`/time/position freeze, state `paused`, `paused`/`resumed` events | `p2-pause` |
| P2-13 | **Charm**: pickup → `charm_picked` C1 600, run speed 7.2 m/s, charm unavailable | `p2-charm` |
| P2-14 | **Drifter** steals min(3, carried) from a player carrying ≥ 5, then flees | `p2-drifter-steal` |
| P2-15 | Pulse on a fleeing drifter holding motes → `drifter_drop`, the motes become dropped motes | `p2-drifter-pulse-drop` |
| P2-16 | **Launch pad** (Night 2): touching it lands Mây on island B (x > 42, grounded) | `p2-launch-pad` |
| P2-17 | **Wind** (Night 3): inactive at t1790, active at t1810, inactive again at t2110 | `p2-wind` |
| P2-18 | Malformed v1.1 scenario fields (`pause` not a boolean, `--night 4`) → exit 2 / non-zero | `p2-bad-pause`, `p2-bad-night` |
| P2-19 | A full headless night (21,600 ticks, Night 3) finishes in ≤ 30 s | `tests/perf.test.ts` |
| P2-20 | Every Phase 1 scenario re-derived for the v1.1 numbers still passes; replaced rules are deleted with a reason | `tests/scenarios/p1-*`, `docs/notes/changes.md` |
| P2-W1 | Web: menu → intro (island name, Ông Đăng's line) → play → result → next night; Dawn screen after Night 3; replay a lost night | screenshots `docs/proof/phase-2/img/` |
| P2-W2 | Web pause (Esc/P) with Continue / Replay night / Settings / Menu; logic frozen | screenshot + `p2-pause` |
| P2-W3 | Settings (volume, mouse sensitivity) persist after reload (`localStorage`) | screenshot before/after reload |
| P2-W4 | Audio: night music + listed effects (WebAudio synthesised, credited) | demo video / manual check list |
| P2-W5 | Full HUD layout, the clock turning red and blinking at ≤ 30 s, prompt near a lantern, off-screen arrow | screenshots |
| P2-W6 | Palette hex values used for the listed parts; ambient = 0.15 + 0.55 × lit/total | code review (constants in `src/web/palette.ts`) + screenshot |
| P2-W7 | ≥ 30 FPS average at 1280×720 | FPS counter screenshot with machine specs |

---

## Phase 3: Ticket-03 (rule replacement expected)
_(filled by `/phase kickoff 3`)_
### Rules replaced and their impact (tests, docs, assumptions)
### New or updated assumptions
### Acceptance criteria → verification
| ID | Criterion | Verified by |
|---|---|---|

---

## Phase 4: Ticket-04 (release, measurements)
_(filled by `/phase kickoff 4`)_
### Measured requirements (threshold, command, machine)
### New or updated assumptions
### Acceptance criteria → verification
| ID | Criterion | Verified by |
|---|---|---|
