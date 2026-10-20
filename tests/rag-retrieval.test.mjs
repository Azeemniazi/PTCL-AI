import test from 'node:test';import assert from 'node:assert/strict';
import {Repository} from '../build/repository.js';import {rerankCandidates} from '../build/rag.js';
test('atomic replacement rolls back after a mid-insert failure and retains the old index',async()=>{
 const repo=new Repository();let rows=['old'];let saved;let released=false;
 const client={query:async(sql,args)=>{if(sql==='BEGIN')saved=[...rows];else if(sql==='ROLLBACK')rows=saved;else if(sql.startsWith('DELETE'))rows=[];else if(sql.includes('INSERT INTO')){if(args[2]===1)throw Error('Injected insert failure');rows.push(args[3]);}},release:()=>released=true};
 repo.pool={connect:async()=>client};
 await assert.rejects(()=>repo.insertDocumentChunks('d',[{chunkIndex:0,content:'new0',tokenCount:1},{chunkIndex:1,content:'new1',tokenCount:1}]),/Injected/);
 assert.deepEqual(rows,['old']);assert.equal(released,true);
});
test('hybrid SQL uses independent rank fusion, scope ACL and bounded recursive folder traversal',async()=>{
 const repo=new Repository();let received;
 repo.pool={query:async(sql,params)=>{received={sql,params};return {rows:[]};}};
 await repo.searchChunksHybrid('user','biodiversity retention',undefined,12,{mode:'folder',id:'folder'});
 assert.match(received.sql,/websearch_to_tsquery/);assert.match(received.sql,/60\+tr/);assert.match(received.sql,/d\.user_id = \$1/);assert.match(received.sql,/d.status = 'ready'/);assert.ok(!received.sql.includes('UNION ALL'));assert.ok(received.params.includes('folder'));
});
test('reranker malformed/partial responses cannot masquerade as measured zero relevance',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({results:[{index:0,relevance_score:0}]});
  const partial=await rerankCandidates('query',['a','b']);assert.ok(partial.every(r=>r.serviceFailed));
  globalThis.fetch=async()=>Response.json({results:[{index:0,relevance_score:0},{index:1,relevance_score:0.8}]});
  const valid=await rerankCandidates('query',['a','b']);assert.equal(valid[0].relevanceScore,0);assert.equal(valid[0].evaluated,true);assert.ok(!valid.some(r=>r.serviceFailed));
 }finally{globalThis.fetch=original;}
});
