'use strict';

/**
 * ram-fast.js — Optimized RAM-based per-key RGB at maximum FPS
 *
 * Key discoveries:
 *  - 0x0C/0x0D finalize = EEPROM commit only. Skip it = RAM display, no wear.
 *  - Palette + flags only need to be sent once at startup.
 *  - Per frame: only R + G + B channels need updating (9 transfers vs 13).
 *  - Zero delays between transfers is stable.
 *
 * EEPROM check: run this script, then unplug+replug the keyboard.
 * If it reverts to old colors → confirms NO EEPROM write without finalize.
 * If it keeps the colors → EEPROM is still being written somehow.
 *
 * Usage: node backend/ram-fast.js
 */

const usb = require('usb');

const VID = 0x04D9, PID = 0xA1CD, IFACE = 2;
let dev, iface, outEP;

// ── USB plumbing ──────────────────────────────────────────────────────────
function connect() {
    dev = usb.findByIds(VID, PID);
    if (!dev) throw new Error('Keyboard not found');
    dev.open();
    iface = dev.interface(IFACE);
    try { if (iface.isKernelDriverActive()) iface.detachKernelDriver(); } catch (_) {}
    iface.claim();
    outEP = iface.endpoints.find(e => e.direction === 'out');
    if (outEP) outEP.timeout = 500;
}

function disconnect() {
    try { iface?.release(true); } catch (_) {}
    try { dev?.close(); } catch (_) {}
}

function feat(data) {
    return new Promise((res, rej) => {
        const buf = Buffer.alloc(8, 0);
        data.forEach((b, i) => { buf[i] = b; });
        dev.controlTransfer(0x21, 0x09, 0x0300, IFACE, buf, e => e ? rej(e) : res());
    });
}

function bulk(data) {
    return new Promise((res, rej) => {
        const buf = Buffer.alloc(64, 0);
        data.forEach((b, i) => { buf[i] = b; });
        outEP.transfer(buf, e => e ? rej(e) : res());
    });
}

const s = v => Math.round((v / 255) * 63); // 0-255 → 0-63

// ── One-time init: unlock + palette + flags ───────────────────────────────
// Only needs to run once per session.
async function initSession() {
    const palette = [
        0x3f,0x00,0x00, 0x00,0x3f,0x00, 0x3f,0x3f,0x00,
        0x00,0x00,0x3f, 0x00,0x3f,0x3f, 0x3f,0x00,0x3f, 0x3f,0x3f,0x3f,
        ...new Array(43).fill(0)
    ];
    const flags = new Array(128).fill(0x10);

    // Unlock
    await feat([0x30,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]);
    await bulk(palette);

    // Flags (enable all 128 keys)
    await feat([0x12,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]);
    await bulk(flags.slice(0, 64));
    await bulk(flags.slice(64));

    // Set mode 51 (per-key custom mode)
    await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
}

// ── Per-frame: only sends R + G + B channels (9 transfers) ───────────────
// No delays, no palette, no flags, no finalize. Pure RAM write.
async function sendFrameRaw(rArr, gArr, bArr) {
    await feat([0x12,0x00,0x00,0x01,0x00,0x55,0xAA,0x00]);
    await bulk(rArr.slice(0, 64));
    await bulk(rArr.slice(64));

    await feat([0x12,0x00,0x00,0x02,0x00,0x55,0xAA,0x00]);
    await bulk(gArr.slice(0, 64));
    await bulk(gArr.slice(64));

    await feat([0x12,0x00,0x00,0x03,0x00,0x55,0xAA,0x00]);
    await bulk(bArr.slice(0, 64));
    await bulk(bArr.slice(64));
}

// Helper: build flat 128-element arrays from a single solid color
function solidArrays(r, g, b) {
    return [
        new Array(128).fill(s(r)),
        new Array(128).fill(s(g)),
        new Array(128).fill(s(b)),
    ];
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── FPS Benchmark ─────────────────────────────────────────────────────────
async function benchmarkFPS(frames = 60) {
    console.log(`\n📊 FPS Benchmark: ${frames} frames, alternating colors`);
    console.log('   (no delays, no finalize, only R/G/B channels)\n');

    const colors = [
        [255, 0,   0  ],
        [0,   255, 0  ],
        [0,   0,   255],
        [255, 255, 0  ],
        [0,   255, 255],
        [255, 0,   255],
    ];

    const start = Date.now();
    let errors = 0;

    for (let i = 0; i < frames; i++) {
        const [r, g, b] = colors[i % colors.length];
        const [rArr, gArr, bArr] = solidArrays(r, g, b);
        try {
            await sendFrameRaw(rArr, gArr, bArr);
        } catch (e) {
            errors++;
        }
    }

    const ms = Date.now() - start;
    const fps = (frames / (ms / 1000)).toFixed(1);
    const msPerFrame = (ms / frames).toFixed(1);

    console.log(`   ✅ ${frames} frames | ${ms}ms total`);
    console.log(`   🚀 ${fps} FPS  |  ${msPerFrame}ms per frame`);
    if (errors) console.log(`   ⚠️  ${errors} transfer errors`);
    return parseFloat(fps);
}

// ── Smooth hue cycle demo ─────────────────────────────────────────────────
function hslToRgb(h) {
    // h: 0-360
    const s = 1, l = 0.5;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        return Math.round((l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)) * 255);
    };
    return [f(0), f(8), f(4)];
}

async function rainbowDemo(durationMs = 5000) {
    console.log(`\n🌈 Rainbow cycle demo for ${durationMs / 1000}s`);
    console.log('   All keys cycling through hue spectrum\n');

    const end = Date.now() + durationMs;
    let frames = 0;
    let hue = 0;

    while (Date.now() < end) {
        const [r, g, b] = hslToRgb(hue);
        const [rArr, gArr, bArr] = solidArrays(r, g, b);
        try {
            await sendFrameRaw(rArr, gArr, bArr);
            frames++;
            hue = (hue + 3) % 360;
        } catch (_) {}
    }

    const fps = (frames / (durationMs / 1000)).toFixed(1);
    console.log(`   Done: ${frames} frames → ${fps} FPS sustained`);
}

// ── Per-key gradient demo ─────────────────────────────────────────────────
async function perKeyDemo(durationMs = 5000) {
    console.log(`\n🎨 Per-key wave demo for ${durationMs / 1000}s\n`);

    // 128 key positions, each gets a different hue offset
    const end = Date.now() + durationMs;
    let frames = 0;
    let tick = 0;

    while (Date.now() < end) {
        const rArr = new Array(128).fill(0);
        const gArr = new Array(128).fill(0);
        const bArr = new Array(128).fill(0);

        for (let i = 0; i < 128; i++) {
            const hue = (tick * 4 + i * 2.8) % 360;
            const [r, g, b] = hslToRgb(hue);
            rArr[i] = s(r);
            gArr[i] = s(g);
            bArr[i] = s(b);
        }

        try {
            await sendFrameRaw(rArr, gArr, bArr);
            frames++;
            tick++;
        } catch (_) {}
    }

    const fps = (frames / (durationMs / 1000)).toFixed(1);
    console.log(`   Done: ${frames} frames → ${fps} FPS sustained`);
}

// ── EEPROM check ──────────────────────────────────────────────────────────
async function eepromCheck() {
    console.log('\n🔍 EEPROM Check');
    console.log('   Setting keyboard to SOLID ORANGE (no finalize)...');
    const [rArr, gArr, bArr] = solidArrays(255, 80, 0);
    await sendFrameRaw(rArr, gArr, bArr);
    console.log('\n   ⚡ ACTION REQUIRED:');
    console.log('   1. Unplug the keyboard USB cable');
    console.log('   2. Plug it back in');
    console.log('   3. Check what color the keyboard boots to:\n');
    console.log('   → If it boots ORANGE  : EEPROM was written (still persisting)');
    console.log('   → If it boots previous: NO EEPROM write — pure RAM! 🎉');
    console.log('   → If it boots rainbow : No state saved at all (default mode)\n');
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  Nebula — Optimized RAM Lighting Engine           ║');
    console.log('║  No finalize (0x0C/0x0D) = no EEPROM commit      ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    connect();
    console.log('✅  Connected — running one-time session init...');
    await initSession();
    console.log('✅  Session ready (palette + flags sent once)\n');

    // 1. Benchmark
    const fps = await benchmarkFPS(60);

    // 2. Rainbow solid demo
    await rainbowDemo(5000);

    // 3. Per-key wave
    await perKeyDemo(5000);

    // 4. EEPROM check
    await eepromCheck();

    // Leave keyboard in a nice state
    const [rArr, gArr, bArr] = solidArrays(0, 180, 255);
    await sendFrameRaw(rArr, gArr, bArr);

    disconnect();

    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║  Results summary                                  ║');
    console.log(`║  FPS achieved: ${String(fps).padEnd(35)}║`);
    console.log('║                                                   ║');
    console.log('║  If fps > 15: reactive lighting is now viable!   ║');
    console.log('║  Next: integrate into Nebula app as "Live Mode"  ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
}

main().catch(e => {
    console.error('\n❌  Fatal:', e.message);
    try { disconnect(); } catch (_) {}
    process.exit(1);
});
