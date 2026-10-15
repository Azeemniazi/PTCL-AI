import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
async function availablePort() {const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}

test('studio API integrates remix, ownership, cancellation, output formats and analysis provenance',{timeout:45000},async()=>{
  const temp=mkdtempSync(join(tmpdir(),'cloudcore-studio-'));
  const generated=join(temp,'data/images/generated');mkdirSync(generated,{recursive:true});
  const sample=await sharp({create:{width:48,height:32,channels:3,background:'#2d8b59'}}).png().toBuffer();
  writeFileSync(join(generated,'foreign.png'),sample);
  writeFileSync(join(generated,'manifest.json'),JSON.stringify([{id:'foreign',userId:'someone-else',filename:'foreign.png',url:'/api/images/generated/foreign.png',prompt:'Private reference',style:'natural',aspectRatio:'1:1',width:48,height:32,seed:1,createdAt:new Date().toISOString()}]));
  let releaseDelayed, delayedStarted=false, visual=false;
  const received=[];
  const engine=createServer(async(req,res)=>{
    if(req.url==='/sdcpp/v1/capabilities')return json(res,{model:{name:'Isolated test engine'},supported_modes:['img_gen'],features_by_mode:{img_gen:{init_image:true}}});
    if(req.url.includes('chat/completions'))return json(res,{choices:[{message:{content:'File metadata inspection only.'}}]});
    if(req.url.endsWith('/api/vision')&&visual)return json(res,{answer:'Visual report from the image service.'});
    if(!['/sdapi/v1/txt2img','/sdapi/v1/img2img'].includes(req.url))return json(res,{},404);
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks));received.push({path:req.url,body});
    if(body.prompt.startsWith('delay')){delayedStarted=true;await new Promise(r=>{releaseDelayed=r;});}
    if(body.prompt.startsWith('fail'))return json(res,{error:'Engine failure'},500);
    return json(res,{images:[sample.toString('base64')]});
  });
  engine.listen(0,'127.0.0.1');await once(engine,'listening');
  const engineUrl=`http://127.0.0.1:${engine.address().port}`,port=await availablePort(),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,[fileURLToPath(new URL('../build/server.js',import.meta.url))],{cwd:temp,windowsHide:true,env:{...process.env,
    NODE_ENV:'test',PORT:String(port),DATABASE_URL:'',REDIS_URL:'',AUTH_MODE:'local',PUBLIC_BASE_URL:base,
    IMAGE_ENGINE_URL:engineUrl,IMAGE_REMIX_VERIFIED:'true',AI_BASE_URL:engineUrl,AI_API_KEY:'',VEXA_BASE_URL:'',
    INITIAL_DEV_PASSWORD:'studio-test-password',INITIAL_ADMIN_PASSWORD:'studio-test-admin',LOG_LEVEL:'error'}});
  let logs='';child.stdout.on('data',b=>{logs+=b;});child.stderr.on('data',b=>{logs+=b;});
  async function api(path,{cookie,body,...options}={}){
    return fetch(base+path,{...options,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),headers:{'x-requested-with':'CloudCoreAI',...(cookie?{cookie}:{}),...(body!==undefined&&!(body instanceof FormData)?{'content-type':'application/json'}:{})},signal:AbortSignal.timeout(10000)});
  }
  async function login(username,password) {const response=await api('/api/auth/login',{method:'POST',body:{username,password}});assert.equal(response.status,200,await response.clone().text());return response.headers.get('set-cookie').split(';')[0];}
  function remixForm(source,prompt='Change the lighting') {const form=new FormData();form.set('prompt',prompt);form.set('style','natural');form.set('aspectRatio','1:1');form.set('sourceAssetId',source);form.set('strength','.35');form.set('seed','42');return form;}
  async function finished(id,cookie) {for(let n=0;n<100;n++){const r=await api(`/api/images/jobs/${id}`,{cookie});const {job}=await r.json();if(['completed','failed','cancelled'].includes(job.status))return job;await wait(25);}throw Error('Job did not finish. '+logs);}
  try {
    let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}if(child.exitCode!==null)break;await wait(50);}assert.ok(ready,logs);
    assert.equal((await api('/api/images/capabilities')).status,401);
    assert.equal((await api('/api/images/import-url',{method:'POST',body:{url:'https://127.0.0.1/a.png'}})).status,401);
    const cookie=await login('azeemniazi','studio-test-password');
    const capabilities=await (await api('/api/images/capabilities',{cookie})).json();assert.equal(capabilities.remix,true);
    assert.equal((await api('/api/images/import-url',{cookie,method:'POST',body:{url:'https://127.0.0.1/a.png'}})).status,400);
    const createUser=await api('/api/admin/users',{cookie,method:'POST',body:{username:'studio-user',password:'studio-user-test',displayName:'Studio User',role:'user',mustChangePassword:false}});assert.equal(createUser.status,200);
    const userCookie=await login('studio-user','studio-user-test');
    assert.equal((await api('/api/images/remix',{cookie:userCookie,method:'POST',body:remixForm('foreign')})).status,403);
    assert.equal((await api('/api/images/generated/foreign.png',{cookie:userCookie})).status,403);
    assert.equal((await api('/api/images/foreign/save-to-knowledge',{cookie:userCookie,method:'POST',body:{}})).status,403);
    const original=await (await api('/api/images/generate',{cookie,method:'POST',body:{prompt:'An image',style:'natural',aspectRatio:'1:1',sync:true}})).json();
    assert.equal(original.asset.renderKind,'generated');const originalBytes=readFileSync(join(generated,original.asset.filename));
    const accepted=await api('/api/images/remix',{cookie,method:'POST',body:remixForm(original.asset.id)});assert.equal(accepted.status,202,await accepted.clone().text());
    const {job}=await accepted.json();assert.equal(job.referenceFilename,undefined);
    const done=await finished(job.id,cookie);assert.equal(done.status,'completed');assert.equal(done.asset.operation,'remix');assert.equal(done.asset.sourceAssetId,original.asset.id);assert.equal(done.asset.strength,.35);
    assert.deepEqual(readFileSync(join(generated,original.asset.filename)),originalBytes);
    const forwarded=received.find(r=>r.path==='/sdapi/v1/img2img');assert.equal(forwarded.body.denoising_strength,.35);assert.ok(Buffer.from(forwarded.body.init_images[0],'base64').length>100);
    const missing=remixForm('');assert.equal((await api('/api/images/remix',{cookie,method:'POST',body:missing})).status,400);
    const both=remixForm(original.asset.id);both.set('image',new Blob([sample],{type:'image/png'}),'reference.png');assert.equal((await api('/api/images/remix',{cookie,method:'POST',body:both})).status,400);
    const invalid=remixForm('');invalid.delete('sourceAssetId');invalid.set('image',new Blob(['not an image'],{type:'image/png'}),'bad.png');assert.equal((await api('/api/images/remix',{cookie,method:'POST',body:invalid})).status,400);
    const upload=remixForm('');upload.delete('sourceAssetId');upload.set('image',new Blob([sample],{type:'image/png'}),'reference.png');
    const uploadJob=(await (await api('/api/images/remix',{cookie,method:'POST',body:upload})).json()).job;assert.equal((await finished(uploadJob.id,cookie)).asset.sourceName,'reference.png');
    const failure=(await (await api('/api/images/remix',{cookie,method:'POST',body:remixForm(original.asset.id,'fail this remix')})).json()).job;
    const failed=await finished(failure.id,cookie);assert.equal(failed.status,'failed');assert.equal(failed.asset,undefined);
    const delayed=(await (await api('/api/images/remix',{cookie,method:'POST',body:remixForm(original.asset.id,'delay this remix')})).json()).job;
    for(let n=0;n<100&&!delayedStarted;n++)await wait(20);assert.ok(delayedStarted);
    assert.equal((await api('/api/images/generate',{cookie,method:'POST',body:{prompt:'Duplicate'}})).status,409);
    const cancellation=await api(`/api/images/jobs/${delayed.id}/cancel`,{cookie,method:'POST'});assert.equal(cancellation.status,200);
    releaseDelayed();await wait(250);assert.equal((await finished(delayed.id,cookie)).status,'cancelled');
    const history=await (await api('/api/images/history',{cookie})).json();assert.ok(!history.assets.some(a=>a.id===delayed.id));assert.ok(!history.assets.some(a=>a.id===failure.id));
    assert.deepEqual(readdirSync(join(temp,'data/images/references')),[]);
    const saved=await api(`/api/images/${original.asset.id}/save-to-knowledge`,{cookie,method:'POST',body:{filename:'incorrect.svg',isShared:false}});assert.equal(saved.status,200);assert.equal((await saved.json()).document.filename,'incorrect.png');
    const visionForm=new FormData();visionForm.set('image',new Blob([sample],{type:'image/png'}),'reference.png');
    const metadata=await (await api('/api/vision',{cookie,method:'POST',body:visionForm})).json();assert.equal(metadata.analysisKind,'metadata');
    visual=true;const vision=await (await api('/api/vision',{cookie,method:'POST',body:visionForm})).json();assert.equal(vision.analysisKind,'visual');
  } finally {
    releaseDelayed?.();
    if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}
    await new Promise(r=>{engine.close(r);engine.closeAllConnections();});
    assert.ok(resolve(temp).startsWith(resolve(tmpdir(),'cloudcore-studio-')),'Only remove this test’s temporary directory');
    rmSync(temp,{recursive:true,force:true});
  }
});
