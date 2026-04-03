const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("musicGenDesktop", {
  isDesktop: true
});
