import { repository } from '../src/repository.js';
import { extractDocumentText } from '../src/parsers.js';
import { extractPdfOcr, indexDocumentChunks, retrieveKnowledgeContext } from '../src/rag.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  console.log('🚀 Initializing repository and connecting to Supabase database...');
  await repository.init();
  const pool = (repository as any).pool;
  if (!pool) {
    console.error('❌ Database connection pool is not available.');
    process.exit(1);
  }

  // 1. Fetch all documents in Datacenter Certifications folder plus any document with <= 50 chars of text
  const query = `
    SELECT d.id, d.filename, d.storage_path, length(d.extracted_text) as text_len, f.name as folder_name
    FROM knowledge_documents d
    LEFT JOIN knowledge_folders f ON d.folder_id = f.id
    WHERE f.name = 'Datacenter Certifications' OR d.extracted_text IS NULL OR length(d.extracted_text) < 50
    ORDER BY f.name NULLS LAST, d.filename ASC
  `;
  const res = await pool.query(query);
  console.log(`📋 Found ${res.rows.length} documents to inspect/re-index.`);

  const knowledgeDir = resolve(process.cwd(), 'data/knowledge');

  let successCount = 0;
  for (let i = 0; i < res.rows.length; i++) {
    const doc = res.rows[i];
    console.log(`\n[${i + 1}/${res.rows.length}] Processing "${doc.filename}" (Folder: ${doc.folder_name || 'root'})...`);
    const filePath = resolve(knowledgeDir, doc.storage_path);

    if (!existsSync(filePath)) {
      console.warn(`  ⚠️ File not found at storage path: ${filePath}`);
      continue;
    }

    const fileBytes = readFileSync(filePath);
    let newText = '';
    try {
      newText = extractDocumentText(doc.filename, fileBytes) || '';
    } catch (err: any) {
      console.warn(`  ⚠️ Parser error on ${doc.filename}:`, err.message);
    }

    // If text is still under 50 characters, invoke Vision OCR
    if (!newText || newText.trim().length < 50) {
      if (doc.filename.toLowerCase().endsWith('.pdf') || (fileBytes.length >= 5 && fileBytes.subarray(0, 5).toString('ascii') === '%PDF-')) {
        console.log('  🔍 Running Qwen3-VL Vision OCR on scanned PDF pages...');
        try {
          const ocrText = await extractPdfOcr(fileBytes, 3);
          if (ocrText && ocrText.trim()) {
            newText = ocrText.trim();
          }
        } catch (ocrErr: any) {
          console.warn('  ⚠️ Vision OCR fallback failed:', ocrErr.message);
        }
      }
    }

    const cleanText = newText.trim();
    if (!cleanText) {
      console.warn(`  ⚠️ Could not extract text for "${doc.filename}". Skipping.`);
      continue;
    }

    const tokenCount = Math.round(cleanText.split(/\s+/).filter(Boolean).length * 1.3);
    console.log(`  📄 Extracted ${cleanText.length} characters (~${tokenCount} tokens).`);

    // Update knowledge_documents record
    await pool.query(
      'UPDATE knowledge_documents SET extracted_text = $1, token_count = $2, updated_at = NOW() WHERE id = $3',
      [cleanText, tokenCount, doc.id]
    );

    // Delete stale chunks
    await pool.query('DELETE FROM knowledge_document_chunks WHERE document_id = $1', [doc.id]);

    // Re-index chunks with fresh dense embeddings
    const chunksCount = await indexDocumentChunks({
      id: doc.id,
      filename: doc.filename,
      extractedText: cleanText
    });
    console.log(`  ✅ Successfully indexed ${chunksCount} chunks with vector embeddings.`);
    successCount++;
  }

  console.log(`\n🎉 Re-indexing complete! Successfully re-indexed ${successCount} documents.`);

  // 2. Perform verification test query
  console.log('\n🔎 Running verification RAG query: "find me all datacenter certifications tell about them"...');
  const dummyUserId = '00000000-0000-0000-0000-000000000000'; // System check
  // Temporarily find a valid user or query with admin permissions
  const userRes = await pool.query('SELECT id FROM users LIMIT 1');
  const testUserId = userRes.rows[0]?.id || dummyUserId;

  const ragResult = await retrieveKnowledgeContext(testUserId, 'find me all datacenter certifications tell about them');
  console.log(`\n📊 Retrieved ${ragResult.citations.length} cited source chunks:`);
  for (const c of ragResult.citations) {
    console.log(`  - [${c.folderName ? c.folderName + '/' : ''}${c.filename}] (Relevance: ${(c.score * 100).toFixed(1)}%)`);
  }

  console.log('\n=== RETRIEVED CONTEXT SAMPLE (first 1000 chars) ===');
  console.log(ragResult.contextBlock.slice(0, 1000));
  console.log('...\n');

  await repository.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal re-indexing error:', err);
  process.exit(1);
});
