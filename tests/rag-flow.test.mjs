import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {once} from 'node:events';import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('RAG HTTP lifecycle: readiness, private ACL, grounded SSE, source view, delete and embedding outage',{timeout:30000},async()=>{
 const temp=mkdtempSync(join(tmpdir(),'cloudcore-rag-'));let release;let hold=true;let outage=false;let calls=0;
 const engine=createServer(async(req,res)=>{
  const parts=[];for await(const part of req)parts.push(part);const body=parts.length?JSON.parse(Buffer.concat(parts)):{};
  res.setHeader('content-type','application/json');
  if(req.url.endsWith('/embeddings')){calls++;if(hold)await new Promise(r=>{release=r;});if(outage){res.statusCode=503;res.end('{}');return;}const input=Array.isArray(body.input)?body.input:[body.input];res.end(JSON.stringify({data:input.map((_,index)=>({index,embedding:Array.from({length:2560},(_,i)=>i===0?1:0)}))}));return;}
  if(req.url.endsWith('/chat/completions')){const evidence=body.messages.find(m=>m.role==='user'&&m.content.startsWith('{"type":"untrusted_source_evidence"'));assert.ok(evidence);assert.equal(body.messages[0].content.includes('SecretFixture'),false);res.end(JSON.stringify({choices:[{message:{content:'The source states uptime is 99.87%. [S1]'},finish_reason:'stop'}]}));return;}
  res.statusCode=404;res.end('{}');
 });engine.listen(0,'127.0.0.1');await once(engine,'listening');
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r));
 const base=`http://127.0.0.1:${port}`,engineUrl=`http://127.0.0.1:${engine.address().port}`;
 const child=spawn(process.execPath,[fileURLToPath(new URL('../build/server.js',import.meta.url))],{cwd:temp,windowsHide:true,env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_URL:'',REDIS_URL:'',AUTH_MODE:'local',PUBLIC_BASE_URL:base,AI_BASE_URL:engineUrl+'/v1',EMBEDDING_API_URL:engineUrl,RERANKER_API_URL:engineUrl,INITIAL_DEV_PASSWORD:'rag-test-password',LOG_LEVEL:'error'}});
 let logs='';child.stderr.on('data',b=>logs+=b);child.stdout.on('data',b=>logs+=b);
 const api=(path,cookie,body,method=body?'POST':'GET')=>fetch(base+path,{method,signal:AbortSignal.timeout(10000),headers:{'x-requested-with':'CloudCoreAI',...(cookie?{cookie}:{}),...(body&&!(body instanceof FormData)?{'content-type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const upload=async(cookie,name)=>{const form=new FormData();form.append('files',new Blob(['SecretFixture uptime is 99.87%.\nSupport is 8x5.'],{type:'text/plain'}),name);form.set('isShared','false');const r=await api('/api/knowledge/upload',cookie,form);assert.equal(r.status,201,await r.clone().text());return (await r.json()).uploaded[0];};
 try{
  let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}await pause(30);}assert.ok(ready,logs);
  const login=await api('/api/auth/login',undefined,{username:'azeemniazi',password:'rag-test-password'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  const created=await api('/api/admin/users',cookie,{username:'rag-test-reader',password:'rag-reader-password',displayName:'RAG Test Reader',role:'user',mustChangePassword:false});assert.equal(created.status,200);
  const userLogin=await api('/api/auth/login',undefined,{username:'rag-test-reader',password:'rag-reader-password'});const other=userLogin.headers.get('set-cookie').split(';')[0];
  const doc=await upload(cookie,'SecretFixture.txt');assert.equal(doc.status,'indexing');
  const request={message:'What uptime does SecretFixture state?',rag_scope:{mode:'document',id:doc.id},use_rag:true,max_tokens:400};
  assert.equal((await (await api('/api/chat',cookie,request)).json()).finishReason,'no_evidence');
  for(let n=0;n<50&&!release;n++)await pause(20);assert.ok(release);hold=false;release();
  for(let n=0;n<100;n++){const r=await (await api('/api/knowledge/documents/'+doc.id,cookie)).json();if(r.document.status==='ready')break;await pause(20);}
  const answer=await (await api('/api/chat',cookie,request)).json();assert.match(answer.answer,/99.87%/);assert.equal(answer.citations[0].documentId,doc.id);
  const denied=await (await api('/api/chat',other,request)).json();assert.equal(denied.finishReason,'no_evidence');assert.deepEqual(denied.citations,[]);
  assert.equal((await api('/api/knowledge/documents/'+doc.id+'/view',other)).status,403);
  assert.equal((await api('/api/knowledge/documents/'+doc.id+'/view',cookie)).status,200);
  const stream=await (await api('/api/chat',cookie,{...request,stream:true})).text();assert.match(stream,/99.87%/);assert.match(stream,/\[DONE\]/);assert.match(stream,/"sourceId":"S1"/);
  assert.equal((await api('/api/knowledge/documents/'+doc.id,cookie,undefined,'DELETE')).status,200);
  assert.equal((await (await api('/api/chat',cookie,request)).json()).finishReason,'no_evidence');
  outage=true;const prior=calls;const failed=await upload(cookie,'OutageFixture.txt');let status;
  for(let n=0;n<100;n++){status=(await (await api('/api/knowledge/documents/'+failed.id,cookie)).json()).document.status;if(status==='failed')break;await pause(20);}assert.equal(status,'failed');assert.equal(calls-prior,1);
 }finally{
  release?.();if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}await new Promise(r=>{engine.close(r);engine.closeAllConnections();});
  assert.ok(resolve(temp).startsWith(resolve(tmpdir(),'cloudcore-rag-')));rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
});
