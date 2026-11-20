# Changelog

## [phase-3] Contract v1.2: "Đèn cạn dầu" (Ticket-03)

### Breaking changes
- **Win rule:**
  - A night is won only at dawn, with ≥ ceil(0.6 × lanterns) lit and Mây alive.
  - Lighting every lantern no longer ends the night.
  - `game_over.reason` `all_lit` is removed and `dawn_survived` is added.
  - Dawn with too few lit lanterns is a loss (`dawn`).
- **Night lengths:** 300/330/360 s → **240/270/300 s**, which changes `time_left_s` for every default run.
- **Score:**
  - 10 → **5** per mote deposited.
  - +40 per relight.
  - Pulse +5, or +15 on a draining shade.
  - Win bonus: 50 + floor(fuel) per lit lantern, plus 50 per flame.
  - The time bonus is removed (`per_second_left` = 0).
- **Lanterns:**
  - They burn fuel and can go out (`lantern_out`).
  - A lit lantern accepts refuel (`refuel`).
  - A relight costs 5.
  - Snapshot lanterns add `fuel`, `ever_lit`, `relit_count`.
  - `lantern_lit` adds `relight`.
- **Safe zones:** lost below 30 fuel. Shades can enter weak lanterns' zones and drain them (new shade state `drain`, event `fuel_drain`).
- **Wander shades** move towards a weak lantern, or else the nearest unlit lantern. In Phase 2 they stood still.
- **Capacity:** 10 + 2 × successful lights, max 20 (`player.capacity`).
- **Contract:** `contract_version` "1.2". New tuning keys `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.

### Added
- Colour-blind palette setting (web).
- Lantern fuel bar with a 1 Hz blink below 30 fuel (web).

## [phase-2] Contract v1.1: "Ba hòn đảo" (Ticket-02)
- Standard numbers and three nights, plus:
  - dash, falling, drifters (Gió Lạc), charms (Bùa Gió), pause, wind, launch pads
  - menus, settings, audio, full HUD
- See `docs/spec/ticket-02.md`.

## [phase-1] Contract v1.0: PRD-0
- Night 1, the headless CLI and the first playable web build.
