const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

test('keyboard child processes use absolute paths (static analysis)', async (t) => {
    const keyboardSource = await fs.promises.readFile(path.join(__dirname, 'keyboard.js'), 'utf8');

    // Check for secure execution methods
    assert.ok(!keyboardSource.includes('execSync('), 'execSync should be removed');
    assert.ok(keyboardSource.includes('execFile('), 'execFile should be used');

    // Check for absolute paths
    assert.ok(keyboardSource.includes('process.env.SystemRoot'), 'SystemRoot should be used for paths');
    assert.ok(keyboardSource.includes('System32'), 'System32 should be in paths');
    assert.ok(keyboardSource.includes('powershellPath = path.join'), 'powershell path should be joined');
    assert.ok(keyboardSource.includes('taskkillPath = path.join'), 'taskkill path should be joined');

    // Check for asynchronous file system access
    assert.ok(!keyboardSource.includes('fs.readFileSync('), 'readFileSync should be removed');
    assert.ok(!keyboardSource.includes('fs.writeFileSync('), 'writeFileSync should be removed');
    assert.ok(keyboardSource.includes('fs.promises.readFile('), 'fs.promises.readFile should be used');
    assert.ok(keyboardSource.includes('fs.promises.writeFile('), 'fs.promises.writeFile should be used');

    // Check for EMPTY_LINE constant extraction
    assert.ok(keyboardSource.includes('EMPTY_LINE'), 'EMPTY_LINE constant should be used');
    assert.ok(keyboardSource.includes('Array(512).fill(0).join('), 'EMPTY_LINE should be correctly defined');
});
