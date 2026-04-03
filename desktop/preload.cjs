const { contextBridge } = require("electron");

// Expose only the tiny bit of state the renderer actually needs.
contextBridge.exposeInMainWorld("musicGenDesktop", {
  isDesktop: true
});
