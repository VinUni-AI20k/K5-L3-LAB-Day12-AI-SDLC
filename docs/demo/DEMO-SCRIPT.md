# Demo video script (under 5 minutes): to be recorded by the author

The video is **not recorded yet** (an agent cannot record the screen). Record it with Cmd+Shift+5, save it as `docs/demo/demo.mp4` or attach it to the GitHub Release, and put the link at the top of README.

| Time | Show |
|---|---|
| 0:00 | Title, one sentence about the game |
| 0:10 | `npx electron .`: menu, Night 1 intro, play about 60 s live (pick fireflies, light a lantern, refuel, a pulse, a shade drain a low lantern) |
| 1:30 | Night 2 or 3 briefly (bridge or tiers, wind caption) |
| 2:00 | Settings: rebind a key, large text, colour-blind palette; leaderboard name entry |
| 2:40 | Terminal: `npm run verify` (green), then one headless run `node dist/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl` |
| 3:20 | `npx electron . --bench --seed 42 --duration 30 --out bench.json` (the window), then `cat bench.json` |
| 3:50 | `node dist/soak.js --seed 7 --nights 10 --out soak.json`, `cat soak.json` |
| 4:20 | Scroll through `CLAUDE.md`, `.claude/`, `docs/notes/harness.md` and `git log --oneline` |
| 4:45 | End card: repository and release links |

Compress with QuickTime export or `ffmpeg` if it is over the size limit.
