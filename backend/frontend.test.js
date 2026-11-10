const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { JSDOM } = require('jsdom');

test('frontend functionality', async (t) => {
    const htmlPath = path.resolve(__dirname, '../src/index.html');
    let window;

    await t.test('initializes JSDOM with mock api', async () => {
        const dom = await JSDOM.fromFile(htmlPath, {
            runScripts: 'dangerously',
            resources: 'usable',
            beforeParse(win) {
                // Mock time-dependent functions to prevent Node.js from hanging
                win.requestAnimationFrame = (cb) => win.setTimeout(cb, 0);
                win.setInterval = () => {}; // Stub out intervals
                win.cancelAnimationFrame = () => {};
                win.clearInterval = () => {};

                // Inject mock Electron API - define all standard methods
                const mockApi = {
                    send: () => {},
                    receive: () => {},
                    invoke: async () => {},
                    removeListener: () => {}
                };

                // Add common listeners dynamically using a Proxy or predefined list
                const listeners = [
                    'onWindowRestore', 'onStatus', 'onKeyStats', 'onKeyboardStatus',
                    'onKey', 'onMacroRecord', 'onMacroStop', 'onStats',
                    'onUpdateReady', 'onUpdateProgress', 'onUpdateError',
                    'onUpdateAvailable', 'onFullStats', 'onSmartModeChanged'
                ];

                listeners.forEach(l => { mockApi[l] = () => {}; });

                win.api = new Proxy(mockApi, {
                    get(target, prop, receiver) {
                        if (prop in target) {
                            return Reflect.get(target, prop, receiver);
                        }
                        // Default to empty function for any other property accessed
                        return () => {};
                    }
                });

                // Add structuredClone polyfill if missing
                if (!win.structuredClone) {
                   win.structuredClone = val => JSON.parse(JSON.stringify(val));
                }
            }
        });

        window = dom.window;

        // Wait for onload or DOMContentLoaded
        await new Promise((resolve) => {
            if (window.document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });

        assert(window.document.body);
    });

    await t.test('tab navigation works', async () => {
        const tabs = Array.from(window.document.querySelectorAll('.nav-tab'));
        if (tabs.length > 1) {
            // Click the second tab
            tabs[1].click();

            // Verify that the second tab is active and the first is not
            assert.strictEqual(tabs[1].classList.contains('active'), true);
            assert.strictEqual(tabs[0].classList.contains('active'), false);

            // Verify the correct page is displayed
            const targetPage = tabs[1].getAttribute('data-page');
            const pageEl = window.document.getElementById(`${targetPage}-page`);
            if (pageEl) {
                assert.strictEqual(pageEl.style.display !== 'none', true);
            }
        }
    });
});
