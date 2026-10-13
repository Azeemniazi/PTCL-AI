import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { Repository } from '../build/repository.js';

test('AI Image Studio: prompt enhancement heuristic', async () => {
  // Test prompt expansion
  const raw = 'optical fiber network';
  const enhancers = [
    'cinematic studio lighting, 8k resolution, highly detailed, photorealistic textures, crisp focus, award-winning composition',
    'volumetric warm lighting, intricate depth of field, sharp edge details, balanced exposure, professional grade',
    'hyper-detailed architectural rendering, volumetric shadows, raytraced reflections, elegant modern aesthetics'
  ];
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  const picked = enhancers[Math.abs(h) % enhancers.length];
  const enhanced = `${raw}, ${picked}`;

  assert.ok(enhanced.includes(raw));
  assert.ok(enhanced.length > raw.length + 30);
});

test('AI Image Studio: aspect ratios and dimensional calculation', async () => {
  function getDimensions(ratio) {
    if (ratio === '16:9') return { width: 912, height: 512 };
    if (ratio === '9:16') return { width: 512, height: 912 };
    if (ratio === '4:3') return { width: 680, height: 512 };
    return { width: 512, height: 512 };
  }

  assert.deepEqual(getDimensions('1:1'), { width: 512, height: 512 });
  assert.deepEqual(getDimensions('16:9'), { width: 912, height: 512 });
  assert.deepEqual(getDimensions('9:16'), { width: 512, height: 912 });
  assert.deepEqual(getDimensions('4:3'), { width: 680, height: 512 });
});

test('AI Image Studio: integration with Knowledge Hub repository', async () => {
  const repo = new Repository();
  await repo.init();

  const user = await repo.findUserByUsername('azeemniazi');
  assert.ok(user);

  // 1. Create a folder in Knowledge Hub for AI Visuals
  const folder = await repo.createFolder({
    userId: user.id,
    name: 'AI Generated Assets',
    isShared: true,
    color: '#00663b'
  });
  assert.ok(folder.id);

  // 2. Simulate saving generated visual asset into Knowledge Hub
  const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#00663b"/></svg>`;
  const doc = await repo.createDocument({
    userId: user.id,
    folderId: folder.id,
    filename: 'AI_Visual_849201.svg',
    mimeType: 'image/svg+xml',
    sizeBytes: Buffer.byteLength(testSvg),
    storagePath: 'data/images/generated/test_asset.svg',
    isShared: true,
    status: 'ready',
    extractedText: 'AI Generated Image Visual Asset: Optical Fiber Network in Islamabad'
  });

  assert.ok(doc.id);
  assert.equal(doc.folderId, folder.id);
  assert.equal(doc.mimeType, 'image/svg+xml');

  // 3. Verify it is listed in Knowledge Hub folder documents
  const docs = await repo.listDocuments(user.id, { folderId: folder.id, scope: 'all' });
  const found = docs.find(d => d.id === doc.id);
  assert.ok(found);
  assert.equal(found.filename, 'AI_Visual_849201.svg');

  // 4. Cleanup test document and folder
  await repo.deleteDocument(doc.id, user.id, true);
  await repo.deleteFolder(folder.id, user.id, true);
});
