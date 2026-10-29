const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('frontend scripts execute without error', async () => {
    const htmlPath = path.join(__dirname, '../src/index.html');

    const dom = await JSDOM.fromFile(htmlPath, {
        runScripts: 'dangerously',
        resources: 'usable',
        beforeParse(window) {
            window.api = {
                onStatus: () => {},
                onKey: () => {},
                onStats: () => {},
                onFullStats: () => {},
                getStats: () => {},
                windowAnimateDone: () => {},
                onWindowRestore: () => {}
            };
        }
    });

    // Wait until the DOM is loaded
    await new Promise(resolve => {
        if (dom.window.document.readyState === 'complete') {
            resolve();
        } else {
            dom.window.addEventListener('load', resolve);
        }
    });

    assert.ok(dom.window);

    const modeGrid = dom.window.document.getElementById('modeGrid');
    assert.ok(modeGrid.children.length > 0, 'modeGrid should be populated');

    dom.window.close();
});
