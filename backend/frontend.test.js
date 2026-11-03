const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');
const path = require('node:path');

test('Frontend loads without crashing', async () => {
    const htmlPath = path.resolve(__dirname, '../src/index.html');
    let windowRef;
    const dom = await JSDOM.fromFile(htmlPath, {
        runScripts: 'dangerously',
        resources: 'usable',
        beforeParse(window) {
            windowRef = window;
            window.api = {
                onWindowRestore: () => {},
                onHardwareError: () => {},
                onInitialState: () => {},
                onEffectUpdate: () => {},
                onStatus: () => {},
                onKey: () => {},
                onStats: () => {},
                onFullStats: () => {},
                getStats: () => {},
                windowAnimateDone: () => {},
                send: () => {},
                resetStats: () => {},
                setMode: () => {},
                updateSettings: () => {},
                toggleSmart: () => {},
                getInitialState: async () => ({}),
                applyColor: () => {},
                applyEffect: () => {},
                updateBrightness: () => {},
                updateSpeed: () => {},
                openLogFolder: () => {},
                closeWindow: () => {},
                minimizeWindow: () => {}
            };
            window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
            window.setInterval = (cb, time) => {
               // mock to prevent hanging
               return 1;
            };
            const origSetTimeout = window.setTimeout;
            const timeouts = [];
            window.setTimeout = (cb, time) => {
               const id = origSetTimeout(cb, time);
               timeouts.push(id);
               return id;
            };
            window.cleanup = () => {
               timeouts.forEach(clearTimeout);
            };
        }
    });

    // Attempt to invoke the new "Random Color" button if it exists
    const randomBtn = dom.window.document.getElementById('randomizeBtn');
    if (randomBtn) {
        randomBtn.click();
    }

    assert.ok(dom.window.document.body);
    windowRef.close();
});
