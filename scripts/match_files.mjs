import { repository } from '../build/repository.js';
import fs from 'fs';
import path from 'path';

const BASE_DIR = "D:\\PTCL-TECH Fatima\\Product Portfolio";

function getAllFiles(dir, all = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      getAllFiles(full, all);
    } else {
      all.push({
        fullPath: full,
        filename: e.name,
        size: fs.statSync(full).size
      });
    }
  }
  return all;
}

async function main() {
  process.env.DATABASE_URL = "postgresql://postgres.ickwifhjjcwutxshpwxl:Fatimaniazi1.@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
  await repository.init();
  const pool = repository['pool'];
  const res = await pool.query("SELECT id, filename, size_bytes, storage_path FROM knowledge_documents");
  const localFiles = getAllFiles(BASE_DIR);

  console.log(`DB Documents: ${res.rows.length}`);
  console.log(`Local Files in Portfolio: ${localFiles.length}`);

  let matched = 0;
  let unmatched = 0;
  const matchMap = [];

  for (const doc of res.rows) {
    // try exact filename match
    const candidates = localFiles.filter(f => f.filename.toLowerCase() === doc.filename.toLowerCase());
    let best = candidates[0];
    if (candidates.length > 1) {
      // try matching size
      const exactSize = candidates.find(c => Math.abs(c.size - doc.size_bytes) < 100);
      if (exactSize) best = exactSize;
    }

    if (best) {
      matched++;
      matchMap.push({
        docId: doc.id,
        filename: doc.filename,
        storagePath: doc.storage_path,
        sourceFile: best.fullPath,
        size: best.size,
        expectedSize: doc.size_bytes
      });
    } else {
      unmatched++;
      console.log(`MISSING: "${doc.filename}" (size: ${doc.size_bytes}, storage_path: ${doc.storage_path})`);
    }
  }

  console.log(`\nMatched: ${matched}/${res.rows.length} documents.`);
  fs.writeFileSync('scripts/matches.json', JSON.stringify(matchMap, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
