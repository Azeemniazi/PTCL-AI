import { repository } from './build/repository.js';
import { retrieveKnowledgeContext } from './build/rag.js';

await repository.init();
const pool = repository.pool;
const userRes = await pool.query('SELECT id FROM users LIMIT 1');
const testUserId = userRes.rows[0]?.id;

for (const q of [
  'find me all datacenter certifications tell about them',
  'tell me about ISO certifications and PCI DSS for PTCL data centers'
]) {
  console.log(`\n========================================`);
  console.log(`Query: "${q}"`);
  console.log(`========================================`);
  const res = await retrieveKnowledgeContext(testUserId, q);
  console.log(`Retrieved ${res.citations.length} cited source documents:`);
  for (let i = 0; i < res.citations.length; i++) {
    const c = res.citations[i];
    console.log(`  ${i + 1}. [${c.folderName ? c.folderName + '/' : ''}${c.filename}] (Score: ${(c.score * 100).toFixed(1)}%)`);
  }
}
await repository.close();
