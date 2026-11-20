// Electron shell: opens the built web game (dist/web) in a 1280x720 window. Bench and leaderboard export are added in later steps.
const { app, BrowserWindow } = require("electron");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: false,
    resizable: true,
    backgroundColor: "#0e1430",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "..", "dist", "web", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
