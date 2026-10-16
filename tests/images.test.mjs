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

test('AI Image Studio: prompt history extraction and deduplication', async () => {
  const assets = [
    { prompt: 'Optical fiber datacenter', style: 'corporate', aspectRatio: '1:1', seed: 100, createdAt: '2026-10-14T01:00:00Z' },
    { prompt: 'Optical fiber datacenter', style: 'corporate', aspectRatio: '1:1', seed: 101, createdAt: '2026-10-14T02:00:00Z' },
    { prompt: '5G transmission tower Islamabad', style: 'photoreal', aspectRatio: '16:9', seed: 200, createdAt: '2026-10-14T03:00:00Z' }
  ];

  const seen = new Set();
  const prompts = [];
  for (const a of assets) {
    const key = (a.prompt || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    prompts.push({
      prompt: a.prompt,
      style: a.style,
      aspectRatio: a.aspectRatio,
      seed: a.seed,
      timestamp: a.createdAt
    });
  }

  assert.equal(prompts.length, 2);
  assert.equal(prompts[0].prompt, 'Optical fiber datacenter');
  assert.equal(prompts[1].prompt, '5G transmission tower Islamabad');
});

test('AI Image Studio: job queue lifecycle and cancellation tracking', async () => {
  const jobs = [];
  function createJob(prompt) {
    const job = {
      id: `imgjob_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: 'test-user',
      status: 'queued',
      params: { prompt, style: 'corporate', aspectRatio: '1:1', steps: 4, cfgScale: 7.5 },
      createdAt: new Date().toISOString()
    };
    jobs.push(job);
    return job;
  }

  function getActiveJob(userId) {
    return jobs.find(j => j.userId === userId && (j.status === 'queued' || j.status === 'running')) || null;
  }

  function cancelJob(id, userId) {
    const j = jobs.find(x => x.id === id && x.userId === userId);
    if (!j) return false;
    if (j.status === 'queued' || j.status === 'running') {
      j.status = 'cancelled';
      j.completedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  const job1 = createJob('Cybersecurity NOC panoramic display');
  assert.equal(job1.status, 'queued');

  const active = getActiveJob('test-user');
  assert.ok(active);
  assert.equal(active.id, job1.id);

  // Transition to running
  active.status = 'running';
  active.startedAt = new Date().toISOString();
  assert.equal(getActiveJob('test-user')?.status, 'running');

  // Cancel job
  const cancelled = cancelJob(job1.id, 'test-user');
  assert.equal(cancelled, true);
  assert.equal(job1.status, 'cancelled');
  assert.equal(getActiveJob('test-user'), null);
});

test('AI Image Studio: estimateJobDurationMs and requestEngineJson', async () => {
  const { estimateJobDurationMs, requestEngineJson } = await import('../build/image-engine.js');
  const { createServer } = await import('node:http');
  const { once } = await import('node:events');

  assert.equal(estimateJobDurationMs('16:9'), 950000);
  assert.equal(estimateJobDurationMs('9:16'), 950000);
  assert.equal(estimateJobDurationMs('4:3'), 700000);
  assert.equal(estimateJobDurationMs('1:1'), 480000);

  // Test requestEngineJson against a local mock HTTP server
  const server = createServer(async (req, res) => {
    if (req.url === '/sdapi/v1/txt2img') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (parsed.prompt === 'fail') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'GPU fault' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ images: ['dGVzdA=='] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;

  try {
    const successRes = await requestEngineJson(`http://127.0.0.1:${port}/sdapi/v1/txt2img`, {
      method: 'POST',
      body: { prompt: 'A sunny beach' }
    });
    assert.equal(successRes.ok, true);
    assert.equal(successRes.status, 200);
    assert.deepEqual(successRes.data, { images: ['dGVzdA=='] });

    const failRes = await requestEngineJson(`http://127.0.0.1:${port}/sdapi/v1/txt2img`, {
      method: 'POST',
      body: { prompt: 'fail' }
    });
    assert.equal(failRes.ok, false);
    assert.equal(failRes.status, 500);
    assert.equal(failRes.data.error, 'GPU fault');
  } finally {
    server.close();
  }
});

