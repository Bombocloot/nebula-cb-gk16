const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let bridge = null;

function startBridge() {
    bridge = spawn('node', [path.join(__dirname, 'backend', 'bridge.js')], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    bridge.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (!line.trim()) return;
            try {
                const msg = JSON.parse(line);
                if (msg.type === 'status') mainWindow?.webContents.send('status', msg.msg);
                else if (msg.type === 'key') mainWindow?.webContents.send('key', msg);
                else if (msg.type === 'stats') mainWindow?.webContents.send('stats', msg);
                else if (msg.type === 'full-stats') mainWindow?.webContents.send('full-stats', msg);
                else if (msg.type === 'log') console.log('[Bridge]', msg.msg);
            } catch (e) { }
        });
    });

    bridge.stderr.on('data', (d) => console.error('[Bridge Error]', d.toString()));
}

function sendToBridge(msg) {
    if (bridge?.stdin?.writable) bridge.stdin.write(JSON.stringify(msg) + '\n');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400, height: 850,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        backgroundColor: '#0D0D0D',
    });
    mainWindow.loadFile('src/index.html');
}

app.whenReady().then(() => {
    startBridge();
    createWindow();
});

app.on('window-all-closed', () => {
    if (bridge) bridge.kill();
    app.quit();
});

// IPC Handlers
ipcMain.handle('set-mode', (e, mode, color, speed, brightness, direction) => {
    sendToBridge({ action: 'set-mode', mode, color, speed, brightness, direction });
});

ipcMain.handle('toggle-smart', (e, active) => {
    sendToBridge({ action: 'toggle-smart', active });
});

ipcMain.handle('update-settings', (e, settings) => {
    if (settings.custom) {
        sendToBridge({ action: 'apply-custom', ...settings });
    } else {
        sendToBridge({ action: 'settings', ...settings });
    }
});

ipcMain.handle('get-stats', () => {
    sendToBridge({ action: 'get-stats' });
});

ipcMain.handle('reset-stats', () => {
    sendToBridge({ action: 'reset-stats' });
});

ipcMain.handle('window-control', (e, action) => {
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'close') mainWindow.close();
});

// Generic command sender for per-key RGB
ipcMain.handle('send-command', (e, cmd) => {
    sendToBridge(cmd);
});
