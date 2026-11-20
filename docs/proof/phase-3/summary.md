# Phase 3 evidence (Ticket-03, Contract v1.2)

- Commit `f5a19f7` + release notes, date 2026-11-20, machine Darwin 24.0.0 arm64, node v21.6.1
- `npm run verify`: green, 87 tests (79 scenario folders, 0 pending; contract hygiene, CLI, perf, `matches()`). Raw log: `vitest.txt`.
- Determinism: full nights (seed 7, 18000 ticks) on Night 1, 2 and 3 run twice and `cmp` identical; every scenario also runs twice inside the test.
- Raw runs (untouched output): `runs/*.jsonl.txt` (`.txt` only because `*.jsonl` is git-ignored).
- Independent review: `contract-reviewer`; findings and actions in `docs/notes/changes.md` ("Phase 3 release").

| Requirement | Criterion | How verified | Evidence | Result |
|---|---|---|---|---|
| P3-01 | `game.contract.json` v1.2: the 8 new keys, durations 240/270/300, score keys per Q3-1 | unit test | `tests/contract.test.ts` in `vitest.txt` | PASS |\n| P3-02 | A lit lantern loses 1 fuel/s: 100 at t0, 99 at t60, 98 at t120 | headless scenario | `p3-fuel-decay` in `vitest.txt` | PASS |\n| P3-03 | Fuel reaches 0 → `lantern_out` at t60 (from fuel 1), unlit, deposited 0, `ever_lit` true | headless scenario | `p3-lantern-out` in `vitest.txt` | PASS |\n| P3-04 | Relight costs 5: `lantern_lit relight:true`, +5×5 + 40 = 65, `relit_count` 1, capacity 12 | headless scenario | `p3-relight` in `vitest.txt` | PASS |\n| P3-05 | First light: `relight:false`, +5 + 100, capacity 12 | headless scenario | `p3-first-light-capacity` in `vitest.txt` | PASS |\n| P3-06 | Refuel uses ceil((100−fuel)/10) motes after this tick's decay (49.983 → 6 motes), fuel capped at 100, +30 | headless scenario | `p3-refuel` in `vitest.txt` | PASS |\n| P3-07 | A wander shade next to a weak lantern (fuel 20) drains it (`drain`, `fuel_drain`), the lantern goes out, the shade returns to wander | headless scenario | `p3-drain` in `vitest.txt` | PASS |\n| P3-08 | Pulse on a draining shade → +15 | headless scenario | `p3-drain-pulse-score` in `vitest.txt` | PASS |\n| P3-09 | A weak lantern (< 30) has no safe zone: a chasing shade reaches Mây next to it | headless scenario | `p3-weak-no-safezone` in `vitest.txt` | PASS |\n| P3-10 | Dawn with 3/5 lit → won `dawn_survived`, score 3×(50+99) + 3×50 = 597 | headless scenario | `p3-win-dawn` in `vitest.txt` | PASS |\n| P3-11 | Dawn with 2/5 lit → lost `dawn` | headless scenario | `p3-lose-dawn-below` in `vitest.txt` | PASS |\n| P3-12 | All 5 lit before dawn → no `game_over`, still playing | headless scenario | `p3-no-early-win` in `vitest.txt` | PASS |\n| P3-13 | Night 3 lasts 300 s | headless scenario | `p3-night3-time` in `vitest.txt` | PASS |\n| P3-W1 | Fuel bar on lit lanterns, 1 Hz blink below 30 | screenshot | `img/p3-w1-*.jpg` | PASS (manual) |\n| P3-W2 | Colour-blind setting (saved): shade outline #00B3FF, warnings #FFFFFF with ⚠, unlit lanterns squashed 20% and torn | screenshot | `img/p3-w2-*` (on and off) | PASS (manual) |\n| P3-W3 | HUD shows carried / capacity | screenshot | `img/p3-w1-fuel-bar-low-red-and-capacity-6of16.jpg` (mote bar 6/16) | PASS (manual) |\n| P3-D1 | ADR written; `CHANGELOG.md` lists the breaking changes; every changed or deleted old scenario has a reason | docs | `docs/adr/0001-lantern-fuel-and-dawn-win.md`, `CHANGELOG.md`, `docs/notes/changes.md` (every changed/deleted scenario with a reason) | PASS |

## Added after the independent review
`p3-fuel-implies-lit` and `p3-unlit-full-deposit` (scenario edge cases) were written red first, then fixed; the win threshold now comes from `TUNING.win_ratio`. Details: `docs/notes/changes.md` ("Phase 3 release").

## Regression of Phases 1-2
Every earlier scenario still passes. 17 were re-derived by arithmetic and 1 deleted because Ticket-03 replaced the rule they tested (night lengths, score values, no early win, lit lanterns as refuel candidates, moving wander shades). Each is one line in `docs/notes/changes.md` with the old value, the new value and the reason. `all_lit` and the time bonus no longer appear in `src/` (grep).

## Not done / honest notes
- Web screenshots use the debug handle `window.__ddl.sim` to set fuel, capacity and a shade; a real shade draining a real lantern was verified in headless scenarios only (`p3-drain`), not seen in the browser.
- The torn-paper look is subtle at normal camera distance (the 20% squash is obvious); no colour-blind simulator was used.
- No new sound effects for refuel / lantern out (existing pickup and lose sounds are reused).
- No human play-through of Phase 3 is recorded.
- Q3-1..Q3-8 in `docs/notes/assumptions.md` are our defaults, unconfirmed by the TA.

## Reproduce
```bash
npm ci && npm run build && npm run verify
node dist/headless.js --seed 1 --night 3 --ticks 18000 --out out/a.jsonl
node dist/headless.js --seed 1 --night 3 --ticks 18000 --out out/b.jsonl && cmp out/a.jsonl out/b.jsonl
npm run play
```
