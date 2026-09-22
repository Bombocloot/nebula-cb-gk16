const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('security and performance guidelines in backend', async (t) => {
    const bridgeCode = fs.readFileSync(path.join(__dirname, 'bridge.js'), 'utf8');
    const keyboardCode = fs.readFileSync(path.join(__dirname, 'keyboard.js'), 'utf8');

    await t.test('No synchronous I/O or process execution in bridge.js', () => {
        assert.ok(!bridgeCode.includes('readFileSync'), 'bridge.js uses readFileSync');
        assert.ok(!bridgeCode.includes('writeFileSync'), 'bridge.js uses writeFileSync');
        assert.ok(!bridgeCode.includes('execSync'), 'bridge.js uses execSync');
        assert.ok(!bridgeCode.includes('spawnSync'), 'bridge.js uses spawnSync');
    });

    await t.test('No synchronous I/O or process execution in keyboard.js', () => {
        assert.ok(!keyboardCode.includes('readFileSync'), 'keyboard.js uses readFileSync');
        assert.ok(!keyboardCode.includes('writeFileSync'), 'keyboard.js uses writeFileSync');
        assert.ok(!keyboardCode.includes('execSync'), 'keyboard.js uses execSync');
        assert.ok(!keyboardCode.includes('spawnSync'), 'keyboard.js uses spawnSync');
    });

    await t.test('Uses absolute paths for system binaries in bridge.js', () => {
        assert.ok(!bridgeCode.includes("spawn('powershell.exe'"), 'bridge.js uses relative powershell');
        assert.ok(!bridgeCode.includes("spawn(\"powershell.exe\""), 'bridge.js uses relative powershell');
    });

    await t.test('Uses absolute paths for system binaries in keyboard.js', () => {
        assert.ok(!keyboardCode.includes("spawn('powershell.exe'"), 'keyboard.js uses relative powershell');
        assert.ok(!keyboardCode.includes("spawn(\"powershell.exe\""), 'keyboard.js uses relative powershell');
    });
});
