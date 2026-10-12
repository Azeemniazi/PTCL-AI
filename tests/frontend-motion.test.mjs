import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/theme.js',import.meta.url),'utf8');
function fixture(reduced=false){
  const query={matches:reduced,addEventListener(_event,handler){this.changed=handler;}};
  const video={dataset:{videoSrc:'assets/sidebar-motion.mp4'},attributes:{},paused:true,muted:false,plays:0,pauses:0,
    getAttribute(name){return this.attributes[name];},setAttribute(name,value){this.attributes[name]=value;},
    play(){this.paused=false;this.plays++;return Promise.resolve();},pause(){this.paused=true;this.pauses++;}};
  const document={hidden:false,videos:[video],querySelectorAll(){return this.videos;},addEventListener(_event,handler){this.changed=handler;}};
  const context=vm.createContext({document,window:{matchMedia(){return query;}}});
  vm.runInContext(source,context);
  return {video,query,document,sync:()=>vm.runInContext('refSyncMotion()',context),render:kind=>vm.runInContext(`refVideoBackground(${JSON.stringify(kind)})`,context)};
}
test('reduced motion uses the poster without downloading a background video',()=>{
  const f=fixture(true);f.sync();assert.equal(f.video.attributes.src,undefined);assert.equal(f.video.plays,0);
  f.query.matches=false;f.query.changed();assert.equal(f.video.attributes.src,'assets/sidebar-motion.mp4');assert.equal(f.video.muted,true);assert.equal(f.video.plays,1);
  f.query.matches=true;f.query.changed();assert.equal(f.video.paused,true);
});
test('background videos pause when the page is hidden and resume when visible',()=>{
  const f=fixture();f.sync();f.sync();assert.equal(f.video.plays,1);
  f.document.hidden=true;f.document.changed();assert.equal(f.video.paused,true);
  f.document.hidden=false;f.document.changed();assert.equal(f.video.plays,2);
});
test('leaving a view pauses its detached background video',()=>{
  const f=fixture();f.sync();f.document.videos=[];f.sync();assert.equal(f.video.paused,true);
});
test('an offscreen background stays paused until it becomes visible',()=>{
  const f=fixture();f.video.dataset.motionVisible='false';f.sync();assert.equal(f.video.attributes.src,undefined);
  f.video.dataset.motionVisible='true';f.sync();assert.equal(f.video.paused,false);
  f.video.dataset.motionVisible='false';f.sync();assert.equal(f.video.paused,true);
});
test('background markup uses silent looping decorative video with a still fallback',()=>{
  const f=fixture();const markup=f.render('assistant');
  assert.match(markup,/data-video-src="assets\/assistant-motion\.mp4"/);
  assert.match(markup,/poster="assets\/assistant-motion-poster\.jpg"/);
  assert.match(markup,/autoplay muted loop playsinline/);
  assert.match(markup,/aria-hidden="true" tabindex="-1"/);
});
