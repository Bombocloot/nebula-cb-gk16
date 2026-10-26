const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

test('frontend logic tests', async (t) => {
    const html = fs.readFileSync('src/index.html', 'utf8');

    // Extract script content
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'Should find script tag in index.html');
    const scriptContent = scriptMatch[1];

    // Check for innerHTML to prevent XSS
    assert.strictEqual(scriptContent.includes('innerHTML'), false, 'innerHTML should not be used in frontend logic');

    // Create a mock DOM
    const mockElements = {};
    const listeners = {};

    const mockDocument = {
        createElement: (tag) => {
            return {
                tagName: tag,
                className: '',
                dataset: {},
                style: {},
                classList: {
                    add: () => {},
                    remove: () => {}
                },
                appendChild: () => {},
                textContent: ''
            };
        },
        getElementById: (id) => {
            if (!mockElements[id]) {
                mockElements[id] = {
                    id,
                    className: '',
                    dataset: {},
                    style: {},
                    classList: {
                        add: () => {},
                        remove: () => {}
                    },
                    appendChild: () => {},
                    querySelectorAll: () => [],
                    textContent: '',
                    value: ''
                };
            }
            return mockElements[id];
        },
        querySelectorAll: (selector) => {
            return [];
        }
    };

    const mockWindow = {
        addEventListener: (event, cb) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(cb);
        },
        removeEventListener: () => {},
        api: {
            send: () => {},
            onStatus: () => {},
            onKey: () => {},
            onStats: () => {},
            onFullStats: () => {},
            getStats: () => {},
            resetStats: () => {},
            setMode: () => {},
            updateSettings: () => {},
            toggleSmart: () => {},
            onWindowRestore: () => {}
        }
    };

    const context = {
        document: mockDocument,
        window: mockWindow,
        setInterval: () => {},
        setTimeout: () => {},
        console: console,
        Date: Date
    };

    vm.createContext(context);

    await t.test('script executes without errors', () => {
        assert.doesNotThrow(() => {
            vm.runInContext(scriptContent, context);
        });
    });

    await t.test('DOMContentLoaded triggers initialization', () => {
        if (listeners['DOMContentLoaded']) {
            assert.doesNotThrow(() => {
                listeners['DOMContentLoaded'].forEach(cb => cb());
            });
        }
    });
});
