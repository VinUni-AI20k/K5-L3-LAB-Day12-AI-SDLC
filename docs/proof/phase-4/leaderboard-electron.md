# P4-06 / P4-07: leaderboard in Electron (file in userData)

Checked on the author's machine (macOS, Electron 39.8.10). The test wrote through the real preload bridge and IPC from the page, then exported from separate processes.

1. A throwaway wrapper ran `electron/main.cjs`, waited for the page, and called `window.ddl.leaderboard.write([...])` (2 entries). Reading back from the page returned the same 2 entries, and `~/Library/Application Support/dao-den-long/leaderboard.json` contained them.
2. `npx electron . --export-leaderboard out/lb1.json` (no window, exit 0) wrote `{"entries":[...]}` in rank order: `Cường_VN` 640 first, `mayba` 300 second.
3. A second `npx electron . --export-leaderboard out/lb2.json` in a new process produced a byte-identical file: the entries survive a restart.

Not covered: the in-game name-entry screen was exercised in the browser build (localStorage) only, not clicked inside the Electron window. The test data was deleted afterwards.
