const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    setMode: (mode, color, speed, brightness, direction) => ipcRenderer.invoke('set-mode', mode, color, speed, brightness, direction),
    toggleSmart: (active) => ipcRenderer.invoke('toggle-smart', active),
    updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
    getStats: () => ipcRenderer.invoke('get-stats'),
    resetStats: () => ipcRenderer.invoke('reset-stats'),
    windowControl: (action) => ipcRenderer.invoke('window-control', action),

    // Called after CSS animation finishes to trigger actual minimize/close
    windowAnimateDone: (action) => ipcRenderer.invoke('window-animate-done', action),

    // Per-Key RGB commands
    send: (cmd) => ipcRenderer.invoke('send-command', cmd),

    onStatus: (cb) => ipcRenderer.on('status', (e, msg) => cb(msg)),
    onKey: (cb) => ipcRenderer.on('key', (e, data) => cb(data)),
    onStats: (cb) => ipcRenderer.on('stats', (e, data) => cb(data)),
    onFullStats: (cb) => ipcRenderer.on('full-stats', (e, data) => cb(data)),

    // Fired when window is restored from minimized state
    onWindowRestore: (cb) => ipcRenderer.on('window-restored', () => cb()),
});
