# Ticket-02 "Ba hòn đảo" — condensed spec (Phase 2, Contract v1.1)

Source: lab board, Phase 2 tab, pasted by the user at the 1h mark. This summary keeps every number. Where it is silent, follow `docs/notes/assumptions.md` → Phase 2.

**It supersedes our Phase 1 numbers.** All tuning is now fixed by the customer. Contract v1.1 extends v1.0 (`docs/spec/contract-v1.md`).

**Creativity:** extras are allowed, including new characters and enemies. The standard numbers, maps and contract must not change, and headless output must be unchanged, so extras are off in headless.

## 1. Standard numbers (60 ticks/s; metres, seconds; Y up)

### Movement and jump
- **Run:** 6.0 m/s. Acceleration and stopping take ≤ 0.1 s. Full air control.
- **Jump:** vy 7.0 m/s, gravity −20 m/s². Only when grounded.

### Dash (new)
- 14 m/s for 0.2 s (12 ticks). Cooldown 1.5 s, counted from the dash start.
- **Direction:** the current move direction. If standing still, the facing direction.
- In the air, a dash keeps the height (no gravity while dashing).
- No invulnerability while dashing.

### Fireflies (motes)
- **Capacity:** 10.
- **Pickup:** automatic when XZ distance ≤ 1.0 **and** |Mây's feet Y − mote ground Y| ≤ 1.5.
- **Count:** 20 at start, on 20 distinct spawn points. Cap 30.
- **Respawn:** at ticks 240, 480, … spawn +1 on an empty point if fewer than 30. If no point is free, skip.

### Lanterns
- Cost 10 motes. Fill in several deposits; the lantern remembers its progress.
- **Interact:** radius 2.0. Each press deposits `min(carried, missing)` into one lantern.
  - Only unlit lanterns count. The nearest wins; on a tie, the smaller id wins.
- **Safe zone:** a lit lantern has a radius-6 zone. Shades outside are blocked at the 6 m edge.
  - A shade inside when the lantern is just lit is pushed out to the edge within at most 30 ticks.
  - It deals no damage while being pushed.

### Pulse (Tỏa Sáng)
- Costs 3 motes. Radius 5 m. Cooldown 3 s.
- With fewer than 3 motes, the pulse does not trigger.
- **Centre:** Mây's feet + 0.8 m (Y).
- **Targets:** locked on the activation tick. A shade is hit if the **3D** distance from the centre to the shade's centre is ≤ 5.
- **Effect on shades:**
  - Stunned for 120 ticks.
  - During the first 15 ticks, pushed back 4 m in total, horizontally. The push stops at obstacles.
  - If the shade is on the same spot as Mây, push towards +X.
  - A new pulse refreshes both the stun and the push.
  - Shades never die.

### Shades (Bóng Mực)
- **Speed:** 4.0 m/s (Night 3: 4.5 m/s).
- **Chase:** starts at 12 m, gives up beyond 18 m.
- **Touch:** XZ ≤ 1.0 and height difference ≤ 1.5.
  - At most 1 flame lost per tick.
  - The shade that hits goes into recoil: 2 m back over 60 ticks.
  - A shade touching Mây while Mây is invulnerable does nothing.
- **Spawn schedule:**
  - 2 shades at tick 300, then 1 per interval: tick 300 + 480k on Night 1.
  - If no valid point exists, skip.
  - Ids are S1, S2, … in spawn order.
- **States (names are mandatory from v1.1):** `spawning`, `wander`, `chase`, `recoil`, `stunned`.

### Getting hit
- −1 flame.
- `floor(carried / 2)` motes drop onto a ring 1.5–2.5 m around Mây. They live for 480 ticks and can be picked up again from the next tick.
- Then 90 ticks of invulnerability.

### Falling (Y < −10)
- Happens exactly once per fall and ignores invulnerability: −1 flame and all carried motes are lost.
- Wait 60 ticks: no pickup and no hits during the wait.
- Respawn at the night's start point with velocity 0 and 90 ticks of invulnerability.
- If no flames are left: lose at once, with no respawn.

### Health, time, end
- **Flames:** 3, refilled at the start of each night.
- **Night length:** Night 1 / 2 / 3 = 300 / 330 / 360 s.
- **End check, after every tick:**
  - Flames are 0 → always **lost** (`no_flames`).
  - Else all lanterns are lit → **won**, even on the exact dawn tick.
  - Else time is up → **lost** (`dawn`).

### Score
- +10 per mote **deposited**.
- +100 per lantern lit.
- +5 per shade hit by a pulse (every shade, every time, including stunned ones).
- On a win: `floor(seconds left) × 2 + 50 × flames left`.
- The game's total score is the sum over the nights won.

## Mandatory order within one tick
1. **Read input.** Handle pause first. If the game was just paused, stop this step here.
2. **Count down timers:** time, cooldowns, invulnerability, stun, charm, dropped-mote TTL, charm respawn.
3. **Move Mây** (jump, dash, launch pad, wind), then check for falling off the island.
4. **Pick up** motes and charms.
5. **Interact** with lanterns.
6. **Update** safe zones.
7. **Pulse.**
8. **Move** shades and drifters.
9. **Touch:** drifters steal first, then shades hit, in ascending id order.
10. **Spawn** motes, shades and drifters on schedule. New entities can only interact from the next tick.
11. **Check** win/lose.
12. **Write** the snapshot if due.

**While paused:** `tick` still increases, but `sim_tick`, time, cooldowns, spawns and TTLs are frozen. Snapshots show `state: "paused"`.

## 2. Standard maps
Angles are measured from +X, counter-clockwise seen from above, on the XZ plane.

### Night 1 — Đảo Bến
- Circular island, centre (0,0,0), radius 40. Outside 40 m is the cloud sea (falling).
- Start at (0,0,0), facing +Z.
- **Lanterns:**

| Id | Position |
|---|---|
| L1 | (0, 0, 25) |
| L2 | (23.8, 0, 7.7) |
| L3 | (14.7, 0, −20.2) |
| L4 | (−14.7, 0, −20.2) |
| L5 | (−23.8, 0, 7.7) |

- **Mote spawn points:** 8 at r = 12 (every 45°, starting at 0°) and 16 at r = 33 (every 22.5°), 24 in total.
- **Shade spawn points:** 12 at r = 37 (15°, 45°, …, every 30°), at least 15 m from the player.
- **Shades:** 2 at 5 s, then one every 8 s, up to 6.

### Night 2 — Đảo Cau
- **Islands:** two circles of radius 28, centres A (0,0,0) and B (70,0,0).
- **Bridge:** bamboo, x ∈ [26, 44], z ∈ [−2, 2], no railing.
- **Launch pads:** circles of radius 1 at (20,0,18) and (50,0,−18).
  - Touching one launches Mây with vy 14 and horizontal speed 24 towards the **other** island's centre.
  - That velocity is kept until landing. Move keys don't override it, but dash still works.
  - The flight takes about 1.4 s and lands on the target island.
- **Mote spawn points, per island:** 4 at r = 10 (0°, 90°, 180°, 270°) and 8 at r = 22 (every 45°), 24 in total.
- **Shade spawn points, per island:** 8 at r = 26 (22.5°, 67.5°, …).
- **Lanterns, in this order:**

| Id | Position |
|---|---|
| L1 | (0, 0, 20) |
| L2 | (17, 0, −10) |
| L3 | (−17, 0, −10) |
| L4 | (70, 0, 20) |
| L5 | (87, 0, −10) |
| L6 | (53, 0, −10) |

- **Shades:** one every 7 s, up to 8.

### Night 3 — Đảo Chuông
- **Island:** circle of radius 45 with three tiers:
  - Tier 0 (Y = 0): the whole island.
  - Tier 1 (Y = 3): an annulus of r 12–24, only where z > 0.
  - Tier 2 (Y = 6): a disc of r 8 at the centre.
- **Tier edges are vertical walls.** You can't walk up them; stepping off drops you to the tier below.
- **Ramps:** 2 straight ramps, 3 m wide, running along the radius at 30° and 150°. Each goes from r = 30 (Y = 0) up to r = 24 (Y = 3).
- **Launch pad:** radius 1 at (0,3,13). It gives vy 12 and horizontal 8 towards −Z, kept until landing, and lands on tier 2.
- **Bell tower:** a cylinder of r 2 and 8 m tall, at the centre of tier 2. It can't be climbed.
- **Mote spawn points (30):**
  - Tier 0: 18 at r = 34 (every 20° from 0°).
  - Tier 1: 8 at r = 18 (20°, 40°, …, 160°).
  - Tier 2: 4 at r = 5 (45°, 135°, 225°, 315°).
- **Shade spawn points:** 16 at r = 43 (every 22.5°).
- **Lanterns:**

| Id | Position |
|---|---|
| L1 | (0, 6, 6) |
| L2 | (18, 3, 10) |
| L3 | (−18, 3, 10) |
| L4 | (35, 0, −10) |
| L5 | (−35, 0, −10) |
| L6 | (20, 0, −35) |
| L7 | (−20, 0, −35) |

- **Strong wind:** every 30 s, a 5 s gust in a random direction pushes the player at 2 m/s. A 2 s warning comes first (leaves and sound).
- **Shades:** one every 6 s, up to 10.

## 3. New features
Each item below needs acceptance criteria and at least one headless scenario.

### Gió Lạc (drifter), Nights 2 and 3
- A grey-blue silk ribbon that moves at 7 m/s.
- At most 2 at once. They spawn at ticks 1200, 2400, … on a random fog point. Ids are D1, D2, …
- **States:** `idle` (glides slowly at 2 m/s) → `chase` → `flee` → `removed`.
- **idle → chase:** when Mây carries ≥ 5 motes and is ≤ 15 m away, checked every tick. If the condition stops holding, it goes back to idle.
- **Touch** (XZ ≤ 1.2):
  - Steals `min(3, carried)` motes and switches to flee.
  - Flee: moves away from Mây at 7 m/s for 240 ticks, then disappears along with what it stole.
  - Each drifter steals only once.
- **Pulse:**
  - Hitting a drifter in chase sends it to flee without stealing.
  - Hitting a fleeing drifter that carries motes makes it drop all of them on the spot as dropped motes. It disappears 120 ticks later.
- It never costs flames.
  - Lantern safe zones don't block it.
  - Mây's invulnerability doesn't prevent theft.

### Bùa Gió (charm)
- A red talisman with a gold border. Ids C1, C2. Picked up by the same rule as motes.
- **Effect:** lasts 600 ticks; picking up another refreshes it.
  - Run speed becomes 7.2 m/s.
  - Dash has no cooldown. The button must still be pressed again, and a press while dashing is ignored.
  - The dash itself is still 14 m/s for 12 ticks.
- Reappears 2700 ticks after being picked up.
- **Positions:** Night 2 at (35,0,0). Night 3 at (30,0,25) and (−30,0,25).

### Three-night chain (web)
- Flow: main menu → night intro (island name, a line from Ông Đăng) → play → results → next night.
- Winning Night 3 shows a Dawn screen with the total score. Losing lets you replay that night.

### Pause (Esc/P)
- Logic stops completely.
- Menu: Continue / Replay night / Settings / Back to menu.

### Settings and audio
- **Settings:** volume and mouse sensitivity, saved between sessions.
- **Audio:** night background music, plus effects for pickup, lantern lit, pulse, hit, jump, dash, win, lose, shade appears, and a countdown in the last 10 s.

### Full HUD
- **Top-left:** flames.
- **Top-centre:** mm:ss clock. It turns red and blinks at ≤ 30 s.
- **Top-right:** lanterns k/n and score.
- **Bottom-centre:** a 10-slot mote bar.
- **Bottom-right:** dash and pulse cooldown icons.
- A prompt "E — Nạp ánh sáng (x/10)" near a lantern.
- An arrow to the nearest unlit lantern when it is off-screen.

### Palette (each RGB channel within ±10%)

| Use | Colour |
|---|---|
| Night sky | #0E1430 |
| Fog | #1B2350 |
| Grass | #2F5D50 |
| Sand | #C9B48A |
| Wood | #6B4A2F |
| Cloud sea | #12384A |
| Lantern lit | #FFB347 |
| Lantern core | #FFE9B0 |
| Lantern off | #5B5F6E |
| Mote core | #FFF6C2 |
| Mote halo | #FFE58A |
| Shade body | #120A1A |
| Shade outline | #7A3CFF |
| Shade stunned | #3A3450 |
| Mây's shirt | #E8E2D0 |
| Mây's scarf and the charm | #C8102E |
| Gold border, score | #F2C14E |
| Drifter | #8FA3B8 |
| UI danger | #FF5A5F |
| UI text | #F5F1E6 |

**Ambient light:** intensity = 0.15 + 0.55 × (lit lanterns / total lanterns).

## 4. Test Contract v1.1 (changes from v1.0)
- `contract_version` is `"1.1"`. `tuning` must equal the standard numbers.
  - New keys: `dash_speed`, `dash_duration_s`, `dash_cooldown_s`, `night2_duration_s`, `night3_duration_s`.
- `--night` accepts 1, 2 or 3.
- **Snapshot root** adds `night` and `wind {active, dir_deg}`.
- **`player`** adds `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`.
- **Mandatory snapshot arrays:**
  - `motes`: `{id, pos, kind: "random"|"dropped", ttl_s}`
  - `drifters`: `{id, pos, state, stolen}`
  - `charms`: `{id, available, respawn_s}`
- **Scenario additions:**
  - `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`
  - `shades[].{state, state_ticks_left}`
  - `drifters` and `charms` arrays. Each replaces the default list.
  - Flags `random_drifters` and `wind_enabled`.
- **Inputs:** add `dash` and `pause`. Both trigger on a false → true edge.
- **New events:**

| Event | Data |
|---|---|
| `dash` | `{}` |
| `charm_picked` | `{charm_id, charm_ticks}` |
| `drifter_steal` | `{drifter_id, amount, carried}` |
| `drifter_drop` | `{drifter_id, amount}` |
| `night_start` | `{night}` |
| `paused` | `{}` |
| `resumed` | `{}` |

- `player_hit` from a fall gets a `lost` field.
- **Shade state names:** `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- **Performance:** a full headless night (up to 21,600 ticks) must finish in ≤ 30 s.

## Phase 2 TA clarifications
- A shade's `spawning` state lasts 60 ticks. It deals no damage and fades in, then becomes `wander`. Scenario shades start in `wander`.
- **Start points:** Night 2 at (0,0,0) facing +Z. Night 3 at (0,0,−15) facing +Z.
- `player.invuln` in snapshots is a boolean. Scenarios use `player.invuln_ticks`.
- `night_start` is at tick 1, because tick 0 has no events. Hidden tests allow ±2 ticks on timing, but we keep this convention exactly.

## Definition of Done
- Evidence for the phase's requirements.
- **All hidden Phase 1 tests still pass with the standard numbers.**
- A spec with acceptance criteria for every item in section 3 (in `assumptions.md` → Phase 2).
- The agent guide and skills are updated for the new scope, and git history shows it.
- At least 1 headless scenario per new feature.
- The normal build averages ≥ 30 FPS at 1280×720.
