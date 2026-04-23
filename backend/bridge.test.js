const test = require('node:test');
const assert = require('node:assert');
const bridge = require('./bridge.js');

test('topKeys functionality', async (t) => {
    await t.test('returns empty array when stats are empty', () => {
        // Clear stats
        Object.keys(bridge.stats.keys).forEach(k => delete bridge.stats.keys[k]);

        const result = bridge.topKeys(5);
        assert.deepStrictEqual(result, []);
    });

    await t.test('returns top keys in descending order of count', () => {
        // Setup stats
        Object.keys(bridge.stats.keys).forEach(k => delete bridge.stats.keys[k]);
        bridge.stats.keys[65] = 10; // 'A'
        bridge.stats.keys[66] = 5;  // 'B'
        bridge.stats.keys[67] = 15; // 'C'

        const result = bridge.topKeys(2);

        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(result[0], { name: 'C', count: 15 });
        assert.deepStrictEqual(result[1], { name: 'A', count: 10 });
    });

    await t.test('handles fewer keys than requested n', () => {
        // Setup stats
        Object.keys(bridge.stats.keys).forEach(k => delete bridge.stats.keys[k]);
        bridge.stats.keys[65] = 10;

        const result = bridge.topKeys(5);

        assert.strictEqual(result.length, 1);
        assert.deepStrictEqual(result[0], { name: 'A', count: 10 });
    });

    await t.test('uses K fallback for unknown key codes', () => {
        // Setup stats
        Object.keys(bridge.stats.keys).forEach(k => delete bridge.stats.keys[k]);
        bridge.stats.keys[999] = 1;

        const result = bridge.topKeys(1);

        assert.deepStrictEqual(result[0], { name: 'K999', count: 1 });
    });

    await t.test('correctly maps various keys from KEY_NAMES', () => {
        Object.keys(bridge.stats.keys).forEach(k => delete bridge.stats.keys[k]);
        bridge.stats.keys[27] = 1; // Esc
        bridge.stats.keys[32] = 1; // Space
        bridge.stats.keys[13] = 1; // Enter

        const result = bridge.topKeys(10);
        const names = result.map(r => r.name).sort();

        assert.ok(names.includes('Esc'));
        assert.ok(names.includes('Space'));
        assert.ok(names.includes('Enter'));
    });
});
