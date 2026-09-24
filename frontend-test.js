const fs = require('fs');
const path = require('path');
const assert = require('assert');

// A very basic ad-hoc DOM mock for verifying element creation logic
class MockElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.classes = new Set();
        this.attributes = {};
        this.style = {};
        this._textContent = '';
        this.onclick = null;

        // Ensure innerHTML throws if used, as per verification requirements
        Object.defineProperty(this, 'innerHTML', {
            set: function(val) {
                throw new Error('innerHTML usage is strictly prohibited!');
            },
            get: function() { return ''; }
        });
    }

    get textContent() {
        return this._textContent;
    }

    set textContent(val) {
        this._textContent = val;
        if (val === '') {
            this.children = [];
        }
    }

    get classList() {
        return {
            add: (cls) => this.classes.add(cls),
            remove: (cls) => this.classes.delete(cls),
            contains: (cls) => this.classes.has(cls)
        };
    }

    setAttribute(key, val) {
        this.attributes[key] = val;
    }

    appendChild(child) {
        this.children.push(child);
    }

    querySelectorAll(selector) {
        let results = [];
        if (selector.startsWith('.')) {
            const className = selector.substring(1);
            if (this.classes.has(className)) results.push(this);
            for (const child of this.children) {
                results = results.concat(child.querySelectorAll(selector));
            }
        }
        return results;
    }
}

const mockDocument = {
    elements: {},
    getElementById: function(id) {
        if (!this.elements[id]) {
            this.elements[id] = new MockElement('div');
            this.elements[id].setAttribute('id', id);
        }
        return this.elements[id];
    },
    createElement: function(tagName) {
        return new MockElement(tagName);
    },
    querySelectorAll: function(selector) {
        let results = [];
        for (const key in this.elements) {
            results = results.concat(this.elements[key].querySelectorAll(selector));
        }
        return results;
    }
};

global.document = mockDocument;

// Read the index.html file
const htmlContent = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');

// Extract JS using a simple regex since it's between <script> tags
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
    throw new Error('Could not find <script> tags in index.html');
}

const scriptContent = scriptMatch[1];

// We don't want to run the whole script as it tries to access window, setInterval, etc.
// Let's create a controlled environment to run the specific functions we care about.

// Extract the required constants and functions
const constantsToExtract = ['COLORS', 'MODES', 'LAYOUT', 'VK'];
const functionsToExtract = ['buildKb', 'colors', 'initLight', 'initPerkey'];

let codeToEvaluate = `
    let selMode = 9, selColor = 4, actColor = 4, idleColor = 7, dir = 0;
    let paintColor = '#ffffff';
    let perkey = {};
`;

// We'll just define the constants manually for testing to avoid fragile parsing of JS arrays/objects in string mode.
codeToEvaluate += `
        var COLORS = [
            { n: 'Red', h: '#FF0000' },
            { n: 'Green', h: '#00FF00' },
            { n: 'Yellow', h: '#FFFF00' },
            { n: 'Blue', h: '#0000FF' },
            { n: 'Cyan', h: '#00FFFF' },
            { n: 'Magenta', h: '#FF00FF' },
            { n: 'White', h: '#FFFFFF' },
            { n: 'Off', h: '#000000' }
        ];

        var MODES = [
            { id: 1, n: 'Breathe', i: 'blur_on' },
            { id: 2, n: 'Fade', i: 'gradient' },
            { id: 3, n: 'Reactive', i: 'touch_app' },
            { id: 4, n: 'Star', i: 'star' },
            { id: 5, n: 'Laser', i: 'bolt' },
            { id: 6, n: 'Wave', i: 'waves' },
            { id: 7, n: 'Neon', i: 'fluorescent' },
            { id: 8, n: 'Rain', i: 'water_drop' },
            { id: 9, n: 'Ripple', i: 'ripples' },
            { id: 10, n: 'Wave2', i: 'tsunami' },
            { id: 11, n: 'Swirl', i: 'cyclone' },
            { id: 0, n: 'Static', i: 'lightbulb' }
        ];

        var LAYOUT = [
            [{ k: 'ESC' }, { s: .5 }, { k: 'F1' }, { k: 'F2' }, { k: 'F3' }, { k: 'F4' }, { s: .5 }, { k: 'F5' }, { k: 'F6' }, { k: 'F7' }, { k: 'F8' }, { s: .5 }, { k: 'F9' }, { k: 'F10' }, { k: 'F11' }, { k: 'F12' }, { s: .25 }, { k: 'PRTSC', l: 'Prt' }, { k: 'SCRLK', l: 'Scr' }, { k: 'PAUSE', l: 'Pau' }],
            [{ k: 'GRAVE', l: '\`' }, { k: '1' }, { k: '2' }, { k: '3' }, { k: '4' }, { k: '5' }, { k: '6' }, { k: '7' }, { k: '8' }, { k: '9' }, { k: '0' }, { k: 'MINUS', l: '-' }, { k: 'EQUAL', l: '=' }, { k: 'BACKSPACE', l: '←', w: 2 }, { s: .25 }, { k: 'INSERT', l: 'Ins' }, { k: 'HOME', l: 'Hom' }, { k: 'PGUP', l: 'PgU' }],
            [{ k: 'TAB', w: 1.5 }, { k: 'Q' }, { k: 'W' }, { k: 'E' }, { k: 'R' }, { k: 'T' }, { k: 'Y' }, { k: 'U' }, { k: 'I' }, { k: 'O' }, { k: 'P' }, { k: 'LBRACKET', l: '[' }, { k: 'RBRACKET', l: ']' }, { k: 'BACKSLASH', l: '\\\\', w: 1.5 }, { s: .25 }, { k: 'DELETE', l: 'Del' }, { k: 'END' }, { k: 'PGDN', l: 'PgD' }],
            [{ k: 'CAPSLOCK', l: 'Caps', w: 1.75 }, { k: 'A' }, { k: 'S' }, { k: 'D' }, { k: 'F' }, { k: 'G' }, { k: 'H' }, { k: 'J' }, { k: 'K' }, { k: 'L' }, { k: 'SEMICOLON', l: ';' }, { k: 'QUOTE', l: "'" }, { k: 'ENTER', w: 2.25 }],
            [{ k: 'LSHIFT', l: 'Shift', w: 2.25 }, { k: 'Z' }, { k: 'X' }, { k: 'C' }, { k: 'V' }, { k: 'B' }, { k: 'N' }, { k: 'M' }, { k: 'COMMA', l: ',' }, { k: 'PERIOD', l: '.' }, { k: 'SLASH', l: '/' }, { k: 'RSHIFT', l: 'Shift', w: 2.75 }, { s: 1.25 }, { k: 'UP', l: '↑' }],
            [{ k: 'LCTRL', l: 'Ctrl', w: 1.25 }, { k: 'LWIN', l: 'Win', w: 1.25 }, { k: 'LALT', l: 'Alt', w: 1.25 }, { k: 'SPACE', l: '', w: 6.25 }, { k: 'RALT', l: 'Alt', w: 1.25 }, { k: 'FN', w: 1.25 }, { k: 'MENU', w: 1.25 }, { k: 'RCTRL', l: 'Ctrl', w: 1.25 }, { s: .25 }, { k: 'LEFT', l: '←' }, { k: 'DOWN', l: '↓' }, { k: 'RIGHT', l: '→' }]
        ];
`;

for (const funcName of functionsToExtract) {
    // Regex to match function definition: function funcName(...) { ... }
    // Handles nested blocks implicitly by simple index counting approach, but a simple regex might fail on complex nested brackets.
    // Instead, we can use a more robust regex or just split. Given the known structure, this regex works for these specific functions:
    const regex = new RegExp(`function\\s+${funcName}\\s*\\([\\s\\S]*?\\)\\s*\\{([\\s\\S]*?)(^\\s*\\}|^\\s*function|^\\s*document)`, 'm');
    const funcStartIdx = scriptContent.indexOf(`function ${funcName}(`);
    if (funcStartIdx === -1) throw new Error(`Function ${funcName} not found`);

    // Find the matching closing brace
    let openBraces = 0;
    let endIdx = -1;
    let foundStartBrace = false;
    for (let i = funcStartIdx; i < scriptContent.length; i++) {
        if (scriptContent[i] === '{') {
            openBraces++;
            foundStartBrace = true;
        } else if (scriptContent[i] === '}') {
            openBraces--;
        }

        if (foundStartBrace && openBraces === 0) {
            endIdx = i + 1;
            break;
        }
    }

    if (endIdx !== -1) {
        codeToEvaluate += scriptContent.substring(funcStartIdx, endIdx) + '\n';
    } else {
        throw new Error(`Could not correctly extract function ${funcName}`);
    }
}

// Add a mock for setStatus which is used in some functions
codeToEvaluate += `
    const setStatus = (m) => {};
`;

// Evaluate the extracted code
try {
    // We execute the code in the global scope so functions are accessible here
    const script = new (require('vm').Script)(codeToEvaluate);
    const context = require('vm').createContext({
        console: console,
        document: mockDocument,
        assert: assert,
    });
    script.runInContext(context);

    // Test buildKb
    context.buildKb('test-kb', () => {});
    const kbEl = mockDocument.getElementById('test-kb');
    assert.strictEqual(kbEl.children.length, context.LAYOUT.length, 'buildKb should create correct number of rows');

    // Check first row (ESC, F1, etc)
    const firstRow = kbEl.children[0];
    assert.ok(firstRow.classes.has('kb-row'), 'Row should have kb-row class');
    assert.strictEqual(firstRow.children.length, context.LAYOUT[0].length, 'First row should have correct number of keys');

    // Find ESC key
    const escKey = firstRow.children[0];
    assert.ok(escKey.classes.has('kb-key'), 'Key should have kb-key class');
    assert.strictEqual(escKey.attributes['data-key'], 'ESC', 'Key should have data-key attribute');
    assert.strictEqual(escKey.textContent, 'ESC', 'Key should have text content');

    // Test colors
    context.colors('test-colors', 1, () => {});
    const colorsEl = mockDocument.getElementById('test-colors');
    assert.strictEqual(colorsEl.children.length, context.COLORS.length, 'colors should create correct number of swatches');

    // Check second color (Green, index 1, should be selected)
    const greenSwatch = colorsEl.children[1];
    assert.ok(greenSwatch.classes.has('color-swatch'), 'Swatch should have color-swatch class');
    assert.ok(greenSwatch.classes.has('selected'), 'Selected swatch should have selected class');
    assert.strictEqual(greenSwatch.style.background, '#00FF00', 'Swatch should have correct background color');

    // Test initLight
    context.initLight();
    const modeGrid = mockDocument.getElementById('modeGrid');
    assert.strictEqual(modeGrid.children.length, context.MODES.length, 'initLight should create correct number of modes');

    // Check first mode (Breathe)
    const breatheMode = modeGrid.children[0];
    assert.ok(breatheMode.classes.has('mode-card'), 'Mode card should have mode-card class');
    assert.strictEqual(breatheMode.attributes['data-m'], 1, 'Mode card should have data-m attribute');
    assert.strictEqual(breatheMode.children.length, 2, 'Mode card should have icon and text spans');

    // Test initPerkey
    context.initPerkey();
    const quickColors = mockDocument.getElementById('quickColors');
    // Expected length is 9 colors from the qc array
    assert.strictEqual(quickColors.children.length, 9, 'initPerkey should create correct number of quick colors');

    const firstQuickColor = quickColors.children[0];
    assert.ok(firstQuickColor.classes.has('color-swatch'), 'Quick color should have color-swatch class');
    assert.strictEqual(firstQuickColor.attributes['data-hex'], '#FF0000', 'Quick color should have data-hex attribute');

    console.log('✅ Frontend tests passed! Safe DOM APIs are correctly creating the required elements without innerHTML.');
} catch (error) {
    console.error('❌ Frontend tests failed:', error.stack);
    process.exit(1);
}
