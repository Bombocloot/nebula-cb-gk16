'use strict';
/**
 * hid-test.js — Test full-keyboard RGB via Interface 1 (vendor HID, usagePage 0xFF02)
 * This interface still has the Windows HID driver (no libusbK needed).
 * FIREFLY.exe uses this path → should reach all 6 rows.
 */

const hid = require('node-hid');

const VID = 0x04D9, PID = 0xA1CD;
const TARGET_USAGE_PAGE = 65282; // 0xFF02 - vendor defined

// Find the vendor-defined HID device
const devInfo = hid.devices(VID, PID).find(d => d.usagePage === TARGET_USAGE_PAGE);
if (!devInfo) {
    console.error('❌  Vendor HID interface not found! usagePage=0xFF02 missing.');
    process.exit(1);
}
console.log('✅  Found vendor HID interface:');
console.log('    Path:', devInfo.path);
console.log('    Interface:', devInfo.interface);

const dev = new hid.HID(devInfo.path);
console.log('✅  Opened\n');

const delay = ms => new Promise(r => setTimeout(r, ms));

// Send 8-byte command as HID output report
function feat(data) {
    const buf = [0x00]; // report ID = 0
    for (let i = 0; i < 8; i++) buf.push(data[i] || 0);
    dev.write(buf); // use write() not sendFeatureReport
}

// Send 64-byte data as HID output report
function out(data) {
    const buf = [0x00]; // report ID = 0
    for (let i = 0; i < 64; i++) buf.push(data[i] || 0);
    dev.write(buf);
}

async function allRed() {
    const flags    = new Array(128).fill(0x10);
    const redCh    = new Array(128).fill(0x3F);
    const zeroCh   = new Array(128).fill(0x00);

    const palette = [
        0x3f,0x00,0x00, 0x00,0x3f,0x00, 0x3f,0x3f,0x00,
        0x00,0x00,0x3f, 0x00,0x3f,0x3f, 0x3f,0x00,0x3f,
        0x3f,0x3f,0x3f, ...new Array(43).fill(0)
    ];

    // UNLOCK
    feat([0x30,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
    out(palette); await delay(30);

    // Flags channel
    feat([0x12,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
    out(flags.slice(0,64)); await delay(30);
    out(flags.slice(64));   await delay(30);

    // Red channel
    feat([0x12,0x00,0x00,0x01,0x00,0x55,0xAA,0x00]); await delay(20);
    out(redCh.slice(0,64)); await delay(30);
    out(redCh.slice(64));   await delay(30);

    // Green channel = 0
    feat([0x12,0x00,0x00,0x02,0x00,0x55,0xAA,0x00]); await delay(20);
    out(zeroCh.slice(0,64)); await delay(30);
    out(zeroCh.slice(64));   await delay(30);

    // Blue channel = 0
    feat([0x12,0x00,0x00,0x03,0x00,0x55,0xAA,0x00]); await delay(20);
    out(zeroCh.slice(0,64)); await delay(30);
    out(zeroCh.slice(64));   await delay(30);

    // Mode 51
    feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]); await delay(20);

    // Finalize with zeros (safe baseline)
    for (const cmd of [0x0C, 0x0D]) {
        feat([cmd,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
        out(new Array(64).fill(0)); await delay(30);
        out(new Array(64).fill(0)); await delay(30);
    }

    feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
}

allRed()
    .then(() => {
        console.log('✅  DONE — how many rows are RED?');
        console.log('    (If all 6 rows = Interface 1 is the correct path!)');
        setTimeout(() => { dev.close(); process.exit(0); }, 1000);
    })
    .catch(e => {
        console.error('❌', e.message);
        try { dev.close(); } catch(_) {}
        process.exit(1);
    });
