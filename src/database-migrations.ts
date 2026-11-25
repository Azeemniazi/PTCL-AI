import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';

const migrations = [
  '001_init.sql',
  '002_auth_users.sql',
  '003_scalability_and_indexes.sql',
  '004_knowledge_hub.sql',
  '005_trigram_knowledge_search.sql',
  '006_image_studio.sql',
  '007_knowledge_rag_chunks.sql',
  '008_secure_knowledge_rls.sql',
  '012_knowledge_imports.sql',
  '013_knowledge_index_errors.sql',
  '014_workspace_notifications.sql',
  '015_knowledge_filing.sql'
];

export async function runDatabaseMigrations(pool: Pool) {
  for (const file of migrations) {
    const sql = await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8');
    await pool.query(sql);
  }
}
