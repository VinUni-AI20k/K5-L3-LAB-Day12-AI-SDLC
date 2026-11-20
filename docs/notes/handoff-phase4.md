# Phase 4 handoff: build and release with Sonnet (90 minutes, deadline 4h)

Kickoff was done on Opus:
- the spec: `docs/spec/ticket-04.md`
- the decisions (Electron, commands, bench/soak details) and criteria P4-01…13: `docs/notes/assumptions.md` → Phase 4

Phase 4 adds no game rules, so there are no pending scenarios. The new checks are unit tests on pure modules, listed per step below.

## Time plan (from 2h30)
| Until | Work |
|---|---|
| 3h05 | Steps 1–3: contract v1.3, soak, bench. Headless and numbers first, because they are scored automatically. |
| 3h30 | Steps 4–5: leaderboard and accessibility. |
| 3h40 | Step 6: README, CHANGELOG, CREDITS, release zip, and a fresh-clone check. |
| 3h45 | Step 7: `/phase release 4`, then tag `phase-4` and push. |
| 4h00 | **Done by the human, not Sonnet:** the retro, recording the demo video, creating the GitHub Release, and attaching the zip and video. |

## Prompt to paste (Sonnet, after `/clear` + `/model sonnet`)
```
Phase 4 build. Read docs/notes/handoff-phase4.md, docs/spec/ticket-04.md and docs/notes/assumptions.md (Phase 4) first.
Decisions there are final (Electron shell, commands, bench/soak details). Follow the build order, one commit per step,
`npm run verify` before each commit. Write each listed unit test BEFORE the module, with hand-computed expected values.
Bench/soak must not change headless contract output: every p1/p2/p3 scenario must stay green. Keep to the time plan;
if a step overruns, finish the minimum in the "Must" column and move on. Stop after step 3 and show me bench.json + soak.json.
```

## Build order
| # | Step | Must (scored) | Nice (cut first) | Tests (write first) |
|---|---|---|---|---|
| 1 | **Contract v1.3.** Set `contract_version` 1.3, `run_cmd` `npx electron .`, `bench_cmd` `npx electron . --bench`, `soak_cmd` `node dist/soak.js`. Add an esbuild entry for `dist/soak.js` and `electron/main.cjs` + `preload.cjs`. Pin `electron` as an exact devDependency at least 2 weeks old (check `npm view electron time`). Set `"main": "electron/main.cjs"`. | contract test green; `npm ci && npm run build` still works | | `contract.test.ts`: version 1.3, both new commands present |
| 2 | **Soak** (`src/soak/soak.ts`). Run 10 nights in one process, rotating night 1→2→3 with seed 7+i. Use seeded random input exactly as the ticket specifies. Catch exceptions per night and count them as crashes. Measure RSS with `process.memoryUsage().rss`. Run it and commit `soak.json`. | `soak.json` committed with crashes 0 and ratio ≤ 1.2 | | `soak.test.ts`: a 2-night run has the right shape and the same results twice |
| 3 | **Bench.** Sim option `bench: true` (ADR-free, but list it in `assumptions.md`): 200 wander shades, 100 motes, L1–L3 lit at fuel 100, and no spawns, damage, pickup, decay or end. In Electron `--bench`: a 1280×720 window with the vsync-off switches. The renderer runs the bench scene with the camera path, a 3 s warm-up, then measures `--duration` s from rAF frame deltas and sends the deltas over IPC. The main process computes the stats (shared pure `benchStats(dts)`), peak memory from `app.getAppMetrics()` polled every 250 ms, and `load_ms`. It writes `--out` and quits with code 0. Run it and commit `bench.json`. | `bench.json` committed; the numbers recorded honestly even if below the thresholds | creative extras auto-off check | `bench-stats.test.ts`: N=4 hand case (dt 10,10,10,40 → avg 1000·4/70 = 57.143, p1-low k=1 → 25, p95 = 40); `bench-scene.test.ts`: counts and flags after 600 ticks |
| 4 | **Leaderboard** (`src/web/leaderboard.ts`, pure, with storage injected). Name rule, top 10, sort, ISO time with offset. Electron stores the file in `userData/leaderboard.json` through preload IPC; web uses `localStorage`. Add the name-entry screen after Dawn or a loss, and a menu screen. `npx electron . --export-leaderboard out.json` writes `{"entries":[...]}` with no window. | export works; persists after a restart | Vietnamese names | `leaderboard.test.ts`: invalid names, the 11th entry is dropped, a tie keeps the earlier one first, export order |
| 5 | **Accessibility.** Keymap module: 10 actions, conflict detection, defaults, saved. Settings UI with rebinding. Captions: shade appears + edge arrow, wind incoming, last 10 s, lantern < 30. Reduced motion (no shake, no flash). Base UI font ≥ 18 px; large text ×1.25. | rebinding + conflicts + restore; captions; 18 px | edge-arrow polish | `keymap.test.ts`: duplicate detection, restore defaults |
| 6 | **Packaging and docs.** README sections per the ticket, with a screenshot in `docs/proof/phase-4/img/`. CHANGELOG `[phase-4]` entry. CREDITS gets Electron (MIT). Add `npm run release:zip`, which zips `dist/web` into `release/dao-den-long-web-v1.0.0.zip`. **Fresh-clone check:** clone to a temp dir, run the 3 commands, then run headless, soak and the bench once. | all of the above | GIF | |
| 7 | Run `/phase release 4`. It runs verify, writes the proof (bench and soak numbers, machine spec from `system_profiler SPHardwareDataType` or `uname`), and runs the `contract-reviewer`. Then commit, give the user `git tag phase-4 && git push origin HEAD phase-4`, and stop. | | | |

## The human finishes (last 15 minutes)
1. **Retro** (`docs/notes/retro.md`, 1–2 pages). Sonnet can draft it from `ai-log.md`, `changes.md`, `harness.md` and the per-phase evaluations, but **you** check it, especially the % of your limit used per phase.
2. **Video** (Cmd+Shift+5, under 5 minutes):
   - live play of Night 1;
   - `npm run verify` passing;
   - one headless run;
   - the bench window and `bench.json`;
   - `soak.json`;
   - a quick scroll through the harness and `git log`.

   Compress with QuickTime export, or `ffmpeg` if installed.
3. **GitHub Release v1.0.0** in the web UI, since `gh` is not installed. Attach the zip and `demo.mp4`. Put the video link at the top of README, then commit and push. Tag first; the release content can follow before 4h.

## Pitfalls
- **Electron on the grading machine.** `npm ci` downloads the Electron binary. Note in README that the first install needs network access.
- **Never let bench code touch headless output.** The `bench` flag must not be readable from scenario files.
- **Soak memory.** Release each night's `Sim` before the next; don't keep event arrays across nights. Measure `mem_end` after the reset, as the ticket specifies.
- **The 3-command rule.** `npm ci`, `npm run build`, `npx electron .` (or `npm run play`). Keep `npm run dev` documented as the browser alternative.
