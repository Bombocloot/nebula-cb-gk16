'use strict';

/**
 * key-mapper.js — Map firmware key indices to physical key positions
 *
 * Lights one key at a time using 0x04 [index] [r] [g] [b] feature report.
 * Watch which physical key lights up for each index.
 *
 * Findings so far:
 *  - 0x04 [key] [r] [g] [b] is accepted with 0 errors (no rejection)
 *  - Keyboard goes dark when streaming stops (needs keep-alive or finalize)
 *  - Bottom 2 rows = slots 0-~30 in current 0x12 mapping
 *
 * Usage: node backend/key-mapper.js [startIndex] [endIndex] [delayMs]
 *   node backend/key-mapper.js         → scans 0-127, 400ms per key
 *   node backend/key-mapper.js 0 29    → bottom 2 rows range, 600ms each
 *   node backend/key-mapper.js 80 127  → upper range, 600ms each
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

function feat(data) {
    return new Promise((res, rej) => {
        const buf = Buffer.alloc(8, 0);
        data.forEach((b, i) => { buf[i] = b; });
        dev.controlTransfer(0x21, 0x09, 0x0300, IFACE, buf, e => e ? rej(e) : res());
    });
}

function out64(data) {
    return new Promise((res) => {
        if (!outEP) return res();
        const buf = Buffer.alloc(64, 0);
        if (data) data.forEach((b, i) => { if (i < 64) buf[i] = b; });
        outEP.transfer(buf, e => res());
    });
}

const delay = ms => new Promise(r => setTimeout(r, ms));
const s = v => Math.round((v / 255) * 63);

const PALETTE = [0x3f,0x00,0x00,0x00,0x3f,0x00,0x3f,0x3f,0x00,
                 0x00,0x00,0x3f,0x00,0x3f,0x3f,0x3f,0x00,0x3f,
                 0x3f,0x3f,0x3f,...new Array(43).fill(0)];

// ── Set all keys to a solid colour via 0x12 (EEPROM baseline) ────────────
async function setAll(r, g, b) {
    const sr=s(r), sg=s(g), sb=s(b);
    const fl=new Array(128).fill(0x10);
    const ra=new Array(128).fill(sr);
    const ga=new Array(128).fill(sg);
    const ba=new Array(128).fill(sb);

    await feat([0x30,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]);
    await out64(PALETTE);              await delay(10);
    await feat([0x12,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]);
    await out64(fl.slice(0,64));       await delay(8);
    await out64(fl.slice(64));         await delay(8);
    await feat([0x12,0x00,0x00,0x01,0x00,0x55,0xAA,0x00]);
    await out64(ra.slice(0,64));       await delay(8);
    await out64(ra.slice(64));         await delay(8);
    await feat([0x12,0x00,0x00,0x02,0x00,0x55,0xAA,0x00]);
    await out64(ga.slice(0,64));       await delay(8);
    await out64(ga.slice(64));         await delay(8);
    await feat([0x12,0x00,0x00,0x03,0x00,0x55,0xAA,0x00]);
    await out64(ba.slice(0,64));       await delay(8);
    await out64(ba.slice(64));         await delay(8);
    await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
    await delay(300);
}

// ── Set one key via 0x04 [index] [r] [g] [b] ────────────────────────────
async function setKey04(index, r, g, b) {
    await feat([0x04, index, s(r), s(g), s(b), 0x00, 0x00, 0x00]);
}

// ── Reset that key back to dim (off) via 0x04 ────────────────────────────
async function clearKey04(index) {
    await feat([0x04, index, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

// ── Colours that are visually distinct from dim background ──────────────
// We cycle through them so consecutive keys have different colours
// making it easier to see which key moved
const PROBE_COLORS = [
    [255, 0,   0  ], // Red
    [0,   255, 0  ], // Green
    [0,   0,   255], // Blue
    [255, 255, 0  ], // Yellow
    [0,   255, 255], // Cyan
    [255, 0,   255], // Magenta
    [255, 128, 0  ], // Orange
    [128, 0,   255], // Purple
];

async function main() {
    const startIdx = parseInt(process.argv[2] ?? '0',   10);
    const endIdx   = parseInt(process.argv[3] ?? '127', 10);
    const holdMs   = parseInt(process.argv[4] ?? '400', 10);

    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  Key Mapper — 0x04 per-key index scanner             ║');
    console.log(`║  Range: ${String(startIdx).padEnd(3)} → ${String(endIdx).padEnd(3)}   Hold: ${holdMs}ms per key         ║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');
    console.log('Watch the keyboard:');
    console.log('  • Background = DIM (dark grey, all keys via 0x12)');
    console.log('  • ONE bright key lights up per step = that index maps here');
    console.log('  • Write down: index → physical key name\n');

    connect();

    // Set dark dim background so the lit key is obvious
    console.log('Setting dim background (all keys to very dim white)...');
    await setAll(15, 15, 15); // very dim white baseline

    console.log(`\nScanning indices ${startIdx} → ${endIdx} (${holdMs}ms each)\n`);
    console.log('Index | Physical key (fill this in while watching)');
    console.log('------+--------------------------------------------');

    const hits = []; // indices that actually light up a key

    for (let i = startIdx; i <= endIdx; i++) {
        const [r, g, b] = PROBE_COLORS[i % PROBE_COLORS.length];
        const hex = `RGB(${r},${g},${b})`.padEnd(18);

        // Light this key brightly
        await setKey04(i, r, g, b);
        process.stdout.write(`  ${String(i).padStart(3)}  | ${hex} → `);

        await delay(holdMs);

        // Check if it's visibly different (user watches)
        // We can't auto-detect, but we record timing
        process.stdout.write('(observe)\n');

        // Clear this key back to dim
        await setKey04(i, 15, 15, 15);
        await delay(50);
    }

    // ── After scan: test if 0x04 changes survive power cycle ─────────────
    console.log('\n─────────────────────────────────────────────────────');
    console.log('EEPROM TEST: Setting 5 specific keys to bright colours');
    console.log('  Key  0 → RED');
    console.log('  Key 10 → GREEN');
    console.log('  Key 20 → BLUE');
    console.log('  Key 30 → YELLOW');
    console.log('  Key 40 → CYAN');
    await setKey04(0,  255, 0,   0  );
    await setKey04(10, 0,   255, 0  );
    await setKey04(20, 0,   0,   255);
    await setKey04(30, 255, 255, 0  );
    await setKey04(40, 0,   255, 255);

    console.log('\n⚡ NOW: Unplug keyboard, wait 3s, plug back in');
    console.log('  → If those 5 keys keep their bright colours = EEPROM write');
    console.log('  → If keyboard reverts to all-dim-white = PURE RAM! 🎉\n');

    await delay(10000); // give user time to read and unplug

    // Restore to a nice state
    await setAll(0, 100, 255);
    disconnect();
    console.log('Done.\n');
}

main().catch(e => {
    console.error('\n❌', e.message);
    try { disconnect(); } catch (_) {}
    process.exit(1);
});
