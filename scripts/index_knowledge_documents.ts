import { repository } from '../src/repository.js';
import { indexDocumentChunks } from '../src/rag.js';

async function main() {
  console.log('Connecting to database and fetching documents for indexing...');
  await repository.init();

  const unindexed = await repository.getUnindexedDocuments(200);
  console.log(`Found ${unindexed.length} unindexed documents in Knowledge Hub.`);

  let totalChunks = 0;
  for (let i = 0; i < unindexed.length; i++) {
    const doc = unindexed[i]!;
    console.log(`[${i + 1}/${unindexed.length}] Indexing: "${doc.filename}" (${(doc.extractedText || '').length} chars)...`);
    try {
      const count = await indexDocumentChunks(doc);
      console.log(`  -> Generated and stored ${count} chunks with vector embeddings.`);
      totalChunks += count;
    } catch (err: any) {
      console.error(`  -> Failed to index "${doc.filename}":`, err?.message || err);
    }
  }

  console.log(`\nIndexing completed! Total documents indexed: ${unindexed.length}, total chunks stored: ${totalChunks}`);
  await repository.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Indexing failed:', err);
  process.exit(1);
});
