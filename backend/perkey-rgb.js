// Per-Key RGB Controller with Planar Encoding
// Supports ANY RGB color, gradients, and custom colors
// Protocol: Apply0=flags, Apply1=R, Apply2=G, Apply3=B

const HID = require('node-hid');

const VID = 0x04D9;
const PID = 0xA1CD;

// Complete TKL Key Map (87 keys) - EXACT indices from USB capture
const KEY_MAP = {
    // Row 0: Function keys (indices 0-15)
    'ESC': 0, 'F1': 1, 'F2': 2, 'F3': 3, 'F4': 4, 'F5': 5,
    'F6': 6, 'F7': 7, 'F8': 8, 'F9': 9, 'F10': 10, 'F11': 11,
    'F12': 12, 'PRTSC': 13, 'SCRLK': 14, 'PAUSE': 15,

    // Row 1: Number row (indices 16-31)
    'GRAVE': 16, '`': 16, '1': 17, '2': 18, '3': 19, '4': 20, '5': 21,
    '6': 22, '7': 23, '8': 24, '9': 25, '0': 26, 'MINUS': 27, '-': 27,
    'EQUAL': 28, '=': 28, 'BACKSPACE': 29, 'INSERT': 30, 'HOME': 31,

    // Row 2: QWERTY row (indices 32-47)
    'TAB': 32, 'Q': 33, 'W': 34, 'E': 35, 'R': 36, 'T': 37,
    'Y': 38, 'U': 39, 'I': 40, 'O': 41, 'P': 42,
    'LBRACKET': 43, '[': 43, 'RBRACKET': 44, ']': 44,
    'BACKSLASH': 45, '\\': 45, 'DELETE': 46, 'END': 47,

    // Row 3: Home row (indices 48-63) - note PGUP/PGDN at end
    'CAPSLOCK': 48, 'CAPS': 48, 'A': 49, 'S': 50, 'D': 51, 'F': 52, 'G': 53,
    'H': 54, 'J': 55, 'K': 56, 'L': 57,
    'SEMICOLON': 58, ';': 58, 'QUOTE': 59, "'": 59,
    'ENTER': 60, 'PGUP': 62, 'PGDN': 63,

    // Row 4: Shift row (indices 64-79) - from 0D section
    'LSHIFT': 64, 'Z': 65, 'X': 66, 'C': 67, 'V': 68, 'B': 69,
    'N': 70, 'M': 71, 'COMMA': 72, ',': 72, 'PERIOD': 73, '.': 73,
    'SLASH': 74, '/': 74, 'RSHIFT': 75, 'UP': 78, 'RIGHT': 79,

    // Row 5: Control row (indices 80-95) - from 0D section
    'LCTRL': 80, 'LWIN': 81, 'LALT': 82, 'SPACE': 85,
    'RALT': 88, 'FN': 89, 'MENU': 90, 'RCTRL': 91, 'LEFT': 94, 'DOWN': 95
};

// Reverse map for index -> key name
const INDEX_TO_KEY = {};
for (const [key, idx] of Object.entries(KEY_MAP)) {
    INDEX_TO_KEY[idx] = key;
}

class PerKeyRGBController {
    constructor() {
        this.device = null;
        this.keyColors = {};  // {index: {r, g, b}}

        // Initialize all keys to off
        for (let i = 0; i < 128; i++) {
            this.keyColors[i] = { r: 0, g: 0, b: 0 };
        }
    }

    connect() {
        try {
            const devices = HID.devices().filter(d =>
                d.vendorId === VID &&
                d.productId === PID &&
                d.usagePage === 0xFF01
            );

            if (devices.length > 0) {
                this.device = new HID.HID(devices[0].path);
                this.device.on('error', () => { this.device = null; });
                return true;
            }
        } catch (e) {
            console.error('Connect error:', e.message);
        }
        return false;
    }

    disconnect() {
        if (this.device) {
            this.device.close();
            this.device = null;
        }
    }

    sendCmd(data) {
        if (!this.device && !this.connect()) return false;
        try {
            const report = [0, ...data.slice(0, 8)];
            while (report.length < 9) report.push(0);
            this.device.sendFeatureReport(report);
            return true;
        } catch (e) {
            console.error('sendCmd error:', e.message);
            // Try to reconnect on next call
            this.device = null;
            return false;
        }
    }

    sendData(data) {
        if (!this.device && !this.connect()) return false;
        try {
            const report = [0, ...data.slice(0, 64)];
            while (report.length < 65) report.push(0);
            this.device.write(report);
            return true;
        } catch (e) {
            console.error('sendData error:', e.message);
            // Try to reconnect on next call
            this.device = null;
            return false;
        }
    }

    // Convert 0-255 RGB to 0-63 hardware range
    scale(value) {
        return Math.round((value / 255) * 63);
    }

    // Set a single key color (0-255 RGB)
    setKey(keyOrIndex, r, g, b) {
        const idx = typeof keyOrIndex === 'string' ? KEY_MAP[keyOrIndex.toUpperCase()] : keyOrIndex;
        if (idx !== undefined && idx >= 0 && idx < 128) {
            this.keyColors[idx] = { r: this.scale(r), g: this.scale(g), b: this.scale(b) };
        }
    }

    // Set all keys to one color
    setAll(r, g, b) {
        const scaled = { r: this.scale(r), g: this.scale(g), b: this.scale(b) };
        for (let i = 0; i < 128; i++) {
            this.keyColors[i] = { ...scaled };
        }
    }

    // Clear all keys
    clearAll() {
        for (let i = 0; i < 128; i++) {
            this.keyColors[i] = { r: 0, g: 0, b: 0 };
        }
    }

    // Apply horizontal gradient (left to right)
    applyGradient(startColor, endColor) {
        // Row-based gradient (6 rows)
        const rows = [
            [0, 15],   // Function row
            [16, 31],  // Number row
            [32, 47],  // QWERTY row
            [48, 63],  // Home row
            [64, 79],  // Shift row
            [80, 95]   // Control row
        ];

        rows.forEach((rowRange, rowIdx) => {
            for (let i = rowRange[0]; i <= rowRange[1]; i++) {
                const t = (i - rowRange[0]) / (rowRange[1] - rowRange[0]);
                this.keyColors[i] = {
                    r: this.scale(Math.round(startColor.r + (endColor.r - startColor.r) * t)),
                    g: this.scale(Math.round(startColor.g + (endColor.g - startColor.g) * t)),
                    b: this.scale(Math.round(startColor.b + (endColor.b - startColor.b) * t))
                };
            }
        });
    }

    // Apply rainbow gradient across keyboard
    applyRainbow() {
        for (let i = 0; i < 96; i++) {
            const hue = (i / 96) * 360;
            const rgb = this.hslToRgb(hue, 100, 50);
            this.keyColors[i] = {
                r: this.scale(rgb.r),
                g: this.scale(rgb.g),
                b: this.scale(rgb.b)
            };
        }
    }

    // HSL to RGB conversion
    hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        };
        return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
    }

    // Apply colors to keyboard using EEPROM write
    async apply() {
        if (!this.device && !this.connect()) {
            throw new Error('Cannot connect to keyboard');
        }

        // Build channel arrays
        const flags = new Array(128).fill(0);
        const redChannel = new Array(128).fill(0);
        const greenChannel = new Array(128).fill(0);
        const blueChannel = new Array(128).fill(0);

        for (let i = 0; i < 128; i++) {
            const c = this.keyColors[i];
            if (c.r > 0 || c.g > 0 || c.b > 0) {
                flags[i] = 0x10;  // Enable key
                redChannel[i] = c.r;
                greenChannel[i] = c.g;
                blueChannel[i] = c.b;
            }
        }

        // Standard 7-color palette (required by protocol)
        const palette = [
            0x3f, 0x00, 0x00, 0x00, 0x3f, 0x00, 0x3f, 0x3f, 0x00,
            0x00, 0x00, 0x3f, 0x00, 0x3f, 0x3f, 0x3f, 0x00, 0x3f,
            0x3f, 0x3f, 0x3f
        ].concat(new Array(43).fill(0));

        // UNLOCK
        this.sendCmd([0x30, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]);
        await this.delay(20);
        this.sendData(palette);
        await this.delay(30);

        // APPLY 0: Enable flags
        this.sendCmd([0x12, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]);
        await this.delay(20);
        this.sendData(flags.slice(0, 64));
        await this.delay(30);
        this.sendData(flags.slice(64));
        await this.delay(30);

        // APPLY 1: RED channel
        this.sendCmd([0x12, 0x00, 0x00, 0x01, 0x00, 0x55, 0xAA, 0x00]);
        await this.delay(20);
        this.sendData(redChannel.slice(0, 64));
        await this.delay(30);
        this.sendData(redChannel.slice(64));
        await this.delay(30);

        // APPLY 2: GREEN channel
        this.sendCmd([0x12, 0x00, 0x00, 0x02, 0x00, 0x55, 0xAA, 0x00]);
        await this.delay(20);
        this.sendData(greenChannel.slice(0, 64));
        await this.delay(30);
        this.sendData(greenChannel.slice(64));
        await this.delay(30);

        // APPLY 3: BLUE channel
        this.sendCmd([0x12, 0x00, 0x00, 0x03, 0x00, 0x55, 0xAA, 0x00]);
        await this.delay(20);
        this.sendData(blueChannel.slice(0, 64));
        await this.delay(30);
        this.sendData(blueChannel.slice(64));
        await this.delay(30);

        // MODE 51
        this.sendCmd([0x08, 0x33, 0x3f, 0x04, 0x00, 0x00, 0xC4, 0x3B]);
        await this.delay(20);

        // FINALIZE
        for (const cmd of [0x0C, 0x0D]) {
            this.sendCmd([cmd, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]);
            await this.delay(20);
            this.sendData(new Array(64).fill(0));
            await this.delay(30);
            this.sendData(new Array(64).fill(0));
            await this.delay(30);
        }

        // Final MODE
        this.sendCmd([0x08, 0x33, 0x3f, 0x04, 0x00, 0x00, 0xC4, 0x3B]);

        return true;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { PerKeyRGBController, KEY_MAP, INDEX_TO_KEY };
