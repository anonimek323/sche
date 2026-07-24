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
  assert.ok(html.includes('<script src="./highs-wasm.js"></script>'), 'the embedded solver loads on every protocol, so file:// and GitHub Pages both work');
  assert.ok(!html.includes('node_modules'), 'the page loads no runtime file from node_modules, so a bare clone runs');

  // vendor/ is what the page actually loads; keep it identical to the installed packages.
  [
    ['javascript-lp-solver', 'src/solver.js', 'solver.js'],
    ['highs', 'build/highs.js', 'highs.js'],
    ['xlsx', 'dist/xlsx.full.min.js', 'xlsx.full.min.js']
  ].forEach(([pkg, source, target]) => {
    const installed = fs.readFileSync(path.join(fs.realpathSync(path.join(root, 'node_modules', pkg)), source));
    const vendored = fs.readFileSync(path.join(root, 'vendor', target));
    assert.ok(installed.equals(vendored), 'vendor/' + target + ' matches the installed ' + pkg + '; run pnpm run vendor');
    assert.ok(html.includes('./vendor/' + target), 'index.html loads vendor/' + target);
  });
  const highs = await require('highs')({ wasmBinary: new Uint8Array(bytes), locateFile: () => '/intentionally-missing/highs.wasm' });
  assert.equal(typeof highs.solve, 'function', 'solver starts from embedded bytes without fetching a file');
  console.log('Safari local-file WebAssembly bundle test passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
