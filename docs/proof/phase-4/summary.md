# Phase 4 evidence (Ticket-04, Contract v1.3), release v1.0.0

- Commit `4051071` + release notes, 2026-11-20. Machine: MacBook Air, Apple M1 (8 cores: 4 performance + 4 efficiency), 16 GB, macOS 15.0 (Darwin 24.0.0 arm64), Node v21.6.1, Electron 39.8.10 (Chromium 142).
- `npm run verify`: green, 133 tests in 8 files (79 scenario folders, **0 pending**, unit tests for bench stats/scene, soak, leaderboard, keymap, contract hygiene, perf). Raw log: `vitest.txt`.
- Phase 1-3 regression: `git diff 0725404..HEAD -- tests/scenarios` is empty: no scenario was edited in this phase, and all 79 pass.
- Determinism: full nights (seed 7, 18000 ticks) on Night 1, 2 and 3 identical across two runs; the soak `results` array is identical across two runs.
- Independent review: `contract-reviewer`; findings and actions in `docs/notes/changes.md` ("Phase 4 release").

## Measured requirements
| Requirement | Threshold | Result | Evidence | Status |
|---|---|---|---|---|
| Bench `avg_fps` | >= 60 | 275.148 | [bench.json](../../../bench.json) (30 s, seed 42, pixel ratio 1) | MET on this machine |
| Bench `p1_low_fps` | >= 30 | 145.767 | same | MET |
| Bench `load_ms` | <= 10000 | 623 | same | MET |
| Bench other fields | | `frames` 8255, `frame_ms_p95` 4.4, `peak_mem_mb` 427.1 (sum of workingSetSize over all Electron processes, not the ticket's single-process RSS), `vsync_off` true, renderer ANGLE Metal Apple M1 | same | recorded |
| Soak crashes | 0 | 0 | [soak.json](../../../soak.json) | MET |
| Soak memory | `mem_end` <= 1.2 x `mem_start` | 34.1 -> 84.4 MB = **2.48** | same, and `docs/notes/assumptions.md` | **NOT MET** (not a leak: JS heap flat at 3-6 MB; native warm-up; author decided to report the literal number) |

**Bench caveat:** the earlier committed run (avg 211.6, 1% low 124.1) was replaced after the review found the renderer used devicePixelRatio 2 on this Retina display; it now renders at pixel ratio 1. Runs made before that fix with other apps open gave about 91-99 average fps and a 1% low of 31-38, so results depend on machine load and resolution. See `fresh-clone.md`.

## Requirement -> evidence
| ID | Criterion | How verified | Evidence | Result |
|---|---|---|---|---|
| P4-01 | contract v1.3 with `bench_cmd`, `soak_cmd`, earlier keys unchanged | unit test | `tests/contract.test.ts` | PASS |
| P4-02 | bench statistics follow the ticket | hand-computed unit tests (N=4, 100, 200, 1) | `tests/bench-stats.test.ts` | PASS |
| P4-03 | bench writes a valid `bench.json`, exits 0, thresholds met | real run | `bench.json`; exit code 0 (several runs); invalid `--duration` now exits 1 | PASS on this machine |
| P4-04 | bench scene: 200 wander shades, 100 motes, L1-L3 lit at fuel 100; spawns, damage, pickup, decay, end off; unreachable from files | unit test | `tests/bench-scene.test.ts` | PASS |
| P4-05 | soak: 10 nights, 0 crashes, memory ratio <= 1.2, same seed -> same results | real run + unit test | `soak.json`, `tests/soak.test.ts` | crashes/determinism PASS; **memory NOT MET** |
| P4-06 | leaderboard rules and export format | unit tests + real export | `tests/leaderboard.test.ts`, `leaderboard-electron.md` | PASS |
| P4-07 | leaderboard persists across a restart | Electron write over IPC, two fresh export processes | `leaderboard-electron.md` | PASS (in-game name screen not clicked inside Electron) |
| P4-08 | rebinding of all ticket actions, duplicates reported, restore defaults, saved | unit tests + browser | `tests/keymap.test.ts`, `accessibility.md` | PASS (9 actions per the ticket; the handoff said 10) |
| P4-09 | captions (shade appears + edge arrow, wind, last 10 s, lantern < 30) | screenshots | `img/p4-a11y-caption*` | PASS (states set with the debug handle) |
| P4-10 | reduced motion; text >= 18 px; large text x1.25 | measured in browser + code | `accessibility.md` | PASS; the hit flash and shake were not triggered in the browser |
| P4-11 | clean clone -> 3 commands -> playable; README sections | fresh clone | `fresh-clone.md`, `README.md` | PASS (window not looked at) |
| P4-12 | Release v1.0.0 with a runnable build; tag `phase-4` | zip built and served | `release/dao-den-long-web-v1.0.0.zip` (git-ignored) | zip PASS; **GitHub Release and tag: author to do** |
| P4-13 | hidden Phase 1-3 tests still pass | scenarios | 79 green, 0 pending, no scenario edited | PASS |
| P4-D1 | retro, demo video < 5 min, CHANGELOG all 4 phases, CREDITS | docs | `CHANGELOG.md`, `CREDITS.md` | CHANGELOG/CREDITS PASS; **retro and demo video: author to do** |

## Not done / honest notes
- Soak memory threshold NOT MET (above).
- Retro, demo video and the GitHub Release are the author's (handoff: "the human finishes").
- Screenshots of accessibility states used the debug handle (`window.__ddl.sim`), not play; no human play-through of Phase 4 features is recorded.
- Bench numbers depend on machine load; only one machine was used; no Linux run.
- Electron is pinned to 39.8.10 because newer installers fail on Node 21; behaviour on other Node versions was not tested.

## Reproduce
```bash
npm ci && npm run build && npm run verify
npx electron . --bench --seed 42 --duration 30 --out bench.json
node dist/soak.js --seed 7 --nights 10 --out soak.json
npm run release:zip
```
