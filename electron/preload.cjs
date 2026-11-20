// Bridge between the web game and the Electron main process.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("ddl", {
  shell: "electron",
  leaderboard: { read: () => ipcRenderer.sendSync("lb-read"), write: (v) => ipcRenderer.sendSync("lb-write", v) },
  benchConfig: ipcRenderer.sendSync("bench-config"), // null unless started with --bench
  benchFirstFrame: () => ipcRenderer.send("bench-first-frame"),
  benchMeasureStart: () => ipcRenderer.send("bench-measure-start"),
  benchResult: (payload) => ipcRenderer.send("bench-result", payload),
});
