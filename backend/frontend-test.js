const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

test('frontend code execution', async (t) => {
    const htmlPath = path.join(__dirname, '../src/index.html');

    let dom;

    await t.test('loads correctly', async () => {
        dom = await JSDOM.fromFile(htmlPath, {
            runScripts: 'dangerously',
            beforeParse(window) {
                // stub out requestAnimationFrame and setInterval for jsdom
                window.requestAnimationFrame = (cb) => { };
                window.setInterval = (cb, time) => { };
                window.api = {
                    onStatus: () => {},
                    onKey: () => {},
                    onStats: () => {},
                    onFullStats: () => {},
                    onWindowRestore: () => {},
                    setMode: async () => {},
                    toggleSmart: async () => {},
                    updateSettings: async () => {},
                    getStats: async () => {},
                    resetStats: async () => {},
                    windowControl: async () => {},
                    windowAnimateDone: async () => {},
                    sendCommand: async () => {}
                };
            }
        });

        assert.ok(dom.window.document.body);
    });
});
