import { repository } from '../build/repository.js';

const BASE = "http://127.0.0.1:4173";

async function main() {
  await repository.init();
  const pool = repository['pool'];
  const res = await pool.query("SELECT id, filename, storage_path FROM knowledge_documents");

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "CloudCoreAI" },
    body: JSON.stringify({ username: "azeemniazi", password: "fatimaarif" })
  });
  const cookie = loginRes.headers.get("set-cookie").split(";")[0];

  console.log(`Verifying preview/view status for all ${res.rows.length} documents on VM:`);
  let successCount = 0;
  for (const doc of res.rows) {
    const r = await fetch(`${BASE}/api/knowledge/documents/${doc.id}/view`, {
      headers: { cookie }
    });
    if (r.status === 200) {
      successCount++;
    } else {
      console.error(`FAILED: ${doc.filename} -> Status ${r.status}`);
    }
  }
  console.log(`\nResult: ${successCount}/${res.rows.length} documents verified HTTP 200 OK!`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
