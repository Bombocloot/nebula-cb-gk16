'use strict';

/**
 * ram-test-nofinalize.js — Test per-key RGB WITHOUT EEPROM finalize (0x0C/0x0D)
 *
 * Theory: The 0x0C/0x0D finalize commands are what commit to EEPROM.
 * If we skip them, colors might still display from RAM → faster updates.
 *
 * Usage: node backend/ram-test-nofinalize.js
 */

const usb = require('usb');

const VID = 0x04D9, PID = 0xA1CD, IFACE = 2;

let dev, iface, outEP;

function connect() {
    dev = usb.findByIds(VID, PID);
    if (!dev) throw new Error('Keyboard not found');
    dev.open();
    iface = dev.interface(IFACE);
    try { if (iface.isKernelDriverActive()) iface.detachKernelDriver(); } catch (_) {}
    iface.claim();
    outEP = iface.endpoints.find(e => e.direction === 'out');
    if (outEP) outEP.timeout = 1000;
    console.log('✅  Connected\n');
}

function disconnect() {
    try { iface?.release(true); } catch (_) {}
    try { dev?.close(); } catch (_) {}
}

function sendFeature(data) {
    return new Promise((res, rej) => {
        const buf = Buffer.alloc(8, 0);
        data.forEach((b, i) => buf[i] = b);
        dev.controlTransfer(0x21, 0x09, 0x0300, IFACE, buf, e => e ? rej(e) : res());
    });
}

function sendData(data) {
    return new Promise((res, rej) => {
        if (!outEP) return res();
        const buf = Buffer.alloc(64, 0);
        data.forEach((b, i) => buf[i] = b);
        outEP.transfer(buf, e => e ? rej(e) : res());
    });
}

const delay = ms => new Promise(r => setTimeout(r, ms));
const scale = v => Math.round((v / 255) * 63);

const PALETTE = [
    0x3f, 0x00, 0x00, 0x00, 0x3f, 0x00, 0x3f, 0x3f, 0x00,
    0x00, 0x00, 0x3f, 0x00, 0x3f, 0x3f, 0x3f, 0x00, 0x3f,
    0x3f, 0x3f, 0x3f, ...new Array(43).fill(0)
];

// ── Core: send per-key frame WITH or WITHOUT finalize ────────────────────
async function sendFrame(r, g, b, { finalize = false, modeCmd = true } = {}) {
    const sr = scale(r), sg = scale(g), sb = scale(b);
    const flags = new Array(128).fill(0x10);
    const red   = new Array(128).fill(sr);
    const green = new Array(128).fill(sg);
    const blue  = new Array(128).fill(sb);

    // UNLOCK
    await sendFeature([0x30, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]);
    await delay(10);
    await sendData(PALETTE);
    await delay(15);

    // FLAGS
    await sendFeature([0x12, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]);
    await delay(10);
    await sendData(flags.slice(0, 64));
    await delay(15);
    await sendData(flags.slice(64));
    await delay(15);

    // RED
    await sendFeature([0x12, 0x00, 0x00, 0x01, 0x00, 0x55, 0xAA, 0x00]);
    await delay(10);
    await sendData(red.slice(0, 64));
    await delay(15);
    await sendData(red.slice(64));
    await delay(15);

    // GREEN
    await sendFeature([0x12, 0x00, 0x00, 0x02, 0x00, 0x55, 0xAA, 0x00]);
    await delay(10);
    await sendData(green.slice(0, 64));
    await delay(15);
    await sendData(green.slice(64));
    await delay(15);

    // BLUE
    await sendFeature([0x12, 0x00, 0x00, 0x03, 0x00, 0x55, 0xAA, 0x00]);
    await delay(10);
    await sendData(blue.slice(0, 64));
    await delay(15);
    await sendData(blue.slice(64));
    await delay(15);

    if (modeCmd) {
        await sendFeature([0x08, 0x33, 0x3f, 0x04, 0x00, 0x00, 0xC4, 0x3B]);
        await delay(10);
    }

    if (finalize) {
        for (const cmd of [0x0C, 0x0D]) {
            await sendFeature([cmd, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]);
            await delay(10);
            await sendData(new Array(64).fill(0));
            await delay(15);
            await sendData(new Array(64).fill(0));
            await delay(15);
        }
        await sendFeature([0x08, 0x33, 0x3f, 0x04, 0x00, 0x00, 0xC4, 0x3B]);
    }
}

// ── Test 1: No finalize — does it show color at all? ────────────────────
async function test1_NoFinalize() {
    console.log('═══════════════════════════════════════════════════');
    console.log('TEST 1: No-finalize single frame');
    console.log('Expected: Keyboard should turn SOLID GREEN');
    console.log('If it shows green → RAM write works without EEPROM!');
    console.log('If nothing changes  → finalize is required to display');
    console.log('═══════════════════════════════════════════════════\n');

    await delay(1000);
    const t = Date.now();
    await sendFrame(0, 255, 0, { finalize: false });
    console.log(`  Frame sent in ${Date.now() - t}ms`);
    console.log('  👀  Look at keyboard now — is it GREEN?\n');
    await delay(3000);
}

// ── Test 2: No finalize loop — measure FPS ──────────────────────────────
async function test2_NoFinalizeLoop() {
    console.log('═══════════════════════════════════════════════════');
    console.log('TEST 2: No-finalize rapid loop (10 frames)');
    console.log('Cycling: RED → GREEN → BLUE → MAGENTA → CYAN');
    console.log('Watch for smooth color changes and note FPS');
    console.log('═══════════════════════════════════════════════════\n');

    await delay(1000);

    const colors = [
        [255, 0,   0  ],  // Red
        [0,   255, 0  ],  // Green
        [0,   0,   255],  // Blue
        [255, 0,   255],  // Magenta
        [0,   255, 255],  // Cyan
        [255, 255, 0  ],  // Yellow
        [255, 128, 0  ],  // Orange
        [128, 0,   255],  // Purple
        [255, 255, 255],  // White
        [0,   0,   0  ],  // Off
    ];

    const start = Date.now();
    let frames = 0;

    for (const [r, g, b] of colors) {
        const ft = Date.now();
        await sendFrame(r, g, b, { finalize: false });
        const elapsed = Date.now() - ft;
        console.log(`  Frame ${++frames}: RGB(${r},${g},${b}) — ${elapsed}ms`);
    }

    const totalMs = Date.now() - start;
    const fps = (frames / (totalMs / 1000)).toFixed(1);
    console.log(`\n  📊 ${frames} frames in ${totalMs}ms → ${fps} FPS`);

    if (parseFloat(fps) > 5) {
        console.log('  🚀 FASTER THAN EEPROM PATH! RAM write likely working.');
    } else {
        console.log('  ⚠️  Same speed as EEPROM path. May still be writing to flash.');
    }

    console.log('  👀  Did colors actually change on keyboard?\n');
    await delay(3000);
}

// ── Test 3: No finalize, no mode cmd — minimal path ─────────────────────
async function test3_MinimalPath() {
    console.log('═══════════════════════════════════════════════════');
    console.log('TEST 3: Minimal path — no finalize, no mode cmd');
    console.log('Just: UNLOCK → FLAGS → R → G → B');
    console.log('Expected: Shows YELLOW if working');
    console.log('═══════════════════════════════════════════════════\n');

    await delay(1000);
    const t = Date.now();
    await sendFrame(255, 255, 0, { finalize: false, modeCmd: false });
    console.log(`  Frame sent in ${Date.now() - t}ms`);
    console.log('  👀  Is keyboard YELLOW now?\n');
    await delay(3000);
}

// ── Test 4: Aggressive loop, minimum delays ──────────────────────────────
async function test4_AggressiveLoop() {
    console.log('═══════════════════════════════════════════════════');
    console.log('TEST 4: Aggressive FPS test — 0ms delays between sends');
    console.log('20 frames, alternating RED ↔ BLUE as fast as possible');
    console.log('═══════════════════════════════════════════════════\n');

    await delay(1000);

    // Minimal delay version
    async function sendFrameFast(r, g, b) {
        const sr = scale(r), sg = scale(g), sb = scale(b);
        const flags = new Array(128).fill(0x10);
        const red   = new Array(128).fill(sr);
        const green = new Array(128).fill(sg);
        const blue  = new Array(128).fill(sb);

        await sendFeature([0x30, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]);
        await sendData(PALETTE);
        await sendFeature([0x12, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]);
        await sendData(flags.slice(0, 64));
        await sendData(flags.slice(64));
        await sendFeature([0x12, 0x00, 0x00, 0x01, 0x00, 0x55, 0xAA, 0x00]);
        await sendData(red.slice(0, 64));
        await sendData(red.slice(64));
        await sendFeature([0x12, 0x00, 0x00, 0x02, 0x00, 0x55, 0xAA, 0x00]);
        await sendData(green.slice(0, 64));
        await sendData(green.slice(64));
        await sendFeature([0x12, 0x00, 0x00, 0x03, 0x00, 0x55, 0xAA, 0x00]);
        await sendData(blue.slice(0, 64));
        await sendData(blue.slice(64));
        await sendFeature([0x08, 0x33, 0x3f, 0x04, 0x00, 0x00, 0xC4, 0x3B]);
    }

    const FRAMES = 20;
    const start = Date.now();
    let errors = 0;

    for (let i = 0; i < FRAMES; i++) {
        try {
            await sendFrameFast(i % 2 === 0 ? 255 : 0, 0, i % 2 === 0 ? 0 : 255);
        } catch (e) {
            errors++;
        }
    }

    const totalMs = Date.now() - start;
    const fps = (FRAMES / (totalMs / 1000)).toFixed(1);
    console.log(`  📊 ${FRAMES} frames in ${totalMs}ms → ${fps} FPS (${errors} errors)`);
    console.log(`  Per-frame: ${(totalMs / FRAMES).toFixed(0)}ms\n`);
}

// ── Test 5: With finalize for comparison ────────────────────────────────
async function test5_WithFinalize() {
    console.log('═══════════════════════════════════════════════════');
    console.log('TEST 5: WITH finalize (baseline comparison)');
    console.log('Sending MAGENTA the normal EEPROM way');
    console.log('Compare speed vs tests above');
    console.log('═══════════════════════════════════════════════════\n');

    await delay(1000);
    const t = Date.now();
    await sendFrame(255, 0, 255, { finalize: true });
    console.log(`  Full EEPROM frame: ${Date.now() - t}ms`);
    console.log('  👀  Is keyboard MAGENTA?\n');
    await delay(2000);
}

// ── Run all tests ────────────────────────────────────────────────────────
async function run() {
    console.log('\n🔬 RAM No-Finalize Test Suite — CB-GK-16 Firefly\n');
    console.log('Watch your keyboard LEDs throughout!\n');

    connect();

    try {
        await test1_NoFinalize();
        await test2_NoFinalizeLoop();
        await test3_MinimalPath();
        await test4_AggressiveLoop();
        await test5_WithFinalize();

        console.log('═══════════════════════════════════════════════════');
        console.log('ALL TESTS DONE');
        console.log('');
        console.log('If tests 1-4 showed colors on keyboard:');
        console.log('  → RAM write IS possible without EEPROM commit!');
        console.log('  → We can achieve high FPS reactive lighting');
        console.log('  → Need to figure out max stable FPS');
        console.log('');
        console.log('If ONLY test 5 showed colors:');
        console.log('  → Finalize IS required to display (EEPROM only)');
        console.log('  → But the 0x08 mode commands confirmed earlier');
        console.log('     suggest some form of RAM access is possible');
        console.log('═══════════════════════════════════════════════════\n');

    } finally {
        disconnect();
    }
}

run().catch(e => {
    console.error('❌  Error:', e.message);
    try { disconnect(); } catch (_) {}
    process.exit(1);
});
