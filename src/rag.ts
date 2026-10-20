import { config } from './config.js';
import type { KnowledgeChunk, RetrievedChunk } from './models.js';
import { repository } from './repository.js';
import pino from 'pino';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export interface ChunkSplit {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

/**
 * Smart recursive chunking algorithm: splits text into overlapping windows
 * respecting paragraph breaks, markdown sections, and sentence boundaries.
 */
export function chunkText(text: string, maxWords = 400, overlap = 80): ChunkSplit[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const safeOverlap = Math.max(0, Math.min(overlap, maxWords - 1));
  const rawParagraphs = clean.split(/\n{2,}/);
  const pieces: string[] = [];

  for (const p of rawParagraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [trimmed];
    for (const s of sentences) {
      const sTrim = s.trim();
      if (sTrim) pieces.push(sTrim);
    }
  }

  if (pieces.length === 0) return [];

  const chunks: ChunkSplit[] = [];
  let currentWords: string[] = [];
  let newWordsAdded = false;

  const emitChunk = () => {
    if (currentWords.length === 0 || !newWordsAdded) return;
    chunks.push({
      chunkIndex: chunks.length,
      content: currentWords.join(' '),
      tokenCount: Math.ceil(currentWords.length * 1.3)
    });
    newWordsAdded = false;
  };

  for (const piece of pieces) {
    let pWords = piece.split(/\s+/).filter(Boolean);
    while (pWords.length > 0) {
      const room = maxWords - currentWords.length;
      if (room <= 0) {
        emitChunk();
        currentWords = currentWords.slice(-safeOverlap);
        continue;
      }
      if (pWords.length <= room) {
        currentWords.push(...pWords);
        newWordsAdded = true;
        pWords = [];
      } else {
        currentWords.push(...pWords.slice(0, room));
        newWordsAdded = true;
        pWords = pWords.slice(room);
        emitChunk();
        currentWords = currentWords.slice(-safeOverlap);
      }
    }
  }

  emitChunk();
  return chunks;
}

/**
 * Fetch dense embedding vector (2560 dimensions) from local Qwen3-Embedding service.
 */
export async function generateEmbedding(input: string): Promise<number[] | null> {
  const url = `${config.ai.embeddingUrl}/v1/embeddings`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: input.slice(0, 16000) }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn({ status: res.status, err }, 'Embedding generation failed');
      return null;
    }
    const data: any = await res.json();
    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== 2560 || !vec.every((n: any) => typeof n === 'number' && Number.isFinite(n))) {
      return null;
    }
    return vec;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Embedding request error');
    return null;
  }
}

/**
 * Batch generate embeddings for document chunks using native array batching.
 */
export async function generateBatchEmbeddings(inputs: string[], batchSize = 3): Promise<Array<number[] | null>> {
  const results: Array<number[] | null> = [];
  const url = `${config.ai.embeddingUrl}/v1/embeddings`;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize).map(t => t.slice(0, 16000));
    const batchVectors: Array<number[] | null> = new Array(batch.length).fill(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: batch }),
        signal: AbortSignal.timeout(90000)
      });
      if (res.ok) {
        const data: any = await res.json();
        const rawItems = Array.isArray(data?.data) ? data.data : [];
        for (const item of rawItems) {
          const idx = typeof item?.index === 'number' ? item.index : -1;
          if (idx >= 0 && idx < batch.length) {
            const emb = item?.embedding;
            if (Array.isArray(emb) && emb.every((n: any) => typeof n === 'number' && Number.isFinite(n))) {
              batchVectors[idx] = emb;
            }
          }
        }
        results.push(...batchVectors);
      } else {
        for (const singleText of batch) {
          results.push(await generateEmbedding(singleText));
        }
      }
    } catch {
      for (const singleText of batch) {
        results.push(await generateEmbedding(singleText));
      }
    }
  }
  return results;
}

/**
 * Fast-path intent classifier: Determines whether a message genuinely needs
 * Knowledge Base RAG retrieval, avoiding multi-second reranker & DB latency on
 * basic greetings, casual chat, math, jokes, or generic questions.
 */
export function shouldQueryKnowledgeBase(
  query: string,
  scope?: { mode?: string; id?: string }
): boolean {
  if (!query || typeof query !== 'string') return false;
  const trimmed = query.trim();
  if (!trimmed) return false;

  // If user explicitly scoped to a folder or document, always query
  if (scope?.mode === 'folder' || scope?.mode === 'document') return true;

  const lower = trimmed.toLowerCase();

  // 1. Common greetings & pleasantries (Urdu, English, Roman Urdu) -> skip RAG
  if (/^(hi|hello|hey|heya|howdy|salam|assalam|aoa|hola|good\s*(morning|afternoon|evening|night|day)|kese\s*ho|kia\s*hal\s*hai|kaise\s*ho|kya\s*haal\s*hai)[.!?\s]*$/i.test(lower)) {
    return false;
  }

  // 2. Casual conversational inquiries -> skip RAG
  if (/^(how\s+are\s+you|who\s+are\s+you|what\s+is\s+your\s+name|who\s+(made|created|built)\s+you|what\s+can\s+you\s+do|tell\s+me\s+about\s+yourself|tell\s+me\s+a\s+joke|thank\s*(you|s)|thanks|ok|okay|bye|goodbye|cool|nice|awesome|great|test|testing|ping)[.!?\s]*$/i.test(lower)) {
    return false;
  }

  // 3. Simple math, time, jokes, coding prompts that don't reference enterprise data
  if (/^(what\s+is\s+\d+[\s\+\-\*\/]+\d+|what\s+time\s+is\s+it|write\s+(a\s+)?(python|javascript|code|script|function|poem|story))\b/i.test(lower)) {
    return false;
  }

  // 4. Strong enterprise / document signals -> definitely query RAG
  const enterpriseKeywords = /\b(ptcl|smart\s*cloud|luna|datacenter|data\s*center|certifications?|standards?|iso|pci|dss|tia|tier|rated|cloud|iaas|paas|saas|backup|disaster\s*recovery|dr|sla|colocation|hosting|server|storage|vcloud|vmware|openstack|network|firewall|cybersecurity|compliance|audit|security|governance|policy|guideline|contract|proposal|agreement|specification|hardware|rack|power|ups|h9|cddt|garden\s*town|marston|misrishah|satellite\s*town|karachi|lahore|islamabad|rawalpindi|document|file|folder|upload|summary|summarize)\b/i;
  if (enterpriseKeywords.test(lower)) {
    return true;
  }

  // 5. Short follow-up questions ending with ? or query intent (e.g. "Pricing?", "Why?")
  if (trimmed.endsWith('?') || /\b(pricing|cost|price|fee|rate|why|how|what|where|when|which|who|limit|terms)\b/i.test(lower)) {
    return true;
  }

  // 6. Short non-question statements (<= 2 words) without enterprise keywords -> skip RAG
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 2) {
    return false;
  }

  return true;
}

/**
 * Score candidate documents using local cross-encoder Qwen3-Reranker service.
 * Evaluates top 4 snippets (<= 350 chars each) for sub-second CPU cross-attention.
 */
export async function rerankCandidates(
  query: string,
  documents: string[]
): Promise<Array<{ index: number; relevanceScore: number }>> {
  if (!documents.length) return [];

  const cappedDocs = documents.slice(0, 4);
  const url = `${config.ai.rerankerUrl}/v1/rerank`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.slice(0, 400),
        documents: cappedDocs.map(d => d.slice(0, 350))
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn({ status: res.status, err }, 'Reranker request failed');
      return documents.map((_, index) => ({ index, relevanceScore: 0 }));
    }

    const data: any = await res.json();
    const results = data?.results ?? [];
    const scoredMap = new Map<number, number>();
    for (const r of results) {
      scoredMap.set(Number(r.index), Number(r.relevance_score ?? r.score ?? 0));
    }

    return documents.map((_, index) => ({
      index,
      relevanceScore: scoredMap.has(index) ? scoredMap.get(index)! : 0
    }));
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Reranker service error');
    return documents.map((_, index) => ({ index, relevanceScore: 0 }));
  }
}

/**
 * Transcribe scanned document image or diagram using Qwen3-VL 30B multimodal vision model on port 8000.
 */
export async function extractDocumentImageOcr(
  imageBuffer: Buffer,
  mimeType = 'image/png'
): Promise<string> {
  const url = `${config.ai.baseUrl}/chat/completions`;
  const base64Data = imageBuffer.toString('base64');
  const prompt = 'Transcribe this document page verbatim into clean Markdown. Preserve all table structures as Markdown pipe tables (| header | ... |), section headers (#, ##), and bullet lists. Do not summarize; extract all legible text with high precision.';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ai.momModel || 'qwen-30b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn({ status: res.status, err }, 'Vision OCR request failed');
      return '';
    }
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Vision OCR error');
    return '';
  }
}

/**
 * Render PDF pages to high-resolution PNGs and transcribe via Qwen3-VL 30B multimodal vision.
 */
export async function extractPdfOcr(pdfBuffer: Buffer, maxPages = 3): Promise<string> {
  const tempId = randomUUID();
  const tempPdf = join(tmpdir(), `ocr_${tempId}.pdf`);
  const tempPrefix = join(tmpdir(), `page_${tempId}`);
  try {
    writeFileSync(tempPdf, pdfBuffer);
    execSync(`pdftoppm -png -r 150 -f 1 -l ${maxPages} "${tempPdf}" "${tempPrefix}"`, {
      timeout: 25000
    });
    const ocrPages: string[] = [];
    for (let p = 1; p <= maxPages; p++) {
      const pagePath = `${tempPrefix}-${p}.png`;
      if (existsSync(pagePath)) {
        try {
          const pageBuffer = readFileSync(pagePath);
          const pageText = await extractDocumentImageOcr(pageBuffer, 'image/png');
          if (pageText && pageText.trim()) {
            ocrPages.push(`--- Page ${p} ---\n${pageText.trim()}`);
          }
        } finally {
          try { unlinkSync(pagePath); } catch {}
        }
      }
    }
    return ocrPages.join('\n\n');
  } catch (err) {
    logger.warn({ error: String(err) }, 'PDF OCR rendering failed');
    return '';
  } finally {
    try { unlinkSync(tempPdf); } catch {}
  }
}

export interface RetrievalOptions {
  scope?: {
    mode: 'all' | 'folder' | 'document';
    id?: string;
  };
  topK?: number;
  minScoreThreshold?: number;
}

export interface CitationItem {
  documentId: string;
  filename: string;
  folderName?: string;
  chunkIndex: number;
  score: number;
  preview: string;
}

export interface RetrievalResult {
  contextBlock: string;
  citations: CitationItem[];
}

/**
 * Enterprise Hybrid Retrieval Pipeline:
 * 1. Generates dense query vector via Qwen3-Embedding (2560d).
 * 2. Executes hybrid dense vector (<=> cosine) + lexical trigram (pg_trgm) search in PostgreSQL.
 * 3. Reranks candidate pool using Qwen3-Reranker cross-encoder.
 * 4. Filters out irrelevant chunks (< minScoreThreshold).
 * 5. Constructs grounded context block with exact document citations.
 */
export async function retrieveKnowledgeContext(
  userId: string,
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult> {
  const isBroadQuery = /\b(all|every|list|certifications?|standards?|audit|facilities|datacenter|data\s*center|overview|summary|what\s+are)\b/i.test(query) || options?.scope?.mode === 'folder';
  const candidatePoolSize = isBroadQuery ? 16 : 8;
  const effectiveTopK = isBroadQuery ? Math.max(options?.topK ?? 4, 6) : (options?.topK ?? 4);
  const threshold = options?.minScoreThreshold ?? 0.05;

  const queryEmbedding = await generateEmbedding(query);
  const candidates: RetrievedChunk[] = await repository.searchChunksHybrid(
    userId,
    query,
    queryEmbedding ?? undefined,
    candidatePoolSize,
    options?.scope
  );

  if (!candidates.length) {
    return { contextBlock: '', citations: [] };
  }

  // Stage 2: Cross-Encoder Reranking
  const candidateTexts = candidates.map(c => c.content);
  const rerankedScores = await rerankCandidates(query, candidateTexts);

  // Map scores back to candidate chunks: prefer cross-encoder rerank score if > 0, otherwise retain initial search score
  const scoredChunks = candidates
    .map((chunk, index) => {
      const reranked = rerankedScores.find(r => r.index === index);
      const score = (reranked && typeof reranked.relevanceScore === 'number' && reranked.relevanceScore > 0)
        ? reranked.relevanceScore
        : (chunk.score ?? 0);
      return {
        ...chunk,
        score
      };
    })
    .filter((c): c is RetrievedChunk => c.score >= threshold)
    .sort((a, b) => b.score - a.score);

  if (!scoredChunks.length) {
    return { contextBlock: '', citations: [] };
  }

  // Diversity selection: ensure every relevant document gets represented before multiple chunks from the same doc
  const relevantChunks: RetrievedChunk[] = [];
  const seenDocIds = new Set<string>();

  // Pass 1: Add highest-scoring chunk from each unique document
  for (const chunk of scoredChunks) {
    if (!seenDocIds.has(chunk.documentId)) {
      relevantChunks.push(chunk);
      seenDocIds.add(chunk.documentId);
      if (relevantChunks.length >= effectiveTopK) break;
    }
  }

  // Pass 2: If we still have slots under effectiveTopK, fill with secondary chunks
  if (relevantChunks.length < effectiveTopK) {
    for (const chunk of scoredChunks) {
      if (!relevantChunks.some(c => c.id === chunk.id)) {
        relevantChunks.push(chunk);
        if (relevantChunks.length >= effectiveTopK) break;
      }
    }
  }

  // Format Grounded Knowledge Context Block
  const contextParts: string[] = [
    '=== KNOWLEDGE BASE CONTEXT (Retrieved from authorized CloudCore enterprise documents) ==='
  ];

  const citations: CitationItem[] = [];

  for (let i = 0; i < relevantChunks.length; i++) {
    const chunk = relevantChunks[i]!;
    const sourceLabel = chunk.folderName
      ? `${chunk.folderName}/${chunk.filename}`
      : chunk.filename;

    contextParts.push(
      `[Source ${i + 1}: "${sourceLabel}" | Relevance: ${(chunk.score * 100).toFixed(1)}%]\n"""\n${chunk.content}\n"""`
    );

    citations.push({
      documentId: chunk.documentId,
      filename: chunk.filename,
      folderName: chunk.folderName,
      chunkIndex: chunk.chunkIndex,
      score: Math.round(chunk.score * 100) / 100,
      preview: chunk.content.slice(0, 240).replace(/\s+/g, ' ') + '...'
    });
  }

  contextParts.push('=== END KNOWLEDGE BASE CONTEXT ===');
  contextParts.push(
    'INSTRUCTION: Use the retrieved knowledge base sources above to answer the user query accurately and factually. Explicitly cite the source document name (e.g. "According to [Document Name]...") when stating facts, standards, or specifications from them. Provide a comprehensive, complete answer covering all relevant sources. If the retrieved context does not contain the answer, politely state that the knowledge base does not contain that specific information.'
  );

  return {
    contextBlock: contextParts.join('\n\n'),
    citations
  };
}

/**
 * Chunks a knowledge document, generates embeddings via Qwen3-Embedding,
 * and saves chunks into the database.
 */
export async function indexDocumentChunks(doc: { id: string; extractedText?: string; filename: string }): Promise<number> {
  const text = doc.extractedText?.trim();
  if (!text) return 0;

  const splits = chunkText(text, 450, 80);
  if (!splits.length) return 0;

  logger.info({ documentId: doc.id, filename: doc.filename, chunkCount: splits.length }, 'Indexing document chunks...');
  
  // Generate embeddings in batches of 6
  const contents = splits.map(s => s.content);
  const embeddings = await generateBatchEmbeddings(contents, 6);

  if (!embeddings.length || embeddings.every(e => e === null)) {
    throw new Error('Embedding generation failed or returned empty results for all chunks');
  }

  const chunksToInsert = splits.map((s, idx) => ({
    chunkIndex: s.chunkIndex,
    content: s.content,
    tokenCount: s.tokenCount,
    embedding: embeddings[idx] ?? null
  }));

  await repository.insertDocumentChunks(doc.id, chunksToInsert);
  logger.info({ documentId: doc.id, filename: doc.filename, chunkCount: chunksToInsert.length }, 'Successfully indexed document chunks');
  return chunksToInsert.length;
}

/**
 * Background routine that indexes any unindexed documents in the database.
 */
export async function backfillUnindexedDocuments(): Promise<number> {
  try {
    const unindexed = await repository.getUnindexedDocuments(50);
    if (!unindexed.length) return 0;

    logger.info({ count: unindexed.length }, 'Found unindexed knowledge documents, starting background indexing...');
    let totalIndexed = 0;
    for (const doc of unindexed) {
      try {
        const count = await indexDocumentChunks(doc);
        totalIndexed += count;
      } catch (err) {
        logger.warn({ documentId: doc.id, error: err instanceof Error ? err.message : String(err) }, 'Failed to index document');
      }
    }
    logger.info({ totalIndexed }, 'Finished background indexing of knowledge documents');
    return totalIndexed;
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Backfill indexing error');
    return 0;
  }
}
