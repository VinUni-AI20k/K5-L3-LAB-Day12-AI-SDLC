# Ticket-03 "Đèn cạn dầu" — condensed spec (Phase 3, Contract v1.2)

Source: lab board, Phase 3 tab, pasted by the user at the 2h mark. This is a change request that **replaces** core rules, marked [REPLACES] below.

Everything in Ticket-02 not mentioned here still holds (`docs/spec/ticket-02.md`). Creative extras that conflict with the new rules must follow the new rules.

**Why the change:** good players lit every lantern in 2 minutes. The goal changes from "light them all" to "keep the island lit until dawn".

## 1. Lantern fuel [REPLACES "a lit lantern accepts no more motes"]
- **Fuel:** max 100. On lighting (first time or relight), fuel = 100.
- **Decay while lit:** 1.0 per second, i.e. 1/60 per tick.
- **Precision:** keep fuel in whole 1/60 units (max 6000). Round only on output.
- **Refuel:** Interact at a lit lantern:
  - `used = min(carried, ceil((100 − fuel) / 10))`
  - `fuel = min(100, fuel + 10 × used)`
  - `carried −= used`
  - A full lantern (used = 0) is not a candidate: no event, no score.
- **Interact target:** only lanterns that can take motes, i.e. unlit, or lit and not full. The nearest wins; on a tie, the smaller id.
- **Out of fuel (fuel ≤ 0):**
  - The lantern goes **out**: `lit = false`, `deposited = 0`, event `lantern_out`. Ambient light drops to match.
  - The lantern remembers `ever_lit = true`.
- **Relight:** a lantern with `ever_lit` needs only **5** motes. A lantern never lit still needs 10.
- **Display:** a fuel bar on each lit lantern. Below 30 fuel, the lantern and its bar blink slowly (1 Hz).

## 2. Shades drain fuel [REPLACES "shades never enter a safe zone"]
- **Weak lanterns:** a lantern with fuel **< 30** loses its safe zone. At exactly 30 it keeps it.
- **Wander targeting:** only **wander** shades pick a target.
  - They go to the nearest lit lantern with fuel < 30; on a tie, the smaller id.
  - If there is none, they go to the nearest **unlit** lantern, "as before".
  - A chasing shade doesn't change target.
- **Drain:** within ≤ 2 m (XZ) of that lantern, the shade enters the new state **`drain`**.
  - It stands still and drains 5 fuel/s (5/60 per tick).
  - Several shades add up, and the lantern still decays 1/s on its own.
- **Leaving drain:**
  - → `chase` if Mây comes within 6 m.
  - → `stunned` if hit by a pulse.
  - → `wander` if the lantern goes out, is refuelled to ≥ 30, or the shade is > 2 m away.
- **Stun end:** → `wander`.
- **Refuel push-out:** refuelling to ≥ 30 while shades are inside the 6 m zone pushes them out to the edge within ≤ 30 ticks, with no damage meanwhile. This is the same as when a lantern is first lit.

## 3. New win rule [REPLACES "win as soon as all lanterns are lit"]
- **Night length:** Night 1 / 2 / 3 = **240 / 270 / 300 s**.
- **Win:** Mây is alive at dawn, and the number of **lit** lanterns on the last tick is ≥ `ceil(0.6 × total)`. That is 3/5 on Night 1, 4/6 on Night 2 and 5/7 on Night 3.
- **No early win:** lighting every lantern does not end the night.
- **Loss:** flames reach 0 (immediately, even on the last tick), or dawn arrives with fewer lit lanterns than the threshold.
- **Reasons:** a win is `dawn_survived`. A loss is `dawn` or `no_flames`. `all_lit` is no longer used.
- **Tick order:** Ticket-02's order, plus:
  - Step 2 also subtracts fuel (decay + drain).
  - **Right after step 2**, any lantern with fuel ≤ 0 goes out.
  - The win/lose check comes after every update of the tick, including the dawn tick. `no_flames` always wins over the other results.

## 4. Growing capacity (new)
- `capacity = 10 + 2 × successful_lights`, max 20.
- `successful_lights` counts successful lightings this night, relights included. Lanterns preset by a scenario don't count.
- It resets to 0 at the start of each night.
- The HUD shows carried / capacity.

## 5. New score [REPLACES the whole old formula]
| Event | Points |
|---|---|
| Each mote put into a lantern (first light, relight or refuel) | +5 |
| First lighting | +100 |
| Relight | +40 |
| A shade hit by a pulse | +5 total; +15 total if it was in `drain` just before |
| Dawn, on a win only: each lit lantern | +50 + floor(fuel) |
| Dawn, on a win only: each flame left | +50 |
| Time bonus | removed |

The game total and the replay rules are unchanged from Ticket-02.

## 6. Colour-blind mode (new, web, saved setting "Bảng màu dễ phân biệt")
- Shade outline and eyes change from #7A3CFF to #00B3FF.
- UI warning colour changes from #FF5A5F to #FFFFFF, with a ⚠ icon.
- Lit and unlit lanterns must be distinguishable without colour:
  - An unlit lantern is squashed 20% and its paper is torn.
  - A lantern low on fuel blinks.

## 7. Test Contract v1.2
- **Version and tuning:**
  - `contract_version` is `"1.2"`.
  - New tuning keys: `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`.
  - `night1_duration_s` = 240, `night2_duration_s` = 270, `night3_duration_s` = 300.
- **Snapshot:**
  - Each lantern gets `fuel` (a number with 1 decimal; an unlit lantern has `fuel: 0`), `ever_lit` and `relit_count`.
  - `player` gets `capacity`.
  - Shades can have state `drain`.
- **Scenario:**
  - Each lantern can set `lit`, `fuel` and `ever_lit`.
  - `player.successful_lights`.
  - `shades[].target_lantern_id`.
  - A lantern set to `lit: true` with no `fuel` defaults to `fuel: 100`.
- **New events:**

| Event | Data | Notes |
|---|---|---|
| `refuel` | `{lantern_id, amount, fuel}` | |
| `lantern_out` | `{lantern_id}` | |
| `fuel_drain` | `{lantern_id, shade_id, fuel}` | written every 60 ticks while draining |

- **Changed events:**
  - `lantern_lit` gets `relight: true|false`.
  - `game_over.reason` adds `dawn_survived`. `all_lit` is no longer used.

## Definition of Done
- Evidence for the phase's requirements.
- **An ADR** on how the lantern state model and the win rule changed: `docs/adr/0001-lantern-fuel-and-dawn-win.md`.
- Old tests made wrong by the new rules are **updated or deleted with a reason**, never silently skipped.
- **A changelog** of Phase 3 breaking changes: `CHANGELOG.md`.
- All hidden Phase 1–2 tests that weren't replaced still pass.
