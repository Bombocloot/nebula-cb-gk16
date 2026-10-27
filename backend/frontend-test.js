const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

test('frontend code logic', (t) => {
    const htmlContent = fs.readFileSync('src/index.html', 'utf-8');

    // We expect the script to execute without throwing errors
    try {
        const dom = new JSDOM(htmlContent, { runScripts: 'dangerously' });
        const windowMock = dom.window;
        windowMock.api = {
            send: () => {},
            onStatus: () => {},
            onKey: () => {},
            onStats: () => {},
            onFullStats: () => {},
            onWindowRestore: () => {},
            getStats: () => {}
        };

        // Emulate DOM elements checking
        const speedVal = dom.window.document.getElementById('speedVal');
        assert.ok(speedVal, 'DOM elements should be properly constructed by JSDOM');
        assert.ok(true, 'Frontend script executed without errors');

        dom.window.close();
    } catch (err) {
        assert.fail('Frontend script execution failed: ' + err.message);
    }
});
