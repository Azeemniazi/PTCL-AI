import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pino from 'pino';
import { repository } from './repository.js';
import { extractDocumentText } from './parsers.js';
import { sourceTextQuality } from './rag-planning.js';
import { extractDocumentImageOcr, indexDocumentChunks } from './rag.js';
import { extractKnowledgePdf, extractLocalPdfPage, KnowledgePdfError } from './knowledge-pdf.js';
import type { KnowledgeDocument } from './models.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const jobs = new Map<string, Promise<void>>();
let queue: Promise<void> = Promise.resolve();

/** Original and indexing status are persisted before acknowledging upload. */
export function enqueueKnowledgeIngestion(document: KnowledgeDocument, storageRoot: string): Promise<void> {
  const existing = jobs.get(document.id);
  if (existing) return existing;
  const job = queue.catch(() => {}).then(async () => {
    let reason = 'The original could not be read. Check that it can be downloaded and retry.';
    try {
      if (!await repository.getDocumentById(document.id)) return;
      const path = resolve(storageRoot, document.storagePath);
      const file = await open(path, 'r');
      const header = Buffer.alloc(5);
      try { await file.read(header, 0, header.length, 0); }
      finally { await file.close(); }
      reason = 'Readable text could not be extracted. Check the original and retry.';
      let text: string;
      if (/\.pdf$/i.test(document.filename) || header.toString('ascii') === '%PDF-') {
        text = await extractKnowledgePdf(path, async image => {
          const local = await extractLocalPdfPage(image);
          return local || extractDocumentImageOcr(await readFile(image), 'image/png');
        });
      } else {
        const bytes = await readFile(path);
        text = extractDocumentText(document.filename, bytes);
        if (!sourceTextQuality(text).usable && /^image\//.test(document.mimeType)) {
          text = await extractDocumentImageOcr(bytes, document.mimeType);
        }
      }
      if (!sourceTextQuality(text).usable) throw new Error('No complete readable extraction was obtained');
      if (!await repository.getDocumentById(document.id)) return;
      await repository.setDocumentExtractedText(document.id, text);
      reason = 'Text was extracted but the search index could not be built. Retry indexing.';
      await indexDocumentChunks({ ...document, extractedText: text });
    } catch (error) {
      await repository.setDocumentIndexStatus(document.id, 'failed', error instanceof KnowledgePdfError ? error.message : reason).catch(() => {});
      logger.warn({ documentId: document.id, error: error instanceof Error ? error.message : String(error) }, 'Knowledge ingestion failed');
    }
  }).finally(() => { jobs.delete(document.id); });
  jobs.set(document.id, job);
  queue = job;
  return job;
}

export async function resumeKnowledgeIngestion(storageRoot: string): Promise<void> {
  for (const doc of await repository.getPendingKnowledgeDocuments()) await enqueueKnowledgeIngestion(doc, storageRoot);
}
