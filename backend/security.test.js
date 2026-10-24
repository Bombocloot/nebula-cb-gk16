const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('security checks in backend files', () => {
    const bridge = fs.readFileSync('backend/bridge.js', 'utf8');
    const keyboard = fs.readFileSync('backend/keyboard.js', 'utf8');

    // check for no innerHTML in frontend
    const indexHtml = fs.readFileSync('src/index.html', 'utf8');
    assert.strictEqual(indexHtml.includes('innerHTML ='), false, 'innerHTML used in src/index.html');

    // check for absolute paths and no execSync
    const files = [bridge, keyboard];
    for (const file of files) {
        assert.strictEqual(file.includes('execSync'), false, 'execSync found');
        assert.strictEqual(file.includes('readFileSync'), false, 'readFileSync found');
        assert.strictEqual(file.includes('writeFileSync'), false, 'writeFileSync found');

        assert.strictEqual(file.includes("'powershell.exe'"), false, 'bare powershell.exe found');
        assert.strictEqual(file.includes("'taskkill"), false, 'bare taskkill found');
    }
});
