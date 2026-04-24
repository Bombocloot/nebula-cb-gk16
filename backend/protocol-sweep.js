'use strict';

/**
 * protocol-sweep.js v2 — 8 variants, 8s observation window each.
 * Baseline: bottom 2 rows GREEN. Watch for ANY top row lighting up.
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
    return new Promise((res, rej) => {
        if (!outEP) return res();
        const buf = Buffer.alloc(64, 0);
        if (data) data.forEach((b, i) => { if (i < 64) buf[i] = b; });
        outEP.transfer(buf, e => e ? rej(e) : res());
    });
}
const delay = ms => new Promise(r => setTimeout(r, ms));
const PALETTE = [0x3f,0x00,0x00,0x00,0x3f,0x00,0x3f,0x3f,0x00,
                 0x00,0x00,0x3f,0x00,0x3f,0x3f,0x3f,0x00,0x3f,
                 0x3f,0x3f,0x3f,...new Array(43).fill(0)];

async function knownGoodBaseline() {
    const fl = new Array(128).fill(0x10);
    const gr = new Array(128).fill(0);
    const gg = new Array(128).fill(63);
    const gb = new Array(128).fill(0);
    await feat([0x30,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
    await out64(PALETTE); await delay(30);
    await feat([0x12,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
    await out64(fl.slice(0,64)); await delay(30); await out64(fl.slice(64)); await delay(30);
    await feat([0x12,0x00,0x00,0x01,0x00,0x55,0xAA,0x00]); await delay(20);
    await out64(gr.slice(0,64)); await delay(30); await out64(gr.slice(64)); await delay(30);
    await feat([0x12,0x00,0x00,0x02,0x00,0x55,0xAA,0x00]); await delay(20);
    await out64(gg.slice(0,64)); await delay(30); await out64(gg.slice(64)); await delay(30);
    await feat([0x12,0x00,0x00,0x03,0x00,0x55,0xAA,0x00]); await delay(20);
    await out64(gb.slice(0,64)); await delay(30); await out64(gb.slice(64)); await delay(30);
    await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]); await delay(20);
}

async function sendFin(cmd, data128) {
    await feat([cmd,0x00,0x00,0x00,0x00,0x55,0xAA,0x00]); await delay(20);
    await out64(data128.slice(0,64)); await delay(30);
    await out64(data128.slice(64)); await delay(30);
}

async function sendFinCh(cmd, ch, data128) {
    await feat([cmd,0x00,0x00,ch,0x00,0x55,0xAA,0x00]); await delay(20);
    await out64(data128.slice(0,64)); await delay(30);
    await out64(data128.slice(64)); await delay(30);
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  Protocol Sweep v2  (8 variants × 8s each = ~2min) ║');
    console.log('║  Bottom 2 rows = GREEN reference                    ║');
    console.log('║  Look for any key ABOVE that changing colour!       ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    connect();

    const FF = new Array(128).fill(0x3f);
    const FL = new Array(128).fill(0x10);
    const ZZ = new Array(128).fill(0x00);

    const variants = [
        {
            label: 'A — 0x0C + all-bright data  →  expect RED on top rows',
            run: async () => { await sendFin(0x0C, FF); await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]); }
        },
        {
            label: 'B — 0x0D + all-bright data  →  any top rows change?',
            run: async () => { await sendFin(0x0D, FF); await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]); }
        },
        {
            label: 'C — 0x0C then 0x0D both bright  →  top rows?',
            run: async () => { await sendFin(0x0C,FF); await sendFin(0x0D,FF); await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]); }
        },
        {
            label: 'D — 0x0C multi-ch flags+R+G+B  →  MAGENTA top?',
            run: async () => {
                await sendFinCh(0x0C,0,FL); await sendFinCh(0x0C,1,FF);
                await sendFinCh(0x0C,2,ZZ); await sendFinCh(0x0C,3,FF);
                await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
            }
        },
        {
            label: 'E — 0x0D multi-ch flags+R+G+B  →  RED top?',
            run: async () => {
                await sendFinCh(0x0D,0,FL); await sendFinCh(0x0D,1,FF);
                await sendFinCh(0x0D,2,ZZ); await sendFinCh(0x0D,3,ZZ);
                await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
            }
        },
        {
            label: 'F — 0x12 byte[4]=0x01 (page 1)  →  CYAN top?',
            run: async () => {
                for (const [ch,val] of [[0,0x10],[1,0x00],[2,0x3f],[3,0x3f]]) {
                    await feat([0x12,0x00,0x00,ch,0x01,0x55,0xAA,0x00]); await delay(20);
                    const d = new Array(128).fill(val);
                    await out64(d.slice(0,64)); await delay(30);
                    await out64(d.slice(64)); await delay(30);
                }
                await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
            }
        },
        {
            label: 'G — 0x12 byte[1]=0x01 (sub-cmd)  →  PURPLE top?',
            run: async () => {
                for (const [ch,val] of [[0,0x10],[1,0x3f],[2,0x00],[3,0x3f]]) {
                    await feat([0x12,0x01,0x00,ch,0x00,0x55,0xAA,0x00]); await delay(20);
                    const d = new Array(128).fill(val);
                    await out64(d.slice(0,64)); await delay(30);
                    await out64(d.slice(64)); await delay(30);
                }
                await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
            }
        },
        {
            label: 'H — 0x11 as apply cmd  →  WHITE top?',
            run: async () => {
                for (const [ch,val] of [[0,0x10],[1,0x3f],[2,0x3f],[3,0x3f]]) {
                    try {
                        await feat([0x11,0x00,0x00,ch,0x00,0x55,0xAA,0x00]); await delay(20);
                        const d = new Array(128).fill(val);
                        await out64(d.slice(0,64)); await delay(30);
                        await out64(d.slice(64)); await delay(30);
                    } catch(e) { console.log(`   0x11 err: ${e.message}`); }
                }
                await feat([0x08,0x33,0x3f,0x04,0x00,0x00,0xC4,0x3B]);
            }
        },
    ];

    for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        console.log(`\n${'═'.repeat(58)}`);
        console.log(`  [${i+1}/${variants.length}] ${v.label}`);
        console.log('═'.repeat(58));
        process.stdout.write('  Resetting baseline (GREEN)... ');
        await knownGoodBaseline();
        console.log('done');
        process.stdout.write('  Sending variant... ');
        await v.run();
        console.log('done');
        console.log(`\n  👀  WATCH NOW — 8 seconds`);
        for (let s = 8; s > 0; s--) {
            process.stdout.write(`\r  ⏱  ${s}s remaining...  `);
            await delay(1000);
        }
        console.log('\r  ⏱  done.            ');
    }

    console.log('\nFinal restore to GREEN...');
    await knownGoodBaseline();
    disconnect();

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  ALL DONE                                            ║');
    console.log('║  Which variant (A-H) lit up the top rows?           ║');
    console.log('║  (even a brief flicker counts)                      ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
}

main().catch(e => {
    console.error('\n❌', e.message);
    try { disconnect(); } catch(_) {}
    process.exit(1);
});
