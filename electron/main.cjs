// Electron shell: opens the built web game (dist/web) in a 1280x720 window.
//   npx electron .                                              play
//   npx electron . --bench --seed 42 --duration 30 --out bench.json   benchmark (Ticket-04 section 1)
// The benchmark scene runs in the renderer; this process owns the timing summary, memory polling and the output file.
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const argv = process.argv.slice(app.isPackaged ? 1 : 2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; // a following flag is not a value
};

const bench = has("--bench");
const exportPath = has("--export-leaderboard") ? val("--export-leaderboard", "leaderboard-export.json") : null;

// leaderboard file in the per-user data folder (survives restarts); entries are kept in rank order by the web code
const lbFile = () => path.join(app.getPath("userData"), "leaderboard.json");
function lbRead() {
  try {
    const v = JSON.parse(fs.readFileSync(lbFile(), "utf8"));
    return Array.isArray(v) ? v : Array.isArray(v && v.entries) ? v.entries : [];
  } catch {
    return [];
  }
}
ipcMain.on("bench-config", (e) => { e.returnValue = benchCfg; }); // null when not benchmarking
ipcMain.on("lb-read", (e) => { e.returnValue = lbRead(); });
ipcMain.on("lb-write", (e, entries) => {
  if (!Array.isArray(entries) || entries.length > 10) { e.returnValue = false; return; } // only a top-10 list is ever stored
  try {
    fs.mkdirSync(path.dirname(lbFile()), { recursive: true });
    fs.writeFileSync(lbFile(), JSON.stringify(entries, null, 2) + "\n");
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});
const benchCfg = bench ? { seed: Number(val("--seed", "42")), duration: Number(val("--duration", "30")), out: val("--out", "bench.json") } : null;
if (benchCfg && (!Number.isInteger(benchCfg.seed) || !Number.isFinite(benchCfg.duration) || benchCfg.duration <= 0)) {
  process.stderr.write("error: --bench needs an integer --seed and a --duration > 0 (seconds)\n");
  process.exit(1);
}
if (bench) {
  // vsync off, frame-rate limit off, so the measured fps is not capped by the display
  app.commandLine.appendSwitch("disable-gpu-vsync");
  app.commandLine.appendSwitch("disable-frame-rate-limit");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    useContentSize: true, // 1280x720 of page, not of the frame
    fullscreen: false,
    resizable: !bench,
    show: true,
    backgroundColor: "#0e1430",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "..", "dist", "web", "index.html"));
}

function setupBench() {
  const { benchStats } = require("./bench-stats.cjs");
  let loadMs = null;
  let peakKb = 0;
  let timer = null;
  const sample = () => {
    const kb = app.getAppMetrics().reduce((sum, m) => sum + (m.memory ? m.memory.workingSetSize : 0), 0);
    if (kb > peakKb) peakKb = kb;
  };
  ipcMain.on("bench-first-frame", () => {
    // process start = Date.now() - uptime; so load_ms = uptime at the first rendered bench frame
    if (loadMs === null) loadMs = Math.round(process.uptime() * 1000);
  });
  ipcMain.on("bench-measure-start", () => {
    sample();
    timer = setInterval(sample, 250);
  });
  ipcMain.on("bench-result", (_e, payload) => {
    if (timer) clearInterval(timer);
    if (!payload || !Array.isArray(payload.dts) || payload.dts.length === 0 || !payload.dts.every((x) => Number.isFinite(x) && x >= 0)) {
      process.stderr.write("bench failed: invalid frame times\n");
      app.exit(1);
      return;
    }
    sample();
    try {
      const s = benchStats(payload.dts);
      const r3 = (x) => Math.round(x * 1000) / 1000;
      const out = {
        contract_version: "1.3",
        avg_fps: r3(s.avg_fps),
        p1_low_fps: r3(s.p1_low_fps),
        frame_ms_p95: r3(s.frame_ms_p95),
        frames: s.frames,
        load_ms: loadMs,
        peak_mem_mb: Math.round((peakKb / 1024) * 10) / 10, // sum of workingSetSize over all Electron processes, polled every 250 ms
        vsync_off: true, // --disable-gpu-vsync and --disable-frame-rate-limit were applied
        renderer: payload.renderer,
        os: `${os.type()} ${os.release()} ${os.arch()} (${process.platform}), Electron ${process.versions.electron}, Chromium ${process.versions.chrome}`,
      };
      fs.mkdirSync(path.dirname(path.resolve(benchCfg.out)), { recursive: true });
      fs.writeFileSync(benchCfg.out, JSON.stringify(out, null, 2) + "\n");
      app.exit(0);
    } catch (err) {
      process.stderr.write(`bench failed: ${err && err.message}\n`);
      app.exit(1);
    }
  });
}

if (bench) setupBench();
app.whenReady().then(() => {
  if (exportPath) { // --export-leaderboard out.json: no window, write {"entries": [...]} in rank order and quit
    try {
      fs.mkdirSync(path.dirname(path.resolve(exportPath)), { recursive: true });
      fs.writeFileSync(exportPath, JSON.stringify({ entries: lbRead() }, null, 2) + "\n");
      app.exit(0);
    } catch (err) {
      process.stderr.write(`export failed: ${err && err.message}\n`);
      app.exit(1);
    }
    return;
  }
  createWindow();
});
app.on("window-all-closed", () => app.quit());
