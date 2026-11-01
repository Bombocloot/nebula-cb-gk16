const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { JSDOM } = require('jsdom');
const fs = require('fs');

test('frontend basic structure', async (t) => {
    const htmlPath = path.join(__dirname, '..', 'src', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    const dom = new JSDOM(html);
    const document = dom.window.document;

    await t.test('has expected main elements', () => {
        assert.ok(document.querySelector('.top-nav'), 'top nav exists');
        assert.ok(document.querySelector('#page-lighting'), 'lighting view exists');
        assert.ok(document.querySelector('#page-perkey'), 'perkey view exists');
        assert.ok(document.querySelector('#page-stats'), 'stats view exists');
    });
});
