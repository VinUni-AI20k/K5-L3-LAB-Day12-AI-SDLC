# P4-11: fresh-clone check and release zip

Date 2026-11-20, Apple M1 MacBook Air 16 GB, macOS 15 (Darwin 24.0.0), Node v21.6.1. Clone of commit `1a71cbd` made with `git clone` into a temporary folder (committed files only).

| Step | Result |
|---|---|
| `npm ci` | ok, Electron 39.8.10 binary installed (the npm cache was warm, so it took 4 s; a cold install downloads the binary and needs network access) |
| `npm run build` | ok: `dist/headless.js`, `dist/soak.js`, `dist/web`, `electron/bench-stats.cjs` |
| `npx electron .` | the window process was still running after 8 s (killed by me); the game window itself was not looked at in this check |
| `node dist/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl` | exit 0, last line `{"type":"end","ticks":600,"state":"playing","score":0}` |
| `node dist/soak.js --seed 7 --nights 10 --out out/soak.json` | exit 0, 0 crashes, `mem_start_mb` 34.8, `mem_end_mb` 91.7 (ratio 2.63: the memory threshold is still NOT MET, same cause as in `soak.json`) |
| `npx electron . --bench --seed 42 --duration 10 --out out/bench.json` | exit 0, 987 frames |
| `npx electron . --export-leaderboard out/lb.json` | exit 0, `{"entries": []}` (fresh user, nothing saved in that folder yet) |

## Bench numbers vary with machine load (important)
- The first committed bench.json (30 s, before the review fix, renderer at devicePixelRatio 2 on this Retina display): avg 211.6 fps, 1% low 124.1 fps, load 357 ms. It was replaced by a run with the pixel ratio forced to 1: avg 275.1, 1% low 145.8, load 623 ms.
- Runs made later, with the author's other apps open (a 10 s run in the clone and two 10 s runs in the repo): avg 98.6 / 90.6 / 93.8 fps, 1% low 37.8 / 30.8 / 31.4 fps, load 548-648 ms.
- So the thresholds (avg >= 60, 1% low >= 30, load <= 10 s) were met in every run, but the 1% low was close to 30 in the later pre-fix runs. Treat the committed numbers as one run on this machine, not as a guarantee.

## Release zip
`npm run release:zip` wrote `release/dao-den-long-web-v1.0.0.zip` (index.html, assets/, LICENSE, HOW-TO-RUN.txt). Unzipped and served with `python3 -m http.server`: `/` and the JS asset both returned HTTP 200. The game was not opened from that served copy in a browser.
