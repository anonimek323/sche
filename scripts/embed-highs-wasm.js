const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const wasmPath = path.join(path.dirname(require.resolve('highs')), 'highs.wasm');
const outputPath = path.join(root, 'highs-wasm.js');
const base64 = fs.readFileSync(wasmPath).toString('base64');
const chunks = base64.match(/.{1,120}/g) || [];
const source = "window.HIGHS_WASM_BASE64=[\n" + chunks.map(chunk => JSON.stringify(chunk)).join(',\n') + "\n].join('');\n";
fs.writeFileSync(outputPath, source);
console.log('Wrote ' + path.relative(root, outputPath) + ' (' + base64.length + ' base64 characters)');
