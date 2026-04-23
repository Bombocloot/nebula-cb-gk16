const { EventEmitter } = require('events');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const { PerKeyRGBController, KEY_MAP, INDEX_TO_KEY } = require('./perkey-rgb');

const VID = 0x04D9, PID = 0xA1CD;
const P1_BIN = 'c:\\Program Files (x86)\\Cosmic Byte\\Firefly\\modules\\setting\\p1.bin';
const FIREFLY_EXE = 'c:\\Program Files (x86)\\Cosmic Byte\\Firefly\\FIREFLY.exe';

const RGB_PRESETS = [
    [252, 0, 0], [0, 252, 0], [252, 252, 0], [0, 0, 252],
    [0, 252, 252], [252, 0, 252], [252, 252, 252], [0, 0, 0]
];

const KEY_NAMES = {
    8: 'Bksp', 9: 'Tab', 13: 'Enter', 16: 'LShift', 17: 'LCtrl', 18: 'LAlt', 20: 'Caps', 27: 'Esc', 32: 'Space',
    33: 'PgUp', 34: 'PgDn', 35: 'End', 36: 'Home', 37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down', 45: 'Ins', 46: 'Del',
    48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
    65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I', 74: 'J', 75: 'K', 76: 'L', 77: 'M',
    78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
    91: 'LWin', 93: 'Menu', 112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6', 118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
    160: 'LShift', 161: 'RShift', 162: 'LCtrl', 163: 'RCtrl', 164: 'LAlt', 165: 'RAlt',
    186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`', 219: '[', 220: '\\', 221: ']', 222: "'"
};

const VK_TO_KEYNAME = {
    8: 'BACKSPACE', 9: 'TAB', 13: 'ENTER', 20: 'CAPSLOCK', 27: 'ESC', 32: 'SPACE',
    33: 'PGUP', 34: 'PGDN', 35: 'END', 36: 'HOME', 37: 'LEFT', 38: 'UP', 39: 'RIGHT', 40: 'DOWN',
    45: 'INSERT', 46: 'DELETE',
    48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
    65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I', 74: 'J',
    75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T',
    85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
    91: 'LWIN', 93: 'MENU',
    112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
    118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
    160: 'LSHIFT', 161: 'RSHIFT', 162: 'LCTRL', 163: 'RCTRL', 164: 'LALT', 165: 'RALT',
    186: 'SEMICOLON', 187: 'EQUAL', 188: 'COMMA', 189: 'MINUS', 190: 'PERIOD',
    191: 'SLASH', 192: 'GRAVE', 219: 'LBRACKET', 220: 'BACKSLASH', 221: 'RBRACKET', 222: 'QUOTE',
    144: 'SCRLK', 145: 'PAUSE', 44: 'PRTSC'
};

const KEY_NEIGHBORS = {
    'ESC': ['F1'], 'F1': ['ESC', 'F2'], 'F2': ['F1', 'F3'], 'F3': ['F2', 'F4'],
    'F4': ['F3', 'F5'], 'F5': ['F4', 'F6'], 'F6': ['F5', 'F7'], 'F7': ['F6', 'F8'],
    'F8': ['F7', 'F9'], 'F9': ['F8', 'F10'], 'F10': ['F9', 'F11'], 'F11': ['F10', 'F12'], 'F12': ['F11'],
    'GRAVE': ['1', 'TAB'], '1': ['GRAVE', '2', 'Q'], '2': ['1', '3', 'W', 'Q'],
    '3': ['2', '4', 'E', 'W'], '4': ['3', '5', 'R', 'E'], '5': ['4', '6', 'T', 'R'],
    '6': ['5', '7', 'Y', 'T'], '7': ['6', '8', 'U', 'Y'], '8': ['7', '9', 'I', 'U'],
    '9': ['8', '0', 'O', 'I'], '0': ['9', 'MINUS', 'P', 'O'],
    'MINUS': ['0', 'EQUAL'], 'EQUAL': ['MINUS', 'BACKSPACE'], 'BACKSPACE': ['EQUAL'],
    'TAB': ['GRAVE', 'Q', 'CAPSLOCK'], 'Q': ['TAB', 'W', '1', '2', 'A'],
    'W': ['Q', 'E', '2', '3', 'S', 'A'], 'E': ['W', 'R', '3', '4', 'D', 'S'],
    'R': ['E', 'T', '4', '5', 'F', 'D'], 'T': ['R', 'Y', '5', '6', 'G', 'F'],
    'Y': ['T', 'U', '6', '7', 'H', 'G'], 'U': ['Y', 'I', '7', '8', 'J', 'H'],
    'I': ['U', 'O', '8', '9', 'K', 'J'], 'O': ['I', 'P', '9', '0', 'L', 'K'],
    'P': ['O', 'LBRACKET', '0', 'MINUS'], 'LBRACKET': ['P', 'RBRACKET'],
    'RBRACKET': ['LBRACKET', 'BACKSLASH'], 'BACKSLASH': ['RBRACKET', 'ENTER'],
    'CAPSLOCK': ['TAB', 'A', 'LSHIFT'], 'A': ['CAPSLOCK', 'S', 'Q', 'W', 'Z'],
    'S': ['A', 'D', 'W', 'E', 'X', 'Z'], 'D': ['S', 'F', 'E', 'R', 'C', 'X'],
    'F': ['D', 'G', 'R', 'T', 'V', 'C'], 'G': ['F', 'H', 'T', 'Y', 'B', 'V'],
    'H': ['G', 'J', 'Y', 'U', 'N', 'B'], 'J': ['H', 'K', 'U', 'I', 'M', 'N'],
    'K': ['J', 'L', 'I', 'O', 'COMMA', 'M'], 'L': ['K', 'SEMICOLON', 'O', 'P'],
    'SEMICOLON': ['L', 'QUOTE', 'P'], 'QUOTE': ['SEMICOLON', 'ENTER'], 'ENTER': ['QUOTE', 'BACKSLASH'],
    'LSHIFT': ['CAPSLOCK', 'Z'], 'Z': ['LSHIFT', 'X', 'A', 'S'],
    'X': ['Z', 'C', 'S', 'D'], 'C': ['X', 'V', 'D', 'F'], 'V': ['C', 'B', 'F', 'G'],
    'B': ['V', 'N', 'G', 'H'], 'N': ['B', 'M', 'H', 'J'], 'M': ['N', 'COMMA', 'J', 'K'],
    'COMMA': ['M', 'PERIOD', 'K', 'L'], 'PERIOD': ['COMMA', 'SLASH', 'L'],
    'SLASH': ['PERIOD', 'RSHIFT'], 'RSHIFT': ['SLASH', 'UP'],
    'LCTRL': ['LWIN'], 'LWIN': ['LCTRL', 'LALT'], 'LALT': ['LWIN', 'SPACE'],
    'SPACE': ['LALT', 'RALT', 'V', 'B', 'N', 'M'], 'RALT': ['SPACE'], 'RCTRL': ['LEFT'],
    'LEFT': ['RCTRL', 'DOWN'], 'DOWN': ['LEFT', 'UP', 'RIGHT'], 'UP': ['RSHIFT', 'DOWN'], 'RIGHT': ['DOWN']
};

class KeyboardController extends EventEmitter {
    constructor() {
        super();
        this.HID = null;
        this.device = null;
        this.perKey = new PerKeyRGBController();
        this.psProcess = null;

        this.smartEnabled = false;
        this.lastKeyTime = Date.now();
        this.isIdle = false;
        this.idleTimeout = 10000;
        this.activeColor = 6;
        this.idleColor = 6;
        this.neighborFlashEnabled = true;

        this.reactiveEnabled = false;
        this.reactiveColor = { r: 0, g: 255, b: 255 };
        this.reactiveKeyStates = {};
        this.reactiveInterval = null;
        this.reactiveApplying = false;

        this.stats = { keys: {}, total: 0, start: Date.now() };
        this.recentKeys = [];
        this.lastPressedKeys = [];
        this.idleCheckInterval = null;
    }

    start() {
        try {
            this.HID = require('node-hid');
        } catch (e) {
            console.error('[KB] node-hid not available:', e.message);
            this.HID = { devices: () => [] };
        }
        this.connect();
        this.startKeyMonitor();
        this.idleCheckInterval = setInterval(() => this.checkIdle(), 200);
        this.emit('status', 'Ready');
    }

    stop() {
        if (this.psProcess) { try { this.psProcess.kill(); } catch (_) {} this.psProcess = null; }
        if (this.reactiveInterval) { clearInterval(this.reactiveInterval); this.reactiveInterval = null; }
        if (this.idleCheckInterval) { clearInterval(this.idleCheckInterval); this.idleCheckInterval = null; }
        if (this.device) { try { this.device.close(); } catch (_) {} this.device = null; }
    }

    connect() {
        if (this.device) return true;
        try {
            const d = this.HID.devices().find(x => x.vendorId === VID && x.productId === PID && x.usagePage === 0xFF01);
            if (d) {
                this.device = new this.HID.HID(d.path);
                this.device.on('error', () => { this.device = null; });
                return true;
            }
        } catch (_) {}
        return false;
    }

    sendMode(mode, color, speed = 100, brightness = 100, direction = 0) {
        if (!this.device && !this.connect()) return;
        try {
            const p = Array(65).fill(0);
            p[0] = 0x03;
            p[1] = 0x08;
            p[2] = mode;
            p[3] = Math.round((brightness / 100) * 63);
            p[4] = Math.max(1, Math.round(6 - (speed / 100) * 5));
            p[5] = direction;
            p[6] = color;
            this.device.sendFeatureReport(p);
        } catch (_) { this.device = null; }
    }

    kpm() {
        const now = Date.now();
        this.recentKeys = this.recentKeys.filter(t => now - t < 60000);
        return this.recentKeys.length;
    }

    topKeys(n) {
        return Object.entries(this.stats.keys)
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([c, cnt]) => ({ name: KEY_NAMES[+c] || ('K' + c), count: cnt }));
    }

    checkIdle() {
        if (!this.smartEnabled) return;
        if (!this.isIdle && Date.now() - this.lastKeyTime > this.idleTimeout) {
            this.isIdle = true;
            this.sendMode(8, this.idleColor);
            this.emit('status', 'IDLE');
        }
    }

    onKeyPress(code) {
        const name = KEY_NAMES[code] || ('K' + code);
        const isModifier = [16, 17, 18, 91, 160, 161, 162, 163, 164, 165].includes(code);

        this.stats.keys[code] = (this.stats.keys[code] || 0) + 1;
        this.stats.total++;
        this.recentKeys.push(Date.now());

        this.emit('key', { code, name });
        if (this.stats.total % 20 === 0) {
            this.emit('stats', { total: this.stats.total, kpm: this.kpm(), top: this.topKeys(5) });
        }

        if (this.smartEnabled && !isModifier) {
            if (this.isIdle) {
                this.isIdle = false;
                if (this.neighborFlashEnabled) {
                    this.flashNeighbors(code);
                    setTimeout(() => {
                        this.sendMode(9, this.activeColor);
                        this.emit('status', 'ACTIVE');
                    }, 300);
                } else {
                    this.sendMode(9, this.activeColor);
                    this.emit('status', 'ACTIVE');
                }
            }
            this.lastKeyTime = Date.now();
        }

        if (this.reactiveEnabled) {
            const keyName = VK_TO_KEYNAME[code];
            if (keyName && this.reactiveKeyStates[keyName] !== undefined) {
                this.reactiveKeyStates[keyName].brightness = 255;
            }
        }
    }

    async flashNeighbors(vkCode) {
        const keyName = VK_TO_KEYNAME[vkCode];
        if (!keyName) return;
        const neighbors = KEY_NEIGHBORS[keyName] || [];
        this.perKey.clearAll();
        [keyName, ...neighbors].forEach(k => this.perKey.setKey(k, 0, 255, 255));
        try { await this.perKey.apply(); } catch (_) {}
    }

    startReactiveMode() {
        if (this.reactiveInterval) return;
        Object.keys(KEY_MAP).forEach(k => { this.reactiveKeyStates[k] = { brightness: 0 }; });
        this.reactiveInterval = setInterval(async () => {
            if (this.reactiveApplying) return;
            let needsUpdate = false;
            Object.keys(this.reactiveKeyStates).forEach(k => {
                if (this.reactiveKeyStates[k].brightness > 0) {
                    this.reactiveKeyStates[k].brightness = Math.max(0, this.reactiveKeyStates[k].brightness - 30);
                    needsUpdate = true;
                }
            });
            if (needsUpdate) {
                this.reactiveApplying = true;
                Object.keys(this.reactiveKeyStates).forEach(k => {
                    const b = this.reactiveKeyStates[k].brightness / 255;
                    this.perKey.setKey(k,
                        Math.round(this.reactiveColor.r * b),
                        Math.round(this.reactiveColor.g * b),
                        Math.round(this.reactiveColor.b * b));
                });
                try { await this.perKey.apply(); } catch (_) {}
                this.reactiveApplying = false;
            }
        }, 200);
    }

    stopReactiveMode() {
        if (this.reactiveInterval) { clearInterval(this.reactiveInterval); this.reactiveInterval = null; }
    }

    startKeyMonitor() {
        const script = [
            'Add-Type @"',
            'using System; using System.Runtime.InteropServices;',
            'public class K { [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int v); }',
            '"@',
            '[Console]::OutputEncoding = [System.Text.Encoding]::ASCII',
            '$lastState = ""',
            'while($true) {',
            '    $pressed = @()',
            '    for($i = 8; $i -le 254; $i++) {',
            '        if([K]::GetAsyncKeyState($i) -band 0x8000) { $pressed += $i }',
            '    }',
            '    $currentState = $pressed -join ","',
            '    if($currentState -ne $lastState) {',
            '        $lastState = $currentState',
            '        [Console]::WriteLine("KEYS:" + $currentState)',
            '        [Console]::Out.Flush()',
            '    }',
            '    Start-Sleep -Milliseconds 10',
            '}'
        ].join('\n');

        this.psProcess = spawn('powershell.exe', ['-Command', script], { stdio: ['ignore', 'pipe', 'ignore'] });
        this.psProcess.stdout.on('data', data => {
            data.toString().split('\n').forEach(line => {
                line = line.trim();
                if (!line.startsWith('KEYS:')) return;
                const keysStr = line.substring(5);
                const keys = keysStr ? keysStr.split(',').map(Number) : [];
                const newPresses = keys.filter(k => !this.lastPressedKeys.includes(k));
                newPresses.forEach(code => this.onKeyPress(code));
                this.lastPressedKeys = keys;
                this.emit('full-stats', { keys });
            });
        });
    }

    applyCustom(args) {
        const startTime = Date.now();
        try {
            if (this.device) { this.device.close(); this.device = null; }
            if (args && args.map) {
                let content = fs.readFileSync(P1_BIN, 'utf8');
                let keyData = [];
                for (let i = 0; i < 128; i++) {
                    const colorIdx = args.map[i] !== undefined ? args.map[i] : 7;
                    const [r, g, b] = RGB_PRESETS[colorIdx] || [0, 0, 0];
                    keyData.push(colorIdx === 7 ? 0 : 16, r, g, b);
                }
                const line0 = keyData.join(', ');
                const emptyLine = Array(512).fill(0).join(', ');
                const newSection = '[userPicture]\n0=' + line0 + '\n1=' + emptyLine + '\n2=' + emptyLine + '\n3=' + emptyLine + '\n4=' + emptyLine + '\n';
                content = content.replace(/\[color\]\s+ledType=.*$/m, '[color]\r\nledType=51, 63, 3, 0, 0, 0, 0');
                const idx = content.indexOf('[userPicture]');
                content = idx !== -1 ? content.substring(0, idx) + newSection : content + '\r\n' + newSection;
                fs.writeFileSync(P1_BIN, content);
            }
            const fireflyDir = 'c:\\Program Files (x86)\\Cosmic Byte\\Firefly';
            try { execSync('taskkill /F /IM FIREFLY.exe', { stdio: 'ignore' }); } catch (_) {}
            const proc = spawn(FIREFLY_EXE, [], { detached: true, stdio: 'ignore', cwd: fireflyDir, windowsHide: true });
            proc.unref();
            setTimeout(() => {
                try { execSync('taskkill /F /IM FIREFLY.exe', { stdio: 'ignore' }); } catch (_) {}
                this.connect();
                this.sendMode(51, 0);
                this.emit('status', 'DONE (' + (Date.now() - startTime) + 'ms)');
            }, args && args.fast ? 1000 : 1500);
        } catch (e) {
            this.emit('status', 'ERROR');
            this.connect();
        }
    }

    handleCommand(cmd) {
        switch (cmd.action) {
            case 'set-mode':
                this.smartEnabled = false;
                this.sendMode(cmd.mode, cmd.color, cmd.speed || 100, cmd.brightness || 100, cmd.direction || 0);
                this.emit('status', 'Mode ' + cmd.mode);
                break;
            case 'toggle-smart':
                this.smartEnabled = cmd.active;
                if (this.smartEnabled) {
                    this.isIdle = false;
                    this.lastKeyTime = Date.now();
                    this.sendMode(9, this.activeColor);
                    this.emit('status', 'SMART ON');
                } else {
                    this.emit('status', 'SMART OFF');
                }
                break;
            case 'settings':
                if (cmd.idleTimeout !== undefined) this.idleTimeout = cmd.idleTimeout;
                if (cmd.activeColor !== undefined) this.activeColor = cmd.activeColor;
                if (cmd.idleColor !== undefined) this.idleColor = cmd.idleColor;
                this.emit('status', 'CFG: ' + (this.idleTimeout / 1000) + 's');
                break;
            case 'apply-custom':
                this.applyCustom(cmd);
                break;
            case 'get-stats':
                this.emit('full-stats', { total: this.stats.total, session: Math.round((Date.now() - this.stats.start) / 1000), top: this.topKeys(10) });
                break;
            case 'reset-stats':
                this.stats = { keys: {}, total: 0, start: Date.now() };
                this.recentKeys = [];
                break;
            case 'perkey-all': {
                const r = cmd.r !== undefined ? cmd.r : 255;
                const g = cmd.g !== undefined ? cmd.g : 255;
                const b = cmd.b !== undefined ? cmd.b : 255;
                this.perKey.setAll(r, g, b);
                if (r > 0 || g > 0 || b > 0) {
                    this.perKey.apply()
                        .then(() => this.emit('status', 'Per-Key: All set'))
                        .catch(e => this.emit('status', 'Per-Key error: ' + e.message));
                } else {
                    this.emit('status', 'Per-Key: State cleared');
                }
                break;
            }
            case 'perkey-key': {
                const r = cmd.r !== undefined ? cmd.r : 255;
                const g = cmd.g !== undefined ? cmd.g : 255;
                const b = cmd.b !== undefined ? cmd.b : 255;
                this.perKey.setKey(cmd.key, r, g, b);
                break;
            }
            case 'perkey-apply':
                this.perKey.apply()
                    .then(() => this.emit('status', 'Per-Key: Applied'))
                    .catch(e => this.emit('status', 'Per-Key error: ' + e.message));
                break;
            case 'perkey-gradient':
                this.perKey.applyGradient(cmd.start || { r: 255, g: 0, b: 0 }, cmd.end || { r: 0, g: 0, b: 255 });
                this.perKey.apply()
                    .then(() => this.emit('status', 'Per-Key: Gradient applied'))
                    .catch(e => this.emit('status', 'Per-Key error: ' + e.message));
                break;
            case 'perkey-rainbow':
                this.perKey.applyRainbow();
                this.perKey.apply()
                    .then(() => this.emit('status', 'Per-Key: Rainbow applied'))
                    .catch(e => this.emit('status', 'Per-Key error: ' + e.message));
                break;
            case 'perkey-clear':
                this.perKey.clearAll();
                this.perKey.apply()
                    .then(() => this.emit('status', 'Per-Key: Cleared'))
                    .catch(e => this.emit('status', 'Per-Key error: ' + e.message));
                break;
            case 'toggle-reactive':
                this.reactiveEnabled = cmd.active;
                if (cmd.color) this.reactiveColor = cmd.color;
                if (this.reactiveEnabled) {
                    this.startReactiveMode();
                    this.emit('status', 'Reactive: ON');
                } else {
                    this.stopReactiveMode();
                    this.perKey.clearAll();
                    this.perKey.apply().catch(() => {});
                    this.emit('status', 'Reactive: OFF');
                }
                break;
            case 'toggle-neighbor-flash':
                this.neighborFlashEnabled = cmd.active;
                this.emit('status', 'Neighbor Flash: ' + (this.neighborFlashEnabled ? 'ON' : 'OFF'));
                break;
        }
    }
}

module.exports = { KeyboardController };
