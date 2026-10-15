import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import sharp from 'sharp';
import { normalizeReference, parseRemixFields, probeImageEngine, remixImage } from '../build/image-engine.js';
import {parseImageUrl,publicImageAddress} from '../build/image-url.js';

const modelSource = readFileSync(new URL('../dist/studio-model.js',import.meta.url),'utf8');
function model() { const c = vm.createContext({Set,Map,Date}); vm.runInContext(modelSource,c); return c.StudioModel; }
test('studio drafts are independent and image selection does not mutate prompts',()=>{
  const m = model(), s = m.createState();
  s.create.prompt = 'Keep this draft'; s.remix.prompt = 'Change the lighting';
  s.assets = [{id:'a',prompt:'Old prompt',style:'photoreal',aspectRatio:'16:9',seed:42}];
  s.activeId = 'a';
  assert.equal(s.create.prompt,'Keep this draft'); assert.equal(s.remix.prompt,'Change the lighting');
  const restored = m.restoreDraft(s.create,s.assets[0]);
  assert.equal(restored.prompt,'Old prompt'); assert.equal(restored.seed,'42'); assert.equal(s.create.prompt,'Keep this draft');
});
test('completion merging deduplicates jobs without dropping other assets',()=>{
  const m=model(); const result=m.mergeAssets([{id:'a',createdAt:'2026-01-01',prompt:'old'},{id:'b',createdAt:'2026-01-02'}],[{id:'a',createdAt:'2026-01-03',prompt:'new'},{id:'a'}]);
  assert.equal(result.length,2); assert.equal(result[0].prompt,'new');
});
test('gallery search combines prompt/style matching with style filtering',()=>{
  const m=model(), assets=[{prompt:'Sunrise in Islamabad',style:'photoreal'},{prompt:'A blue tower',style:'diagram'}];
  assert.equal(m.filterAssets(assets,' ISLAMABAD ','all').length,1);
  assert.equal(m.filterAssets(assets,'tower','photoreal').length,0);
  assert.equal(m.filterAssets(assets,'diagram','all').length,1);
});
test('draft and upload validation rejects invalid seed, prompt, size, and type',()=>{
  const m=model(), d=m.createState().create;
  assert.ok(m.validateDraft(d)); d.prompt='An idea'; assert.equal(m.validateDraft(d),'');
  d.seed='2.5'; assert.ok(m.validateDraft(d)); d.seed='-1'; assert.ok(m.validateDraft(d));
  d.seed=''; d.prompt='a'.repeat(501); assert.ok(m.validateDraft(d));
  assert.ok(m.validateFile({type:'image/svg+xml',size:12}));
  assert.ok(m.validateFile({type:'image/png',size:20*1048576+1}));
  assert.equal(m.validateFile({type:'image/png',size:20*1048576}),'');
});
test('URL import rejects credentials, local/private/metadata networks and unsupported schemes',()=>{
  for(const address of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','198.18.0.1'])assert.equal(publicImageAddress(address),false,address);
  assert.equal(publicImageAddress('8.8.8.8'),true);
  for(const url of ['http://example.com/x.png','https://user:pass@example.com/x.png','https://example.com:8080/x.png','https://example.com/x.png#fragment','file:///tmp/x.png'])assert.throws(()=>parseImageUrl(url));
  assert.equal(parseImageUrl('https://example.com/x.png').hostname,'example.com');
});
test('studio renders all modes with honest status and no fixed fake progress',()=>{
  const c=vm.createContext({Set,Map,Date,navigator:{platform:'Win32'},icon:n=>`<svg aria-hidden="true">${n}</svg>`,renderMarkdown:t=>t});
  vm.runInContext(modelSource+readFileSync(new URL('../dist/studio-view.js',import.meta.url),'utf8'),c);
  const s=c.StudioModel.createState();
  s.job={id:'j',status:'processing',startedAt:new Date().toISOString()};
  for(const tab of ['create','remix','gallery','analyze']) { s.tab=tab; const html=c.StudioView.render(s); assert.ok(html.includes(`aria-labelledby="is-tab-${tab}"`)); assert.ok(!html.includes('% Synthesized')); }
  s.create.prompt='<img src=x onerror=alert(1)>';
  assert.ok(!c.StudioView.render({...s,tab:'create'}).includes('<img src=x'));
  s.analyze={...s.analyze,source:{url:'/image.png'},result:'Only metadata',kind:'metadata'};
  assert.ok(c.StudioView.render(s).includes('not visual recognition or OCR'));
});

async function engine(handler) {
  const server=createServer(handler); server.listen(0,'127.0.0.1'); await once(server,'listening');
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
test('capabilities fail closed until both image-to-image support and verification exist',async()=>{
  const mock=await engine((req,res)=>json(res,req.url==='/sdcpp/v1/capabilities'?{supported_modes:['img_gen'],model:{name:'Test model'},features_by_mode:{img_gen:{init_image:true}}}:{}));
  try {
    const unverified=await probeImageEngine(mock.url,false), verified=await probeImageEngine(mock.url,true);
    assert.equal(unverified.remixSupported,true); assert.equal(unverified.remix,false); assert.equal(unverified.controls.strength,false);
    assert.equal(verified.remix,true); assert.equal(verified.controls.strength,true); assert.equal(verified.model,'Test model');
  } finally {await mock.close();}
  const legacy=await engine((_req,res)=>json(res,{status:'ok',model:'Text only'}));
  try {assert.equal((await probeImageEngine(legacy.url,true)).remix,false);} finally {await legacy.close();}
});
test('remix requires exactly one source and validates every controllable parameter',()=>{
  const form=new FormData(); form.set('prompt','Change the light');
  assert.throws(()=>parseRemixFields(form),/exactly one/);
  form.set('sourceAssetId','asset'); assert.equal(parseRemixFields(form).strength,.65);
  form.set('image',new Blob(['x'],{type:'image/png'}),'image.png'); assert.throws(()=>parseRemixFields(form),/exactly one/);
  form.delete('image'); form.set('strength','NaN'); assert.throws(()=>parseRemixFields(form),/strength/);
  form.set('strength','.6'); form.set('style','unknown'); assert.throws(()=>parseRemixFields(form),/supported/);
});
test('reference decoding checks actual bytes, dimensions and format',async()=>{
  await assert.rejects(normalizeReference(Buffer.from('not an image'),'image/png'),/decoded/);
  await assert.rejects(normalizeReference(Buffer.from('anything'),'image/svg+xml'),/JPG/);
  const bytes=await sharp({create:{width:48,height:32,channels:3,background:'#ff0000'}}).jpeg().toBuffer();
  const output=await normalizeReference(bytes,'image/jpeg'); const meta=await sharp(output).metadata();
  assert.equal(meta.width,48); assert.equal(meta.format,'png');
});
test('remix forwards the real reference and strength only to img2img; errors never fall back',async()=>{
  const source=await sharp({create:{width:32,height:32,channels:3,background:'#00ff00'}}).png().toBuffer();
  const requests=[];
  const mock=await engine(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    requests.push({url:req.url,body:JSON.parse(Buffer.concat(chunks))});
    json(res,{images:[source.toString('base64')]});
  });
  try {
    const result=await remixImage(mock.url,{prompt:'Change the light',negativePrompt:'text',width:512,height:512,seed:42,strength:.35,reference:source});
    assert.equal(requests.length,1); assert.equal(requests[0].url,'/sdapi/v1/img2img');
    assert.equal(requests[0].body.denoising_strength,.35); assert.equal(requests[0].body.seed,42);
    assert.deepEqual(Buffer.from(requests[0].body.init_images[0],'base64'),source);
    assert.equal((await sharp(result).metadata()).format,'png');
  } finally {await mock.close();}
  const errors=[]; const unavailable=await engine((req,res)=>{errors.push(req.url);json(res,{},404);});
  try {await assert.rejects(remixImage(unavailable.url,{prompt:'x',width:512,height:512,seed:1,strength:.5,reference:source}),/does not expose/);assert.deepEqual(errors,['/sdapi/v1/img2img']);} finally {await unavailable.close();}
});
