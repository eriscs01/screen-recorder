const { contextBridge, ipcRenderer } = require('electron');

// Expose specific APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
    getDesktopCaptureSources: () => ipcRenderer.invoke('get-desktop-sources')
});