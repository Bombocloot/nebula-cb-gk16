const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

test('Backend execution security', async (t) => {
    const bridgeJs = fs.readFileSync('backend/bridge.js', 'utf8');
    const keyboardJs = fs.readFileSync('backend/keyboard.js', 'utf8');

    // Check for execSync usage
    const bridgeExecSync = bridgeJs.match(/execSync/g);
    const keyboardExecSync = keyboardJs.match(/execSync/g);

    assert.ok(bridgeExecSync === null, 'Should not find execSync in bridge.js');
    assert.ok(keyboardExecSync === null, 'Should not find execSync in keyboard.js');
});
