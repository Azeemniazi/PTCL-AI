import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=['studio-model.js','studio-view.js','studio.js'].map(f=>readFileSync(new URL('../dist/'+f,import.meta.url),'utf8')).join('\n');
const turn=()=>new Promise(setImmediate);
const reply=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const assets=['one','two'].map((id,n)=>({id,prompt:`Saved prompt ${n}`,style:'natural',aspectRatio:'1:1',filename:id+'.png',url:'/'+id+'.png',width:1080,height:1080,createdAt:'2026-10-15',seed:n+1}));

async function fixture(override=()=>undefined) {
  const listeners=new Map(),nodes=new Map(),timers=new Set(),requests=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',dataset:{},style:{},open:false,isConnected:true,
    classList:{add(){},remove(){},toggle(){},contains(){return true;}},focus(){},scrollIntoView(){},setSelectionRange(){},setAttribute(){},removeAttribute(){},close(){this.open=false;},insertAdjacentHTML(_p,s){this.innerHTML+=s;}});return nodes.get(id);};
  const document={hidden:false,activeElement:null,addEventListener:(event,handler)=>{const list=listeners.get(event)||[];list.push(handler);listeners.set(event,list);},
    getElementById:node,querySelector:selector=>selector==='dialog[open]'?null:node(selector),querySelectorAll:()=>[]};
  const location={hash:'#images/create'};
  const context=vm.createContext({document,location,window:{scrollY:0,scrollX:0,scrollTo(){},history:{replaceState(_s,_t,hash){location.hash=hash;}}},
    appUser:{id:'review'},Set,Map,Date,URL,AbortSignal,AbortController,FormData,File,Blob,Response,console,navigator:{platform:'Win32'},
    icon:()=>'<svg></svg>',renderMarkdown:s=>s,toast(){},route(){},modal(content){node('#dialog-content').innerHTML=content;node('dialog').open=true;},
    setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),setInterval:()=>1,clearInterval(){},
    fetch:async(path,options={})=>{requests.push({path,options});const custom=override(path,options);if(custom!==undefined)return await custom;
      if(path==='/api/images/history')return reply({assets});
      if(path==='/api/images/capabilities')return reply({model:'Fixture',remix:true,generation:true,controls:{strength:true}});
      if(path==='/api/images/jobs/active')return reply({activeJob:null});
      if(path.endsWith('/cancel'))return reply({success:true,message:'Cancelled; computing may finish, but the result will be discarded.'});
      if(path.includes('/jobs/'))return reply({job:{id:'job',status:'processing',startedAt:new Date().toISOString()}});
      return reply({success:true});}});
  vm.runInContext(source,context);
  context.ImageStudio.render();context.ImageStudio.mount();await turn();await turn();
  function emit(type,target,extra={}){const event={target,key:'',preventDefault(){},...extra};for(const handler of listeners.get(type)||[])handler(event);}
  function element(dataset){const button={dataset,disabled:false,closest:selector=>selector==='[data-studio-action]'?button:selector==='#premium-studio,.studio-dialog'||selector==='#premium-studio'?node('#premium-studio'):null};return button;}
  function click(action,data={}){emit('click',element({studioAction:action,...data}));}
  function input(key,value,draft='create'){const el=element({studioField:key,draft});el.value=value;emit('input',el);}
  const html=()=>context.ImageStudio.render();
  return {context,click,input,html,emit,element,node,timers,requests};
}
test('preview keeps an edited draft; explicit reuse restores saved settings',async()=>{
  const f=await fixture();f.input('prompt','Keep my new idea');f.click('preview',{id:'two'});
  assert.ok(f.html().includes('Keep my new idea'));
  f.click('reuse',{id:'one'});assert.ok(!f.html().includes('Keep my new idea'));assert.ok(f.html().includes('Saved prompt 0'));
});
test('button and keyboard submissions share the same duplicate-job guard',async()=>{
  let resolveRequest;const f=await fixture(path=>path==='/api/images/generate'?new Promise(r=>{resolveRequest=r;}):undefined);
  f.input('prompt','My new image');f.click('generate');
  f.emit('keydown',f.element({}),{key:'Enter',ctrlKey:true});f.click('generate');
  assert.equal(f.requests.filter(r=>r.path==='/api/images/generate').length,1);
  resolveRequest(reply({job:{id:'job',status:'queued',startedAt:new Date().toISOString()}}));await turn();
  f.click('generate');assert.equal(f.requests.filter(r=>r.path==='/api/images/generate').length,1);
});
test('enhancement supports undo and ignores a stale response after typing',async()=>{
  let resolveEnhance;const f=await fixture(path=>path==='/api/images/enhance-prompt'?new Promise(r=>{resolveEnhance=r;}):undefined);
  f.input('prompt','Original idea');f.click('enhance');resolveEnhance(reply({enhancedPrompt:'Enhanced idea'}));await turn();
  assert.ok(f.html().includes('Enhanced idea'));f.click('undo-enhance');assert.ok(f.html().includes('Original idea'));
  f.click('enhance');f.input('prompt','Changed while enhancing');resolveEnhance(reply({enhancedPrompt:'Stale response'}));await turn();
  assert.ok(f.html().includes('Changed while enhancing'));assert.ok(!f.html().includes('Stale response'));
});
test('a late polling response cannot resurrect a cancelled job',async()=>{
  let resolvePoll;const f=await fixture(path=>path==='/api/images/generate'?reply({job:{id:'job',status:'queued',startedAt:new Date().toISOString()}}):path==='/api/images/jobs/job'?new Promise(r=>{resolvePoll=r;}):undefined);
  f.input('prompt','Keep this draft');f.click('generate');await turn();
  const poll=[...f.timers][0];f.timers.delete(poll);const running=poll();await turn();
  f.click('cancel');await turn();resolvePoll(reply({job:{id:'job',status:'processing',startedAt:new Date().toISOString()}}));await running;
  assert.ok(f.html().includes('Generation cancelled'));assert.ok(f.html().includes('Keep this draft'));assert.ok(!f.html().includes('Creating your image'));
});
test('reconnection releases a missing job without losing the draft',async()=>{
  const f=await fixture(path=>path==='/api/images/generate'?reply({job:{id:'missing',status:'queued',startedAt:new Date().toISOString()}}):path==='/api/images/jobs/missing'?new Response(JSON.stringify({error:{message:'Job not found'}}),{status:404}):undefined);
  f.input('prompt','A recoverable draft');f.click('generate');await turn();f.click('reconnect');await turn();await turn();
  assert.ok(f.html().includes('This job is no longer available'));assert.ok(f.html().includes('A recoverable draft'));
  const before=f.requests.filter(r=>r.path==='/api/images/generate').length;f.click('generate');await turn();
  assert.equal(f.requests.filter(r=>r.path==='/api/images/generate').length,before+1);
});
test('gallery searches update results without replacing the studio shell',async()=>{
  const f=await fixture();f.click('tab',{tab:'gallery'});const before=f.node('#premium-studio').innerHTML;
  f.input('query','Saved prompt 1','');assert.equal(f.node('#premium-studio').innerHTML,before);
  assert.ok(f.node('#is-gallery-results').innerHTML.includes('Saved prompt 1'));assert.ok(!f.node('#is-gallery-results').innerHTML.includes('Saved prompt 0'));
});
test('bulk deletion removes successful assets and retains failed selections',async()=>{
  const f=await fixture(path=>path==='/api/images/two'?new Response(JSON.stringify({error:{message:'Not allowed'}}),{status:403}):undefined);
  f.click('tab',{tab:'gallery'});
  for(const id of ['one','two'])f.emit('change',{dataset:{studioSelect:id},checked:true});
  f.click('confirm-delete',{ids:JSON.stringify(['one','two'])});await turn();await turn();
  assert.ok(f.html().includes('1 selected'));assert.ok(f.html().includes('Saved prompt 1'));assert.ok(!f.html().includes('Saved prompt 0'));
  assert.ok(f.node('is-dialog-error').innerHTML.includes('1 deleted; 1 could not be deleted'));
});
