# Phase 3 handoff: build with Sonnet (30 minutes, deadline 2h30)

Kickoff was done on Opus. It produced:
- the spec: `docs/spec/ticket-03.md`
- the design: `docs/adr/0001-lantern-fuel-and-dawn-win.md` (the **lantern model and the tick order are decided there**)
- the decisions and acceptance criteria: `docs/notes/assumptions.md` → Phase 3
- `CHANGELOG.md` (the DoD changelog, already filled in)
- 13 scenarios written before the code: `tests/scenarios/p3-*`, marked `pending`

`src/` is untouched.

## How to start
1. In the Sonnet session: `/clear`, then `/model sonnet`. Effort medium.
2. Paste the prompt below.
3. This phase is short. If step 3 isn't green by about **2h20**, stop the web work, run `/phase release 3`, and tag what passes. Record the rest as NOT DONE.

## Prompt to paste (Sonnet)
```
Phase 3 build (30 min budget). Read docs/notes/handoff-phase3.md, docs/adr/0001-lantern-fuel-and-dawn-win.md,
docs/spec/ticket-03.md and docs/notes/assumptions.md (Phase 3 section) first. Decisions there are final; don't re-decide.
Follow the build order in the handoff, one commit per step, `npm run verify` before each commit.
Un-pend each p3 scenario only when built; never change its expected values (if one looks wrong, stop and show me the
arithmetic). Old p1/p2 scenarios broken by the new rules: update by arithmetic or delete — one line each in
docs/notes/changes.md (scenario, old → new, why). Never skip silently. Headless first; stop after step 3 and show me verify.
```

## Build order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | **Contract v1.2.** Add the 8 new tuning keys and set durations to 240/270/300. Score keys per Q3-1: `per_mote` 5, `per_second_left` 0, the rest unchanged. Put relight +40, drain-stun +15 and the dawn bonus in `WORLD`. Update `contract.test.ts` to expect v1.2. | `config.ts`, `game.contract.json`, `tests/contract.test.ts` | contract test green |
| 2 | **Lantern model** (ADR §1–2). Fuel in integer units. Step 2: decay + drain, then lights out. Interact candidates and refuel. Relight cost 5. `ever_lit`, `relit_count`, capacity from `successful_lights`. New scoring. End rule: no early win; at dawn, `ceil(n×6/10)` gives `dawn_survived` or `dawn`, plus the dawn bonus. Snapshot, scenario and event fields for v1.2, with scenario validation (Q3-7 → exit 2). | `sim.ts`, `files.ts`, `types.ts` | `p3-fuel-decay`, `-lantern-out`, `-relight`, `-first-light-capacity`, `-refuel`, `-win-dawn`, `-lose-dawn-below`, `-no-early-win`, `-night2/3-time` green |
| 3 | **Shades** (ADR §3). Wander targets a weak lantern, else the nearest unlit one; moves at `shade_speed`, stops at 2 m. `drain` state with its transitions and the `fuel_drain` event every 60 ticks. A zone exists only at ≥ 30 fuel; a refuel that crosses 30 starts the push-out. Pulse +15 on a draining shade. **Then fix or delete the old p1/p2 scenarios** (see the impact table in `assumptions.md`) and log each one. | `sim.ts`, `tests/scenarios/*`, `changes.md` | `p3-drain`, `p3-drain-pulse-score`, `p3-weak-no-safezone` green; **zero pending**; verify green |
| 4 | **Web.** Fuel bar over lit lanterns with a 1 Hz blink below 30. HUD shows carried / capacity. Colour-blind setting saved in `localStorage`: `#00B3FF` for shade outline and eyes, `#FFFFFF` + ⚠ for warnings, unlit lanterns at scale 0.8 with a torn-paper look. Ambient light uses the current lit count. The end screen gives `dawn_survived` / `dawn` messages. | `src/web/*`, `palette.ts` | screenshots P3-W1..W3 |
| 5 | `/phase release 3` (the reviewer subagent runs here). | notes, proof | tag commands given |

**Cut order if time runs out:** first the torn-paper visual (keep the 20% squash), then the blink. **Never cut steps 1–3.**

## Pitfalls
- **Old `all_lit` code paths.** Grep for `all_lit` and `per_second_left`: neither may produce output any more.
- **Float fuel.** Use integer units only (`fuelU`), and output `Math.round(fuelU / 6) / 10`.
- **The refuel scenario depends on order.** Decay happens in step 2, *before* interact, so fuel 50 becomes 49.983 and needs 6 motes, not 5.
- **The dawn tick** is the step where time reaches 0. Lanterns are checked **after** that step's decay and lights out.
