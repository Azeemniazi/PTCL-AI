import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Repository } from '../build/repository.js';
import { VexaEngine, meetingEngine } from '../build/engine.js';

test('Roadmap 1: PostgreSQL trigram indexing migration and substring search', async () => {
  const migPath = resolve('migrations/005_trigram_knowledge_search.sql');
  assert.ok(existsSync(migPath), '005_trigram_knowledge_search.sql must exist');
  const sql = readFileSync(migPath, 'utf8');
  assert.ok(sql.includes('CREATE EXTENSION IF NOT EXISTS pg_trgm'), 'Must enable pg_trgm extension');
  assert.ok(sql.includes('gin (filename gin_trgm_ops)'), 'Must index filename with gin_trgm_ops');
  assert.ok(sql.includes('gin (extracted_text gin_trgm_ops)'), 'Must index extracted_text with gin_trgm_ops');

  const repo = new Repository();
  await repo.init();
  const user = await repo.findUserByUsername('azeemniazi');
  assert.ok(user, 'Default user must be present');

  const doc = await repo.createDocument({
    userId: user.id,
    folderId: null,
    filename: 'Strategic_Quarterly_Roadmap_2026.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    storagePath: 'test_doc.pdf',
    isShared: true,
    status: 'ready',
    extractedText: 'CloudCore AI distributed cluster scaling and trigram search indexing benchmarks.'
  });

  const search1 = await repo.listDocuments(user.id, { search: 'Roadmap' });
  assert.ok(search1.some(d => d.id === doc.id), 'Search by filename substring should match');

  const search2 = await repo.listDocuments(user.id, { search: 'cluster scaling' });
  assert.ok(search2.some(d => d.id === doc.id), 'Search by extracted text substring should match');

  const search3 = await repo.listDocuments(user.id, { search: 'NonExistentString123' });
  assert.ok(!search3.some(d => d.id === doc.id), 'Non-matching search should return empty');
});

test('Roadmap 2: Image manifest database migration and clustered job queue', async () => {
  const migPath = resolve('migrations/006_image_studio.sql');
  assert.ok(existsSync(migPath), '006_image_studio.sql must exist');
  const sql = readFileSync(migPath, 'utf8');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS generated_assets'), 'Must create generated_assets table');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS image_jobs'), 'Must create image_jobs table');

  const repo = new Repository();
  await repo.init();
  const user = await repo.findUserByUsername('azeemniazi');
  assert.ok(user);

  // Asset lifecycle
  const assetId = 'asset-uuid-1';
  const asset = await repo.saveGeneratedAsset({
    id: assetId,
    userId: user.id,
    url: `/api/images/generated/${assetId}.png`,
    filename: `${assetId}.png`,
    prompt: 'Photorealistic enterprise cloud datacenter at dawn',
    style: 'natural',
    aspectRatio: '16:9',
    seed: 987654,
    steps: 4,
    cfgScale: 1.0,
    width: 1920,
    height: 1080,
    durationMs: 1450,
    createdAt: new Date().toISOString(),
    operation: 'generate',
    renderKind: 'generated'
  });
  assert.equal(asset.id, assetId);

  const retrieved = await repo.getGeneratedAsset(assetId);
  assert.ok(retrieved);
  assert.equal(retrieved.prompt, 'Photorealistic enterprise cloud datacenter at dawn');

  const byFilename = await repo.getGeneratedAssetByFilename(`${assetId}.png`);
  assert.ok(byFilename);
  assert.equal(byFilename.id, assetId);

  const assets = await repo.listGeneratedAssets(user.id);
  assert.ok(assets.some(a => a.id === assetId));

  const prompts = await repo.listRecentPrompts(user.id);
  assert.ok(prompts.some(p => p.prompt.includes('datacenter')));

  // Job queue lifecycle
  const jobId = 'job-uuid-1';
  assert.equal(await repo.hasActiveJobForUser(user.id), false);

  const job = await repo.saveImageJob({
    id: jobId,
    userId: user.id,
    prompt: 'Remix of datacenter with cyberpunk neon lighting',
    style: 'neon',
    aspectRatio: '16:9',
    seed: 123456,
    steps: 4,
    cfgScale: 1.0,
    width: 1920,
    height: 1080,
    status: 'queued',
    operation: 'remix',
    sourceAssetId: assetId,
    strength: 0.45,
    progress: 0,
    stageText: 'Your remix is queued.',
    startedAt: new Date().toISOString(),
    estimatedDurationMs: 3000
  });
  assert.equal(job.id, jobId);

  assert.equal(await repo.hasActiveJobForUser(user.id), true);

  const nextJob = await repo.getNextQueuedImageJob();
  assert.ok(nextJob);
  assert.equal(nextJob.id, jobId);

  const activeState = await repo.getActiveImageJob(user.id);
  assert.ok(activeState.activeJob);
  assert.equal(activeState.activeJob.id, jobId);

  // Update job progress
  await repo.updateImageJob(jobId, {
    status: 'processing',
    progress: 50,
    stageText: 'Synthesizing visual layers…'
  });
  const processingJob = await repo.getImageJob(jobId);
  assert.equal(processingJob?.status, 'processing');
  assert.equal(processingJob?.progress, 50);

  // Complete job
  await repo.updateImageJob(jobId, {
    status: 'completed',
    progress: 100,
    stageText: 'Completed',
    completedAt: new Date().toISOString()
  });
  assert.equal(await repo.hasActiveJobForUser(user.id), false);

  // Test resetStaleImageJobs
  await repo.saveImageJob({
    id: 'stale-job-id',
    userId: user.id,
    prompt: 'Stale job test',
    style: 'natural',
    aspectRatio: '1:1',
    seed: 111,
    steps: 4,
    cfgScale: 1.0,
    width: 1080,
    height: 1080,
    status: 'processing',
    progress: 30,
    stageText: 'Generating…',
    startedAt: new Date().toISOString(),
    estimatedDurationMs: 2000
  });
  await repo.resetStaleImageJobs();
  const resetJob = await repo.getImageJob('stale-job-id');
  assert.equal(resetJob?.status, 'failed');
  assert.ok(resetJob?.error?.includes('Server restarted'));

  // Batch delete assets
  const deleted = await repo.batchDeleteGeneratedAssets([assetId], user.id);
  assert.equal(deleted.length, 1);
  assert.equal(await repo.getGeneratedAsset(assetId), undefined);
});

test('Roadmap 3: Screen-share snapshots extension and Vexa screen capture stream', async () => {
  // Test VexaEngine screenshot method handles fallback and custom URLs
  const vexa = new VexaEngine();
  const result = await vexa.screenshot('non-existent-native-id');
  // When no bot is running locally or upstream, gracefully returns undefined or active stream Response without throwing
  assert.ok(result === undefined || (result && typeof result.status === 'number'), 'Screenshot must return undefined or active stream Response');

  // Test frontend contains the capture snapshot action and button in dist/app.js
  const appJs = readFileSync(resolve('dist/app.js'), 'utf8');
  assert.ok(appJs.includes('data-action="capture-snapshot"'), 'Must have capture-snapshot button in snapshot tab');
  assert.ok(appJs.includes('/capture-snapshot'), 'Must call /capture-snapshot endpoint in app.js');
  assert.ok(appJs.includes('live-bot-screen-img'), 'Must have live bot screen viewer element');
  assert.ok(appJs.includes('Vexa Screen Stream'), 'Must display Vexa screen stream title');
});
