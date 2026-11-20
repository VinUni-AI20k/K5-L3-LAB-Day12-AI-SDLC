# Requirement changes, design changes, and test changes

One entry per change: phase, what changed in the ticket, design decision (one line why), tests updated or removed (with reason).

## Phase 1 kickoff
- Ticket: PRD-0 / Test Contract v1.0 (`docs/spec/contract-v1.md`). First spec, so no earlier rule is replaced and no test is retired.
- Tuning and `game.contract.json` unchanged (CP0 values kept; the CP1 TA answers left every number to us).
- Added 36 scenario folders `tests/scenarios/p1-*` before any implementation (35 after the replacement below, plus the CP0 `p0-smoke`). They were RED against the CP0 stub on purpose: the failures were the build list for Phase 1.
- `p0-smoke` is kept as criterion P1-01 (its requirement text still says P0-01).

## Phase 1 build: scenario replaced
- Removed `p1-end-priority-flames`, added `p1-lit-expels-shade` (both P1-21).
- Why: the TA's CP1 answer 7 says shades inside the zone of a lantern that just lit must be moved out, and the sim does that before the hit step. A shade within 1 m of the player is always within 4 m of any lantern the player can deposit into (interact_radius 3), so it is always inside the 6 m zone and gets expelled. "Last lantern lit and last flame lost in the same step" is therefore impossible, and the old scenario's premise was wrong, not the sim. The new scenario asserts the expel rule; the all_lit > no_flames > dawn order is still covered by `p1-end-priority-dawn` and `p1-end-priority-flames-dawn`.
- Assumption Q9 wording updated to the counting actually used (effects count from the tick the event happens).

## Phase 1 release: contract-reviewer findings
- Fixed: overlapping lit safe zones could leave a shade inside one (single projection pass). Now the nearest point outside all lit zones is used. Scenarios `p1-safe-zone-overlap`, `p1-pulse-push-into-zone` (written first, red, then green).
- Fixed: an id-less shade could get the same id as a later explicit one. Scenario `p1-shade-ids-unique`.
- Fixed: a lantern with `deposited >= lantern_cost` and `lit:false` could never be lit; it is now lit. `deposited > lantern_cost` is exit 2 (`p1-bad-scenario-deposited`).
- Documented as Q13..Q15: win bonus floors seconds, `per_stun` is re-awarded, scenario-value handling. README pickup wording corrected (id order, not nearest).
- Tightened: `p1-pulse-stun-push` now checks t120/t121, `p1-hit-drop` checks t90/t91 (both edges). Added `p1-win-bonus-fraction`, `p1-end-priority-flames-dawn`, `p1-shade-spawn-schedule`.
- Test runner: every scenario now checks "events of tick T precede tick T's snapshot", and `absent_snapshots` is available (used by `p1-lose-no-flames`).
- Not changed: Q6 default (respawn on when `motes` listed and `random_motes` omitted) is still a guess; the reviewer flagged the risk.

## Phase 2 kickoff: Ticket-02 replaces our Phase 1 numbers (Contract v1.1)
- **What changed:** the customer standardised every number, the map and the tick order. Our own Phase 1 choices no longer apply. The full list is in `assumptions.md` → Phase 2 → "Replaced".
- **Design decision:**
  - Per-night data moves to `src/sim/maps.ts`.
  - Timers become integer tick counters.
  - Island clamping is replaced by a ground-height function and falling.
  - End order becomes no_flames → all_lit → dawn.
  - Why: the ticket fixes all of this, and hidden Phase 1 tests are re-run with the standard numbers.
- **Tests:**
  - 21 `p2-*` scenarios were added before any code, marked `pending`.
  - The runner gained `night`, `pending` (visible as skipped, and release requires zero) and `$range` (for bounds the ticket gives, like "lands on island B").
  - All `p1-*` scenarios must be **re-derived** for the v1.1 numbers in build step 7. Each change gets a line below.
  - `p1-island-clamp` is to be **deleted**: falling replaces the clamp, and P2-09 covers it.
  - `p1-end-priority-dawn` stays valid. Under the new order it is still won.
  - `p1-end-priority-flames-dawn` stays valid: no_flames is now checked first anyway.
- **Phase 1 TA answers superseded by the ticket:**
  - safe-zone expel is now gradual over ≤ 30 ticks, not an instant projection;
  - pulse targets use 3D distance;
  - dropped motes go onto a ring instead of being lost.

### Phase 2 build: p1 scenario re-derivations
_(one line per scenario: old → new value, arithmetic)_

## Phase 2 build: Ticket-02 replaces Phase 1 numbers (Contract v1.1)
The ticket fixes every number, so all Phase 1 tuning is replaced (list in `assumptions.md` → Phase 2). Expected values below were re-derived by arithmetic from the v1.1 numbers (shown in each `expect.json` → `requirement`), never copied from program output.

**Deleted**
- `p1-island-clamp`: `fall_enabled` is now true; walking off the island is a fall (replaced by `p2-fall`).

**Re-derived (rule replaced → new expected values)**
| Scenario | Why it changed |
|---|---|
| `p1-default-world` | 20 motes on fixed points, fixed lantern positions, 2 shades at t300 in `spawning` |
| `p1-deposit-lights`, `-remaining`, `-out-of-range`, `-partial` (text), `p1-interact-edge` | lantern cost 10, interact radius 2 |
| `p1-win-score`, `p1-end-priority-dawn`, `p1-win-bonus-fraction` | cost 10 (carried 10 to finish a lantern), so scores are 550 / 350 / 360 |
| `p1-pickup-boundary`, `p1-pickup-capacity` (text) | pickup radius 1.0 (+ height rule) |
| `p1-pulse-stun-push`, `-boundary`, `-cooldown`, `-empty`, `-prevents-hit`, `-push-into-zone`, `-no-light` (text) | pulse cost 3, 3D radius 5 from feet+0.8, push 4 m over 15 ticks, cooldown 180 ticks, +5 per stun |
| `p1-hit-drop` | dropped motes now stay as a ring (motes_active 2/3), shade recoils; second hit still lands at t91 |
| `p1-lit-expels-shade`, `p1-safe-zone-overlap`, `p1-shade-safe-radius` | zone push-out is 0.2 m/tick (not instant); a shade starts in `wander` and only chases within 12 m (18 to give up) |
| `p1-shade-spawn-schedule` | 2 shades at t300 then every 8 s (Night 1) on fixed points |
| `p1-inputs-accept-dash` | dash exists now: a dash from standing is 2.8 m |

**Unchanged and still green:** movement, diagonal, camera yaw, jump, setup/time model, ticks-zero, lose-no-flames, lose-dawn, shade-chase, shade ids, bad-file cases, `p1-end-priority-flames-dawn`, `p1-mote-respawn`, `p1-pulse-no-light`, `p0-smoke`.

**Order change:** the end check is now no_flames → all_lit → dawn (was all_lit first). No p1 scenario depended on the old order (`p1-lit-expels-shade` replaced the impossible case earlier).

**Handoff note:** `p2-n1-schedule` (step 4) expects `night_start` at tick 1, which the handoff lists under step 7. I implemented only that one event in step 4 so the scenario's expected values stayed untouched.

