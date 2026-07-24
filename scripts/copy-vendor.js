// Copies the three libraries index.html loads at runtime into vendor/, so the app
// runs from a bare clone and from GitHub Pages without an install step.
// Refresh them after changing a dependency version: pnpm run vendor
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  ['javascript-lp-solver', 'src/solver.js', 'solver.js'],
  ['highs', 'build/highs.js', 'highs.js'],
  ['xlsx', 'dist/xlsx.full.min.js', 'xlsx.full.min.js']
];

const vendor = path.join(root, 'vendor');
fs.mkdirSync(vendor, { recursive: true });
files.forEach(([pkg, source, target]) => {
  const from = path.join(fs.realpathSync(path.join(root, 'node_modules', pkg)), source);
  const to = path.join(vendor, target);
  fs.copyFileSync(from, to);
  console.log('vendor/' + target + '  ' + (fs.statSync(to).size / 1024).toFixed(0) + ' kB');
});
