import fs from 'fs';
import path from 'path';

const matches = JSON.parse(fs.readFileSync('scripts/matches.json', 'utf8'));
const localKnowledgeDir = path.resolve(process.cwd(), 'data/knowledge');
fs.mkdirSync(localKnowledgeDir, { recursive: true });

console.log(`Copying ${matches.length} files to local ${localKnowledgeDir}...`);
for (const m of matches) {
  const dest = path.resolve(localKnowledgeDir, m.storagePath);
  fs.copyFileSync(m.sourceFile, dest);
  const st = fs.statSync(dest);
  console.log(`Copied: ${m.filename} -> ${m.storagePath} (${st.size} bytes)`);
}

console.log("All files copied locally successfully!");
