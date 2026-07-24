const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

(async () => {
  const root = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'highs-wasm.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const bytes = Buffer.from(context.window.HIGHS_WASM_BASE64, 'base64');
  const original = fs.readFileSync(path.join(path.dirname(require.resolve('highs')), 'highs.wasm'));
  assert.deepEqual([...bytes.subarray(0, 4)], [0, 97, 115, 109], 'embedded solver starts with the WebAssembly magic bytes');
  assert.ok(bytes.equals(original), 'embedded solver exactly matches the installed WebAssembly binary');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const loader = html.match(/<script>(if\(location\.protocol==='file:'\)[\s\S]*?)<\/script>/)[1];
  let written = '';
  vm.runInNewContext(loader, { location: { protocol: 'file:' }, document: { write: value => { written += value; } } });
  assert.equal(written, '<script src="./highs-wasm.js"></script>', 'local-file loader emits a valid script element');
  const highs = await require('highs')({ wasmBinary: new Uint8Array(bytes), locateFile: () => '/intentionally-missing/highs.wasm' });
  assert.equal(typeof highs.solve, 'function', 'solver starts from embedded bytes without fetching a file');
  console.log('Safari local-file WebAssembly bundle test passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
