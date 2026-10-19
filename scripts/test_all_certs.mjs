import pg from 'pg';
import { execSync } from 'child_process';
import { resolve } from 'path';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const res = await pool.query(
  "SELECT d.id, d.filename, d.storage_path FROM knowledge_documents d JOIN knowledge_folders f ON d.folder_id = f.id WHERE f.name = 'Datacenter Certifications' ORDER BY d.filename"
);

for (const row of res.rows) {
  const filePath = resolve(process.cwd(), 'data/knowledge', row.storage_path);
  try {
    const text = execSync(`pdftotext "${filePath}" -`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    console.log(`✅ ${row.filename}: ${text.trim().length} chars`);
    console.log('   Preview:', text.trim().replace(/\s+/g, ' ').slice(0, 150));
  } catch (err) {
    console.log(`❌ ${row.filename}: ${err.message}`);
  }
}
await pool.end();
