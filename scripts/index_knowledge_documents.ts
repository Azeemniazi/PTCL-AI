import { repository } from '../src/repository.js';
import { generateEmbedding, indexDocumentChunks } from '../src/rag.js';

async function main() {
  console.log('Connecting to database...');
  await repository.init();
  const pool = (repository as any).pool;
  if (!pool) {
    console.error('No database pool available.');
    process.exit(1);
  }

  // First, check for unindexed documents
  const unindexed = await repository.getUnindexedDocuments(200);
  if (unindexed.length > 0) {
    console.log(`Found ${unindexed.length} unindexed documents, indexing them now...`);
    for (const doc of unindexed) {
      console.log(`Indexing document "${doc.filename}"...`);
      await indexDocumentChunks(doc);
    }
  }

  // Next, find any chunks that have NULL embeddings
  const missing = await pool.query(`
    SELECT c.id, c.content, d.filename
    FROM knowledge_document_chunks c
    JOIN knowledge_documents d ON c.document_id = d.id
    WHERE c.embedding IS NULL
    ORDER BY c.created_at ASC
  `);

  console.log(`Found ${missing.rows.length} chunks needing vector embeddings.`);
  for (let i = 0; i < missing.rows.length; i++) {
    const row = missing.rows[i];
    console.log(`[${i + 1}/${missing.rows.length}] Generating embedding for "${row.filename}" (${row.content.length} chars)...`);
    const vec = await generateEmbedding(row.content);
    if (vec && vec.length > 0) {
      await pool.query('UPDATE knowledge_document_chunks SET embedding = $1::vector WHERE id = $2', [`[${vec.join(',')}]`, row.id]);
      console.log('  -> Stored vector embedding in database.');
    } else {
      console.warn('  -> Failed to generate vector.');
    }
  }

  const finalCheck = await pool.query('SELECT count(*)::int as total_chunks, count(embedding)::int as with_embeddings FROM knowledge_document_chunks');
  console.log('\n🎉 Indexing finished! Status:', finalCheck.rows[0]);
  await repository.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Re-indexing error:', err);
  process.exit(1);
});
