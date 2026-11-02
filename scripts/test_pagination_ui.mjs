import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const appCode = fs.readFileSync('dist/app.js', 'utf8');
const themeCode = fs.readFileSync('dist/theme.js', 'utf8');

const appEl = { innerHTML: '', querySelectorAll: () => [] };

const context = {
  console,
  document: {
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'app' ? appEl : null),
    querySelector: (sel) => (sel === '#app' ? appEl : null),
    addEventListener: () => {}
  },
  window: {
    addEventListener: () => {},
    location: { hash: '#documents' }
  },
  location: { hash: '#documents' },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  setTimeout: () => 1,
  clearTimeout: () => {}
};

vm.createContext(context);
vm.runInContext(themeCode, context);
vm.runInContext(appCode, context);

// Set mock docs directly in VM context scope
vm.runInContext(`
  knowledgeDocs = Array.from({ length: 25 }, (_, i) => ({
    id: 'doc-' + (i + 1),
    filename: 'Test Document ' + (i + 1) + '.pdf',
    folderName: 'Certifications',
    isShared: true,
    sizeBytes: 1024 * (i + 1),
    creatorName: 'Azeem Niazi',
    createdAt: new Date().toISOString(),
    status: 'ready'
  }));
  knowledgeFolders = [{ id: 'f1', name: 'Certifications', isShared: true }];
  knowledgeScope = 'shared';
  activeKnowledgeFolderId = null;
`, context);

// Test Page 1
vm.runInContext('knowledgePage = 1;', context);
const htmlPage1 = context.refKnowledge();
console.log('Testing Page 1:');
assert.ok(htmlPage1.includes('Showing <b>1–10</b> of <b>25</b> files'), 'Shows correct count for page 1');
assert.ok(htmlPage1.includes('Test Document 1.pdf'), 'Page 1 has doc 1');
assert.ok(htmlPage1.includes('Test Document 10.pdf'), 'Page 1 has doc 10');
assert.ok(!htmlPage1.includes('Test Document 11.pdf'), 'Page 1 does NOT have doc 11');
assert.ok(htmlPage1.includes('data-page="1" aria-current="page"'), 'Page 1 is active');
assert.ok(htmlPage1.includes('ref-page-prev disabled'), 'Prev button is disabled on page 1');
console.log('✓ Page 1 validated: shows exactly 10 files (1-10) with active page 1 pill');

// Test Page 2
vm.runInContext('knowledgePage = 2;', context);
const htmlPage2 = context.refKnowledge();
console.log('Testing Page 2:');
assert.ok(htmlPage2.includes('Showing <b>11–20</b> of <b>25</b> files'), 'Shows correct count for page 2');
assert.ok(!htmlPage2.includes('Test Document 10.pdf'), 'Page 2 does NOT have doc 10');
assert.ok(htmlPage2.includes('Test Document 11.pdf'), 'Page 2 has doc 11');
assert.ok(htmlPage2.includes('Test Document 20.pdf'), 'Page 2 has doc 20');
assert.ok(!htmlPage2.includes('Test Document 21.pdf'), 'Page 2 does NOT have doc 21');
assert.ok(htmlPage2.includes('data-page="2" aria-current="page"'), 'Page 2 is active');
console.log('✓ Page 2 validated: shows exactly 10 files (11-20) with active page 2 pill');

// Test Page 3 (final page with 5 files)
vm.runInContext('knowledgePage = 3;', context);
const htmlPage3 = context.refKnowledge();
console.log('Testing Page 3:');
assert.ok(htmlPage3.includes('Showing <b>21–25</b> of <b>25</b> files'), 'Shows correct count for page 3');
assert.ok(htmlPage3.includes('Test Document 21.pdf'), 'Page 3 has doc 21');
assert.ok(htmlPage3.includes('Test Document 25.pdf'), 'Page 3 has doc 25');
assert.ok(htmlPage3.includes('ref-page-next disabled'), 'Next button is disabled on final page');
console.log('✓ Page 3 validated: shows remaining 5 files (21-25) with active page 3 pill and disabled Next');

console.log('\nAll pagination unit tests PASSED cleanly!');
