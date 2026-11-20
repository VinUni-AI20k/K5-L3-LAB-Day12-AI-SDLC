// Bridge between the web game and the Electron main process (filled in by later steps).
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("ddl", { shell: "electron" });
