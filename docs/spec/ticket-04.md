# Ticket-04 "Bình minh: phát hành v1.0.0" — condensed spec (Phase 4, Contract v1.3)

Source: lab board, Phase 4 tab, pasted by the user at the 2h30 mark. All v1.0–v1.2 rules stay.

Creative extras stay, but must be **off in the bench and soak scenes**, so every submission is measured on the same standard scene.

## 1. Benchmark
- **Command:** `<bench_cmd> --seed 42 --duration 30 --out bench.json`
- **Window:** 1280×720, not fullscreen. Turn vsync off if possible; if not, say so in README.
- **Scene:** Night 1 with full effects and lighting.
  - Exactly **200 shades** in `wander`, spread evenly over the island using seed 42.
  - Exactly **100 motes**. The bench may exceed the gameplay cap.
  - L1–L3 lit with fuel 100.
- **Switched off in the bench:**
  - spawning
  - damage
  - pickup
  - fuel decay
  - end of night
  
  Shades still move by the normal wander rule.
- **Camera:**
  - No player input; Mây stands still at (0,0,0).
  - The camera flies a circle around (0,0,0) with radius 30 m at Y = 15, always looking at (0,0,0).
  - It starts at angle 0°, which is the point (30,15,0).
  - It turns counter-clockwise seen from above, one lap per 15 s.
- **Timing:** 3 s warm-up (not measured), then measure exactly `--duration` s, then exit with code 0.
- **Output** (`bench.json`):
  ```
  {contract_version "1.3", avg_fps, p1_low_fps, frame_ms_p95, frames, load_ms, peak_mem_mb, vsync_off, renderer, os}
  ```

  | Field | Definition |
  |---|---|
  | `frames` | N, the number of frames in the measured window |
  | `avg_fps` | `1000·N / Σdt_i`, with `dt_i` each frame's time in ms |
  | `p1_low_fps` | k = `max(1, ceil(0.01·N))`; `1000 / mean(k largest dt)` |
  | `frame_ms_p95` | 95th percentile of `dt` |
  | `load_ms` | from process start to the first frame of the bench scene |
  | `peak_mem_mb` | peak process RSS during measurement; `null` for a web build that can't measure it, with an explanation |
- **Pass thresholds** on the instructor's machine:
  - `avg_fps` ≥ 60
  - `p1_low_fps` ≥ 30
  - `load_ms` ≤ 10000

## 2. Soak test
- **Command:** `<soak_cmd> --seed 7 --nights 10 --out soak.json`. Headless, one process.
- **Nights:** 10 in a row, rotating Night 1 → 2 → 3. Night *i* uses seed `7 + i`.
  - Each night runs until it ends or its standard length runs out.
- **Seeded random input:**
  - Pick a new move direction every 30 ticks.
  - Each tick: 5% jump, 3% dash, 2% pulse, 10% interact.
- **Memory:**
  - `mem_start_mb` = RSS after the first night has loaded.
  - `mem_end_mb` = RSS after the last night has been reset.
- **Output:**
  ```
  {"nights":10,"crashes":0,"results":[...10],"mem_start_mb","mem_end_mb","duration_s"}
  ```
- **Pass:** `crashes` = 0 and `mem_end_mb` ≤ 1.2 × `mem_start_mb`.

## 3. Local leaderboard
- **When:** enter a name after the Dawn screen (Night 3 won) or after a loss on any night.
- **Name:** 3–12 characters from `[A-Za-z0-9_]`. Vietnamese with diacritics is a bonus, not required.
- **Entry:**
  - `name`
  - `score` (sum of the nights won)
  - `nights_won` (0–3)
  - `achieved_at` (ISO 8601 with time zone)
  - `seed`
- **Ranking:** keep the top 10, by score descending. On equal score, the earlier entry ranks higher.
- **Storage:** on local disk, surviving a restart.
- **Menu:** a Leaderboard screen from the main menu.
- **Export:** `<run_cmd> --export-leaderboard out.json` writes `{"entries":[...]}` in rank order.

## 4. Accessibility
- **Key rebinding:** every action can be rebound:
  - move (4 directions)
  - jump
  - dash
  - interact
  - pulse
  - pause

  Duplicate keys are detected and reported. There is a "Restore defaults" button. Bindings are saved.
- **Captions and visual cues:**
  - a shade appears, with an arrow at the screen edge pointing to it
  - wind is coming
  - the last 10 s
  - a lantern below 30 fuel
- **Reduced motion:** turns off camera shake and screen flashes.
- **UI text:** at least 18 px at 1280×720. A large-text option scales it ×1.25.

## 5. Packaging and docs
- From a clean clone, at most 3 commands in README make the game playable.
- **README covers:**
  - a short description
  - a screenshot or GIF
  - system requirements
  - install
  - controls
  - tests
  - headless
  - bench
  - soak
- **Other files:**
  - `CHANGELOG.md` with a section for all 4 phases
  - `CREDITS.md` listing every asset, sound and AI tool used to make content
  - `LICENSE`
- **GitHub Release v1.0.0** with a runnable build: an executable, a static web folder, or a Docker image, with instructions.

## 6. Contract v1.3
- `contract_version` is `"1.3"`.
- `game.contract.json` adds `bench_cmd` and `soak_cmd`.
- Everything from v1.0–v1.2 still holds.

## 7. Retro and demo
- **Retro** (1–2 pages):
  - the evaluation of all 4 phases
  - what worked and what didn't with AI
  - the AI's mistakes and how they were caught
  - the most useful harness piece
  - total tokens/cost and how tokens were saved
  - what to change next time
- **Demo:** an `.mp4` under 5 minutes, attached to the release or at `docs/demo/demo.mp4`. It shows live play plus evidence: tests, headless runs and the bench.

## Definition of Done
- Evidence for the phase.
- Tag `phase-4` and Release `v1.0.0`.
- `bench.json` and `soak.json` from our own runs, **committed**.
- Hidden Phase 1–3 tests still pass.
- The repo is public, with the full harness and docs.
