import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const databaseUrl = process.env.CLOUDCORE_IMPORT_TEST_DATABASE_URL;
const sleep = ms => new Promise(done => setTimeout(done, ms));
const basePath = '/api/knowledge/imports';
const sha = value => createHash('sha256').update(value).digest('hex');

test('Knowledge imports preserve hierarchy, isolate users and recover completed items', {
  skip: !databaseUrl && 'Set CLOUDCORE_IMPORT_TEST_DATABASE_URL to a disposable database.',
  timeout: 90000
}, async () => {
  assert.equal(new URL(databaseUrl).hostname, '127.0.0.1', 'The fixture requires a loopback test database.');
  const temp = await mkdtemp(join(tmpdir(), 'cloudcore-imports-'));
  const engine = createServer(async (req, res) => {
    const pieces = [];
    for await (const part of req) pieces.push(part);
    const payload = JSON.parse(Buffer.concat(pieces).toString() || '{}');
    res.setHeader('content-type', 'application/json');
    if (req.url.endsWith('/embeddings')) {
      const input = Array.isArray(payload.input) ? payload.input : [payload.input];
      res.end(JSON.stringify({ data: input.map((_, index) => ({ index, embedding: Array.from({ length: 2560 }, (_, i) => i === 0 ? 1 : 0) })) }));
    } else if (req.url.endsWith('/chat/completions')) {
      const content = payload.response_format ? '{"verdict":"supported","issues":[]}' : 'The source states uptime is 99.87%. [S1]';
      res.end(JSON.stringify({choices: [{message: {content}, finish_reason: 'stop'}]}));
    } else { res.statusCode = 404; res.end('{}'); }
  });
  engine.listen(0, '127.0.0.1');
  await once(engine, 'listening');
  const listener = createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(done => listener.close(done));
  const origin = `http://127.0.0.1:${port}`;
  const engineUrl = `http://127.0.0.1:${engine.address().port}`;
  const password = 'isolated-knowledge-import-fixture-password';
  let child;
  let logs = '';
  let cookie;
  const api = (path, {session = cookie, method = 'GET', data, raw} = {}) => fetch(origin + path, {
    method, signal: AbortSignal.timeout(10000),
    headers: {'x-requested-with': 'CloudCoreAI', ...(session ? {cookie: session} : {}),
      ...(raw !== undefined ? {'content-type': 'application/octet-stream'} : data ? {'content-type': 'application/json'} : {})},
    body: raw ?? (data ? JSON.stringify(data) : undefined)
  });
  async function json(response, code = 200) {
    const value = await response.json();
    assert.equal(response.status, code, JSON.stringify(value));
    return value;
  }
  async function boot() {
    child = spawn(process.execPath, [fileURLToPath(new URL('../build/server.js', import.meta.url))], {
      cwd: temp, env: {...process.env, NODE_ENV: 'test', PORT: String(port), APP_BIND_HOST: '127.0.0.1',
        PUBLIC_BASE_URL: origin, DATABASE_URL: databaseUrl, REDIS_URL: '', AUTH_MODE: 'local',
        INITIAL_DEV_PASSWORD: password, AI_BASE_URL: engineUrl + '/v1', EMBEDDING_API_URL: engineUrl,
        RERANKER_API_URL: engineUrl, DATABASE_RUN_MIGRATIONS: 'true', LOG_LEVEL: 'error'}
    });
    child.stderr.on('data', data => { logs += data; });
    for (let n = 0; n < 200; n++) {
      if ((await api('/readyz').catch(() => null))?.ok) return;
      if (child.exitCode !== null) break;
      await sleep(100);
    }
    assert.fail(logs || 'CloudCore could not start.');
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const done = once(child, 'exit');
    child.kill();
    await done;
  }
  async function signIn(username) {
    const result = await api('/api/auth/login', {method: 'POST', data: {username, password}, session: null});
    assert.equal(result.status, 200, (await result.clone().text()) + '\n' + logs);
    return result.headers.get('set-cookie').split(';', 1)[0];
  }
  const title = 'Contract import ' + randomUUID().slice(0, 8);
  const text = 'SecretFixture uptime is 99.87%.\nSupport is 8x5.';
  const create = (destinationId, files, directories = []) => ({id: randomUUID(), destinationId,
    isShared: true, directories, files: files.map(([path, content, sourcePath]) => ({
      path, sourcePath, size: Buffer.byteLength(content), type: 'text/plain'
    }))});
  const submit = (manifest, session) => api(basePath, {method: 'POST', data: manifest, session});
  const send = (batch, item, content, session) => api(`${basePath}/${batch.id}/items/${item.id}`, {method: 'PUT', raw: content, session});
  const read = batch => api(`${basePath}/${batch.id}`).then(response => json(response));
  try {
    await boot();
    cookie = await signIn('azeemniazi');
    const guestName = 'u-' + randomUUID().slice(0, 8);
    await json(await api('/api/admin/users', {method: 'POST', data: {
      username: guestName, password, displayName: 'Import test reader', role: 'user', mustChangePassword: false
    }}), 200);
    let guest = await signIn(guestName);
    const {folder} = await json(await api('/api/knowledge/folders', {method: 'POST', data: {name: title, isShared: false}}), 201);
    const dirs = ['Contract Central', 'Contract Central/2026/Empty',
      ...Array.from({length: 101}, (_, index) => `Contract Central/2026/Sibling-${index}`)];
    const path = 'Contract Central/2026/SecretFixture.txt';
    const manifest = create(folder.id, [[path, text]], dirs);
    assert.equal((await submit(manifest, guest)).status, 403);
    assert.equal((await submit(create(null, [['../bad.txt', text]]))).status, 400);
    const batch = await json(await submit(manifest), 201);
    assert.equal((await json(await submit(manifest), 201)).items[0].id, batch.items[0].id);
    assert.equal((await send(batch, batch.items[0], text, guest)).status, 404);
    const partial = httpRequest(origin + `${basePath}/${batch.id}/items/${batch.items[0].id}`, {
      method: 'PUT', headers: {cookie, 'content-type': 'application/octet-stream', 'content-length': Buffer.byteLength(text)}
    });
    partial.on('error', () => {});
    partial.write('SecretFi');
    await sleep(100);
    partial.destroy();
    for (let n = 0; n < 20; n++) {
      if ((await read(batch)).items[0].status === 'failed') break;
      await sleep(50);
    }
    assert.equal((await read(batch)).items[0].status, 'failed');
    await stop();
    await boot();
    cookie = await signIn('azeemniazi');
    guest = await signIn(guestName);
    assert.equal((await json(await send(batch, batch.items[0], text))).status, 'uploaded');
    assert.equal((await json(await send(batch, batch.items[0], text))).status, 'uploaded');
    const current = (await read(batch)).items[0];
    const bytes = await (await api(`/api/knowledge/documents/${current.documentId}/download`)).arrayBuffer();
    assert.equal(sha(Buffer.from(bytes)), sha(text));
    const copies = await Promise.all([submit(create(folder.id, [[path, text]])), submit(create(folder.id, [[path, text + ' Updated.']]))]);
    const [same, changed] = await Promise.all(copies.map(response => json(response, 201)));
    const output = await Promise.all([send(same, same.items[0], text), send(changed, changed.items[0], text + ' Updated.')]);
    assert.equal((await json(output[0])).status, 'skipped');
    assert.equal((await json(output[1])).status, 'uploaded');
    assert.equal((await read(changed)).items[0].storedName, 'SecretFixture (2).txt');
    const flattened = await json(await submit(create(folder.id, [['Sibling/Reference.txt', text, 'Dropped/Sibling/Reference.txt']], ['Sibling'])), 201);
    assert.equal(flattened.items[0].sourcePath, 'Dropped/Sibling/Reference.txt');
    await json(await send(flattened, flattened.items[0], text));
    const cancelled = await json(await submit(create(folder.id, [['Never.txt', text], ['Keep.bin', text]])), 201);
    const keep = cancelled.items.find(item => item.path === 'Keep.bin');
    const never = cancelled.items.find(item => item.path === 'Never.txt');
    await json(await send(cancelled, keep, text));
    await json(await api(`${basePath}/${cancelled.id}/cancel`, {method: 'POST'}));
    assert.equal((await send(cancelled, never, text)).status, 409);
    const retained = (await read(cancelled)).items.find(item => item.id === keep.id);
    assert.equal(retained.status, 'uploaded');
    assert.equal(retained.indexing, 'unsupported');
    assert.equal(await (await api(`/api/knowledge/documents/${retained.documentId}/download`)).text(), text);
    const {folders} = await json(await api('/api/knowledge/folders?scope=all'));
    const importedRoot = folders.find(item => item.parentId === folder.id && item.name === 'Contract Central');
    const year = folders.find(item => item.parentId === importedRoot.id && item.name === '2026');
    assert.equal(folders.filter(item => item.parentId === year.id).length, 102);
    assert.ok(folders.some(item => item.parentId === folder.id && item.name === 'Sibling'));
    for (let attempt = 0; attempt < 60; attempt++) {
      if ((await read(batch)).items[0].indexing === 'ready') break;
      await sleep(250);
    }
    assert.equal((await read(batch)).items[0].indexing, 'ready');
    const answer = await json(await api('/api/chat', {method: 'POST', data: {
      message: 'What uptime does SecretFixture state?', rag_scope: {mode: 'folder', id: folder.id}, use_rag: true, max_tokens: 250
    }}));
    assert.match(answer.answer, /99\.87/);
    assert.ok(answer.citations.some(citation => [current.documentId, changed.items[0].id, flattened.items[0].id].includes(citation.documentId)),
      JSON.stringify(answer.citations));
    const notifications = '/api/notifications';
    const feed = await json(await api(notifications));
    const milestone = 'import:' + batch.id + ':index';
    assert.equal(feed.entries.filter(entry => entry.id === milestone).length, 1);
    const secondDevice = await signIn('azeemniazi');
    assert.equal((await json(await api(notifications, {session:secondDevice}))).entries.find(entry => entry.id === milestone).unread, true);
    assert.equal((await json(await api(notifications, {session:guest}))).entries.length, 0);
    assert.equal((await api(notifications + '/read', {method:'POST',data:{ids:[milestone]}})).status, 204);
    assert.equal((await json(await api(notifications, {session:secondDevice}))).entries.find(entry => entry.id === milestone).unread, false);
    assert.equal((await api(notifications + '/clear', {method:'POST',session:secondDevice,data:{ids:[milestone]}})).status, 204);
    assert.equal((await json(await api(notifications))).entries.length, 0);

    if (process.platform === 'linux') {
      const zip = execFileSync('python3', ['-c', [
        'import io, sys, zipfile',
        'output = io.BytesIO()',
        'with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:',
        '    archive.writestr("Archived/Nested/Guide.txt", sys.argv[1])',
        '    archive.writestr("Archived/Empty/", "")',
        'sys.stdout.buffer.write(output.getvalue())',
      ].join('\n'), text]);
      const archive = await json(await submit(create(folder.id, [['Synthetic.zip', zip]])), 201);
      await json(await send(archive, archive.items[0], zip));
      const source = basePath + '/archive/' + archive.items[0].id;
      assert.equal((await api(source, {session: guest})).status, 404);
      const preview = await json(await api(source));
      assert.deepEqual(preview.directories, ['Archived/Empty']);
      assert.equal(preview.files[0].path, 'Archived/Nested/Guide.txt');
      const id = randomUUID();
      const job = {id, destinationId: folder.id, isShared: false, preview: preview.preview};
      await json(await api(source, {method: 'POST', data: job}), 202);
      const statusPath = basePath + '/archive-status/' + id;
      let extraction;
      for (let attempt = 0; attempt < 60; attempt++) {
        extraction = await json(await api(statusPath));
        if (!extraction.running && extraction.report?.items[0]?.indexing === 'ready' || extraction.error) break;
        await sleep(250);
      }
      assert.equal(extraction.error, undefined);
      assert.equal(extraction.report.items[0].status, 'uploaded');
      assert.equal(extraction.report.items[0].indexing, 'ready');
      const expanded = extraction.report.items[0].documentId;
      assert.equal(sha(Buffer.from(await (await api('/api/knowledge/documents/' + expanded + '/download')).arrayBuffer())), sha(text));
      assert.equal(sha(Buffer.from(await (await api('/api/knowledge/documents/' + archive.items[0].id + '/download')).arrayBuffer())), sha(zip));
      const partialStatus = await json(await api(statusPath, {session: guest}));
      assert.equal(partialStatus.report, undefined);
      const matches = await json(await api('/api/knowledge/documents?metadataOnly=true&namesOnly=true&descendants=true&folderId=' + folder.id + '&search=Guide.txt'));
      assert.deepEqual(matches.documents.map(doc => doc.id), [expanded]);
      assert.equal(matches.documents[0].extractedText, undefined);
    }
  } finally {
    await stop();
    await new Promise(done => { engine.close(done); engine.closeAllConnections(); });
    await rm(temp, {recursive: true, force: true});
  }
});
