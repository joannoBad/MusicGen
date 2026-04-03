const { app, BrowserWindow } = require("electron");
const path = require("node:path");

function createWindow() {
  // Give the desktop UI enough room to match the web layout without feeling cramped.
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1040,
    minHeight: 760,
    backgroundColor: "#070b14",
    title: "MusicGen Desktop",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Keep the usual macOS behavior where the app stays open until the user quits it.
  if (process.platform !== "darwin") {
    app.quit();
  }
});
