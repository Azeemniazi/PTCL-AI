import { chunkText, isValidEmbedding, assertChunkCoverage } from './rag-core.js';
import { config } from './config.js';
import { selectKnowledgeDocuments, sourceTextQuality } from './rag-planning.js';
import { certificateAnswer, missingAmountAnswer } from './rag-facts.js';
import { packEvidence, evidenceMessage, type EvidenceSource } from './rag-evidence.js';
import type { KnowledgeChunk, RetrievedChunk } from './models.js';
import { repository } from './repository.js';
import pino from 'pino';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
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
 * Preserves exact decimals, IPs, versions, and markdown tables.
 */
export { chunkText } from './rag-core.js';

/**
 * Fetch dense embedding vector (2560 dimensions) from local Qwen3-Embedding service.
 */
export async function generateEmbedding(input: string): Promise<number[] | null> {
  if (!input.trim() || input.length > 16000) return null;
  const url = `${config.ai.embeddingUrl.replace(/\/v1$/, '')}/v1/embeddings`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn({ status: res.status, err }, 'Embedding generation failed');
      return null;
    }
    const data: any = await res.json();
    const vec = data?.data?.[0]?.embedding;
    return isValidEmbedding(vec) ? vec : null;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Embedding request error');
    return null;
  }
}

/**
 * Batch generate embeddings for document chunks using native array batching.
 */
export async function generateBatchEmbeddings(inputs: string[], batchSize = 3): Promise<Array<number[] | null>> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 64) throw new RangeError('batchSize must be between 1 and 64.');
  const results: Array<number[] | null> = new Array(inputs.length).fill(null);
  const url = `${config.ai.embeddingUrl.replace(/\/v1$/, '')}/v1/embeddings`;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const positions = batch.map((text, index) => ({ text, index })).filter(item => item.text.trim() && item.text.length <= 16000);
    if (!positions.length) continue;
    let canRetrySingles = false;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: positions.map(item => item.text) }),
        signal: AbortSignal.timeout(90000)
      });
      if (res.ok) {
        const data: any = await res.json();
        const rawItems = Array.isArray(data?.data) ? data.data : [];
        const seen = new Set<number>();
        for (const item of rawItems) {
          const idx = item?.index;
          if (!Number.isInteger(idx) || idx < 0 || idx >= positions.length) continue;
          const target = i + positions[idx]!.index;
          if (seen.has(idx)) { results[target] = null; continue; }
          seen.add(idx);
          results[target] = isValidEmbedding(item.embedding) ? item.embedding : null;
        }
        canRetrySingles = true;
      } else if (res.status === 400 || res.status === 413) {
        // Some compatible services accept only scalar input. Do not multiply
        // requests during outages, rate limiting, or timeouts.
        canRetrySingles = true;
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Batch embedding request failed');
    }
    if (canRetrySingles) {
      for (const item of positions) {
        if (results[i + item.index] === null) results[i + item.index] = await generateEmbedding(item.text);
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
): Promise<Array<{ index: number; relevanceScore: number; evaluated?: boolean; serviceFailed?: boolean }>> {
  if (!documents.length) return [];

  const cappedDocs = documents.slice(0, 16);
  const url = `${config.ai.rerankerUrl}/v1/rerank`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.slice(0, 400),
        documents: cappedDocs.map(d => d.slice(0, 2500))
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn({ status: res.status, err }, 'Reranker request failed');
      return documents.map((_, index) => ({ index, relevanceScore: 0, serviceFailed: true }));
    }

    const data: any = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) {
      return documents.map((_, index) => ({ index, relevanceScore: 0, serviceFailed: true }));
    }

    const scoredMap = new Map<number, number>();
    for (const r of results) {
      scoredMap.set(Number(r.index), Number(r.relevance_score ?? r.score ?? 0));
    }

    return documents.map((_, index) => ({
      index,
      relevanceScore: scoredMap.has(index) ? scoredMap.get(index)! : 0,
      evaluated: scoredMap.has(index)
    }));
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Reranker service error');
    return documents.map((_, index) => ({ index, relevanceScore: 0, serviceFailed: true }));
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
    if(data?.choices?.[0]?.finish_reason==='length')throw new Error('OCR output was truncated');
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Vision OCR error');
    return '';
  }
}

/**
 * Render PDF pages to high-resolution PNGs and transcribe via Qwen3-VL 30B multimodal vision.
 */
export async function extractPdfOcr(pdfBuffer: Buffer, maxPages = 50): Promise<string> {
  const workdir=mkdtempSync(join(tmpdir(),'cloudcore-ocr-'));
  const tempPdf = join(workdir,'source.pdf');
  const tempPrefix = join(workdir,'page');
  try {
    writeFileSync(tempPdf, pdfBuffer);
    const info=execFileSync('pdfinfo',[tempPdf],{encoding:'utf8',timeout:10000});
    const pages=Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
    if(!Number.isInteger(pages)||pages<1||pages>maxPages)throw new Error(`OCR requires 1-${maxPages} pages; no partial index will be published`);
    execFileSync('pdftoppm',['-png','-r','120',tempPdf,tempPrefix],{timeout:60000});
    const rendered=readdirSync(workdir).filter(name=>/^page-\d+\.png$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)![0])-Number(b.match(/\d+/)![0]));
    if(rendered.length!==pages)throw new Error('PDF rendering did not produce every page');
    const ocrPages: string[] = [];
    for (const [index,name] of rendered.entries()) {
      const pagePath=join(workdir,name);
          const pageBuffer = readFileSync(pagePath);
          const pageText = await extractDocumentImageOcr(pageBuffer, 'image/png');
          if(!sourceTextQuality(pageText).usable)throw new Error(`OCR failed for page ${index+1}`);
          ocrPages.push(`--- Page ${index+1} ---\n${pageText.trim()}`);
    }
    return ocrPages.join('\n\n');
  } catch (err) {
    logger.warn({ error: String(err) }, 'PDF OCR rendering failed');
    return '';
  } finally {
    rmSync(workdir,{recursive:true,force:true});
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
  sourceId?: string;
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
  sources?: EvidenceSource[];
  directAnswer?: string;
  coverage?: 'complete'|'excerpts'|'none';
}

export async function retrieveKnowledgeContext(userId:string,query:string,options?:RetrievalOptions):Promise<RetrievalResult>{
  const catalog=await repository.listKnowledgeSources(userId,options?.scope);
  const ready=catalog.filter(d=>d.status==='ready');
  const selection=selectKnowledgeDocuments(ready,query,Boolean(options?.scope&&options.scope.mode!=='all'));
  let documents=selection.documents;
  if(!documents.length){
    const legacy=await retrieveHybridKnowledgeContext(userId,query,options);
    const ids=new Set(legacy.citations.map(c=>c.documentId));
    documents=ready.filter(d=>ids.has(d.id)&&sourceTextQuality(d.extractedText??'').usable);
  }
  if(!documents.length)return {contextBlock:'',citations:[],sources:[],coverage:'none'};
  const factual=certificateAnswer(documents,query,new Date().toISOString().slice(0,10))??missingAmountAnswer(documents,query);
  if(factual)documents=factual.documents;
  const sources=packEvidence(documents,query);
  const citations=sources.map(s=>({sourceId:s.sourceId,documentId:s.documentId,filename:s.filename,chunkIndex:0,score:0,preview:s.text.slice(0,240)}));
  return {contextBlock:evidenceMessage(sources),sources,citations,directAnswer:factual?.answer,coverage:sources.every(s=>s.complete)?'complete':'excerpts'};
}

/**
 * Enterprise Hybrid Retrieval Pipeline:
 * 1. Generates dense query vector via Qwen3-Embedding (2560d).
 * 2. Executes hybrid dense vector (<=> cosine) + lexical trigram (pg_trgm) search in PostgreSQL.
 * 3. Reranks candidate pool using Qwen3-Reranker cross-encoder.
 * 4. Filters out irrelevant chunks (< minScoreThreshold).
 * 5. Constructs grounded context block with exact document citations.
 */
async function retrieveHybridKnowledgeContext(
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
  const rerankerFailed = rerankedScores.some(r => r.serviceFailed);

  // Map scores back to candidate chunks:
  // - If reranker failed completely (outage), preserve candidate hybrid score
  // - If reranker evaluated the chunk, use exact cross-encoder score (respecting valid 0)
  // - If unevaluated, assign 0 so it cannot displace positive reranked evidence
  const scoredChunks = candidates
    .map((chunk, index) => {
      const reranked = rerankedScores.find(r => r.index === index);
      let score: number;
      if (rerankerFailed) {
        score = chunk.score ?? 0;
      } else if (reranked?.evaluated) {
        score = reranked.relevanceScore;
      } else {
        score = 0;
      }
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
const indexJobs=new Map<string,Promise<number>>();
let indexQueue:Promise<unknown>=Promise.resolve();
export function indexDocumentChunks(doc: { id: string; extractedText?: string; filename: string }): Promise<number> {
  const existing=indexJobs.get(doc.id);if(existing)return existing;
  const job=indexQueue.catch(()=>{}).then(async()=>{
    await repository.setDocumentIndexStatus(doc.id,'indexing');
    try{return await performDocumentIndex(doc);}catch(error){await repository.setDocumentIndexStatus(doc.id,'failed');throw error;}
  }).finally(()=>indexJobs.delete(doc.id));
  indexJobs.set(doc.id,job);indexQueue=job;return job;
}
async function performDocumentIndex(doc: { id: string; extractedText?: string; filename: string }): Promise<number> {
  const text = doc.extractedText?.trim();
  if (!text || !sourceTextQuality(text).usable) {
    await repository.setDocumentIndexStatus(doc.id,'failed');
    throw new Error('Document has no usable extracted text');
  }

  const splits = chunkText(text, 450, 80);
  assertChunkCoverage(text, splits);
  if (!splits.length) return 0;

  logger.info({ documentId: doc.id, filename: doc.filename, chunkCount: splits.length }, 'Indexing document chunks...');
  
  // Generate embeddings in batches of 6
  const contents = splits.map(s => s.content);
  const embeddings = await generateBatchEmbeddings(contents, 6);

  if (!embeddings.length || embeddings.some(e => e === null)) {
    throw new Error('Embedding generation failed or returned null for one or more chunks');
  }

  const chunksToInsert = splits.map((s, idx) => ({
    chunkIndex: s.chunkIndex,
    content: s.content,
    tokenCount: s.tokenCount,
    embedding: embeddings[idx] ?? null
  }));

  await repository.insertDocumentChunks(doc.id, chunksToInsert);
  await repository.setDocumentIndexStatus(doc.id,'ready');
  logger.info({ documentId: doc.id, filename: doc.filename, chunkCount: chunksToInsert.length }, 'Successfully indexed document chunks');
  return chunksToInsert.length;
}

/**
 * Background routine that indexes any unindexed documents in the database.
 */
export async function backfillUnindexedDocuments(): Promise<number> {
  try {
    let totalIndexed = 0;
    const attempted=new Set<string>();
    while (true) {
      const unindexed = await repository.getUnindexedDocuments(50);
      const pending=unindexed.filter(d=>!attempted.has(d.id));
      if (!pending.length) break;

      logger.info({ count: unindexed.length }, 'Found unindexed knowledge documents, starting background indexing...');
      for (const doc of pending) {
        attempted.add(doc.id);
        try {
          const count = await indexDocumentChunks(doc);
          totalIndexed += count;
        } catch (err) {
          await repository.setDocumentIndexStatus(doc.id,'failed');
          logger.warn({ documentId: doc.id, error: err instanceof Error ? err.message : String(err) }, 'Failed to index document');
        }
      }
      if (unindexed.length < 50) break;
    }
    logger.info({ totalIndexed }, 'Finished background indexing of knowledge documents');
    return totalIndexed;
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Backfill indexing error');
    return 0;
  }
}
