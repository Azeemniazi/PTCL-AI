const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../dist');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), ([, src]) => src.split('?')[0]);
assert.equal(scripts.length, 1, 'Production loads a single CloudCore script');
assert.match(scripts[0], /^react\/cloudcore-[\w-]+\.js$/, 'Production script filename includes a content hash');
execFileSync(process.execPath, ['--check', path.join(root, scripts[0])]);

for (const asset of [...scripts, 'style.css', 'meetings.css', 'assets/hero.png', 'assets/favicon.svg',
  'assets/cloudcore-mark.png', 'assets/reference-home.png', 'assets/diagram.svg', 'assets/industry-ai.png']) {
  assert.ok(fs.statSync(path.join(root, asset)).isFile(), asset);
}
console.log('Passed: production HTML entry point and local assets.');
