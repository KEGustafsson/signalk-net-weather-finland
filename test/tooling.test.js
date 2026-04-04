const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const pkg = require('../package.json');

test('build outputs expected artifacts', () => {
  assert.equal(fs.existsSync('dist/index.js'), true);
  assert.equal(fs.existsSync('dist/index.d.ts'), true);
  assert.equal(fs.existsSync('dist/src/index.js'), false);
  assert.equal(fs.existsSync('dist/src/index.d.ts'), false);
});

test('package entrypoints reference built artifacts', () => {
  assert.equal(pkg.main, 'dist/index.js');
  assert.equal(pkg.types, 'dist/index.d.ts');
});
