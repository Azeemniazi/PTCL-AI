import {existsSync,readFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import pino from 'pino';
import {repository} from './repository.js';
import {extractDocumentText} from './parsers.js';
import {sourceTextQuality} from './rag-planning.js';
import {extractDocumentImageOcr,extractPdfOcr,indexDocumentChunks} from './rag.js';
import type {KnowledgeDocument} from './models.js';
const logger=pino({level:process.env.LOG_LEVEL??'info'});
const jobs=new Map<string,Promise<void>>();let queue:Promise<unknown>=Promise.resolve();
/** Original + indexing status are persisted before acknowledging upload. */
export function enqueueKnowledgeIngestion(document:KnowledgeDocument,storageRoot:string):Promise<void>{
  const existing=jobs.get(document.id);if(existing)return existing;
  const job=queue.catch(()=>{}).then(async()=>{
    try{
      if(!await repository.getDocumentById(document.id))return;
      const path=isAbsolute(document.storagePath)?document.storagePath:resolve(storageRoot,document.storagePath);
      if(!existsSync(path))throw new Error('Original document is missing');
      const bytes=readFileSync(path);let text=extractDocumentText(document.filename,bytes);
      if(!sourceTextQuality(text).usable){
        if(/\.pdf$/i.test(document.filename)||bytes.subarray(0,5).toString('ascii')==='%PDF-')text=await extractPdfOcr(bytes);
        else if(/^image\//.test(document.mimeType))text=await extractDocumentImageOcr(bytes,document.mimeType);
      }
      if(!sourceTextQuality(text).usable)throw new Error('No complete readable extraction was obtained');
      if(!await repository.getDocumentById(document.id))return;
      await repository.setDocumentExtractedText(document.id,text);
      await indexDocumentChunks({...document,extractedText:text});
    }catch(error){await repository.setDocumentIndexStatus(document.id,'failed').catch(()=>{});logger.warn({documentId:document.id,error:error instanceof Error?error.message:String(error)},'Knowledge ingestion failed');}
  }).finally(()=>jobs.delete(document.id));
  jobs.set(document.id,job);queue=job;return job;
}
export async function resumeKnowledgeIngestion(storageRoot:string):Promise<void>{
  for(const doc of await repository.getPendingKnowledgeDocuments())await enqueueKnowledgeIngestion(doc,storageRoot);
}
