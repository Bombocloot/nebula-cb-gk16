/**
 * ram-probe.js — Systematic USB opcode scanner for Cosmic Byte CB-GK-16 Firefly
 *
 * Purpose: Try to find a "direct mode" / RAM-based LED write path that avoids
 * EEPROM writes, enabling higher update rates (>5 FPS).
 *
 * Usage:
 *   node backend/ram-probe.js
 *
 * The keyboard must be connected with the libusbK driver on Interface 2 (MI_02).
 * See README.md for driver installation instructions.
 *
 * Safety guards:
 *  - ISP trigger sequences (raw 0x55 0xAA combos) are blocked
 *  - Factory reset sequence (0x07, [0x04, 0xFF]) is skipped
 *  - Delays between each command to avoid overwhelming the MCU
 *  - Results are written to ram-probe-results.json for analysis
 *
 * Risk: Low — HID feature reports cannot brick a keyboard. Worst case:
 *   temporary hang → unplug/replug to recover.
 */

'use strict';

const usb = require('usb');
const fs = require('fs');
const path = require('path');

const VID = 0x04D9;
const PID = 0xA1CD;
const INTERFACE_NUM = 2;
const OUT_LOG = path.join(__dirname, '..', 'ram-probe-results.json');

// ── Safety: sequences we must never send ────────────────────────────────────
// ISP unlock = 0x55 0xAA anywhere in the packet is potentially dangerous
// Factory reset = 0x07 or [0x04, 0xFF]
const BLOCKED_OPCODES = new Set([0x07]); // factory reset
const BLOCKED_PAIRS = [[0x04, 0xFF]];    // ISP/factory reset variant

function isSafe(payload) {
    const b = payload;
    if (BLOCKED_OPCODES.has(b[0])) return false;
    for (const [a, c] of BLOCKED_PAIRS) {
        if (b[0] === a && b[1] === c) return false;
    }
    // Block raw 0x55 0xAA in first two payload bytes (ISP unlock prefix)
    // Note: the existing protocol uses [0x30, ..., 0x55, 0xAA] but that's
    // a known-safe sequence in position 5-6. We only block it at bytes 0-1.
    if (b[0] === 0x55 && b[1] === 0xAA) return false;
    return true;
}

// ── USB helpers ──────────────────────────────────────────────────────────────
let dev = null, iface = null, outEP = null;

function connect() {
    dev = usb.findByIds(VID, PID);
    if (!dev) throw new Error(`Device ${VID.toString(16)}:${PID.toString(16)} not found. Is the keyboard plugged in?`);
    dev.open();
    iface = dev.interface(INTERFACE_NUM);
    try { if (iface.isKernelDriverActive()) iface.detachKernelDriver(); } catch (_) {}
    iface.claim();
    outEP = iface.endpoints.find(e => e.direction === 'out');
    if (outEP) outEP.timeout = 1000;
    console.log('✅  Connected to keyboard');
}

function disconnect() {
    try { if (iface) iface.release(true); } catch (_) {}
    try { if (dev) dev.close(); } catch (_) {}
    dev = null; iface = null; outEP = null;
}

function sendFeatureReport(data) {
    return new Promise((resolve, reject) => {
        const buf = Buffer.alloc(8, 0);
        for (let i = 0; i < Math.min(data.length, 8); i++) buf[i] = data[i];
        dev.controlTransfer(
            0x21,          // bmRequestType: Class | Interface | Host-to-Device
            0x09,          // bRequest: HID SET_REPORT
            0x0300,        // wValue: Report Type = Feature (3), ID = 0
            INTERFACE_NUM,
            buf,
            (err) => err ? reject(err) : resolve()
        );
    });
}

function sendInterruptOut(data) {
    return new Promise((resolve, reject) => {
        if (!outEP) return resolve(); // skip if no OUT endpoint
        const buf = Buffer.alloc(64, 0);
        for (let i = 0; i < Math.min(data.length, 64); i++) buf[i] = data[i];
        outEP.transfer(buf, err => err ? reject(err) : resolve());
    });
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ── Known good baseline: UNLOCK then set a simple solid color ─────────────
// We send this before/after each probe to confirm the keyboard is still alive
async function sendBaseline(r, g, b) {
    const scale = v => Math.round((v / 255) * 63);
    const sr = scale(r), sg = scale(g), sb = scale(b);

    const flags = new Array(128).fill(0x10);
    const red   = new Array(128).fill(sr);
    const green = new Array(128).fill(sg);
    const blue  = new Array(128).fill(sb);
    const palette = [0x3f,0x00,0x00,0x00,0x3f,0x00,0x3f,0x3f,0x00,0x00,0x00,0x3f,0x00,0x3f,0x3f,0x3f,0x00,0x3f,0x3f,0x3f,0x3f,...new Array(43).fill(0)];

    await sendFeatureReport([0x30,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
    await sendInterruptOut(palette); await delay(30);

    await sendFeatureReport([0x12,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
    await sendInterruptOut(flags.slice(0,64)); await delay(20);
    await sendInterruptOut(flags.slice(64));   await delay(20);

    await sendFeatureReport([0x12,0x00,0x00,0x01,0x00,0x55,0xAA,0x00]); await delay(20);
    await sendInterruptOut(red.slice(0,64)); await delay(20);
    await sendInterruptOut(red.slice(64));   await delay(20);

    await sendFeatureReport([0x12,0x00,0x00,0x02,0x00,0x55,0xAA,0x00]); await delay(20);
    await sendInterruptOut(green.slice(0,64)); await delay(20);
    await sendInterruptOut(green.slice(64));   await delay(20);

    await sendFeatureReport([0x12,0x00,0x00,0x03,0x00,0x55,0xAA,0x00]); await delay(20);
    await sendInterruptOut(blue.slice(0,64)); await delay(20);
    await sendInterruptOut(blue.slice(64));   await delay(20);

    await sendFeatureReport([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]); await delay(20);

    for (const cmd of [0x0C, 0x0D]) {
        await sendFeatureReport([cmd,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
        await sendInterruptOut(new Array(64).fill(0)); await delay(20);
        await sendInterruptOut(new Array(64).fill(0)); await delay(20);
    }
    await sendFeatureReport([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
}

// ── Probe definitions ────────────────────────────────────────────────────────
//
// Each probe entry is an 8-byte feature report payload.
// After sending, we wait and watch for any visual change on the keyboard.
// The user observes and marks results manually in the output JSON.
//
// Categories:
//   DIRECT_MODE  — opcodes referenced in protocol docs as possible direct/RAM mode
//   NEAR_APPLY   — opcodes near 0x12 (apply), might be a non-EEPROM variant
//   MODE_SWITCH  — variants of the 0x08 mode command
//   RANGE_SCAN   — systematic sweep of unexplored opcode space
//   KEEPALIVE    — test if a keep-alive / heartbeat command prevents EEPROM write

const PROBES = [
    // ── Category: DIRECT_MODE ──────────────────────────────────────────────
    {
        id: 'DIRECT_MODE_01',
        description: 'Direct mode enable — from HOLTEK-PROTOCOL-REFERENCE.md [0x04, 0x01]',
        payload: [0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'DIRECT_MODE_02',
        description: 'Direct mode enable variant [0x04, 0x00]',
        payload: [0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'DIRECT_MODE_03',
        description: 'Direct mode enable variant [0x04, 0x02]',
        payload: [0x04, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'DIRECT_WRITE_01',
        description: 'Opcode 0x27 — tested in README but worth re-trying after unlock',
        payload: [0x27, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'DIRECT_WRITE_02',
        description: 'Opcode 0x27 with sub-command 0x01',
        payload: [0x27, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'DIRECT_WRITE_03',
        description: 'Opcode 0x3B — tested in README, retry with data',
        payload: [0x3B, 0x01, 0x3F, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'DIRECT_WRITE_04',
        description: 'Opcode 0xC0 — tested in README, retry',
        payload: [0xC0, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },

    // ── Category: NEAR_APPLY (non-EEPROM apply variants) ──────────────────
    {
        id: 'NEAR_APPLY_0x11',
        description: '0x11 — one below APPLY (0x12), might be a preview/RAM write',
        payload: [0x11, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'NEAR_APPLY_0x13',
        description: '0x13 — one above APPLY (0x12)',
        payload: [0x13, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'NEAR_APPLY_0x14',
        description: '0x14 — possible alternate apply channel',
        payload: [0x14, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'NEAR_APPLY_0x1A',
        description: '0x1A — alternate apply (seen in similar Holtek boards)',
        payload: [0x1A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'NEAR_APPLY_0x1C',
        description: '0x1C — another candidate near apply range',
        payload: [0x1C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },

    // ── Category: MODE_SWITCH ──────────────────────────────────────────────
    {
        id: 'MODE_0x08_00',
        description: 'Mode 0 (static?) with full brightness — no finalize, test if it\'s RAM-based',
        payload: [0x08, 0x00, 0x3F, 0x01, 0x00, 0x04, 0x00, 0x00],
    },
    {
        id: 'MODE_NOEEPROM_01',
        description: '0x08 mode with 0x00 at byte 6 (no EEPROM flag?)',
        payload: [0x08, 0x02, 0x33, 0x01, 0x00, 0x04, 0x00, 0x00],
    },
    {
        id: 'MODE_PREVIEW_01',
        description: '0x09 — possible "preview mode" opcode (one above current mode cmd)',
        payload: [0x09, 0x01, 0x3F, 0x01, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'MODE_PREVIEW_02',
        description: '0x09 sub-command 0x33 (mode 51, same as per-key)',
        payload: [0x09, 0x33, 0x3F, 0x04, 0x00, 0x00, 0x00, 0x00],
    },

    // ── Category: KEEPALIVE ────────────────────────────────────────────────
    // Protocol doc says firmware reverts after 5s without data → heartbeat implied
    {
        id: 'KEEPALIVE_01',
        description: '0x01 — simple ping/keep-alive candidate',
        payload: [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'KEEPALIVE_02',
        description: '0x02 — keep-alive variant',
        payload: [0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
        id: 'KEEPALIVE_0x30_NOKEY',
        description: '0x30 unlock without 0x55 0xAA — might work as a no-op/ping',
        payload: [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    },

    // ── Category: RANGE_SCAN (unexplored) ─────────────────────────────────
    {
        id: 'SCAN_0x05',
        payload: [0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x05'
    },
    {
        id: 'SCAN_0x06',
        payload: [0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x06'
    },
    {
        id: 'SCAN_0x10',
        payload: [0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x10 (= per-key flag byte value 0x10 — might be a per-key RAM write)'
    },
    {
        id: 'SCAN_0x15',
        payload: [0x15, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x15'
    },
    {
        id: 'SCAN_0x16',
        payload: [0x16, 0x01, 0x3F, 0x00, 0x3F, 0x00, 0x00, 0x00],
        description: 'Range scan 0x16 with RGB data in bytes 2-4'
    },
    {
        id: 'SCAN_0x18',
        payload: [0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x18'
    },
    {
        id: 'SCAN_0x20',
        payload: [0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x20'
    },
    {
        id: 'SCAN_0x22',
        payload: [0x22, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x22'
    },
    {
        id: 'SCAN_0x25',
        payload: [0x25, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x25'
    },
    {
        id: 'SCAN_0x28',
        payload: [0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x28'
    },
    {
        id: 'SCAN_0x2A',
        payload: [0x2A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x2A'
    },
    {
        id: 'SCAN_0x31',
        payload: [0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x31 (near UNLOCK 0x30)'
    },
    {
        id: 'SCAN_0x40',
        payload: [0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x40'
    },
    {
        id: 'SCAN_0x42',
        payload: [0x42, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x42'
    },
    {
        id: 'SCAN_0x50',
        payload: [0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x50'
    },
    {
        id: 'SCAN_0x60',
        payload: [0x60, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x60'
    },
    {
        id: 'SCAN_0x80',
        payload: [0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0x80'
    },
    {
        id: 'SCAN_0xA0',
        payload: [0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0xA0'
    },
    {
        id: 'SCAN_0xB0',
        payload: [0xB0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0xB0'
    },
    {
        id: 'SCAN_0xD0',
        payload: [0xD0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0xD0'
    },
    {
        id: 'SCAN_0xE0',
        payload: [0xE0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        description: 'Range scan 0xE0'
    },
];

// ── Main runner ──────────────────────────────────────────────────────────────
async function run() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Nebula RAM Probe — CB-GK-16 Firefly');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Total probes: ${PROBES.length}`);
    console.log('  Output:       ram-probe-results.json');
    console.log('');
    console.log('  Instructions:');
    console.log('  Watch your keyboard LEDs during the probe.');
    console.log('  The keyboard will flash RED between each probe.');
    console.log('  If LEDs change to BLUE unexpectedly = possible hit!');
    console.log('  If keyboard stops responding = unplug and replug.');
    console.log('═══════════════════════════════════════════════════════════\n');

    connect();

    // Establish baseline: solid RED = "probe about to fire"
    // solid BLUE = "probe fired, look for changes"
    console.log('Setting baseline (solid red)...');
    await sendBaseline(255, 0, 0);
    await delay(500);

    const results = [];

    for (let i = 0; i < PROBES.length; i++) {
        const probe = PROBES[i];
        const hex = probe.payload.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');

        // Safety check
        if (!isSafe(probe.payload)) {
            console.log(`  [SKIPPED — UNSAFE] ${probe.id}`);
            results.push({ ...probe, hex, status: 'SKIPPED_UNSAFE', timestamp: Date.now() });
            continue;
        }

        process.stdout.write(`  [${String(i+1).padStart(2)}/${PROBES.length}] ${probe.id.padEnd(25)} ${hex} ... `);

        // Flash RED before probe (keyboard should be red = "ready")
        await sendBaseline(255, 0, 0);
        await delay(200);

        // Set keyboard to BLUE as a visual target state
        // (if the probe causes the color to stay blue or change = interesting)
        await sendBaseline(0, 0, 255);
        await delay(50);

        // Fire the probe
        const startMs = Date.now();
        let error = null;
        try {
            await sendFeatureReport(probe.payload);
        } catch (e) {
            error = e.message;
        }
        const elapsed = Date.now() - startMs;

        // Wait briefly to observe effect
        await delay(150);

        const status = error ? `ERROR: ${error}` : 'SENT';
        console.log(status === 'SENT' ? `OK (${elapsed}ms)` : status);

        results.push({
            id: probe.id,
            description: probe.description,
            payload: probe.payload,
            hex,
            status,
            elapsed,
            timestamp: Date.now(),
            // User fills these in manually after reviewing the JSON:
            visualEffect: null,   // "none" | "color change" | "flicker" | "mode change" | "crash"
            notes: null,
        });

        // Write intermediate results so you don't lose data if it crashes
        fs.writeFileSync(OUT_LOG, JSON.stringify(results, null, 2));

        await delay(100);
    }

    // Restore keyboard to a known state (solid cyan = done)
    console.log('\nProbe complete. Restoring keyboard to cyan...');
    try {
        await sendBaseline(0, 255, 255);
    } catch (_) {}

    disconnect();

    console.log(`\n✅  Results saved to: ${OUT_LOG}`);
    console.log('\nNext steps:');
    console.log('  1. Open ram-probe-results.json');
    console.log('  2. Fill in "visualEffect" for any probe that caused LED changes');
    console.log('  3. Re-run with a focused probe script on any hits');
    console.log('  4. If DIRECT_MODE_01 or NEAR_APPLY_* caused changes,');
    console.log('     try sending color data on the OUT endpoint immediately after\n');
}

run().catch(e => {
    console.error('\n❌  Fatal error:', e.message);
    try { disconnect(); } catch (_) {}
    process.exit(1);
});
