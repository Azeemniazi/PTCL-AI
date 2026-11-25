import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, open, readdir, rename, rm, stat, statfs, unlink } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { Router, type Request } from 'express';
import type { Pool, PoolClient } from 'pg';
import { enqueueKnowledgeIngestion } from './knowledge-ingestion.js';
import { repository } from './repository.js';
import { knowledgeImportMaxBytes, supportsKnowledgeIndex } from './knowledge-formats.js';

const MiB = 1024 ** 2;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

class ImportError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function relativePath(value: unknown) {
  if (typeof value !== 'string' || value.length > 480) throw new ImportError(400, 'Invalid import path.');
  const parts = value.split('/');
  if (parts.length > 24 || parts.some(part =>
    !part || part.length > 120 || part.trim() !== part || part === '.' || part === '..' ||
    /[\\:\u0000-\u001f\u007f]/u.test(part))) throw new ImportError(400, 'Invalid import path.');
  return parts.map(part => part.normalize('NFC')).join('/');
}

function validateManifest(body: any) {
  if (!body || typeof body.id !== 'string' || !uuid.test(body.id) ||
      (body.destinationId !== null && (typeof body.destinationId !== 'string' || !uuid.test(body.destinationId))) ||
      typeof body.isShared !== 'boolean' || !Array.isArray(body.files) || !Array.isArray(body.directories) ||
      body.files.length + body.directories.length > 1400 || !body.files.length && !body.directories.length) {
    throw new ImportError(400, 'Provide a valid manifest with up to 1,400 files and folders.');
  }
  const directories = [...new Set<string>(body.directories.map(relativePath))].sort();
  const names = new Set<string>(directories.map(path => path.toLowerCase()));
  if (names.size !== directories.length) throw new ImportError(400, 'Folder names conflict in the import.');
  let bytes = 0;
  const files = body.files.map((file: any) => {
    const path = relativePath(file?.path);
    if (!Number.isSafeInteger(file?.size) || file.size < 0 || file.size > knowledgeImportMaxBytes) {
      throw new ImportError(413, 'Each file must be at most 2 GiB.');
    }
    if (names.has(path.toLowerCase())) throw new ImportError(400, 'File names conflict in the import.');
    names.add(path.toLowerCase());
    bytes += file.size;
    const mimeType = typeof file.type === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(file.type) && file.type.length <= 120
      ? file.type : 'application/octet-stream';
    return { path, sourcePath: relativePath(file.sourcePath ?? path), size: file.size as number, mimeType };
  }) as Array<{path: string; sourcePath: string; size: number; mimeType: string}>;
  if (bytes > knowledgeImportMaxBytes) throw new ImportError(413, 'An import can contain up to 2 GiB.');
  const filePaths = new Set(files.map(file => file.path.toLowerCase()));
  for (const path of [...directories, ...files.map(file => file.path)]) {
    const segments = path.toLowerCase().split('/');
    segments.pop();
    while (segments.length) {
      if (filePaths.has(segments.join('/'))) throw new ImportError(400, 'A file cannot be used as a folder.');
      segments.pop();
    }
  }
  return { id: body.id as string, destinationId: body.destinationId as string | null,
    isShared: body.isShared as boolean, directories, files };
}

async function owned(db: Pool | PoolClient, id: string, userId: string, lock = false) {
  if (!uuid.test(id)) throw new ImportError(404, 'Import not found.');
  const { rows: [batch] } = await db.query(
    'SELECT * FROM knowledge_imports WHERE id=$1 AND user_id=$2' + (lock ? ' FOR UPDATE' : ''), [id, userId]);
  if (!batch) throw new ImportError(404, 'Import not found.');
  return batch;
}

async function destination(db: PoolClient, id: string | null, userId: string, fallback: boolean, required: boolean) {
  if (!id && required) throw new ImportError(409, 'The destination folder was deleted.');
  let shared = fallback;
  const seen = new Set<string>();
  for (let current = id; current !== null;) {
    if (seen.has(current)) throw new ImportError(409, 'The destination folder hierarchy is invalid.');
    seen.add(current);
    const { rows: [folder] } = await db.query('SELECT parent_id,user_id,is_shared FROM knowledge_folders WHERE id=$1 FOR SHARE', [current]);
    if (!folder || (!folder.is_shared && folder.user_id !== userId)) {
      throw new ImportError(403, 'You cannot import into this folder.');
    }
    shared = seen.size === 1 ? folder.is_shared : shared && folder.is_shared;
    current = folder.parent_id;
  }
  return shared;
}

async function folderPath(db: PoolClient, parent: string | null, path: string[], userId: string, shared: boolean) {
  for (const name of path) {
    const { rows: [folder] } = await db.query(
      'SELECT id FROM knowledge_folders WHERE parent_id IS NOT DISTINCT FROM $1::uuid AND lower(name)=lower($2) AND is_shared=$3 AND ($3 OR user_id=$4) ORDER BY created_at,id LIMIT 1 FOR SHARE',
      [parent, name, shared, userId]);
    if (folder) {
      parent = folder.id;
    } else {
      const child = randomUUID();
      await db.query('INSERT INTO knowledge_folders(id,parent_id,user_id,name,is_shared) VALUES($1,$2,$3,$4,$5)',
        [child, parent, userId, name, shared]);
      parent = child;
    }
  }
  return parent;
}

async function prepareDirectories(db: PoolClient, base: string | null, directories: string[], userId: string, shared: boolean) {
  if (!directories.length) return;
  const { rows } = await db.query(`WITH RECURSIVE visible AS (
    SELECT id,parent_id,name,created_at FROM knowledge_folders
    WHERE parent_id IS NOT DISTINCT FROM $1::uuid AND is_shared=$2 AND ($2 OR user_id=$3)
    UNION
    SELECT f.id,f.parent_id,f.name,f.created_at FROM knowledge_folders f JOIN visible v ON f.parent_id=v.id
    WHERE f.is_shared=$2 AND ($2 OR f.user_id=$3)
  ) SELECT id,parent_id,name FROM visible ORDER BY created_at,id`, [base, shared, userId]);
  const key = (parent: string | null, name: string) => JSON.stringify([parent, name.toLowerCase()]);
  const existing = new Map<string, string>();
  for (const row of rows) {
    const index = key(row.parent_id, row.name);
    if (!existing.has(index)) existing.set(index, row.id);
  }
  const created: { id: string; parent: string | null; name: string }[] = [];
  for (const path of directories) {
    let parent = base;
    for (const name of path.split('/')) {
      const index = key(parent, name);
      let id = existing.get(index);
      if (!id) {
        id = randomUUID();
        existing.set(index, id);
        created.push({ id, parent, name });
      }
      parent = id;
    }
  }
  if (created.length) await db.query(`INSERT INTO knowledge_folders(id,parent_id,user_id,name,is_shared)
    SELECT entry.id,entry.parent,$1,entry.name,$2 FROM jsonb_to_recordset($3::jsonb) AS entry(id uuid,parent uuid,name text)`,
  [userId, shared, JSON.stringify(created)]);
}

async function transaction<T>(db: PoolClient, operation: () => Promise<T>) {
  await db.query('BEGIN');
  try {
    const result = await operation();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function report(pool: Pool, id: string, userId: string) {
  const batch = await owned(pool, id, userId);
  const { rows } = await pool.query(`
    SELECT i.id,i.path,i.source_path AS "sourcePath",i.size_bytes AS size,i.status,i.error,i.stored_name AS "storedName",
           d.id AS "documentId",CASE WHEN d.id IS NOT NULL AND NOT i.indexing_supported THEN 'unsupported' ELSE d.status END AS indexing
    FROM knowledge_import_items i LEFT JOIN knowledge_documents d ON d.id=i.document_id
    WHERE i.import_id=$1 ORDER BY i.path`, [id]);
  return { id, destinationId: batch.destination_id, isShared: batch.is_shared, cancelled: Boolean(batch.cancelled_at),
    createdAt: batch.created_at, items: rows.map(row => ({ ...row, size: Number(row.size) })) };
}

async function digestFile(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function receive(req: Request, path: string, expected: number) {
  const stat = await statfs(resolve(path, '..'));
  if (stat.bsize * stat.bavail < expected + 512 * MiB) throw new ImportError(507, 'The server is low on upload storage.');
  const file = await open(path, 'wx', 0o600);
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > expected) throw new ImportError(413, 'The uploaded file exceeds its declared size.');
      hash.update(chunk);
      await file.writeFile(chunk);
    }
    if (bytes !== expected) throw new ImportError(400, 'The file upload was incomplete.');
    await file.sync();
    return hash.digest('hex');
  } finally {
    await file.close();
  }
}

async function commitFile(db: PoolClient, root: string, staging: string, batch: any, item: any, digest: string, userId: string) {
  if (batch.cancelled_at) throw new ImportError(409, 'This import was cancelled.');
  const shared = await destination(db, batch.destination_id, userId, batch.is_shared, batch.had_destination);
  if (shared !== batch.is_shared) throw new ImportError(409, 'The destination visibility changed. Start a new import.');
  const parts = (item.path as string).split('/');
  const original = parts.pop()!;
  const parent = await folderPath(db, batch.destination_id, parts, userId, shared);
  const { rows: siblings } = await db.query(`
    SELECT id,filename,storage_path,size_bytes,content_sha256,is_shared,user_id FROM knowledge_documents
    WHERE folder_id IS NOT DISTINCT FROM $1::uuid AND (is_shared=$2 AND ($2 OR user_id=$3))`,
  [parent, shared, userId]);
  const dot = original.lastIndexOf('.');
  const stem = dot > 0 ? original.slice(0, dot) : original;
  const suffix = dot > 0 ? original.slice(dot) : '';
  const occupied = new Map<string, typeof siblings>();
  for (const sibling of siblings) {
    const key = String(sibling.filename).toLowerCase();
    const matches = occupied.get(key) ?? [];
    matches.push(sibling);
    occupied.set(key, matches);
  }
  let name = original;
  for (let i = 2; occupied.has(name.toLowerCase()); i++) {
    for (const match of occupied.get(name.toLowerCase())!) {
      if (Number(match.size_bytes) !== Number(item.size_bytes)) continue;
      const storage = isAbsolute(match.storage_path) ? match.storage_path : resolve(root, match.storage_path);
      try {
        const previous = match.content_sha256 ? (await stat(storage), match.content_sha256) : await digestFile(storage);
        if (previous === digest) {
          await db.query("UPDATE knowledge_import_items SET status='skipped',document_id=$2,stored_name=$3,error=NULL WHERE id=$1",
            [item.id, match.id, match.filename]);
          return null;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    name = `${stem} (${i})${suffix}`;
  }
  const filename = `${item.id}.${suffix.slice(1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'bin'}`;
  const supported = supportsKnowledgeIndex(original, Number(item.size_bytes));
  await rename(staging, resolve(root, filename));
  await db.query(`INSERT INTO knowledge_documents(id,user_id,folder_id,filename,mime_type,size_bytes,storage_path,is_shared,status,content_sha256)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
  [item.id, userId, parent, name, item.mime_type, item.size_bytes, filename, shared, supported ? 'indexing' : 'failed', digest]);
  await db.query("UPDATE knowledge_import_items SET status='uploaded',document_id=$1,stored_name=$2,error=NULL,indexing_supported=$3 WHERE id=$1",
    [item.id, name, supported]);
  return item.id as string;
}

export async function cleanKnowledgeImportStaging(root: string) {
  const directory = resolve(root, '.imports');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const archive = entry.isDirectory() && /^archive-[a-z0-9]{6}$/i.test(entry.name);
    if (!archive && (!entry.isFile() || !uuid.test(entry.name))) continue;
    const path = resolve(directory, entry.name);
    const info = await stat(path).catch(() => null);
    if (info && Date.now() - info.mtimeMs > 24 * 60 * 60 * 1000) {
      await rm(path, { recursive: archive, force: true }).catch(() => {});
    }
  }
}

async function saveManifest(pool: Pool, manifest: ReturnType<typeof validateManifest>, userId: string, archiveId?: string) {
  const hash = createHash('sha256').update(JSON.stringify(archiveId ? [manifest, archiveId] : manifest)).digest('hex');
  const db = await pool.connect();
  try {
    await transaction(db, async () => {
      await db.query("SELECT pg_advisory_xact_lock(760081, 1)");
      const { rows: [prior] } = await db.query('SELECT user_id,manifest_hash FROM knowledge_imports WHERE id=$1', [manifest.id]);
      if (prior) {
        if (prior.user_id !== userId || prior.manifest_hash !== hash) throw new ImportError(409, 'Import identifier is unavailable.');
        return;
      }
      const shared = await destination(db, manifest.destinationId, userId, manifest.isShared, Boolean(manifest.destinationId));
      await db.query('INSERT INTO knowledge_imports(id,user_id,destination_id,had_destination,is_shared,manifest_hash,source_archive_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [manifest.id, userId, manifest.destinationId, Boolean(manifest.destinationId), shared, hash, archiveId ?? null]);
      await prepareDirectories(db, manifest.destinationId, manifest.directories, userId, shared);
      await db.query(`INSERT INTO knowledge_import_items(id,import_id,path,source_path,size_bytes,mime_type)
        SELECT entry.id,$1,entry.path,entry.source,entry.size,entry.mime FROM jsonb_to_recordset($2::jsonb)
        AS entry(id uuid,path text,source text,size bigint,mime text)`,
      [manifest.id, JSON.stringify(manifest.files.map(file => ({ id: randomUUID(), path: file.path, source: file.sourcePath, size: file.size, mime: file.mimeType })))]);
    });
  } finally { db.release(); }
}

interface ArchiveContents {
  files: Array<{ path: string; size: number; type: string }>;
  directories: string[];
  size: number;
}

const execArchive = promisify(execFile);
const archiveReader = fileURLToPath(new URL('../scripts/read-knowledge-archive.py', import.meta.url));
const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function readArchive(path: string, extension: string, output = ''): Promise<ArchiveContents> {
  try {
    const { stdout } = await execArchive('python3', ['-I', archiveReader, path, extension, output], {
      timeout: output ? 180_000 : 20_000, maxBuffer: 4 * MiB,
      env: { PATH: process.env.PATH, LANG: 'C.UTF-8' }
    });
    return JSON.parse(stdout);
  } catch (cause) {
    const error = cause as NodeJS.ErrnoException & { stdout?: string };
    let explanation: string | undefined;
    try { explanation = JSON.parse(error.stdout ?? '').error; } catch { /* Worker stopped without a report. */ }
    throw new ImportError(422, explanation || (error.code === 'ENOENT'
      ? 'The ZIP and RAR reader is unavailable. Ask an administrator to install Python and libarchive.'
      : 'The archive could not be read within the processing limits.'));
  }
}

async function archiveSource(root: string, id: string, userId: string) {
  const doc = uuid.test(id) ? await repository.getDocumentById(id) : undefined;
  if (!doc || (!doc.isShared && doc.userId !== userId)) throw new ImportError(404, 'Archive not found.');
  const extension = /\.(zip|rar)$/i.exec(doc.filename)?.[1]?.toLowerCase();
  if (!extension) throw new ImportError(422, 'Select a ZIP or RAR archive.');
  if (doc.sizeBytes > knowledgeImportMaxBytes) throw new ImportError(413, 'The archive itself must be at most 2 GiB.');
  return { path: resolve(root, doc.storagePath), extension };
}

async function extractArchive(pool: Pool, root: string, documentId: string, userId: string,
  input: { id: string; destinationId: string | null; isShared: boolean; preview: string }) {
  const db = await pool.connect();
  let claimed = false;
  let directory: string | undefined;
  try {
    claimed = (await db.query('SELECT pg_try_advisory_lock(760083,hashtext($1)) AS acquired', [input.id])).rows[0].acquired;
    if (!claimed) return;
    const source = await archiveSource(root, documentId, userId);
    const listing = await readArchive(source.path, source.extension);
    if (sha256([documentId, listing]) !== input.preview) throw new ImportError(409, 'The archive changed. Open its preview again.');
    const manifest = validateManifest({ ...input, directories: listing.directories, files: listing.files });
    const staging = resolve(root, '.imports');
    await mkdir(staging, { recursive: true, mode: 0o700 });
    const disk = await statfs(staging);
    if (disk.bsize * disk.bavail < listing.size + 512 * MiB) throw new ImportError(507, 'The server is low on extraction storage.');
    directory = await mkdtemp(resolve(staging, 'archive-'));
    const extracted = await readArchive(source.path, source.extension, directory);
    if (sha256(extracted) !== sha256(listing)) throw new ImportError(409, 'The archive changed during extraction.');
    await archiveSource(root, documentId, userId);
    await saveManifest(pool, manifest, userId, documentId);
    const { rows: items } = await db.query('SELECT * FROM knowledge_import_items WHERE import_id=$1', [input.id]);
    const byPath = new Map(items.map(item => [item.source_path, item]));
    for (const [index, file] of manifest.files.entries()) {
      const item = byPath.get(file.sourcePath);
      if (!item || ['uploaded', 'skipped'].includes(item.status)) continue;
      const staged = resolve(directory, String(index));
      const digest = await digestFile(staged);
      const id = await transaction(db, async () => {
        await db.query('SELECT pg_advisory_xact_lock(760081, 1)');
        const batch = await owned(db, input.id, userId, true);
        if (batch.cancelled_at) return false;
        const { rowCount } = await db.query('SELECT id FROM knowledge_documents WHERE id=$1 AND (is_shared OR user_id=$2) FOR SHARE',
          [documentId, userId]);
        if (!rowCount) throw new ImportError(403, 'Archive access changed during extraction.');
        const { rows: [latest] } = await db.query('SELECT status FROM knowledge_import_items WHERE id=$1', [item.id]);
        if (['uploaded', 'skipped'].includes(latest?.status)) return null;
        return commitFile(db, root, staged, batch, item, digest, userId);
      });
      if (id === false) break;
      if (id) {
        const document = await repository.getDocumentById(id);
        if (document?.status === 'indexing') void enqueueKnowledgeIngestion(document, root);
      }
    }
  } finally {
    let discard = false;
    if (claimed) await db.query('SELECT pg_advisory_unlock(760083,hashtext($1))', [input.id]).catch(() => { discard = true; });
    db.release(discard);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

export function knowledgeImports(pool: Pool | undefined, root: string) {
  const router = Router();
  let reading = false;
  let active: { id: string; userId: string } | undefined;
  const errors = new Map<string, string>();
  router.get('/archive/:document', async (req, res) => {
    const userId = req.session.user!.id;
    const id = String(req.params.document);
    const source = await archiveSource(root, id, userId);
    if (reading || active) throw new ImportError(429, 'Another archive is being processed. Try again shortly.');
    reading = true;
    try {
      const listing = await readArchive(source.path, source.extension);
      validateManifest({ id: randomUUID(), destinationId: null, isShared: false, ...listing });
      res.json({ ...listing, preview: sha256([id, listing]) });
    } finally { reading = false; }
  });
  router.post('/archive/:document', async (req, res) => {
    if (!pool) throw new ImportError(503, 'Archive imports require PostgreSQL.');
    const userId = req.session.user!.id;
    const documentId = String(req.params.document);
    await archiveSource(root, documentId, userId);
    const { id, destinationId, isShared, preview } = req.body ?? {};
    if (typeof id !== 'string' || !uuid.test(id) || !(destinationId === null || typeof destinationId === 'string' && uuid.test(destinationId)) ||
      typeof isShared !== 'boolean' || typeof preview !== 'string' || !/^[a-f0-9]{64}$/.test(preview)) {
      throw new ImportError(400, 'Choose a destination and confirm the archive preview.');
    }
    if (reading || active && (active.id !== id || active.userId !== userId)) {
      throw new ImportError(429, 'Another archive is being processed. Try again shortly.');
    }
    if (!active) {
      active = { id, userId };
      const key = userId + '/' + id;
      errors.delete(key);
      void extractArchive(pool, root, documentId, userId, { id, destinationId, isShared, preview })
        .catch(error => {
          if (errors.size >= 32) errors.delete(errors.keys().next().value!);
          errors.set(key, error instanceof ImportError ? error.message : 'Archive extraction was interrupted. Retry to continue.');
        }).finally(() => { active = undefined; });
    }
    res.status(202).json({ id });
  });
  router.get('/archive-status/:id', async (req, res) => {
    if (!pool) throw new ImportError(503, 'Archive imports require PostgreSQL.');
    const userId = req.session.user!.id;
    const id = String(req.params.id);
    const running = active?.id === id && active.userId === userId;
    const result = await report(pool, id, userId).catch(error => {
      if (error instanceof ImportError && error.status === 404) return undefined;
      throw error;
    });
    res.json({ running, report: result, error: errors.get(userId + '/' + id) });
  });
  router.get('/', async (req, res) => {
    if (!pool) throw new ImportError(503, 'Resumable imports require PostgreSQL.');
    const { rows } = await pool.query(`SELECT b.id,b.created_at AS "createdAt",b.cancelled_at IS NOT NULL AS cancelled,
      count(i.id)::int AS total,count(i.id) FILTER (WHERE i.status IN ('uploaded','skipped'))::int AS complete
      FROM knowledge_imports b LEFT JOIN knowledge_import_items i ON b.id=i.import_id
      WHERE b.user_id=$1 GROUP BY b.id ORDER BY b.created_at DESC LIMIT 30`, [req.session.user!.id]);
    res.json({ imports: rows });
  });
  router.post('/', async (req, res) => {
    if (!pool) throw new ImportError(503, 'Resumable imports require PostgreSQL.');
    const manifest = validateManifest(req.body);
    const userId = req.session.user!.id;
    await saveManifest(pool, manifest, userId);
    res.status(201).json(await report(pool, manifest.id, userId));
  });
  router.get('/:id', async (req, res) => {
    if (!pool) throw new ImportError(503, 'Resumable imports require PostgreSQL.');
    res.json(await report(pool, String(req.params.id), req.session.user!.id));
  });
  router.post('/:id/cancel', async (req, res) => {
    if (!pool) throw new ImportError(503, 'Resumable imports require PostgreSQL.');
    const id = String(req.params.id);
    const userId = req.session.user!.id;
    await owned(pool, id, userId);
    await pool.query('UPDATE knowledge_imports SET cancelled_at=coalesce(cancelled_at,now()) WHERE id=$1 AND user_id=$2', [id, userId]);
    res.json(await report(pool, id, userId));
  });
  router.put('/:id/items/:item', async (req, res) => {
    if (!pool) throw new ImportError(503, 'Resumable imports require PostgreSQL.');
    const userId = req.session.user!.id;
    const id = String(req.params.id);
    const itemId = String(req.params.item);
    if (!uuid.test(itemId)) throw new ImportError(404, 'Import item not found.');
    if (!req.is('application/octet-stream')) throw new ImportError(400, 'Send file bytes as application/octet-stream.');
    const db = await pool.connect();
    let slot: string | undefined;
    let itemLocked = false;
    let staging: string | undefined;
    let claimed = false;
    let documentId: string | null = null;
    async function lock(key: string) {
      return (await db.query('SELECT pg_try_advisory_lock(760082,hashtext($1)) AS acquired', [key])).rows[0].acquired;
    }
    try {
      const batch = await owned(db, id, userId);
      if (batch.source_archive_id) throw new ImportError(409, 'Resume this import from the original archive preview.');
      const { rows: [item] } = await db.query('SELECT * FROM knowledge_import_items WHERE id=$1 AND import_id=$2', [itemId, id]);
      if (!item) throw new ImportError(404, 'Import item not found.');
      if (item.status === 'uploaded' || item.status === 'skipped') {
        req.resume();
        res.json({ status: item.status });
        return;
      }
      if (batch.cancelled_at) throw new ImportError(409, 'This import was cancelled.');
      itemLocked = await lock(itemId);
      if (!itemLocked) throw new ImportError(409, 'This file is already uploading.');
      const { rows: [latest] } = await db.query('SELECT status FROM knowledge_import_items WHERE id=$1', [itemId]);
      if (latest?.status === 'uploaded' || latest?.status === 'skipped') {
        req.resume();
        res.json({ status: latest.status });
        return;
      }
      for (const index of [0, 1]) {
        const candidate = `${id}:slot:${index}`;
        if (await lock(candidate)) { slot = candidate; break; }
      }
      if (!slot) throw new ImportError(429, 'Two files are already uploading for this import.');
      await transaction(db, async () => {
        const shared = await destination(db, batch.destination_id, userId, batch.is_shared, batch.had_destination);
        if (shared !== batch.is_shared) throw new ImportError(409, 'The destination visibility changed. Start a new import.');
      });
      claimed = true;
      const size = Number(item.size_bytes);
      if (req.header('content-length') !== undefined && Number(req.header('content-length')) !== size) {
        throw new ImportError(400, 'The selected file size does not match this import.');
      }
      const directory = resolve(root, '.imports');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      staging = resolve(directory, randomUUID());
      req.setTimeout(60000, () => req.destroy());
      const digest = await receive(req, staging, size);
      documentId = await transaction(db, async () => {
        await db.query('SELECT pg_advisory_xact_lock(760081, 1)');
        const current = await owned(db, id, userId, true);
        return commitFile(db, root, staging!, current, item, digest, userId);
      });
    } catch (error) {
      if (claimed) await db.query("UPDATE knowledge_import_items SET status='failed',error=$2 WHERE id=$1 AND status IN ('pending','failed')",
        [itemId, error instanceof ImportError ? error.message : 'The upload was interrupted or could not be saved.']).catch(() => {});
      throw error;
    } finally {
      if (staging) await unlink(staging).catch(() => {});
      let failed = false;
      for (const key of [slot, itemLocked ? itemId : undefined]) {
        if (key) await db.query('SELECT pg_advisory_unlock(760082,hashtext($1))', [key]).catch(() => { failed = true; });
      }
      db.release(failed);
    }
    if (documentId) {
      const document = await repository.getDocumentById(documentId);
      if (document?.status === 'indexing') void enqueueKnowledgeIngestion(document, root);
    }
    res.json({ status: documentId ? 'uploaded' : 'skipped' });
  });
  router.use((error: unknown, req: Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (!(error instanceof ImportError)) { next(error); return; }
    req.resume();
    res.status(error.status).json({ error: { code: 'knowledge_import', message: error.message } });
  });
  return router;
}
