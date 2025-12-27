const HID = require('node-hid');
const { spawn, execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');

// Per-Key RGB Controller with Planar Encoding
const { PerKeyRGBController, KEY_MAP, INDEX_TO_KEY } = require('./perkey-rgb');
const perKeyController = new PerKeyRGBController();

// Native Gaming Zone control (ESC, WASD, Arrows - 9 keys)
// DISABLED: Using HID driver instead of WinUSB
let gamingZone = null;
/*
try {
    const { GamingZoneController } = require('./native-gaming-zone');
    gamingZone = new GamingZoneController();
    console.error('[BRIDGE] Native Gaming Zone module loaded');
} catch (e) {
    console.error('[BRIDGE] Gaming Zone not available:', e.message);
}
*/
console.error('[BRIDGE] Gaming Zone disabled - using HID driver');

const VID = 0x04D9, PID = 0xA1CD;
const P1_BIN = 'c:\\Program Files (x86)\\Cosmic Byte\\Firefly\\modules\\setting\\p1.bin';
const FIREFLY_EXE = 'c:\\Program Files (x86)\\Cosmic Byte\\Firefly\\FIREFLY.exe';

let device = null;
let smartEnabled = false;
let lastKeyTime = Date.now();
let isIdle = false;

let idleTimeout = 10000;
let activeColor = 6;
let idleColor = 6;

let stats = { keys: {}, total: 0, start: Date.now() };
let recentKeys = [];

// Reactive lighting mode
let reactiveEnabled = false;
let reactiveColor = { r: 0, g: 255, b: 255 };  // Cyan by default
let reactiveKeyStates = {};  // keyName -> { brightness: 0-255, lastPress: timestamp }
let reactiveInterval = null;
let reactiveApplying = false;  // Prevent overlapping apply calls
const REACTIVE_FADE_SPEED = 30;  // Brightness drop per frame (faster fade)
const REACTIVE_UPDATE_INTERVAL = 200;  // ms between updates (5 FPS - more stable)

// Map virtual key codes to our KEY_MAP names
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

// Smart Mode: Neighbor flash on idle→active transition
let neighborFlashEnabled = true;  // Enable/disable neighbor flash
const NEIGHBOR_FLASH_COLOR = { r: 0, g: 255, b: 255 };  // Cyan (same as ripple)
const NEIGHBOR_FLASH_DURATION = 300;  // ms before switching to active mode

// Key adjacency map for neighbor flash
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

// Flash neighbors on keypress (for idle→active transition)
async function flashNeighbors(vkCode) {
    const keyName = VK_TO_KEYNAME[vkCode];
    if (!keyName) return;

    const neighbors = KEY_NEIGHBORS[keyName] || [];
    const keysToLight = [keyName, ...neighbors];

    console.error(`[BRIDGE] Neighbor flash: ${keyName} + ${neighbors.length} neighbors`);

    // Clear and light up neighbors
    perKeyController.clearAll();
    keysToLight.forEach(k => {
        perKeyController.setKey(k, NEIGHBOR_FLASH_COLOR.r, NEIGHBOR_FLASH_COLOR.g, NEIGHBOR_FLASH_COLOR.b);
    });

    try {
        await perKeyController.apply();
    } catch (e) {
        console.error('[BRIDGE] Neighbor flash error:', e.message);
    }
}

function startReactiveMode() {
    if (reactiveInterval) return;
    console.error('[BRIDGE] Reactive mode ENABLED');

    // Initialize all keys to off
    Object.keys(KEY_MAP).forEach(k => {
        reactiveKeyStates[k] = { brightness: 0, lastPress: 0 };
    });

    reactiveInterval = setInterval(async () => {
        // Prevent overlapping apply calls
        if (reactiveApplying) return;

        let needsUpdate = false;

        // Fade all keys
        Object.keys(reactiveKeyStates).forEach(k => {
            if (reactiveKeyStates[k].brightness > 0) {
                reactiveKeyStates[k].brightness = Math.max(0, reactiveKeyStates[k].brightness - REACTIVE_FADE_SPEED);
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            reactiveApplying = true;

            // Apply colors based on brightness
            Object.keys(reactiveKeyStates).forEach(k => {
                const b = reactiveKeyStates[k].brightness / 255;
                perKeyController.setKey(k,
                    Math.round(reactiveColor.r * b),
                    Math.round(reactiveColor.g * b),
                    Math.round(reactiveColor.b * b)
                );
            });

            try {
                await perKeyController.apply();
            } catch (e) {
                // Ignore errors during rapid updates
            }

            reactiveApplying = false;
        }
    }, REACTIVE_UPDATE_INTERVAL);
}

function stopReactiveMode() {
    if (reactiveInterval) {
        clearInterval(reactiveInterval);
        reactiveInterval = null;
        console.error('[BRIDGE] Reactive mode DISABLED');
    }
}

function onReactiveKeyPress(vkCode) {
    if (!reactiveEnabled) return;

    const keyName = VK_TO_KEYNAME[vkCode];
    if (keyName && reactiveKeyStates[keyName] !== undefined) {
        reactiveKeyStates[keyName].brightness = 255;
        reactiveKeyStates[keyName].lastPress = Date.now();
    }
}

const rl = readline.createInterface({ input: process.stdin });
const emit = (type, data) => console.log(JSON.stringify({ type, ...data }));

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

// Per-key RGB colors (8 presets)
const RGB_PRESETS = [
    [252, 0, 0],     // 0: Red
    [0, 252, 0],     // 1: Green
    [252, 252, 0],   // 2: Yellow
    [0, 0, 252],     // 3: Blue
    [0, 252, 252],   // 4: Cyan
    [252, 0, 252],   // 5: Magenta
    [252, 252, 252], // 6: White
    [0, 0, 0]        // 7: Off/Black
];

const keyName = c => KEY_NAMES[c] || `K${c}`;

function connect() {
    if (device) return true;
    try {
        const d = HID.devices().find(x => x.vendorId === VID && x.productId === PID && x.usagePage === 0xFF01);
        if (d) { device = new HID.HID(d.path); device.on('error', () => { device = null; }); return true; }
    } catch (e) { }
    return false;
}

function send(mode, color, speed = 100, brightness = 100, direction = 0) {
    // Use WinUSB via Gaming Zone module (node-hid no longer works due to driver change)
    if (gamingZone) {
        const brightnessVal = Math.round((brightness / 100) * 63);
        const speedVal = Math.max(1, Math.round(6 - (speed / 100) * 5));
        gamingZone.setMode(mode, brightnessVal, speedVal, direction)
            .then(() => console.error(`[BRIDGE] Mode ${mode} set via WinUSB`))
            .catch(e => console.error(`[BRIDGE] Mode error: ${e.message}`));
        return;
    }

    // Fallback to node-hid (may not work with WinUSB driver installed)
    if (!device && !connect()) return;
    try {
        const p = Array(65).fill(0);
        p[0] = 0x03; // Report ID
        p[1] = 0x08; // Command
        p[2] = mode;
        // Brightness: 0-100% maps to 0-63 (0=off, 63=max)
        p[3] = Math.round((brightness / 100) * 63);
        // Speed: 0-100% maps to 6-1 (inverted: 0%=6/slowest, 100%=1/fastest) - avoid 0 as it causes issues
        p[4] = Math.max(1, Math.round(6 - (speed / 100) * 5));
        // Direction: 0=Right, 1=Left (only for wave modes)
        p[5] = direction;
        p[6] = color;
        device.sendFeatureReport(p);
    } catch (e) { device = null; }
}

function kpm() {
    const now = Date.now();
    recentKeys = recentKeys.filter(t => now - t < 60000);
    return recentKeys.length;
}

function checkIdle() {
    if (!smartEnabled) return;
    const elapsed = Date.now() - lastKeyTime;

    if (!isIdle && elapsed > idleTimeout) {
        isIdle = true;
        send(8, idleColor);
        emit('status', { msg: 'IDLE' });
    }
}

function onKeyPress(code) {
    const now = Date.now();
    const name = keyName(code);
    const isModifier = [16, 17, 18, 91, 160, 161, 162, 163, 164, 165].includes(code);

    stats.keys[code] = (stats.keys[code] || 0) + 1;
    stats.total++;
    recentKeys.push(now);

    emit('key', { code, name });
    if (stats.total % 20 === 0) emit('stats', { total: stats.total, kpm: kpm(), top: topKeys(5) });

    if (smartEnabled && !isModifier) {
        if (isIdle) {
            isIdle = false;

            // Neighbor flash on idle→active transition
            if (neighborFlashEnabled) {
                flashNeighbors(code);
                // Switch to active mode after flash duration
                setTimeout(() => {
                    send(9, activeColor);
                    emit('status', { msg: 'ACTIVE' });
                }, NEIGHBOR_FLASH_DURATION);
            } else {
                send(9, activeColor);
                emit('status', { msg: 'ACTIVE' });
            }
        }
        lastKeyTime = now;
    }

    // Reactive lighting hook
    onReactiveKeyPress(code);
}

function topKeys(n) {
    return Object.entries(stats.keys).sort((a, b) => b[1] - a[1]).slice(0, n).map(([c, cnt]) => ({ name: keyName(+c), count: cnt }));
}

function startKeyMonitor() {
    // PowerShell script to check key states via GetAsyncKeyState
    // Detects simultaneous key presses and outputs changes as "KEYS:code1,code2..."
    const script = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public class K { [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int v); }
"@
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII
$lastState = ""
while($true) {
    $pressed = @()
    for($i = 8; $i -le 254; $i++) {
        if([K]::GetAsyncKeyState($i) -band 0x8000) {
            $pressed += $i
        }
    }
    $currentState = $pressed -join ","
    if($currentState -ne $lastState) {
        $lastState = $currentState
        [Console]::WriteLine("KEYS:" + $currentState)
        [Console]::Out.Flush()
    }
    Start-Sleep -Milliseconds 10
}`;

    const ps = spawn('powershell.exe', ['-Command', script], { stdio: ['ignore', 'pipe', 'ignore'] });

    ps.stdout.on('data', data => {
        data.toString().split('\n').forEach(line => {
            line = line.trim();
            if (line.startsWith('KEYS:')) {
                const keysStr = line.substring(5);
                const keys = keysStr ? keysStr.split(',').map(Number) : [];
                onKeyStateChange(keys);
            }
        });
    });

    // Cleanup on exit
    process.on('exit', () => ps.kill());
}

let lastPressedKeys = [];

function onKeyStateChange(currentKeys) {
    // Detect new presses for stats
    const newPresses = currentKeys.filter(k => !lastPressedKeys.includes(k));
    newPresses.forEach(code => onKeyPress(code));

    lastPressedKeys = currentKeys;

    // Emit full key state for visualization
    emit('full-stats', { keys: currentKeys });
}

// Per-Key Custom Mode Applier
// Format: [Flag=16/0][R][G][B] per key, 128 keys per line, 5 lines (profiles)
// Key order follows visual layout: ESC=0, F1=1, F2=2, ... (confirmed via testing)
function applyCustom(args) {
    const startTime = Date.now();

    try {
        if (device) { device.close(); device = null; }

        if (args && args.map) {
            console.error(`[BRIDGE] Map length: ${args.map.length}`);

            let content = fs.readFileSync(P1_BIN, 'utf8');

            // Build 128 keys worth of [Flag][R][G][B] data
            // Each key = 4 values: Flag (16=on, 0=off), R, G, B
            let keyData = [];
            for (let i = 0; i < 128; i++) {
                const colorIdx = args.map[i] !== undefined ? args.map[i] : 7; // Default to Off
                const [r, g, b] = RGB_PRESETS[colorIdx] || [0, 0, 0];
                const flag = (colorIdx === 7) ? 0 : 16; // Off = flag 0, else 16
                keyData.push(flag, r, g, b);
            }

            // Build the [userPicture] lines (5 lines for 5 profiles, we only set line 0)
            const line0 = keyData.join(', ');
            const emptyLine = Array(512).fill(0).join(', ');

            const newUserPicture = `[userPicture]
0=${line0}
1=${emptyLine}
2=${emptyLine}
3=${emptyLine}
4=${emptyLine}
`;

            // Update [color] section to use Custom Mode (51)
            content = content.replace(/\[color\]\s+ledType=.*$/m, '[color]\r\nledType=51, 63, 3, 0, 0, 0, 0');

            // Replace [userPicture] section entirely
            const userPicStart = content.indexOf('[userPicture]');
            if (userPicStart !== -1) {
                content = content.substring(0, userPicStart) + newUserPicture;
            } else {
                content += '\r\n' + newUserPicture;
            }

            fs.writeFileSync(P1_BIN, content);
            console.error('[BRIDGE] p1.bin written');
        }

        // Sync via FIREFLY.exe
        // IMPORTANT: Must set CWD so it finds modules/setting/p1.bin
        const fireflyDir = 'c:\\Program Files (x86)\\Cosmic Byte\\Firefly';
        try { execSync('taskkill /F /IM FIREFLY.exe', { stdio: 'ignore' }); } catch (e) { }

        const writeTime = Date.now() - startTime;
        console.error(`[BRIDGE] p1.bin write time: ${writeTime}ms`);
        console.error('[BRIDGE] Launching Firefly to sync...');

        const proc = spawn(FIREFLY_EXE, [], {
            detached: true,
            stdio: 'ignore',
            cwd: fireflyDir,
            windowsHide: true  // Hide FIREFLY window
        });
        proc.unref();

        // Optimized sync delay (tested: 1.5s works reliably)
        const syncDelay = args && args.fast ? 1000 : 1500;

        setTimeout(() => {
            try { execSync('taskkill /F /IM FIREFLY.exe', { stdio: 'ignore' }); } catch (e) { }
            const totalTime = Date.now() - startTime;
            console.error(`[BRIDGE] Sync complete. Total time: ${totalTime}ms`);
            connect();
            send(51, 0); // Switch to Custom Mode
            emit('status', { msg: `DONE (${totalTime}ms)` });
        }, syncDelay);


    } catch (e) {
        console.error('[BRIDGE] Apply failed:', e);
        emit('status', { msg: 'ERROR' });
        connect();
    }
}

// ============================================
// NATIVE PER-KEY RGB PROTOCOL (No FIREFLY.exe)
// ============================================
// Protocol: 13 packets on Interrupt OUT endpoint 0x04
// Packet header: 00 01 00 16 00 04 01 40
// Packet 1: Palette (7 colors × 3 bytes RGB, scaled 0-63)
// Packets 2-8: Per-key brightness for each of 7 colors (126 keys)
// Packets 9-13: HID Keycode mapping table

// HID Keycodes for TKL 87-key layout (standard USB HID usage table)
const HID_KEYMAP = [
    // Row 0: Esc, F1-F12, PrtSc, ScrLk, Pause
    0x29, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
    // Row 1: `, 1-0, -, =, Backspace, Ins, Home, PgUp
    0x35, 0x1E, 0x1F, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x2D, 0x2E, 0x2A, 0x49, 0x4A, 0x4B,
    // Row 2: Tab, Q-P, [, ], \, Del, End, PgDn
    0x2B, 0x14, 0x1A, 0x08, 0x15, 0x17, 0x1C, 0x18, 0x0C, 0x12, 0x13, 0x2F, 0x30, 0x31, 0x4C, 0x4D, 0x4E,
    // Row 3: Caps, A-L, ;, ', Enter
    0x39, 0x04, 0x16, 0x07, 0x09, 0x0A, 0x0B, 0x0D, 0x0E, 0x0F, 0x33, 0x34, 0x28,
    // Row 4: LShift, Z-M, ,, ., /, RShift, Up
    0xE1, 0x1D, 0x1B, 0x06, 0x19, 0x05, 0x11, 0x10, 0x36, 0x37, 0x38, 0xE5, 0x52,
    // Row 5: LCtrl, LWin, LAlt, Space, RAlt, Fn, Menu, RCtrl, Left, Down, Right
    0xE0, 0xE3, 0xE2, 0x2C, 0xE6, 0x00, 0x65, 0xE4, 0x50, 0x51, 0x4F
];

// Native apply: Send per-key RGB directly via USB (no FIREFLY.exe needed!)
// NOTE: This doesn't work with node-hid because it can't write to specific endpoints
// Falling back to legacy file-based method
function nativeApplyCustom(args) {
    console.error('[BRIDGE] Calling legacy file-based method...');
    applyCustom(args);
}

rl.on('line', line => {
    try {
        const cmd = JSON.parse(line);
        if (cmd.action === 'set-mode') {
            smartEnabled = false;
            send(cmd.mode, cmd.color, cmd.speed || 100, cmd.brightness || 100, cmd.direction || 0);
            emit('status', { msg: `Mode ${cmd.mode}` });
        }
        else if (cmd.action === 'toggle-smart') {
            smartEnabled = cmd.active;
            console.error(`[BRIDGE] Smart mode: ${smartEnabled ? 'ENABLED' : 'DISABLED'} (activeColor=${activeColor}, idleColor=${idleColor})`);
            if (smartEnabled) {
                isIdle = false;
                lastKeyTime = Date.now();
                send(9, activeColor);
                emit('status', { msg: 'SMART ON' });
            } else {
                emit('status', { msg: 'SMART OFF' });
            }
        }
        else if (cmd.action === 'settings') {
            console.error(`[BRIDGE] Settings received:`, JSON.stringify(cmd));
            if (cmd.idleTimeout !== undefined) idleTimeout = cmd.idleTimeout;
            if (cmd.activeColor !== undefined) activeColor = cmd.activeColor;
            if (cmd.idleColor !== undefined) idleColor = cmd.idleColor;
            console.error(`[BRIDGE] Settings applied: timeout=${idleTimeout}ms, active=${activeColor}, idle=${idleColor}`);
            emit('status', { msg: `CFG: ${idleTimeout / 1000}s` });
        }
        else if (cmd.action === 'apply-custom') {
            nativeApplyCustom(cmd);
        }
        else if (cmd.action === 'get-stats') emit('full-stats', { total: stats.total, session: Math.round((Date.now() - stats.start) / 1000), top: topKeys(10) });
        else if (cmd.action === 'reset-stats') { stats = { keys: {}, total: 0, start: Date.now() }; recentKeys = []; }
        else if (cmd.action === 'set-gaming-zone') {
            // Native gaming zone control (ESC, WASD, arrows - 9 keys)
            // Requires WinUSB driver on MI_02
            if (gamingZone) {
                gamingZone.setGamingZoneColor(cmd.color || { r: 255, g: 255, b: 255 })
                    .then(() => emit('status', { msg: 'Gaming Zone set' }))
                    .catch(e => emit('status', { msg: 'Gaming Zone error' }));
            } else {
                emit('status', { msg: 'Gaming Zone not available' });
            }
        }
        // === PER-KEY RGB COMMANDS ===
        else if (cmd.action === 'perkey-all') {
            // Set all keys to one color
            const r = cmd.r !== undefined ? cmd.r : 255;
            const g = cmd.g !== undefined ? cmd.g : 255;
            const b = cmd.b !== undefined ? cmd.b : 255;
            perKeyController.setAll(r, g, b);

            // Only apply immediately if not clearing (r=g=b=0 is used to clear state before painting)
            if (r > 0 || g > 0 || b > 0) {
                perKeyController.apply()
                    .then(() => emit('status', { msg: 'Per-Key: All set' }))
                    .catch(e => emit('status', { msg: 'Per-Key error: ' + e.message }));
            } else {
                emit('status', { msg: 'Per-Key: State cleared' });
            }
        }
        else if (cmd.action === 'perkey-key') {
            // Set a single key: {action: 'perkey-key', key: 'W', r, g, b}
            const r = cmd.r !== undefined ? cmd.r : 255;
            const g = cmd.g !== undefined ? cmd.g : 255;
            const b = cmd.b !== undefined ? cmd.b : 255;
            perKeyController.setKey(cmd.key, r, g, b);
            emit('status', { msg: `Key ${cmd.key} set` });
        }
        else if (cmd.action === 'perkey-apply') {
            // Apply current per-key config to keyboard
            perKeyController.apply()
                .then(() => emit('status', { msg: 'Per-Key: Applied' }))
                .catch(e => emit('status', { msg: 'Per-Key error: ' + e.message }));
        }
        else if (cmd.action === 'perkey-gradient') {
            // Apply gradient: {action: 'perkey-gradient', start: {r,g,b}, end: {r,g,b}}
            perKeyController.applyGradient(
                cmd.start || { r: 255, g: 0, b: 0 },
                cmd.end || { r: 0, g: 0, b: 255 }
            );
            perKeyController.apply()
                .then(() => emit('status', { msg: 'Per-Key: Gradient applied' }))
                .catch(e => emit('status', { msg: 'Per-Key error: ' + e.message }));
        }
        else if (cmd.action === 'perkey-rainbow') {
            // Apply rainbow gradient across keyboard
            perKeyController.applyRainbow();
            perKeyController.apply()
                .then(() => emit('status', { msg: 'Per-Key: Rainbow applied' }))
                .catch(e => emit('status', { msg: 'Per-Key error: ' + e.message }));
        }
        else if (cmd.action === 'perkey-clear') {
            // Turn off all keys
            perKeyController.clearAll();
            perKeyController.apply()
                .then(() => emit('status', { msg: 'Per-Key: Cleared' }))
                .catch(e => emit('status', { msg: 'Per-Key error: ' + e.message }));
        }
        else if (cmd.action === 'get-keymap') {
            // Send key map to frontend for per-key UI
            emit('keymap', { map: KEY_MAP, reverse: INDEX_TO_KEY });
        }
        else if (cmd.action === 'toggle-reactive') {
            // Toggle reactive lighting mode: {action: 'toggle-reactive', active: true/false, color: {r,g,b}}
            reactiveEnabled = cmd.active;
            if (cmd.color) {
                reactiveColor = cmd.color;
            }
            if (reactiveEnabled) {
                startReactiveMode();
                emit('status', { msg: 'Reactive: ON' });
            } else {
                stopReactiveMode();
                perKeyController.clearAll();
                perKeyController.apply().catch(() => { });
                emit('status', { msg: 'Reactive: OFF' });
            }
        }
        else if (cmd.action === 'toggle-neighbor-flash') {
            // Toggle neighbor flash on idle->active transition: {action: 'toggle-neighbor-flash', active: true/false}
            neighborFlashEnabled = cmd.active;
            emit('status', { msg: 'Neighbor Flash: ' + (neighborFlashEnabled ? 'ON' : 'OFF') });
            console.error('[BRIDGE] Neighbor flash ' + (neighborFlashEnabled ? 'ENABLED' : 'DISABLED'));
        }
    } catch (e) { }
});

setInterval(checkIdle, 200);
connect();
startKeyMonitor();
console.error('[BRIDGE] v19 Ready - Per-Key RGB');
emit('status', { msg: 'Ready' });
