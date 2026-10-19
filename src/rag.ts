import { config } from './config.js';
import type { KnowledgeChunk, RetrievedChunk } from './models.js';
import { repository } from './repository.js';
import pino from 'pino';

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

  const rawParagraphs = clean.split(/\n{2,}/);
  const paragraphs: string[] = [];

  for (const p of rawParagraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/);
    if (words.length > maxWords) {
      // Split large paragraph by sentences
      const sentences = trimmed.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [trimmed];
      let currentSentenceBlock = '';
      for (const s of sentences) {
        const sentenceWords = s.trim().split(/\s+/).length;
        const currentWords = currentSentenceBlock ? currentSentenceBlock.split(/\s+/).length : 0;
        if (currentWords + sentenceWords > maxWords && currentSentenceBlock) {
          paragraphs.push(currentSentenceBlock.trim());
          currentSentenceBlock = s;
        } else {
          currentSentenceBlock = currentSentenceBlock ? `${currentSentenceBlock} ${s}` : s;
        }
      }
      if (currentSentenceBlock.trim()) {
        paragraphs.push(currentSentenceBlock.trim());
      }
    } else {
      paragraphs.push(trimmed);
    }
  }

  const chunks: ChunkSplit[] = [];
  let currentWords: string[] = [];
  let currentText = '';

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    const pWords = p.split(/\s+/);

    if (currentWords.length + pWords.length <= maxWords) {
      currentWords.push(...pWords);
      currentText = currentText ? `${currentText}\n\n${p}` : p;
    } else {
      if (currentWords.length > 0) {
        chunks.push({
          chunkIndex: chunks.length,
          content: currentText.trim(),
          tokenCount: Math.ceil(currentWords.length * 1.3)
        });
      }

      // Calculate sliding overlap from previous chunk
      const overlapWords = currentWords.slice(-overlap);
      currentWords = [...overlapWords, ...pWords];
      currentText = overlapWords.length > 0
        ? `${overlapWords.join(' ')}\n\n${p}`
        : p;
    }
  }

  if (currentWords.length > 0 && currentText.trim()) {
    chunks.push({
      chunkIndex: chunks.length,
      content: currentText.trim(),
      tokenCount: Math.ceil(currentWords.length * 1.3)
    });
  }

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
    return data?.data?.[0]?.embedding ?? null;
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
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: batch }),
        signal: AbortSignal.timeout(90000)
      });
      if (res.ok) {
        const data: any = await res.json();
        const batchVectors = (data?.data ?? []).map((item: any) => item?.embedding ?? null);
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
 * Score candidate documents using local cross-encoder Qwen3-Reranker service.
 */
export async function rerankCandidates(
  query: string,
  documents: string[]
): Promise<Array<{ index: number; relevanceScore: number }>> {
  if (!documents.length) return [];
  const url = `${config.ai.rerankerUrl}/v1/rerank`;
  const cappedDocs = documents.slice(0, 8);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.slice(0, 1500),
        documents: cappedDocs.map(d => d.slice(0, 1500))
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn({ status: res.status, err }, 'Reranker request failed, falling back to initial scores');
      return documents.map((_, index) => ({ index, relevanceScore: 1 / (index + 1) }));
    }
    const data: any = await res.json();
    const results = data?.results ?? [];
    return results.map((r: any) => ({
      index: Number(r.index),
      relevanceScore: Number(r.relevance_score ?? r.score ?? 0)
    }));
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Reranker service error');
    return documents.map((_, index) => ({ index, relevanceScore: 1 / (index + 1) }));
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
  const topK = options?.topK ?? 4;
  const threshold = options?.minScoreThreshold ?? 0.05;

  const queryEmbedding = await generateEmbedding(query);
  const candidates: RetrievedChunk[] = await repository.searchChunksHybrid(
    userId,
    query,
    queryEmbedding ?? undefined,
    8,
    options?.scope
  );

  if (!candidates.length) {
    return { contextBlock: '', citations: [] };
  }

  // Stage 2: Cross-Encoder Reranking
  const candidateTexts = candidates.map(c => c.content);
  const rerankedScores = await rerankCandidates(query, candidateTexts);

  // Map scores back to candidate chunks
  const scoredChunks = rerankedScores
    .map(r => {
      const chunk = candidates[r.index];
      if (!chunk) return null;
      return {
        ...chunk,
        score: r.relevanceScore
      };
    })
    .filter((c): c is RetrievedChunk => c !== null)
    .sort((a, b) => b.score - a.score);

  // Filter by relevance threshold and take Top K
  const relevantChunks = scoredChunks.filter(c => c.score >= threshold).slice(0, topK);

  if (!relevantChunks.length) {
    return { contextBlock: '', citations: [] };
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
    'INSTRUCTION: Use the retrieved knowledge base sources above to answer the user query accurately and factually. Explicitly cite the source document name (e.g. "According to [Document Name]...") when stating facts, standards, or specifications from them. If the retrieved context does not contain the answer, politely state that the knowledge base does not contain that specific information.'
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
