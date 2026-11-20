# ADR 0001: Lantern fuel state model and the dawn win rule

- **Status:** accepted (Phase 3 kickoff). To be revised if the Phase 3 TA answers differ.
- **Context:** Ticket-03 (`docs/spec/ticket-03.md`) replaces three core rules:
  - a lit lantern now burns fuel and can go out;
  - shades may enter weak lanterns' zones and drain them;
  - the night is won by surviving to dawn with ≥ 60% of lanterns lit, not by lighting them all.

  The Phase 2 model was a lantern with `{deposited, lit}`, where `lit` could only go false → true and "all lit" ended the night.

## Decision

### 1. Lantern state
```
Lantern = { id, pos, lit, deposited, fuelU, everLit, relitCount }
```
- `fuelU` is the fuel as an integer in 1/60 units: 6000 = 100 fuel, decay 1 per tick, drain 5 per tick per shade, refuel 600 per mote.
  - Integers avoid float drift over 18,000 ticks and keep the output byte-deterministic.
  - Output is `round(fuelU / 6) / 10`: 1 decimal, exact for whole units.
- **States and transitions:**
  - `unlit(never)` → deposit to 10 → `lit` (fuel 6000, `everLit`, +100, `successful_lights++`).
  - `lit` → fuel ≤ 0 right after step 2 → `unlit(ever)`: `deposited = 0`, `lantern_out`.
  - `unlit(ever)` → deposit to 5 → `lit` (fuel 6000, `relitCount++`, +40, `successful_lights++`, `lantern_lit {relight: true}`).
  - `lit` with fuel < 6000 → refuel `used` motes (`refuel` event, +5 each).
- **Derived values** (never stored, so they can't go stale):
  - `weak = lit && fuelU < 1800`
  - `hasSafeZone = lit && fuelU >= 1800`
  - `cost = everLit ? 5 : 10`
  - `full = lit && fuelU === 6000`

### 2. Tick order additions
- **Step 2 (timers):** each lit lantern loses 1 unit plus 5 per shade that was in `drain` on it at the start of the tick.
- **Then "lights out":** every lantern with `fuelU ≤ 0` goes out, in id order.
- Draining shades of a lantern that went out switch to `wander` in step 8.
- Refuel push-out reuses the Phase 2 "just lit" push-out. It triggers whenever a lantern **gains** its safe zone, either by lighting or by a refuel that crosses 30.

### 3. Shades
- `drain` joins the shade states.
- **wander:**
  - Target = the nearest weak lit lantern (tie → smaller id), else the nearest unlit lantern.
  - Move towards it at `shade_speed` and stop when ≤ 2 m away.
  - Within ≤ 2 m of a **weak** target → `drain`.
- This replaces our Phase 2 default where wander shades stood still. The ticket says "go to the nearest unlit lantern, as before", so moving towards unlit lanterns is now the rule.
- A shade's target is only re-picked while it is in `wander`. A chasing shade keeps chasing Mây.

### 4. End of night
- The game ends only on `no_flames` (any tick) or at dawn (the tick where time reaches 0).
- At dawn: `lit count ≥ ceil(total × 6 / 10)`, computed in integers to avoid float error. If so → won, `dawn_survived`; otherwise lost, `dawn`.
- The win bonus is added on the `game_over` tick: Σ over lit lanterns of (50 + floor(fuel)), plus 50 × flames.

## Consequences
- **Removed:**
  - early-win code paths;
  - the `all_lit` reason;
  - `per_second_left` scoring (tuning value becomes 0, so the key stays for v1.0 shape compatibility).
- **Tests:**
  - Every Phase 1/2 scenario that relied on an early win, on score values, on night lengths or on stationary wander shades is updated or deleted with a reason in `docs/notes/changes.md`.
  - The breaking changes are listed in `CHANGELOG.md`.
- **Risk:** `fuel` rounding at the .x5 boundary. We round half up on whole 1/60 units, and the scenarios avoid exact .x5 values.
