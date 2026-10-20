import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkText,assertChunkCoverage,isValidEmbedding} from '../build/rag-core.js';
import {generateBatchEmbeddings} from '../build/rag.js';

const vector=n=>Array(2560).fill(n);
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});

test('index windows preserve every source span, values and table boundaries at varied sizes',()=>{
  const table='| Metric | Value |\n| Uptime | 99.95% |\n| Version | v4.0.1 |\n| IP | 10.0.0.1 |\n| PUE | 1.5 |';
  const source=('# Technical facts\n\n'+table+'\n\n'+Array.from({length:1200},(_,i)=>`term${i}`).join(' ')+'\n\nMicrosoft 365 is supported. End fact.').repeat(2);
  for(const size of [1,2,17,80,450])for(const overlap of [0,1,Math.floor(size/4),size+20]){
    const chunks=chunkText(source,size,overlap);
    assertChunkCoverage(source,chunks);
    assert.ok(chunks.every(c=>c.content.split(/\s+/).length<=size));
    assert.equal(chunks.at(-1).endOffset,source.trim().length);
  }
  assert.equal(chunkText(table)[0].content,table);
});
test('invalid chunking settings fail instead of hanging',()=>{
  for(const size of [0,-1,Infinity,1.5])assert.throws(()=>chunkText('hello',size),RangeError);
  assert.throws(()=>chunkText('hello',10,-1),RangeError);
});
test('index coverage validation rejects a dropped source fact',()=>{
  const source='Support includes Microsoft 365 and uptime is 99.95%.';
  const chunks=chunkText(source);
  assert.throws(()=>assertChunkCoverage(source,[{...chunks[0],content:'Support includes workloads.'}]),/differs/);
});
test('embedding validation is identical for local and deployed environments',()=>{
  assert.equal(isValidEmbedding(vector(0.1)),true);
  for(const invalid of [[],[1],[1,2],vector(0),vector(Infinity),[...vector(1).slice(1),NaN]])assert.equal(isValidEmbedding(invalid),false);
});
test('batch embeddings stay aligned when reordered and repair missing slots',async t=>{
  const seen=[];
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    const input=JSON.parse(init.body).input;seen.push(input);
    return Array.isArray(input)?json({data:[{index:2,embedding:vector(3)},{index:0,embedding:vector(1)}]}):json({data:[{embedding:vector(2)}]});
  });
  const result=await generateBatchEmbeddings(['first','second','third']);
  assert.deepEqual(result.map(v=>v?.[0]),[1,2,3]);
  assert.deepEqual(seen,[['first','second','third'],'second']);
});
test('embedding outages do not fan out repeated scalar retries',async t=>{
  let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;return new Response('',{status:503});});
  assert.deepEqual(await generateBatchEmbeddings(['first','second','third']),[null,null,null]);
  assert.equal(requests,1);
});
