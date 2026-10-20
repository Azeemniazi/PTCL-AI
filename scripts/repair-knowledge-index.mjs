// Run on the application host with its existing .env. Originals never leave it.
// Use --apply only after reviewing --check. A private in-place backup is mandatory.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {extractDocumentText} from '../build/parsers.js';
import {sourceTextQuality} from '../build/rag-planning.js';
import {chunkText,assertChunkCoverage,isValidEmbedding} from '../build/rag-core.js';
import {generateBatchEmbeddings,extractPdfOcr} from '../build/rag.js';
const apply=process.argv.includes('--apply');
if(!apply&&!process.argv.includes('--check'))throw Error('Specify --check or --apply');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000,max:2});
const hash=value=>createHash('sha256').update(value).digest('hex');
try{
 const docs=(await pool.query('SELECT * FROM knowledge_documents ORDER BY id')).rows;
 const backup=resolve(process.env.RAG_BACKUP_DIR??'data/rag-backups',new Date().toISOString().replace(/[:.]/g,'-'));
 if(apply){mkdirSync(backup,{recursive:true,mode:0o700});writeFileSync(resolve(backup,'documents.json'),JSON.stringify(docs),{mode:0o600});const chunks=(await pool.query('SELECT * FROM knowledge_document_chunks ORDER BY document_id,chunk_index')).rows;writeFileSync(resolve(backup,'chunks.json'),JSON.stringify(chunks),{mode:0o600});console.log(JSON.stringify({backup,documents:docs.length,chunks:chunks.length}));}
 const report=[];
 for(const doc of docs){
   const path=isAbsolute(doc.storage_path)?doc.storage_path:resolve('data/knowledge',doc.storage_path);
   if(!existsSync(path))throw Error(`Original is missing for ${doc.id}; repair stopped`);
   const bytes=readFileSync(path);let text=extractDocumentText(doc.filename,bytes).replace(/\r\n/g,'\n').trim();
   if(!sourceTextQuality(text).usable&&/\.pdf$/i.test(doc.filename))text=await extractPdfOcr(bytes);
   const quality=sourceTextQuality(text);
   if(!quality.usable)throw Error(`Original ${doc.filename} requires OCR or manual review; no partial index published`);
   const chunks=chunkText(text,450,80);assertChunkCoverage(text,chunks);
   const existing=(await pool.query('SELECT chunk_index,content,embedding::text FROM knowledge_document_chunks WHERE document_id=$1 ORDER BY chunk_index',[doc.id])).rows;
   const unchanged=text===doc.extracted_text&&existing.length===chunks.length&&existing.every((c,i)=>c.chunk_index===i&&c.content===chunks[i].content&&c.embedding&&isValidEmbedding(JSON.parse(c.embedding)));
   const item={id:doc.id,filename:doc.filename,originalHash:hash(bytes),textHash:hash(text),oldCharacters:doc.extracted_text?.length??0,newCharacters:text.length,chunks:chunks.length,applied:false,unchanged};
   if(apply&&!unchanged){
     const embeddings=await generateBatchEmbeddings(chunks.map(c=>c.content),6);
     if(embeddings.length!==chunks.length||embeddings.some(v=>!isValidEmbedding(v)))throw Error(`Invalid embeddings for ${doc.filename}; existing index retained`);
     const client=await pool.connect();
     try{
       await client.query('BEGIN');
       const current=(await client.query('SELECT extracted_text,storage_path FROM knowledge_documents WHERE id=$1 FOR UPDATE',[doc.id])).rows[0];
       if(!current||current.extracted_text!==doc.extracted_text||current.storage_path!==doc.storage_path)throw Error('Source changed during repair; refusing to overwrite it');
       await client.query('DELETE FROM knowledge_document_chunks WHERE document_id=$1',[doc.id]);
       for(const [i,c] of chunks.entries())await client.query('INSERT INTO knowledge_document_chunks(id,document_id,chunk_index,content,token_count,embedding,created_at) VALUES($1,$2,$3,$4,$5,$6::vector,now())',[randomUUID(),doc.id,c.chunkIndex,c.content,c.tokenCount,JSON.stringify(embeddings[i])]);
       await client.query('UPDATE knowledge_documents SET extracted_text=$2,token_count=$3,status=$4,updated_at=now() WHERE id=$1',[doc.id,text,chunks.reduce((sum,c)=>sum+c.tokenCount,0),'ready']);
       await client.query('COMMIT');item.applied=true;
     }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   }
   report.push(item);console.log(JSON.stringify(item));
   if(apply)writeFileSync(resolve(backup,'repair-report.json'),JSON.stringify(report,null,2),{mode:0o600});
 }
 console.log(JSON.stringify({complete:true,apply,documents:report.length,chunks:report.reduce((n,r)=>n+r.chunks,0)}));
}finally{await pool.end();}
