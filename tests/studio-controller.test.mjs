import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../build/frontend-test/fixtures.js',import.meta.url),'utf8');
const turn=()=>new Promise(setImmediate);
const reply=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const assets=['one','two'].map((id,n)=>({id,prompt:`Saved prompt ${n}`,style:'natural',aspectRatio:'1:1',filename:id+'.png',url:'/'+id+'.png',width:1080,height:1080,createdAt:'2026-10-15',seed:n+1}));

async function fixture(override=()=>undefined,sharedBrowserWindow=false) {
  const listeners=new Map(),nodes=new Map(),timers=new Set(),requests=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',dataset:{},style:{},open:false,isConnected:true,
    classList:{add(){},remove(){},toggle(){},contains(){return true;}},focus(){},scrollIntoView(){},setSelectionRange(){},setAttribute(){},removeAttribute(){},close(){this.open=false;},insertAdjacentHTML(_p,s){this.innerHTML+=s;}});return nodes.get(id);};
  const document={hidden:false,activeElement:null,addEventListener:(event,handler)=>{const list=listeners.get(event)||[];list.push(handler);listeners.set(event,list);},
    getElementById:node,querySelector:selector=>selector==='dialog[open]'?null:node(selector),querySelectorAll:()=>[]};
  const location={hash:'#images/create'};
  let props, host;
  const context=vm.createContext({document,location,window:{scrollY:0,scrollX:0,scrollTo(){},history:{replaceState(_s,_t,hash){location.hash=hash;}}},
    Set,Map,Date,URL,AbortSignal,AbortController,FormData,File,Blob,Headers,Response,console,navigator:{platform:'Win32'},
    icon:()=>'<svg></svg>',requestAnimationFrame:callback=>callback(),
    setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),
    fetch:async(path,options={})=>{requests.push({path,options});const custom=override(path,options);if(custom!==undefined)return await custom;
      if(path==='/api/images/history')return reply({assets});
      if(path==='/api/images/capabilities')return reply({model:'Fixture',remix:true,generation:true,controls:{strength:true}});
      if(path==='/api/images/jobs/active')return reply({activeJob:null});
      if(path.endsWith('/cancel'))return reply({success:true,message:'Cancelled; computing may finish, but the result will be discarded.'});
      if(path.includes('/jobs/'))return reply({job:{id:'job',status:'processing',startedAt:new Date().toISOString()}});
      return reply({success:true});}});
  if(sharedBrowserWindow) {
    // Classic browser scripts share the window/global object. A separate window
    // stub hides collisions such as a top-level function named "history".
    const browserWindow=context.window;
    Object.assign(context,browserWindow);
    context.window=context;
  }
  vm.runInContext(source,context);
  const controller=context.CloudCoreFixtures.createStudioController({
    getUserId:()=> 'review', notify(){}, onUnauthorized(){}, onSavedToKnowledge(){},
    renderView(container,next){host=container;props=next;},
  });
  controller.mount();await turn();await turn();
  function emit(type,target,extra={}){const event={target,key:'',preventDefault(){},...extra};for(const handler of listeners.get(type)||[])handler(event);}
  function element(dataset){const button={dataset,disabled:false,closest:selector=>selector==='[data-studio-action]'?button:selector==='#premium-studio,.studio-dialog'||selector==='#premium-studio'?node('#premium-studio'):null};return button;}
  function click(action,data={}){emit('click',element({studioAction:action,...data}));}
  function input(key,value,draft='create'){if(key==='query')props.onQuery(value);else props.onDraft(draft,key,value);}
  return {context,click,input,emit,element,timers,requests,get props(){return props;},get host(){return host;},get state(){return props.state;}};
}
test('the frontend bundle preserves browser history and Image Studio tab navigation',async()=>{
  const f=await fixture(()=>undefined,true);
  assert.equal(typeof f.context.history.replaceState,'function');
  for(const tab of ['remix','gallery','analyze','create']) {
    f.click('tab',{tab});await turn();
    assert.equal(f.context.location.hash,`#images/${tab}`);
    assert.equal(f.state.tab,tab);
  }
});
test('preview keeps an edited draft; explicit reuse restores saved settings',async()=>{
  const f=await fixture();f.input('prompt','Keep my new idea');f.click('preview',{id:'two'});
  assert.equal(f.state.create.prompt,'Keep my new idea');
  f.click('reuse',{id:'one'});assert.equal(f.state.create.prompt,'Saved prompt 0');
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
  assert.equal(f.state.create.prompt,'Enhanced idea');f.click('undo-enhance');assert.equal(f.state.create.prompt,'Original idea');
  f.click('enhance');f.input('prompt','Changed while enhancing');resolveEnhance(reply({enhancedPrompt:'Stale response'}));await turn();
  assert.equal(f.state.create.prompt,'Changed while enhancing');
});
test('a late polling response cannot resurrect a cancelled job',async()=>{
  let resolvePoll;const f=await fixture(path=>path==='/api/images/generate'?reply({job:{id:'job',status:'queued',startedAt:new Date().toISOString()}}):path==='/api/images/jobs/job'?new Promise(r=>{resolvePoll=r;}):undefined);
  f.input('prompt','Keep this draft');f.click('generate');await turn();
  const poll=[...f.timers][0];f.timers.delete(poll);const running=poll();await turn();
  f.click('cancel');await turn();resolvePoll(reply({job:{id:'job',status:'processing',startedAt:new Date().toISOString()}}));await running;
  assert.equal(f.state.job.status,'cancelled');assert.equal(f.state.create.prompt,'Keep this draft');
});
test('reconnection releases a missing job without losing the draft',async()=>{
  const f=await fixture(path=>path==='/api/images/generate'?reply({job:{id:'missing',status:'queued',startedAt:new Date().toISOString()}}):path==='/api/images/jobs/missing'?new Response(JSON.stringify({error:{message:'Job not found'}}),{status:404}):undefined);
  f.input('prompt','A recoverable draft');f.click('generate');await turn();f.click('reconnect');await turn();await turn();
  assert.match(f.state.job.error,/This job is no longer available/);assert.equal(f.state.create.prompt,'A recoverable draft');
  const before=f.requests.filter(r=>r.path==='/api/images/generate').length;f.click('generate');await turn();
  assert.equal(f.requests.filter(r=>r.path==='/api/images/generate').length,before+1);
});
test('gallery searches update results without replacing the studio shell',async()=>{
  const f=await fixture();f.click('tab',{tab:'gallery'});const before=f.host;
  f.input('query','Saved prompt 1');assert.equal(f.host,before);
  assert.equal(f.state.query,'Saved prompt 1');
  assert.equal(f.state.assets.length,2);
});
test('bulk deletion removes successful assets and retains failed selections',async()=>{
  const f=await fixture(path=>path==='/api/images/two'?new Response(JSON.stringify({error:{message:'Not allowed'}}),{status:403}):undefined);
  f.click('tab',{tab:'gallery'});
  for(const id of ['one','two'])f.props.onSelect(id,true);
  f.click('delete-selected');
  const result=await f.props.onAssetOperation(f.props.dialog.ids,'delete',undefined,new AbortController().signal);
  assert.deepEqual([...f.state.selected],['two']);
  assert.deepEqual(Array.from(f.state.assets,asset=>asset.id),['two']);
  assert.deepEqual([...result.succeeded],['one']);
  assert.equal(result.failed[0].message,'Not allowed');
});
