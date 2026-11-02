import { repository } from '../build/repository.js';

async function main() {
  await repository.init();
  const pool = repository['pool'];
  const res = await pool.query("SELECT id, filename, storage_path, length(extracted_text) as text_len, status, created_at FROM knowledge_documents WHERE filename LIKE '%27018%'");
  console.log('Doc info:', res.rows);
  if (res.rows[0]) {
    const chunks = await pool.query("SELECT count(*) as chunk_count FROM knowledge_document_chunks WHERE document_id = $1", [res.rows[0].id]);
    console.log('Chunks:', chunks.rows);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
