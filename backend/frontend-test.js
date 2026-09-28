const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

test('DOM manipulation security', async (t) => {
    const html = fs.readFileSync('src/index.html', 'utf8');

    // Search for innerHTML usage without context or escaping
    const innerHTMLMatch = html.match(/\.innerHTML\s*=/g);

    // We expect 0 innerHTML matches after refactoring
    assert.ok(innerHTMLMatch === null, 'Should not find innerHTML usages');
});
