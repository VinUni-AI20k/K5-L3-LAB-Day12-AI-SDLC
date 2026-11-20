# P2-W7 FPS at 1280x720

- Measured in the desktop app's built-in browser pane, viewport emulated at 1280x720, `npm run dev` (Vite dev server), Night 1 in play, F3 counter on.
- Method: `requestAnimationFrame` counted for 5 s after the game had started: **60.1 FPS average** (the F3 counter also read 60).
- Machine: Apple Silicon Mac (macOS, Darwin 24.0.0 arm64), integrated GPU. The pane is vsync-capped at 60 Hz, so 60 is the ceiling, not a stress result.
- Not measured: Night 3 with many entities, a production build (`npm run play`), a lower-end machine.
- Screenshot: `img/p2-w5-full-hud-prompt-fps60.jpg` (top-left shows "60 FPS · 1280x720").
