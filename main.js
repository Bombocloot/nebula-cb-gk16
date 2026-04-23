const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { KeyboardController } = require('./backend/keyboard');

let mainWindow;
const kb = new KeyboardController();

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
    createWindow();
    kb.start();
});

app.on('window-all-closed', () => {
    kb.stop();
    app.quit();
});

kb.on('status', msg => mainWindow?.webContents.send('status', msg));
kb.on('key', data => mainWindow?.webContents.send('key', data));
kb.on('stats', data => mainWindow?.webContents.send('stats', data));
kb.on('full-stats', data => mainWindow?.webContents.send('full-stats', data));

ipcMain.handle('set-mode', (_, mode, color, speed, brightness, direction) => {
    kb.handleCommand({ action: 'set-mode', mode, color, speed, brightness, direction });
});

ipcMain.handle('toggle-smart', (_, active) => {
    kb.handleCommand({ action: 'toggle-smart', active });
});

ipcMain.handle('update-settings', (_, settings) => {
    if (settings.custom) {
        kb.handleCommand({ action: 'apply-custom', ...settings });
    } else {
        kb.handleCommand({ action: 'settings', ...settings });
    }
});

ipcMain.handle('get-stats', () => {
    kb.handleCommand({ action: 'get-stats' });
});

ipcMain.handle('reset-stats', () => {
    kb.handleCommand({ action: 'reset-stats' });
});

ipcMain.handle('window-control', (_, action) => {
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'close') mainWindow.close();
});

ipcMain.handle('send-command', (_, cmd) => {
    kb.handleCommand(cmd);
});
