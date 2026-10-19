import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Repository } from '../build/repository.js';
import { extractDocumentText, extractZipEntries } from '../build/parsers.js';

const wait = ms => new Promise(r => setTimeout(r, ms));
async function availablePort() {
  const s = createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const port = s.address().port;
  await new Promise(r => s.close(r));
  return port;
}

test('Repository: findOrCreateFolderHierarchy creates and reuses nested folders', async () => {
  const repo = new Repository();
  await repo.init();
  const user = await repo.findUserByUsername('azeemniazi');
  assert.ok(user, 'Default user must exist');

  // 1. Create a 3-level folder hierarchy: Engineering -> 2026 -> Network Specs
  const leafFolderId = await repo.findOrCreateFolderHierarchy(
    user.id,
    ['Engineering', '2026', 'Network Specs'],
    null,
    true
  );
  assert.ok(leafFolderId, 'Must return a valid leaf folder ID');

  const leafFolder = await repo.getFolderById(leafFolderId);
  assert.equal(leafFolder?.name, 'Network Specs');
  assert.equal(leafFolder?.isShared, true);

  // Parent must be '2026'
  const parentFolder = await repo.getFolderById(leafFolder.parentId);
  assert.equal(parentFolder?.name, '2026');

  // Root must be 'Engineering'
  const rootFolder = await repo.getFolderById(parentFolder.parentId);
  assert.equal(rootFolder?.name, 'Engineering');
  assert.equal(rootFolder?.parentId, null);

  // 2. Calling findOrCreateFolderHierarchy with the exact same path must reuse the folders without creating duplicates
  const secondCallId = await repo.findOrCreateFolderHierarchy(
    user.id,
    ['Engineering', '2026', 'Network Specs'],
    null,
    true
  );
  assert.equal(secondCallId, leafFolderId, 'Must return identical folder ID without duplicating');

  // Calling case-insensitively should also match existing folder
  const caseInsensitiveId = await repo.findOrCreateFolderHierarchy(
    user.id,
    ['engineering', '2026', 'network specs'],
    null,
    true
  );
  assert.equal(caseInsensitiveId, leafFolderId, 'Must match case-insensitively');

  // 3. Adding a sibling subfolder: Engineering -> 2026 -> Radio Access
  const siblingLeafId = await repo.findOrCreateFolderHierarchy(
    user.id,
    ['Engineering', '2026', 'Radio Access'],
    null,
    true
  );
  assert.notEqual(siblingLeafId, leafFolderId);
  const siblingFolder = await repo.getFolderById(siblingLeafId);
  assert.equal(siblingFolder?.name, 'Radio Access');
  assert.equal(siblingFolder?.parentId, parentFolder.id, 'Sibling must share the same parent "2026"');

  // Total folders under user should be 4 (Engineering, 2026, Network Specs, Radio Access)
  const allFolders = await repo.listFolders(user.id);
  assert.equal(allFolders.length, 4);
});

test('Document Parsers: extracts text reliably across 13 diverse files without crashing', () => {
  const testFiles = [
    { name: 'doc1.txt', buf: Buffer.from('Plain text report on 5G RAN performance.') },
    { name: 'doc2.md', buf: Buffer.from('# Markdown Header\n\nFeature specification and roadmap notes.') },
    { name: 'doc3.csv', buf: Buffer.from('Host,IP,Status\nRouter1,10.0.0.1,Active\nSwitch2,10.0.0.2,Standby') },
    { name: 'doc4.json', buf: Buffer.from(JSON.stringify({ cluster: 'edge-01', nodes: 8, status: 'healthy' })) },
    { name: 'doc5.log', buf: Buffer.from('[2026-10-19 12:00:00] System initialization completed successfully.') },
    { name: 'doc6.sql', buf: Buffer.from('SELECT * FROM knowledge_documents WHERE is_shared = true;') },
    { name: 'doc7.xml', buf: Buffer.from('<root><policy name="Fiber SLA">Maximum latency 5ms</policy></root>') },
    { name: 'doc8.yaml', buf: Buffer.from('apiVersion: v1\nkind: Service\nmetadata:\n  name: core-api\n') },
    { name: 'doc9.ini', buf: Buffer.from('[database]\nhost=127.0.0.1\nport=5432\n') },
    { name: 'doc10.pdf', buf: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length 20 >>\nstream\n(Hello PDF World)\nendstream\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n99\n%%EOF') },
    { name: 'doc11.bin', buf: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]) }, // binary with no text
    { name: 'doc12.badzip', buf: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]) }, // truncated zip header
    { name: 'doc13.corrupt', buf: Buffer.from('Corrupted payload with unexpected bytes \x00\xFF\xFE') }
  ];

  assert.equal(testFiles.length, 13, 'Must test exactly 13 documents');

  for (const file of testFiles) {
    let extracted = '';
    assert.doesNotThrow(() => {
      extracted = extractDocumentText(file.name, file.buf);
    }, `Parser should never throw on ${file.name}`);
    assert.ok(typeof extracted === 'string', 'Extraction must return a string');
  }
});

test('HTTP API: batch uploads 13 documents simultaneously with nested folder paths', { timeout: 45000 }, async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'cloudcore-upload-test-'));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, [fileURLToPath(new URL('../build/server.js', import.meta.url))], {
    cwd: tempDir,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: '',
      REDIS_URL: '',
      AUTH_MODE: 'local',
      PUBLIC_BASE_URL: base,
      IMAGE_ENGINE_URL: '',
      AI_BASE_URL: '',
      INITIAL_DEV_PASSWORD: 'batch-test-password',
      LOG_LEVEL: 'error'
    }
  });

  try {
    // Wait for server ready
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${base}/healthz`);
        if (res.ok) { ready = true; break; }
      } catch {}
      await wait(250);
    }
    assert.ok(ready, 'Server must start and respond on healthz');

    // 1. Log in
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'CloudCoreAI' },
      body: JSON.stringify({ username: 'azeemniazi', password: 'batch-test-password' })
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    // 2. Prepare 13 files with diverse folder paths
    const batchData = [
      { path: 'CompanyDocs/Policies/AcceptableUse.txt', content: 'PTCL Acceptable Use Policy 2026.' },
      { path: 'CompanyDocs/Policies/SecurityGuide.md', content: '# Security Guidelines\nAlways use MFA.' },
      { path: 'CompanyDocs/Financials/Q1_Budget.csv', content: 'Department,Budget,Spend\nEngineering,500000,420000' },
      { path: 'CompanyDocs/Financials/Q2_Budget.csv', content: 'Department,Budget,Spend\nEngineering,600000,510000' },
      { path: 'CompanyDocs/Financials/Projections.json', content: '{"q3": 750000, "q4": 820000}' },
      { path: 'Engineering/RAN/5G_Architecture.txt', content: 'OpenRAN multi-vendor split 7.2x specifications.' },
      { path: 'Engineering/RAN/Microwave_Links.md', content: 'High throughput microwave wireless transmission.' },
      { path: 'Engineering/Fiber/GPON_Rollout.txt', content: 'Gigabit passive optical network distribution nodes.' },
      { path: 'Engineering/Fiber/Core_Backbone.txt', content: 'DWDM optical backbone cross-connect configurations.' },
      { path: 'Engineering/Operations/IncidentLog_Oct.log', content: '2026-10-19 No major outages reported across all regions.' },
      { path: 'RootNotes.txt', content: 'General notes stored in the root folder.' },
      { path: 'Standalone_Checklist.md', content: '- Task 1: Check fiber splice\n- Task 2: Verify BGP peering' },
      { path: 'Database_Schema.sql', content: 'CREATE TABLE fiber_nodes (id UUID PRIMARY KEY, name TEXT);' }
    ];

    assert.equal(batchData.length, 13, 'Batch must contain exactly 13 files');

    const fd = new FormData();
    for (const item of batchData) {
      const parts = item.path.split('/');
      const fileName = parts[parts.length - 1];
      const blob = new Blob([item.content], { type: 'text/plain' });
      fd.append('files', blob, fileName);
      fd.append('paths', item.path);
    }
    fd.append('isShared', 'true');

    // 3. Upload 13 files in one batch request
    const uploadRes = await fetch(`${base}/api/knowledge/upload`, {
      method: 'POST',
      headers: {
        'x-requested-with': 'CloudCoreAI',
        cookie
      },
      body: fd
    });

    assert.equal(uploadRes.status, 201, 'Batch upload of 13 files must return 201 Created');
    const uploadJson = await uploadRes.json();

    assert.equal(uploadJson.total, 13);
    assert.equal(uploadJson.successCount, 13);
    assert.equal(uploadJson.failedCount, 0);
    assert.equal(uploadJson.uploaded.length, 13);

    // 4. Verify folders were created automatically in Knowledge Hub
    const foldersRes = await fetch(`${base}/api/knowledge/folders`, {
      headers: { 'x-requested-with': 'CloudCoreAI', cookie }
    });
    assert.equal(foldersRes.status, 200);
    const foldersJson = await foldersRes.json();
    const folderNames = foldersJson.folders.map(f => f.name);

    assert.ok(folderNames.includes('CompanyDocs'), 'Must create CompanyDocs folder');
    assert.ok(folderNames.includes('Policies'), 'Must create Policies subfolder');
    assert.ok(folderNames.includes('Financials'), 'Must create Financials subfolder');
    assert.ok(folderNames.includes('Engineering'), 'Must create Engineering folder');
    assert.ok(folderNames.includes('RAN'), 'Must create RAN subfolder');
    assert.ok(folderNames.includes('Fiber'), 'Must create Fiber subfolder');
    assert.ok(folderNames.includes('Operations'), 'Must create Operations subfolder');

    // 5. Verify documents are placed into their respective folders
    const docsRes = await fetch(`${base}/api/knowledge/documents`, {
      headers: { 'x-requested-with': 'CloudCoreAI', cookie }
    });
    assert.equal(docsRes.status, 200);
    const docsJson = await docsRes.json();
    assert.equal(docsJson.documents.length, 13);

    const ranDoc = docsJson.documents.find(d => d.filename === '5G_Architecture.txt');
    assert.ok(ranDoc, '5G_Architecture.txt must exist');
    assert.equal(ranDoc.folderName, 'RAN', 'Document must belong to RAN folder');

    const rootDoc = docsJson.documents.find(d => d.filename === 'RootNotes.txt');
    assert.ok(rootDoc, 'RootNotes.txt must exist');
    assert.equal(rootDoc.folderId, null, 'RootNotes.txt must have no folder (root)');

  } finally {
    child.kill('SIGTERM');
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

test('Frontend UI: includes folder selection and drag-and-drop recursive directory traversal', () => {
  const appJs = readFileSync(join(process.cwd(), 'dist/app.js'), 'utf8');

  assert.ok(appJs.includes('id="batch-folder-input"'), 'Must have batch-folder-input element');
  assert.ok(appJs.includes('webkitdirectory'), 'Must support webkitdirectory for full folder selection');
  assert.ok(appJs.includes('id="batch-choose-folder-btn"'), 'Must have Select Folder button');
  assert.ok(appJs.includes('readEntryRecursively'), 'Must have recursive directory entry reader');
  assert.ok(appJs.includes('uploadRelativePath'), 'Must preserve relative folder path on upload');
  assert.ok(appJs.includes("fd.append('paths'"), 'Must append relative paths to FormData');
});
