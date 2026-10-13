const $=s=>document.querySelector(s);
const icons={cloud:'M7 18a5 5 0 0 1-1-9.9 7 7 0 0 1 13-1A5.5 5.5 0 0 1 18 18Z',home:'m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',chat:'M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.7-5A9 9 0 1 1 21 11ZM8 11h.01M12 11h.01M16 11h.01',file:'M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8',image:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 17l6-6 5 5 3-3 4 4M8 7h.01',history:'M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v6l4 2',plus:'M12 4v16M4 12h16',arrow:'M5 12h14m-6-6 6 6-6 6',chevron:'m9 5 7 7-7 7',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',user:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',lock:'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-7 4v3M7 11V7a5 5 0 0 1 10 0v4',grid:'M3 3h6v6H3ZM15 3h6v6h-6ZM3 15h6v6H3ZM15 15h6v6h-6Z',shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-4 9 3 3 5-6',signal:'M12 20V10M8 16a6 6 0 0 1 0-9M16 16a6 6 0 0 0 0-9M5 19a10 10 0 0 1 0-15M19 19a10 10 0 0 0 0-15',chip:'M6 6h12v12H6ZM9 9h6v6H9ZM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',users:'M16 21v-2a5 5 0 0 0-10 0v2M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M18 4a4 4 0 0 1 0 7M20 15a5 5 0 0 1 2 4v2M3 15a5 5 0 0 0-2 4',building:'M5 22V4l14-2v20M9 7h2M14 6h2M9 11h2M14 10h2M9 15h2M14 14h2M10 22v-4h4v4',chart:'M5 21v-6M12 21V9M19 21V3',play:'m8 4 12 8-12 8Z',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',paperclip:'m8 13 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L13 2M7 14l9-9',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM20 2v4M18 4h4',settings:'m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3Zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0',help:'M9 8a3 3 0 1 1 4 3c-1 0-1 2-1 3M12 18h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',logout:'M10 3H3v18h7M8 12h14m-5-5 5 5-5 5',folder:'M3 6V3h6l3 3h9v14H3Z',check:'m5 12 4 4L19 6',link:'m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',bulb:'M9 18h6M9 22h6M8 14a7 7 0 1 1 8 0l-1 4H9Z',box:'m12 2 10 5v10l-10 5-10-5V7Zm0 10v10M2 7l10 5 10-5',download:'M12 3v13m-5-5 5 5 5-5M3 17v5h18v-5',trash:'M3 6h18M8 6V3h8v3M5 6l1 16h12l1-16M10 10v8M14 10v8',menu:'M3 6h18M3 12h18M3 18h18',close:'m6 6 12 12M6 18 18 6',sliders:'M6 3v18M12 3v18M18 3v18M3 8h6M9 16h6M15 7h6',video:'M15 10l5-3v10l-5-3ZM3 6h12v12H3Z',clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',globe:'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 0c2.5 3 4 6.5 4 10s-1.5 7-4 10m0-20c-2.5 3-4 6.5-4 10s1.5 7 4 10M2 12h20',eye:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',more:'M12 12h.01M12 5h.01M12 19h.01'};
function icon(n,cl=''){return `<svg class="icon ${cl}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n]||icons.spark}"/></svg>`}
function mark(cl=''){return `<img class="brand-mark ${cl}" src="assets/cloudcore-mark.png" alt="" aria-hidden="true">`}
function brand(){return `<a class="brand" href="#landing" aria-label="CloudCore AI landing page">${mark()}<span><strong>CloudCore <b>AI</b></strong><small>A product of PTCL Smart Cloud</small></span></a>`}
function wave(cl=''){return `<svg class="wave ${cl}" viewBox="0 0 1400 260" preserveAspectRatio="none" aria-hidden="true">${Array.from({length:34},(_,i)=>`<path d="M-100 ${95+i*2} C210 ${-150+i*9}, 350 ${400-i*2}, 680 ${135+i} S 850 ${-40+i*6}, 1100 ${100+i*3} S1350 ${260-i*4},1500 ${55+i*3}"/>`).join('')}</svg>`}
function footer(){return `<footer class="page-footer"><span>Technology that moves Pakistan forward.</span><i></i><span>${mark('footer-mark')} A product of PTCL Smart Cloud</span></footer>`}
function landing(){return refLanding()}


const publicRoutes=['site-solutions','site-ai','site-industries','site-resources','site-about'];

function marketingHeader(active){
  const items=[['landing','Home'],['site-solutions','Solutions'],['site-ai','AI Assistant'],['site-industries','Industries'],['site-resources','Resources'],['site-about','About']];
  return `<header class="minimal-header">${brand()}<nav aria-label="Main navigation">${items.map(([id,label])=>`<a class="${active===id?'active':''}" href="#${id}">${label}</a>`).join('')}</nav><div class="minimal-header-tools"><a class="header-search" href="#site-resources" aria-label="Search resources">${icon('search')}</a><a class="minimal-signin" href="${appUser?'#home':'#login'}">${appUser?'Open Workspace':'Sign In'}</a></div></header>`;
}

function marketingFooter(){
  return `<footer class="minimal-footer">${brand()}<span>Conversational AI · Enterprise RAG · Document Intelligence · Vision AI</span><span>© CloudCore AI</span></footer>`;
}

function marketingShell(active,body){
  return `<div class="marketing-page minimal-site ${active}">${marketingHeader(active)}<main>${body}</main>${marketingFooter()}</div>`;
}

function compactProductCanvas(){
  return `<div class="product-canvas" aria-label="CloudCore AI product preview">
    <div class="product-rail"><div class="product-mini-brand">${mark()}<b>CloudCore AI</b></div><span class="selected">${icon('chat')}New conversation</span><span>${icon('file')}Knowledge</span><span>${icon('file')}Documents</span><span>${icon('image')}Images</span><span>${icon('sliders')}Workflows</span></div>
    <div class="product-conversation"><div class="product-question">What are the termination terms in our cloud services agreement?</div><div class="product-answer"><i></i><p>Either party may terminate with 30 days’ written notice when a material breach remains uncured after the notice period.</p><div class="source-chip">${icon('file')} Cloud Services Agreement v2.3 · Section 12.1</div></div><div class="product-composer">Ask a question about your data… ${icon('paperclip')}</div></div>
    <aside class="product-inspector"><span>INSPECTOR</span><b>Extracted clause</b><p><strong>12.1 Termination</strong>Written notice is required when a material breach remains uncured.</p><b>Image insight</b><div class="mini-vision">${icon('image')}<span>HVAC unit<br><small>No visible anomaly</small></span></div></aside>
  </div>`;
}

function assistantCanvas(){
  return `<div class="assistant-canvas" aria-label="CloudCore AI Assistant preview">
    <div class="assistant-question">What are the termination conditions in our managed services agreement?</div>
    <div class="assistant-response"><span class="assistant-avatar">CC</span><div><p>The agreement may be terminated under the following conditions:</p><ol><li>Material breach that remains uncured for 30 days after written notice.</li><li>Termination for convenience with 90 days’ written notice.</li><li>Insolvency or similar proceedings affecting either party.</li></ol></div></div>
    <div class="assistant-sources"><b>Sources</b><span>Managed Services Agreement v3.2 <em>Section 12.1 · Material breach</em></span><span>Managed Services Agreement v3.2 <em>Section 12.2 · Convenience</em></span><span>Managed Services Agreement v3.2 <em>Section 12.3 · Insolvency</em></span></div>
    <div class="assistant-composer">Type a message… ${icon('arrow')}</div><small class="knowledge-status">Using approved knowledge</small>
  </div>`;
}

function solutionsPage(){
  const products=[['AI Assistant','Natural language for real work'],['Enterprise RAG','Trusted knowledge, in context'],['Document Intelligence','Understand and extract information'],['Vision AI','Turn images into insights'],['AI Workflows','Repeatable work, with control']];
  return marketingShell('site-solutions',`<section class="minimal-hero solutions-minimal"><div class="minimal-copy"><span class="minimal-kicker">AI SOLUTIONS</span><h1>One AI workspace.<br>Five focused capabilities.</h1><p>Ask questions. Retrieve trusted knowledge. Understand documents and images. Build repeatable AI workflows.</p></div>${compactProductCanvas()}</section><section class="product-index">${products.map(([name,desc])=>`<article><h2>${name}</h2><p>${desc}</p></article>`).join('')}</section>`);
}

function aiPage(){
  return marketingShell('site-ai',`<section class="minimal-hero assistant-minimal"><div class="minimal-copy"><span class="minimal-kicker">AI ASSISTANT</span><h1>Answers grounded<br>in your business.</h1><p>CloudCore AI retrieves from approved knowledge and returns concise answers with sources you can verify.</p></div>${assistantCanvas()}</section><section class="assistant-statement"><h2>Ask naturally. Check the source. Continue the work.</h2><div><span>Cited responses</span><span>Approved knowledge</span><span>Document upload</span><span>Chat history</span><span>Multilingual</span></div></section>`);
}

function industriesPage(){
  const sectors=['Financial Services','Public Sector','Telecommunications','Healthcare','Education','Manufacturing'];
  return marketingShell('site-industries',`<section class="minimal-hero industries-minimal"><div class="minimal-copy"><span class="minimal-kicker">AI BY INDUSTRY</span><h1>The same AI foundation.<br>Shaped by different work.</h1><p>Grounded conversation, document understanding and vision adapt to the information each sector relies on.</p></div><figure class="industry-photo"><img src="assets/industry-ai.png" alt="Telecommunications specialist reviewing operational information in Islamabad"></figure></section><section class="industry-editorial"><nav aria-label="Industries">${sectors.map(s=>`<span class="${s==='Telecommunications'?'selected':''}">${s}</span>`).join('')}</nav><div class="industry-focus"><h2>Telecommunications</h2><p>Turn operational knowledge, field imagery and incident documents into faster, more consistent support.</p><div class="industry-product"><div class="industry-answer"><span>How do I resolve a high VSWR alarm on a site?</span><p>Inspect the feeder and connectors, verify antenna alignment, then compare the reading with the approved maintenance guide.</p><small>RAN Maintenance Guide v3.2 · Site Troubleshooting Handbook</small></div><div class="industry-vision">${icon('image')}<b>Field image analysis</b><span>Possible antenna misalignment</span><small>Human verification required</small></div></div></div></section>`);
}

function resourcesPage(){
  const resources=[['Evaluating grounded answers','Checklist · Enterprise RAG'],['Designing document extraction with human review','Guide · Document Intelligence'],['Planning a vision AI pilot','Guide · Vision AI']];
  return marketingShell('site-resources',`<section class="resources-minimal"><span class="minimal-kicker">AI RESOURCES</span><h1>Clear guidance for<br>building useful AI.</h1><p>RAG, document intelligence, vision and responsible adoption—written for teams putting AI into real work.</p><label class="resource-search">${icon('search')}<input id="resource-search" type="search" placeholder="Search the library" aria-label="Search the resource library"></label></section><section class="resource-list" id="resource-list"><article class="resource-feature" data-resource="enterprise rag knowledge base guide"><h2>Preparing your knowledge base for enterprise RAG</h2><p>A practical guide to structuring, cleaning and governing content for high-quality, grounded answers.</p><small>Guide · Enterprise RAG</small></article><div class="resource-rows">${resources.map(([title,type])=>`<article data-resource="${(title+' '+type).toLowerCase()}"><h3>${title}</h3><small>${type}</small></article>`).join('')}</div></section><section class="documentation-row"><h2>Product documentation</h2><p><a href="#assistant">AI Assistant</a><span>/</span><a href="#documents">Knowledge sources</a><span>/</span><a href="#documents">Document Insight</a><span>/</span><a href="#images">Image Analysis</a></p></section>`);
}

function aboutPage(){
  return marketingShell('site-about',`<section class="minimal-hero about-minimal"><div class="minimal-copy"><span class="minimal-kicker">ABOUT CLOUDCORE AI</span><h1>Business AI should be<br>useful, grounded and clear.</h1><p>CloudCore AI brings conversational AI, enterprise RAG, document intelligence and vision into one coherent product experience.</p></div>${compactProductCanvas()}</section><section class="about-principles-minimal"><h2>Built around the information your teams already use.</h2><article><h3>Ground every answer.</h3><p>Use approved knowledge and show the source.</p></article><article><h3>Keep people in control.</h3><p>Preserve access, review and judgment.</p></article><article><h3>Design for practical adoption.</h3><p>Fit AI into real work without unnecessary complexity.</p></article></section><section class="architecture-line"><span>Business knowledge</span><i></i><span>Enterprise RAG</span><i></i><span>AI Assistant&nbsp;&nbsp;/&nbsp;&nbsp;Document Insight&nbsp;&nbsp;/&nbsp;&nbsp;Image Analysis</span><small>Access controls · Citations · Human review</small></section>`);
}

function marketingPage(r){
  if(r==='site-solutions')return solutionsPage();
  if(r==='site-ai')return aiPage();
  if(r==='site-industries')return industriesPage();
  if(r==='site-resources')return resourcesPage();
  return aboutPage();
}
function toast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');el.onclick=()=>el.classList.remove('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),2800)}
function isNearBottom(box,threshold=60){if(!box)return true;const sh=Number(box.scrollHeight)||0,st=Number(box.scrollTop)||0,ch=Number(box.clientHeight)||0;if(!sh||!ch)return true;return(sh-st-ch)<=threshold}
function route({preserveScroll=false}={}){
  const scrollX=window.scrollX,scrollY=window.scrollY;
  const mBoxBefore=document.querySelector('.meeting-chat-messages');
  const mNear=isNearBottom(mBoxBefore,60);
  const mScroll=mBoxBefore?mBoxBefore.scrollTop:null;
  const aBoxBefore=document.querySelector('.messages');
  const aNear=isNearBottom(aBoxBefore,60);
  const aScroll=aBoxBefore?aBoxBefore.scrollTop:null;
  const tBoxBefore=document.querySelector('.transcript-list');
  const tNear=isNearBottom(tBoxBefore,60);
  const tScroll=tBoxBefore?tBoxBefore.scrollTop:null;

  const raw=location.hash.slice(1)||'landing',r=raw.split('/')[0];
  selectedMeetingId=r==='meetings'&&raw.includes('/')?decodeURIComponent(raw.slice(raw.indexOf('/')+1)):null;
  const active=document.activeElement;
  const isInput=active&&['INPUT','TEXTAREA'].includes(active.tagName);
  const activeSelector=isInput?(active.id?`#${active.id}`:active.name?`[name="${active.name}"]`:null):null;
  const activeVal=isInput?active.value:null;
  const activeStart=isInput?active.selectionStart:null;
  const activeEnd=isInput?active.selectionEnd:null;
  const meetingUrlVal=document.querySelector('#meeting-form input[name="meetingUrl"]')?.value;
  const consentVal=document.querySelector('#meeting-form input[name="consent"]')?.checked;
  const chatPromptVal=document.querySelector('#meeting-chat-form input[name="chatPrompt"]')?.value;
  if(r==='login'||(!appUser&&!publicRoutes.includes(r)&&r!=='landing'&&r!=='about')){
    if(appUser){location.hash='home';return;}
    $('#app').innerHTML=loginView();
    bindLogin();
    return;
  }
  $('#app').innerHTML=r==='landing'||r==='about'?landing():publicRoutes.includes(r)?marketingPage(r):workspace(r);
  bind();
  if((r==='documents'||r==='knowledge')&&!knowledgeLoaded&&typeof loadKnowledge==='function')loadKnowledge();
  if(r==='meetings'&&!selectedMeetingId){
    const input=document.querySelector('input[name="meetingUrl"]'),label=document.querySelector('.bot-identity b');
    if(input){input.type='text';input.inputMode='url';if(meetingUrlVal)input.value=meetingUrlVal}
    const consentBox=document.querySelector('#meeting-form input[name="consent"]');
    if(consentBox&&typeof consentVal==='boolean')consentBox.checked=consentVal;
    if(label)label.textContent='PTCL AI NOTETAKER'
  }
  if(chatPromptVal){
    const chatInput=document.querySelector('#meeting-chat-form input[name="chatPrompt"]');
    if(chatInput)chatInput.value=chatPromptVal
  }
  if(activeSelector){
    const restored=document.querySelector(activeSelector);
    if(restored){
      if(activeVal!==null)restored.value=activeVal;
      try{restored.focus();if(activeStart!==null&&activeEnd!==null)restored.setSelectionRange(activeStart,activeEnd)}catch{}
    }
  }
  const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:fn=>setTimeout(fn,0);
  if(preserveScroll){
    raf(()=>{
      window.scrollTo(scrollX,scrollY);
      const mBox=document.querySelector('.meeting-chat-messages');
      if(mBox){
        if(mNear)mBox.scrollTop=mBox.scrollHeight;
        else if(mScroll!==null)mBox.scrollTop=mScroll;
      }
      const aBox=document.querySelector('.messages');
      if(aBox){
        if(aNear)aBox.scrollTop=aBox.scrollHeight;
        else if(aScroll!==null)aBox.scrollTop=aScroll;
      }
      const tBox=document.querySelector('.transcript-list');
      if(tBox){
        if(tNear)tBox.scrollTop=tBox.scrollHeight;
        else if(tScroll!==null)tBox.scrollTop=tScroll;
      }
    });
  }else{
    window.scrollTo(0,0);
    if(selectedMeetingId&&meetingTab==='chat'){
      raf(()=>{
        const mBox=document.querySelector('.meeting-chat-messages');
        if(mBox)mBox.scrollTop=mBox.scrollHeight;
      });
    }
  }
  if(r==='about')$('#about').scrollIntoView({behavior:'smooth'});
}
function bind(){
  document.querySelectorAll('[data-action]').forEach(el=>el.onclick=(e)=>{if(el.tagName==='A'&&el.dataset.action)e.preventDefault();const a=el.dataset.action;if(a==='notifications')openNotificationsModal();else if(a==='privacy')toast('This workspace stores chat history on this device only.');else if(a==='terms')toast('CloudCore AI Enterprise Workspace · PTCL Smart Cloud.');else actions(a,el)});
  const resourceSearch=$('#resource-search');
  if(resourceSearch&&resourceSearch.addEventListener)resourceSearch.addEventListener('input',()=>{const term=resourceSearch.value.trim().toLowerCase();document.querySelectorAll('[data-resource]').forEach(item=>item.hidden=term&&!item.dataset.resource.includes(term))});
}
let messages=[],currentChat=null,docFile=null,imageFile=null,imageURL='',docTab='Summary',imageMode='upload',historySearch='',selectedMeetingId=null,meetingTab='overview',meetingsTimer=null,meetingsLoading=false,meetingsError='',transcriptSearch='',meetingChats={},meetingChatLoading=false;
let docIngesting=false,docIngested=false,activeDocUploadPromise=null,attachContext='',chatImageAttached=false,pendingDocAutoPrompt='',pendingImageAutoPrompt='',docJobStatus='',visionLoading=false,visionResult='';
let settingsTab='account',settingsUsersList=[],aiHealthStatus=null;
let userPrefs={motionMode:'auto',responseStyle:'balanced',autoRag:'on',notifications:'on'};
try{const savedPrefs=JSON.parse(localStorage.getItem('cloudcore-prefs')||'null');if(savedPrefs&&typeof savedPrefs==='object')userPrefs={...userPrefs,...savedPrefs}}catch{}
function saveUserPrefs(){try{localStorage.setItem('cloudcore-prefs',JSON.stringify(userPrefs))}catch{}}
async function loadSettingsUsers(showFeedback=false){
  if(typeof fetch!=='function'||!['dev','admin'].includes(appUser?.role))return;
  try{
    const res=await fetch('/api/admin/users');
    if(res.ok){
      const data=await res.json();
      let list=data.users||[];
      if(appUser?.role==='admin')list=list.filter(u=>u.role==='user'||u.role==='member');
      settingsUsersList=list;
      if(showFeedback)toast('Workspace user list refreshed.');
      route({preserveScroll:true});
    }
  }catch{}
}
async function loadAiHealth(showFeedback=false){
  if(typeof fetch!=='function')return;
  try{
    const [hRes,mRes]=await Promise.all([fetch('/api/ai/health').catch(()=>null),fetch('/api/me').catch(()=>null)]);
    if(hRes&&hRes.ok)aiHealthStatus=await hRes.json();
    if(mRes&&mRes.ok){const mData=await mRes.json();if(mData.capacity)meetingsState.capacity=mData.capacity;}
    if(showFeedback)toast('Workspace service statuses refreshed.');
    route({preserveScroll:true});
  }catch{}
}
function switchSettingsTab(tab,scrollToUsers=false){
  settingsTab=tab||'account';
  if(location.hash!=='#settings'&&location.hash!=='settings')location.hash='settings';
  route({preserveScroll:!scrollToUsers});
  if(settingsTab==='security'&&['dev','admin'].includes(appUser?.role))loadSettingsUsers();
  if(settingsTab==='integrations')loadAiHealth();
  if(scrollToUsers){
    const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:fn=>setTimeout(fn,0);
    raf(()=>{const panel=document.querySelector('#settings-users-panel');if(panel&&panel.scrollIntoView)panel.scrollIntoView({behavior:'smooth'});});
  }
}
function bindSettingsForms(){
  const profileForm=document.querySelector('#settings-profile-form');
  if(profileForm){
    profileForm.onsubmit=async(e)=>{
      e.preventDefault();
      const f=new FormData(profileForm);
      const displayName=String(f.get('displayName')||'').trim();
      const email=String(f.get('email')||'').trim();
      if(displayName.length<2)return toast('Display name must be at least 2 characters.');
      if(typeof fetch!=='function'){
        if(appUser){appUser.displayName=displayName;appUser.email=email;}
        route({preserveScroll:true});
        return toast('Profile updated.');
      }
      try{
        const res=await fetch('/api/me/profile',{method:'PATCH',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({displayName,email})});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to update profile.');
        if(data.user)appUser=data.user;
        pushNotification('Profile Updated',`Your display name and profile settings were saved.`);
        toast('Profile changes saved.');
        route({preserveScroll:true});
      }catch(err){toast(err.message);}
    };
  }
  const pwForm=document.querySelector('#settings-password-form');
  if(pwForm){
    pwForm.onsubmit=async(e)=>{
      e.preventDefault();
      const errBox=document.querySelector('#settings-pw-err');if(errBox){errBox.style.display='none';errBox.textContent='';}
      const f=new FormData(pwForm),currentPassword=String(f.get('currentPassword')||''),newPassword=String(f.get('newPassword')||''),confirmPassword=String(f.get('confirmPassword')||'');
      if(newPassword.length<6){if(errBox){errBox.textContent='New password must be at least 6 characters.';errBox.style.display='block';}return;}
      if(newPassword!==confirmPassword){if(errBox){errBox.textContent='New passwords do not match.';errBox.style.display='block';}return;}
      try{
        const res=await fetch('/api/auth/change-password',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({currentPassword,newPassword})});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to update password.');
        pwForm.reset();
        pushNotification('Password Updated','Your account password was changed successfully.');
        toast('Your password has been updated.');
      }catch(err){if(errBox){errBox.textContent=err.message;errBox.style.display='block';}else toast(err.message);}
    };
  }
  const createForm=document.querySelector('#settings-create-user-form');
  if(createForm){
    createForm.onsubmit=async(e)=>{
      e.preventDefault();
      const errBox=document.querySelector('#settings-create-user-err');if(errBox){errBox.style.display='none';errBox.textContent='';}
      const f=new FormData(createForm),username=String(f.get('username')||'').trim(),displayName=String(f.get('displayName')||'').trim(),password=String(f.get('password')||''),role=String(f.get('role')||'user');
      const mustChangePassword=appUser?.role==='admin'?true:Boolean(f.get('mustChangePassword'));
      try{
        const res=await fetch('/api/admin/users',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({username,displayName,password,role,mustChangePassword})});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to create user.');
        createForm.reset();
        pushNotification('User Created',`Created ${role} account '${username}'.`);
        toast(`User '${username}' created successfully.`);
        loadSettingsUsers();
      }catch(err){if(errBox){errBox.textContent=err.message;errBox.style.display='block';}else toast(err.message);}
    };
  }
}

// ==========================================
// KNOWLEDGE HUB CLIENT STATE & METHODS
// ==========================================
let knowledgeScope='shared',knowledgeFolders=[],knowledgeDocs=[],activeKnowledgeFolderId=null;
let knowledgeSearch='',knowledgeTypeFilter='all',selectedKnowledgeDocIds=new Set(),knowledgeLoading=false,knowledgeLoaded=false;

async function loadKnowledge(showToast=false){
  if(typeof fetch!=='function')return;
  knowledgeLoading=true;
  try{
    const scopeParam=encodeURIComponent(knowledgeScope);
    const folderParam=activeKnowledgeFolderId?`&folderId=${encodeURIComponent(activeKnowledgeFolderId)}`:'';
    const searchParam=knowledgeSearch?`&search=${encodeURIComponent(knowledgeSearch)}`:'';
    const typeParam=knowledgeTypeFilter&&knowledgeTypeFilter!=='all'?`&type=${encodeURIComponent(knowledgeTypeFilter)}`:'';

    const [foldersRes, docsRes]=await Promise.all([
      fetch(`/api/knowledge/folders?scope=${scopeParam}`,{headers:{'x-requested-with':'CloudCoreAI'}}),
      fetch(`/api/knowledge/documents?scope=${scopeParam}${folderParam}${searchParam}${typeParam}`,{headers:{'x-requested-with':'CloudCoreAI'}})
    ]);
    if(foldersRes.ok){
      const data=await foldersRes.json().catch(()=>({}));
      knowledgeFolders=data.folders||[];
    }
    if(docsRes.ok){
      const data=await docsRes.json().catch(()=>({}));
      knowledgeDocs=data.documents||[];
    }
    knowledgeLoaded=true;
    if(showToast)toast('Knowledge Hub updated.');
  }catch(err){
    console.warn('loadKnowledge error:',err);
  }finally{
    knowledgeLoading=false;
    route({preserveScroll:true});
  }
}

function switchKnowledgeScope(scope){
  knowledgeScope=scope;
  activeKnowledgeFolderId=null;
  selectedKnowledgeDocIds.clear();
  loadKnowledge();
}

function selectKnowledgeFolder(id){
  activeKnowledgeFolderId=id||null;
  selectedKnowledgeDocIds.clear();
  loadKnowledge();
}

function toggleSelectDoc(id){
  if(selectedKnowledgeDocIds.has(id))selectedKnowledgeDocIds.delete(id);
  else selectedKnowledgeDocIds.add(id);
  route({preserveScroll:true});
}

function toggleSelectAllDocs(){
  if(selectedKnowledgeDocIds.size===knowledgeDocs.length){
    selectedKnowledgeDocIds.clear();
  }else{
    selectedKnowledgeDocIds=new Set(knowledgeDocs.map(d=>d.id));
  }
  route({preserveScroll:true});
}

function openNewFolderModal(){
  modal(`
    <div class="ref-modal-box">
      <div class="panel-heading"><span class="feature-icon">${icon('folder')}</span><div><h2>Create New Folder</h2><p>Organize team manuals, technical specs, and documents.</p></div></div>
      <form id="new-folder-form">
        <label class="login-label"><span>Folder Name</span><input name="name" type="text" required maxlength="120" placeholder="e.g. RAN Operations" autofocus></label>
        <div style="margin:16px 0;">
          <span style="display:block;font-size:12px;color:#536477;margin-bottom:8px;">Folder Scope & Access</span>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:8px;cursor:pointer;">
            <input type="radio" name="isShared" value="true" checked>
            <span><b>Workspace Shared</b> (Visible and accessible to all team members)</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
            <input type="radio" name="isShared" value="false">
            <span><b>My Personal Drive</b> (Private to you)</span>
          </label>
        </div>
        <div class="dialog-actions">
          <button type="button" class="outline" data-action="close-dialog">Cancel</button>
          <button type="submit" class="primary">${icon('check')} Create Folder</button>
        </div>
      </form>
    </div>
  `);
  const form=$('#new-folder-form');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      const name=String(new FormData(form).get('name')||'').trim();
      const isShared=new FormData(form).get('isShared')==='true';
      if(!name)return toast('Folder name is required.');
      try{
        const res=await fetch('/api/knowledge/folders',{
          method:'POST',
          headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},
          body:JSON.stringify({name,isShared})
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to create folder.');
        $('#dialog')?.close();
        toast(`Folder "${name}" created.`);
        loadKnowledge();
      }catch(err){toast(err.message);}
    };
  }
}

function openRenameFolderModal(id, currentName, currentShared){
  modal(`
    <div class="ref-modal-box">
      <div class="panel-heading"><span class="feature-icon">${icon('sliders')}</span><div><h2>Rename Folder</h2><p>Change folder title or sharing scope.</p></div></div>
      <form id="rename-folder-form">
        <label class="login-label"><span>Folder Name</span><input name="name" type="text" required maxlength="120" value="${esc(currentName)}"></label>
        <div style="margin:16px 0;">
          <span style="display:block;font-size:12px;color:#536477;margin-bottom:8px;">Folder Scope</span>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:8px;cursor:pointer;">
            <input type="radio" name="isShared" value="true" ${currentShared?'checked':''}>
            <span><b>Workspace Shared</b> (Team-wide)</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
            <input type="radio" name="isShared" value="false" ${!currentShared?'checked':''}>
            <span><b>My Personal Drive</b> (Private)</span>
          </label>
        </div>
        <div class="dialog-actions">
          <button type="button" class="outline" data-action="close-dialog">Cancel</button>
          <button type="submit" class="primary">${icon('check')} Save Changes</button>
        </div>
      </form>
    </div>
  `);
  const form=$('#rename-folder-form');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      const name=String(new FormData(form).get('name')||'').trim();
      const isShared=new FormData(form).get('isShared')==='true';
      if(!name)return toast('Folder name is required.');
      try{
        const res=await fetch(`/api/knowledge/folders/${encodeURIComponent(id)}`,{
          method:'PATCH',
          headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},
          body:JSON.stringify({name,isShared})
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to rename folder.');
        $('#dialog')?.close();
        toast('Folder updated.');
        loadKnowledge();
      }catch(err){toast(err.message);}
    };
  }
}

function openDeleteFolderModal(id, name, fileCount){
  modal(`
    <div class="ref-modal-box">
      <div class="panel-heading"><span class="feature-icon" style="background:#fee2e2;color:#dc2626;">${icon('trash')}</span><div><h2>Delete Folder "${esc(name)}"?</h2><p>This folder currently contains ${fileCount} document${fileCount===1?'':'s'}.</p></div></div>
      <form id="delete-folder-form">
        ${fileCount>0?`
          <div style="margin:16px 0;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
            <span style="display:block;font-size:12px;color:#991b1b;margin-bottom:8px;font-weight:600;">How should files inside be handled?</span>
            <label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="radio" name="cascade" value="false" checked>
              <span><b>Keep files</b> (Move to unfiled / root)</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
              <input type="radio" name="cascade" value="true">
              <span style="color:#b91c1c;"><b>Delete files</b> (Permanently delete all ${fileCount} documents)</span>
            </label>
          </div>
        `:''}
        <div class="dialog-actions">
          <button type="button" class="outline" data-action="close-dialog">Cancel</button>
          <button type="submit" class="primary danger-outline" style="background:#dc2626;color:#fff;border-color:#dc2626;">${icon('trash')} Confirm Delete</button>
        </div>
      </form>
    </div>
  `);
  const form=$('#delete-folder-form');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      const cascade=new FormData(form).get('cascade')==='true';
      try{
        const res=await fetch(`/api/knowledge/folders/${encodeURIComponent(id)}?cascade=${cascade}`,{
          method:'DELETE',
          headers:{'x-requested-with':'CloudCoreAI'}
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to delete folder.');
        if(activeKnowledgeFolderId===id)activeKnowledgeFolderId=null;
        $('#dialog')?.close();
        toast(`Folder "${name}" deleted.`);
        loadKnowledge();
      }catch(err){toast(err.message);}
    };
  }
}

function openBatchUploadModal(){
  const folderOptions=knowledgeFolders.map(f=>`<option value="${esc(f.id)}" ${activeKnowledgeFolderId===f.id?'selected':''}>${esc(f.name)} (${f.isShared?'Shared':'Private'})</option>`).join('');
  modal(`
    <div class="ref-modal-box">
      <div class="panel-heading"><span class="feature-icon">${icon('upload')}</span><div><h2>Upload Documents</h2><p>Batch upload PDF, Word, Excel, PowerPoint, or text files into Knowledge Hub.</p></div></div>
      <form id="batch-upload-form">
        <div class="ref-upload-dropzone" id="batch-dropzone">
          <span class="mini-icon">${icon('upload')}</span>
          <b style="display:block;margin:6px 0 2px;">Choose files or drag & drop here</b>
          <small style="color:#64748b;display:block;margin-bottom:12px;">PDF, DOCX, PPTX, XLSX, CSV, TXT, MD (Max 100MB per batch)</small>
          <input type="file" id="batch-file-input" name="files" multiple accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json" style="display:none;">
          <button type="button" class="outline small" id="batch-choose-files-btn">${icon('plus')} Select Files</button>
        </div>
        <div id="batch-file-list" style="max-height:160px;overflow-y:auto;margin:12px 0;display:none;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0;">
          <label class="login-label">
            <span>Target Folder</span>
            <select name="folderId" class="ref-select" style="margin-top:4px;">
              <option value="">(None / Root Directory)</option>
              ${folderOptions}
            </select>
          </label>
          <label class="login-label">
            <span>Visibility Scope</span>
            <select name="isShared" class="ref-select" style="margin-top:4px;">
              <option value="true" ${knowledgeScope!=='personal'?'selected':''}>Workspace Shared</option>
              <option value="false" ${knowledgeScope==='personal'?'selected':''}>My Personal Drive</option>
            </select>
          </label>
        </div>
        <div class="dialog-actions">
          <button type="button" class="outline" data-action="close-dialog">Cancel</button>
          <button type="submit" class="primary" id="batch-upload-submit-btn" disabled>${icon('upload')} Upload Documents</button>
        </div>
      </form>
    </div>
  `);

  const fileInput=$('#batch-file-input');
  const chooseFilesBtn=$('#batch-choose-files-btn');
  if(chooseFilesBtn&&fileInput){
    chooseFilesBtn.onclick=()=>fileInput.click();
  }
  const dropzone=$('#batch-dropzone');
  const listEl=$('#batch-file-list');
  const submitBtn=$('#batch-upload-submit-btn');
  let selectedFiles=[];

  function renderSelectedFiles(){
    if(!selectedFiles.length){
      if(listEl)listEl.style.display='none';
      if(submitBtn)submitBtn.disabled=true;
      return;
    }
    if(listEl){
      listEl.style.display='block';
      listEl.innerHTML=selectedFiles.map((f,idx)=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f8faf9;border:1px solid #e2ede6;border-radius:8px;margin-bottom:6px;font-size:12px;">
          <span><b>${esc(f.name)}</b> <small style="color:#64748b;">(${formatBytes(f.size)})</small></span>
          <button type="button" class="icon-button" style="width:22px;height:22px;" data-remove-upload-idx="${idx}" aria-label="Remove ${esc(f.name)}">×</button>
        </div>
      `).join('');
      listEl.querySelectorAll('[data-remove-upload-idx]').forEach(btn=>{
        btn.onclick=()=>{
          const i=parseInt(btn.dataset.removeUploadIdx,10);
          selectedFiles.splice(i,1);
          renderSelectedFiles();
        };
      });
    }
    if(submitBtn){
      submitBtn.disabled=false;
      submitBtn.innerHTML=`${icon('upload')} Upload ${selectedFiles.length} File${selectedFiles.length===1?'':'s'}`;
    }
  }

  if(fileInput){
    fileInput.onchange=()=>{
      if(fileInput.files)selectedFiles=[...selectedFiles,...Array.from(fileInput.files)];
      renderSelectedFiles();
    };
  }

  if(dropzone){
    dropzone.ondragover=e=>{e.preventDefault();dropzone.classList.add('dragging')};
    dropzone.ondragleave=()=>dropzone.classList.remove('dragging');
    dropzone.ondrop=e=>{
      e.preventDefault();
      dropzone.classList.remove('dragging');
      if(e.dataTransfer.files)selectedFiles=[...selectedFiles,...Array.from(e.dataTransfer.files)];
      renderSelectedFiles();
    };
  }

  const form=$('#batch-upload-form');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      if(!selectedFiles.length)return toast('Please select at least one file.');
      const fd=new FormData();
      selectedFiles.forEach(f=>fd.append('files',f));
      const targetFolder=form.folderId?.value;
      if(targetFolder)fd.append('folderId',targetFolder);
      fd.append('isShared',form.isShared?.value);

      if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Uploading and parsing…';}
      try{
        const res=await fetch('/api/knowledge/upload',{
          method:'POST',
          headers:{'x-requested-with':'CloudCoreAI'},
          body:fd
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Upload failed.');
        $('#dialog')?.close();
        toast(`${data.uploaded?.length||selectedFiles.length} file(s) uploaded successfully.`);
        loadKnowledge();
      }catch(err){
        toast(err.message);
        if(submitBtn){submitBtn.disabled=false;renderSelectedFiles();}
      }
    };
  }
}

async function openDocumentViewerModal(id){
  try{
    const res=await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}`,{headers:{'x-requested-with':'CloudCoreAI'}});
    if(!res.ok)throw Error('Failed to load document details.');
    const data=await res.json();
    const doc=data.document;
    const rawExt=doc.filename.split('.').pop()||'DOC';
    const ext=rawExt.toLowerCase();

    // 1. PDF in-browser viewer
    if(ext==='pdf'){
      modal(`
        <div class="ref-viewer-modal">
          <div class="ref-viewer-header">
            <div class="ref-viewer-meta">
              <span class="ref-ext-badge ext-pdf">PDF</span>
              <div>
                <h3 title="${esc(doc.filename)}">${esc(doc.filename)}</h3>
                <p>${formatBytes(doc.sizeBytes)} · Folder: <b>${esc(doc.folderName||'Root')}</b> · Owner: <b>${esc(doc.creatorName||'User')}</b> · ${doc.isShared?'Workspace Shared':'Private'}</p>
              </div>
            </div>
            <div class="ref-viewer-header-actions">
              <a class="outline small" href="/api/knowledge/documents/${encodeURIComponent(doc.id)}/view" target="_blank" title="Open full screen in a new tab">${icon('arrow')} Pop out</a>
              <a class="outline small" href="/api/knowledge/documents/${encodeURIComponent(doc.id)}/download" download="${esc(doc.filename)}" title="Download PDF">${icon('download')} Download</a>
              <button type="button" class="icon-button dialog-close" data-action="close-dialog" aria-label="Close">${icon('close')}</button>
            </div>
          </div>
          <div class="ref-viewer-body" style="height:74vh;background:#525659;">
            <iframe src="/api/knowledge/documents/${encodeURIComponent(doc.id)}/view#toolbar=1&navpanes=1" style="width:100%;height:100%;border:0;" title="${esc(doc.filename)}"></iframe>
          </div>
        </div>
      `);
      bindDialog();
      return;
    }

    // 2. Spreadsheet viewer (XLSX, XLS, CSV)
    if(['xlsx','xls','csv'].includes(ext)){
      modal(`
        <div class="ref-viewer-modal">
          <div class="ref-viewer-header">
            <div class="ref-viewer-meta">
              <span class="ref-ext-badge ext-${ext}">${ext.toUpperCase()}</span>
              <div>
                <h3 title="${esc(doc.filename)}">${esc(doc.filename)}</h3>
                <p>${formatBytes(doc.sizeBytes)} · Folder: <b>${esc(doc.folderName||'Root')}</b> · Spreadsheet</p>
              </div>
            </div>
            <div class="ref-viewer-header-actions">
              <label class="ref-sheet-search" style="display:none;" id="ref-sheet-search-wrap">${icon('search')}<input id="ref-sheet-filter-input" placeholder="Search sheet rows…" aria-label="Search rows"></label>
              <a class="outline small" href="/api/knowledge/documents/${encodeURIComponent(doc.id)}/download" download="${esc(doc.filename)}" title="Download file">${icon('download')} Download</a>
              <button type="button" class="icon-button dialog-close" data-action="close-dialog" aria-label="Close">${icon('close')}</button>
            </div>
          </div>
          <div id="ref-sheet-tabs-container"></div>
          <div class="ref-viewer-body ref-sheet-scroll" id="ref-sheet-container" style="height:68vh;overflow:auto;background:#fff;">
            <div style="text-align:center;padding:48px;color:#617281;"><span class="feature-icon" style="margin:0 auto 12px;">${icon('chart')}</span><p>Parsing spreadsheet data…</p></div>
          </div>
          <div class="ref-sheet-statusbar" id="ref-sheet-statusbar" style="display:none;"></div>
        </div>
      `);
      bindDialog();

      try{
        const sRes=await fetch(`/api/knowledge/documents/${encodeURIComponent(doc.id)}/sheet-data`,{headers:{'x-requested-with':'CloudCoreAI'}});
        if(!sRes.ok)throw Error('Could not parse spreadsheet structure.');
        const sData=await sRes.json();
        const sheets=sData.sheets||[];
        if(!sheets.length)throw Error('No sheet tables found.');

        let activeSheetIdx=0;
        const container=$('#ref-sheet-container');
        const tabsBox=$('#ref-sheet-tabs-container');
        const searchWrap=$('#ref-sheet-search-wrap');
        const filterInput=$('#ref-sheet-filter-input');
        const statusbar=$('#ref-sheet-statusbar');

        if(searchWrap)searchWrap.style.display='inline-flex';
        if(statusbar)statusbar.style.display='flex';

        function renderSheet(idx,filterTerm=''){
          activeSheetIdx=idx;
          const curSheet=sheets[idx];
          if(!curSheet)return;
          const rows=curSheet.rows||[];
          const term=filterTerm.trim().toLowerCase();
          const filteredRows=term?rows.filter(r=>r.some(c=>String(c||'').toLowerCase().includes(term))):rows;

          if(tabsBox && sheets.length>1){
            tabsBox.innerHTML=`<div class="ref-sheet-tabs-bar">${sheets.map((s,i)=>`
              <button type="button" class="ref-sheet-tab-btn ${i===activeSheetIdx?'active':''}" data-sheet-idx="${i}">📊 ${esc(s.name)} <small>(${s.totalRows} rows)</small></button>
            `).join('')}</div>`;
            tabsBox.querySelectorAll('[data-sheet-idx]').forEach(btn=>{
              btn.onclick=()=>renderSheet(parseInt(btn.dataset.sheetIdx,10),filterInput?.value||'');
            });
          }

          if(!filteredRows.length){
            if(container)container.innerHTML=`<div style="text-align:center;padding:40px;color:#718292;"><p>No rows matching "${esc(filterTerm)}"</p></div>`;
            if(statusbar)statusbar.innerHTML=`<span>Showing <b>0</b> of ${rows.length} rows · Active Sheet: <b>${esc(curSheet.name)}</b></span>`;
            return;
          }

          const colCount=Math.max(...filteredRows.map(r=>r.length),1);
          const colLetters=[];
          for(let c=0;c<colCount;c++){
            let letter='';
            let temp=c;
            while(temp>=0){
              letter=String.fromCharCode(65+(temp%26))+letter;
              temp=Math.floor(temp/26)-1;
            }
            colLetters.push(letter);
          }

          let html=`<table class="ref-excel-table"><thead><tr><th class="ref-cell-num">#</th>${colLetters.map(l=>`<th class="ref-cell-col-header">${l}</th>`).join('')}</tr></thead><tbody>`;
          filteredRows.forEach((r,rIdx)=>{
            html+=`<tr><td class="ref-cell-num">${rIdx+1}</td>`;
            for(let c=0;c<colCount;c++){
              const val=r[c]!==undefined?String(r[c]):'';
              const isNum=/^-?\d+(\.\d+)?%?$/.test(val.trim());
              html+=`<td class="${isNum?'ref-cell-number':''}">${esc(val)}</td>`;
            }
            html+='</tr>';
          });
          html+='</tbody></table>';
          if(container)container.innerHTML=html;
          if(statusbar)statusbar.innerHTML=`<span>Showing <b>${filteredRows.length}</b> rows · <b>${colCount}</b> columns · Active Sheet: <b>${esc(curSheet.name)}</b></span>`;
        }

        renderSheet(0);

        if(filterInput){
          let searchTimer;
          filterInput.oninput=()=>{
            clearTimeout(searchTimer);
            searchTimer=setTimeout(()=>{
              renderSheet(activeSheetIdx,filterInput.value);
            },200);
          };
        }
      }catch(sheetErr){
        const container=$('#ref-sheet-container');
        if(container){
          container.innerHTML=`
            <div style="padding:20px;">
              <div style="padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:14px;font-size:12px;color:#991b1b;">
                Spreadsheet grid view not available. Displaying extracted text preview below.
              </div>
              <pre style="font-family:monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;color:#1e293b;background:#f8fafc;padding:14px;border-radius:10px;border:1px solid #e2e8f0;max-height:58vh;overflow:auto;">${esc(doc.extractedText||'No text content.')}</pre>
            </div>
          `;
        }
      }
      return;
    }

    // 3. Image inline viewer
    if(['png','jpg','jpeg','webp','svg','gif'].includes(ext)){
      modal(`
        <div class="ref-viewer-modal">
          <div class="ref-viewer-header">
            <div class="ref-viewer-meta">
              <span class="ref-ext-badge ext-png">IMG</span>
              <div>
                <h3 title="${esc(doc.filename)}">${esc(doc.filename)}</h3>
                <p>${formatBytes(doc.sizeBytes)} · Folder: <b>${esc(doc.folderName||'Root')}</b> · Image</p>
              </div>
            </div>
            <div class="ref-viewer-header-actions">
              <a class="outline small" href="/api/knowledge/documents/${encodeURIComponent(doc.id)}/view" target="_blank">${icon('arrow')} Full Size</a>
              <a class="outline small" href="/api/knowledge/documents/${encodeURIComponent(doc.id)}/download" download="${esc(doc.filename)}">${icon('download')} Download</a>
              <button type="button" class="icon-button dialog-close" data-action="close-dialog" aria-label="Close">${icon('close')}</button>
            </div>
          </div>
          <div class="ref-viewer-body" style="height:72vh;display:grid;place-items:center;background:#0f172a;padding:20px;overflow:auto;">
            <img src="/api/knowledge/documents/${encodeURIComponent(doc.id)}/view" style="max-height:68vh;max-width:100%;object-fit:contain;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.5);" alt="${esc(doc.filename)}">
          </div>
        </div>
      `);
      bindDialog();
      return;
    }

    // 4. Default / Word / Text / Markdown viewer
    modal(`
      <div class="ref-viewer-modal">
        <div class="ref-viewer-header">
          <div class="ref-viewer-meta">
            <span class="ref-ext-badge ext-${esc(ext)}">${esc(ext.toUpperCase())}</span>
            <div>
              <h3 title="${esc(doc.filename)}">${esc(doc.filename)}</h3>
              <p>${formatBytes(doc.sizeBytes)} · Folder: <b>${esc(doc.folderName||'Root')}</b> · Owner: <b>${esc(doc.creatorName||'User')}</b> · ${doc.tokenCount||0} tokens</p>
            </div>
          </div>
          <div class="ref-viewer-header-actions">
            <a class="primary small" href="/api/knowledge/documents/${encodeURIComponent(doc.id)}/download" download="${esc(doc.filename)}">${icon('download')} Download</a>
            <button type="button" class="icon-button dialog-close" data-action="close-dialog" aria-label="Close">${icon('close')}</button>
          </div>
        </div>
        <div class="ref-viewer-body" style="height:72vh;overflow-y:auto;padding:24px 30px;background:#fbfdfc;">
          <article class="ref-doc-formatted-reader" style="max-width:860px;margin:0 auto;background:#fff;padding:32px 36px;border:1px solid #dce8e0;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.03);line-height:1.75;font-size:14px;color:#1e293b;white-space:pre-wrap;font-family:system-ui,-apple-system,sans-serif;">${esc(doc.extractedText||'No text could be extracted from this document.')}</article>
        </div>
      </div>
    `);
    bindDialog();
  }catch(err){toast(err.message);}
}
const openPreviewDocModal=openDocumentViewerModal;

function openMoveDocModal(id){
  const doc=knowledgeDocs.find(d=>d.id===id);
  const folderOptions=knowledgeFolders.map(f=>`<option value="${esc(f.id)}" ${doc&&doc.folderId===f.id?'selected':''}>${esc(f.name)} (${f.isShared?'Shared':'Private'})</option>`).join('');
  modal(`
    <div class="ref-modal-box">
      <div class="panel-heading"><span class="feature-icon">${icon('folder')}</span><div><h2>Move Document</h2><p>Change folder for "${esc(doc?.filename||'document')}".</p></div></div>
      <form id="move-doc-form">
        <label class="login-label">
          <span>Destination Folder</span>
          <select name="folderId" class="ref-select" style="margin-top:6px;">
            <option value="">(None / Root Directory)</option>
            ${folderOptions}
          </select>
        </label>
        <div class="dialog-actions" style="margin-top:18px;">
          <button type="button" class="outline" data-action="close-dialog">Cancel</button>
          <button type="submit" class="primary">${icon('check')} Move Document</button>
        </div>
      </form>
    </div>
  `);
  const form=$('#move-doc-form');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      const folderId=form.folderId.value||null;
      try{
        const res=await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}`,{
          method:'PATCH',
          headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},
          body:JSON.stringify({folderId})
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to move document.');
        $('#dialog')?.close();
        toast('Document moved.');
        loadKnowledge();
      }catch(err){toast(err.message);}
    };
  }
}

function openDeleteDocModal(id, filename){
  modal(`
    <div class="ref-modal-box">
      <div class="panel-heading"><span class="feature-icon" style="background:#fee2e2;color:#dc2626;">${icon('trash')}</span><div><h2>Delete Document?</h2><p>Permanently remove "${esc(filename)}" from the Knowledge Hub.</p></div></div>
      <div class="dialog-actions" style="margin-top:18px;">
        <button type="button" class="outline" data-action="close-dialog">Cancel</button>
        <button type="button" class="primary danger-outline" style="background:#dc2626;color:#fff;border-color:#dc2626;" data-action="confirm-delete-single-doc" data-id="${esc(id)}" data-filename="${esc(filename)}">${icon('trash')} Delete Document</button>
      </div>
    </div>
  `);
}

function openBatchMoveDocsModal(){
  const ids=[...selectedKnowledgeDocIds];
  if(!ids.length)return toast('No documents selected.');
  const folderOptions=knowledgeFolders.map(f=>`<option value="${esc(f.id)}">${esc(f.name)} (${f.isShared?'Shared':'Private'})</option>`).join('');
  modal(`
    <div class="ref-modal-box">
      <div class="panel-heading"><span class="feature-icon">${icon('folder')}</span><div><h2>Move ${ids.length} Documents</h2><p>Select target destination folder.</p></div></div>
      <form id="batch-move-form">
        <label class="login-label">
          <span>Destination Folder</span>
          <select name="targetFolderId" class="ref-select" style="margin-top:6px;">
            <option value="">(None / Root Directory)</option>
            ${folderOptions}
          </select>
        </label>
        <div class="dialog-actions" style="margin-top:18px;">
          <button type="button" class="outline" data-action="close-dialog">Cancel</button>
          <button type="submit" class="primary">${icon('check')} Move ${ids.length} Documents</button>
        </div>
      </form>
    </div>
  `);
  const form=$('#batch-move-form');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      const targetFolderId=form.targetFolderId.value||null;
      try{
        const res=await fetch('/api/knowledge/batch-move',{
          method:'POST',
          headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},
          body:JSON.stringify({documentIds:ids,targetFolderId})
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to batch move documents.');
        selectedKnowledgeDocIds.clear();
        $('#dialog')?.close();
        toast(`${data.movedIds?.length||ids.length} documents moved.`);
        loadKnowledge();
      }catch(err){toast(err.message);}
    };
  }
}

function confirmBatchDeleteDocs(){
  const ids=[...selectedKnowledgeDocIds];
  if(!ids.length)return toast('No documents selected.');
  modal(`
    <div class="ref-modal-box">
      <div class="panel-heading"><span class="feature-icon" style="background:#fee2e2;color:#dc2626;">${icon('trash')}</span><div><h2>Delete ${ids.length} Documents?</h2><p>Permanently remove the ${ids.length} selected documents from Knowledge Hub.</p></div></div>
      <div class="dialog-actions" style="margin-top:18px;">
        <button type="button" class="outline" data-action="close-dialog">Cancel</button>
        <button type="button" class="primary danger-outline" style="background:#dc2626;color:#fff;border-color:#dc2626;" data-action="confirm-delete-batch-docs">${icon('trash')} Delete ${ids.length} Documents</button>
      </div>
    </div>
  `);
}

let appNotifications=[{id:'welcome',title:'CloudCore AI Ready',text:'Connected to Qwen3.5-27B & Whisper intelligence.',time:Date.now(),unread:true}];
function hasUnreadNotifications(){return appNotifications.some(n=>n.unread)}
function pushNotification(titleText,bodyText){appNotifications=[{id:String(Date.now()+Math.random()),title:titleText,text:bodyText,time:Date.now(),unread:true},...appNotifications].slice(0,25)}
function openNotificationsModal(){
  appNotifications.forEach(n=>{n.unread=false});
  const bell=document.querySelector('.notification');
  if(bell){bell.classList.remove('has-unread');const dot=bell.querySelector('i');if(dot)dot.remove();}
  modal(`<div class="notifications-modal">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h2 style="margin:0;">Notifications</h2>
      ${appNotifications.length?`<button type="button" class="outline small" style="margin:0;" data-action="clear-notifications">Clear all</button>`:''}
    </div>
    ${appNotifications.length?`<div class="notifications-list">${appNotifications.map(n=>`<div class="notification-item"><span class="mini-icon">${icon('bell')}</span><div><b>${esc(n.title)}</b><p style="margin:3px 0 0;font-size:13px;">${esc(n.text)}</p><small style="color:#75867e;font-size:11px;">${new Date(n.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join('')}</div>`:`<p style="text-align:center;padding:20px 0;">You’re all caught up. No new notifications.</p>`}
  </div>`);
  bindDialog();
}
let appUser=null,meetingsState={meetings:[],capacity:{active:0,maximum:2},detail:null,lastLoaded:0};
let chats=[];try{chats=JSON.parse(localStorage.getItem('cloudcore-chats')||'[]')}catch{}
const navs=[['home','home','Home'],['assistant','chat','AI Assistant'],['meetings','video','Meetings AI'],['documents','folder','Knowledge Hub'],['images','image','Image Analysis'],['history','history','Chat History']];
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function sidebar(r){return refSidebar(r)}
function workspace(r){return refWorkspace(r)}
function home(){return refHome()}
function composer(id){
  const hasDoc=Boolean(docFile);
  const hasImg=Boolean(chatImageAttached&&imageFile);
  const hasAttachment=hasDoc||hasImg;
  const chips=[];
  if(hasDoc){
    chips.push(`<span class="attachment-chip">${icon('file')}<b>${esc(docFile.name)}</b><small>${docIngesting?'Indexing…':docIngested?'Ready for Q&A':'Attached'}</small><button type="button" class="chip-remove" data-action="remove-attached-doc" aria-label="Remove attached document">×</button></span>`);
  }
  if(hasImg){
    chips.push(`<span class="attachment-chip">${icon('image')}<b>${esc(imageFile.name)}</b><small>Ready for Vision AI</small><button type="button" class="chip-remove" data-action="remove-attached-image" aria-label="Remove attached image">×</button></span>`);
  }
  const placeholder=hasDoc?`Ask anything about "${docFile.name}" (or press Send to summarize)...`:hasImg?`Ask about "${imageFile.name}" (or press Send to analyze)...`:id==='home'?'Ask anything about PTCL, our services, documents, or upload an image...':'Ask CloudCore AI anything...';
  return `<form class="composer ${hasAttachment?'has-attachments':''}" id="${id}-composer"><div>${chips.length?`<div class="composer-attachments">${chips.join('')}</div>`:''}<input name="prompt" aria-label="Message CloudCore AI" placeholder="${esc(placeholder)}" autocomplete="off" ${hasAttachment?'':'required'}><button type="button" class="icon-button" data-action="attach-document" title="Attach PDF, Word, Excel or text file" aria-label="Attach a document">${icon('paperclip')}</button><button type="button" class="icon-button" data-action="attach-image" title="Attach image for analysis" aria-label="Upload an image">${icon('image')}</button></div><button type="submit" class="send" aria-label="Send message">${icon('arrow')}</button></form>`;
}
function title(eyebrow,title,sub){return `<div class="section-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${sub}</p></div><div class="heading-brand">${mark('heading-mark')}<span><b>CloudCore AI</b><small>A product of PTCL Smart Cloud</small></span></div></div>`}
const sampleSummary='This example document outlines PTCL’s enterprise connectivity solutions including dedicated internet, MPLS, cloud services and managed support SLAs for corporate clients. It highlights key service features, deployment options, benefits and commercial terms.';
function documents(){return refDocuments()}
function images(){return refImages()}
const activeMeetingStatuses=['launching','lobby','joined','recording','stopping','processing'];
function statusText(status){return({launching:'Starting bot',lobby:'Waiting in lobby',joined:'Joined',recording:'Recording',stopping:'Stopping',processing:'Preparing MOM',completed:'Completed',failed:'Needs attention',deleted:'Deleted'})[status]||status}
function formatMeetingTime(ms){const total=Math.max(0,Math.floor(ms/1000)),minutes=Math.floor(total/60);return `${String(minutes).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function meetingRowView(m){const active=activeMeetingStatuses.includes(m.status);return `<button class="meeting-row" data-action="open-meeting" data-id="${esc(m.id)}"><span class="meeting-platform">T</span><span><b>${esc(m.title||'Microsoft Teams meeting')}</b><small>${new Date(m.createdAt).toLocaleString()} · ${esc(statusText(m.status))}</small></span><span class="meeting-status ${esc(m.status)}"><i></i>${active?'Live':esc(statusText(m.status))}</span>${icon('chevron')}</button>`}
function meetings(){return refMeetings()}
function meetingDetailView(){const m=meetingsState.detail;if(!m||m.id!==selectedMeetingId)return `${title('MEETING INTELLIGENCE','Loading meeting…','Retrieving the latest meeting status.')}<section class="panel meeting-loading">${meetingsError?esc(meetingsError):'Please wait…'}</section>`;const chatCount=(meetingChats[m.id]||[]).length;const tabs=[['overview','Overview'],['mom','MOM'],['transcript','Transcript'],['snapshots','Snapshots'],['chat','AI Assistant Q&A'],['audio','Audio']];return `<div class="breadcrumb"><a href="#meetings">Meetings AI</a>${icon('chevron')}<span>${esc(m.title)}</span></div><section class="meeting-detail-head panel"><div><span class="meeting-status ${esc(m.status)}"><i></i>${esc(statusText(m.status))}</span><h1>${esc(m.title)}</h1><p>${new Date(m.createdAt).toLocaleString()} · Bot: ${esc(m.botName||'PTCL AI NOTETAKER')}</p></div><div class="meeting-head-actions">${activeMeetingStatuses.includes(m.status)&&m.status!=='processing'?`<button class="outline" data-action="stop-meeting" data-id="${esc(m.id)}">Stop bot</button>`:''}<button class="icon-button danger" data-action="delete-meeting" data-id="${esc(m.id)}" aria-label="Delete meeting">${icon('trash')}</button></div></section>${m.failureMessage?`<div class="meeting-alert"><b>${esc(statusText(m.status))}</b><span>${esc(m.failureMessage)}</span></div>`:''}<div class="meeting-tabs" role="tablist">${tabs.map(([id,label])=>`<button class="${meetingTab===id?'active':''}" data-action="meeting-tab" data-tab="${id}">${label}<small>${id==='transcript'?(m.transcript||[]).length:id==='snapshots'?(m.snapshots||[]).length:id==='chat'?chatCount:''}</small></button>`).join('')}</div>${meetingDetailTab(m)}`}
function renderMarkdown(text){
  if(!text)return'';
  let s=String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s=s.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi,(_m,_lang,code)=>`<pre class="chat-code-block"><code>${code.trim()}</code></pre>`);
  s=s.replace(/`([^`\n]+)`/g,'<code class="chat-inline-code">$1</code>');
  const lines=s.split('\n');
  const out=[];
  let inUl=false,inOl=false,inTable=false,tableHead=true;
  function inline(str){
    return str
      .replace(/\*\*\*([^*]+)\*\*\*/g,'<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/__([^_]+)__/g,'<strong>$1</strong>')
      .replace(/(^|[^\*])\*([^\*\n\s][^\*\n]*[^\*\n\s]|\S)\*([^\*]|$)/g,'$1<em>$2</em>$3')
      .replace(/(^|[^_])_([^_\n\s][^_\n]*[^_\n\s]|\S)_([^_]|$)/g,'$1<em>$2</em>$3');
  }
  for(let i=0;i<lines.length;i++){
    const raw=lines[i];
    const line=raw.trim();
    if(/^(\s*[-*_]\s*){3,}$/.test(line)){
      if(inUl){out.push('</ul>');inUl=false;}
      if(inOl){out.push('</ol>');inOl=false;}
      if(inTable){out.push('</table></div>');inTable=false;}
      out.push('<hr class="chat-hr">');
      continue;
    }
    if(/^\|(.+)\|$/.test(line)){
      if(/^\|(\s*[-:]+[-| :]*)\|$/.test(line)){tableHead=false;continue;}
      if(!inTable){
        if(inUl){out.push('</ul>');inUl=false;}
        if(inOl){out.push('</ol>');inOl=false;}
        inTable=true;tableHead=true;
        out.push('<div class="table-wrap"><table class="chat-table">');
      }
      const cells=line.split('|').slice(1,-1).map(c=>c.trim());
      const tag=tableHead?'th':'td';
      out.push('<tr>'+cells.map(c=>`<${tag}>${inline(c)}</${tag}>`).join('')+'</tr>');
      continue;
    }else if(inTable){
      out.push('</table></div>');
      inTable=false;
    }
    const ulMatch=raw.match(/^(\s*)(?:[\*\-\+]|•)\s+(.*)$/);
    if(ulMatch){
      if(inOl){out.push('</ol>');inOl=false;}
      if(!inUl){out.push('<ul class="chat-list">');inUl=true;}
      out.push(`<li>${inline(ulMatch[2])}</li>`);
      continue;
    }
    const olMatch=raw.match(/^(\s*)\d+[\.\)]\s+(.*)$/);
    if(olMatch){
      if(inUl){out.push('</ul>');inUl=false;}
      if(!inOl){out.push('<ol class="chat-list">');inOl=true;}
      out.push(`<li>${inline(olMatch[2])}</li>`);
      continue;
    }
    if(inUl){out.push('</ul>');inUl=false;}
    if(inOl){out.push('</ol>');inOl=false;}
    if(/^####\s+(.+)$/.test(line)){out.push(`<h5 class="chat-h5">${inline(line.replace(/^####\s+/,''))}</h5>`);continue;}
    if(/^###\s+(.+)$/.test(line)){out.push(`<h4 class="chat-h4">${inline(line.replace(/^###\s+/,''))}</h4>`);continue;}
    if(/^##\s+(.+)$/.test(line)){out.push(`<h3 class="chat-h3">${inline(line.replace(/^##\s+/,''))}</h3>`);continue;}
    if(/^#\s+(.+)$/.test(line)){out.push(`<h2 class="chat-h2">${inline(line.replace(/^#\s+/,''))}</h2>`);continue;}
    if(/^&gt;\s*(.*)$/.test(line)){out.push(`<blockquote class="chat-quote">${inline(line.replace(/^&gt;\s*/,''))}</blockquote>`);continue;}
    if(!line){out.push('<div class="chat-gap"></div>');continue;}
    out.push(`<p class="chat-p">${inline(raw)}</p>`);
  }
  if(inUl)out.push('</ul>');
  if(inOl)out.push('</ol>');
  if(inTable)out.push('</table></div>');
  return out.join('');
}
function meetingChatView(m){const history=meetingChats[m.id]||[];const suggestions=['What is he saying right now?','Who is speaking in this meeting?','Summarize discussion so far','Any key decisions or action items mentioned?'];return `<section class="panel meeting-chat-panel"><div class="panel-heading" style="display:flex;justify-content:space-between;align-items:flex-start;"><div style="display:flex;gap:12px;align-items:center;"><span class="feature-icon" style="width:40px;height:40px;border-radius:12px;background:#e8f7ee;color:var(--green);display:grid;place-items:center;">${icon('spark')}</span><div><h2 style="font-size:18px;margin:0;">Meeting AI Assistant</h2><p style="margin-top:3px;color:var(--muted);font-size:12px;">Real-time Q&A powered by local Qwen3 & Whisper transcription</p></div></div><span class="live-pill" style="margin-top:4px;"><span class="pulse-dot"></span> Qwen MOM / Q&A Active</span></div><div class="quick-queries">${suggestions.map(q=>`<button type="button" class="quick-query-btn" data-action="quick-meeting-ask" data-query="${esc(q)}">${icon('spark')} ${esc(q)}</button>`).join('')}</div><div class="meeting-chat-messages" aria-live="polite">${history.length?history.map(item=>`<div class="meeting-chat-bubble ${item.role}"><span class="chat-role">${item.role==='user'?'You':'CloudCore Meeting AI'}</span><div ${item.streaming?'id="active-meeting-stream-bubble"':''} class="chat-text">${item.streaming&&!item.content?`<span class="live-pill"><span class="pulse-dot"></span> Analyzing meeting transcript...</span><span class="typing-cursor"></span>`:renderMarkdown(item.content)+(item.streaming?'<span class="typing-cursor"></span>':'')}</div></div>`).join(''):`<div class="meeting-chat-empty"><span class="icon">${icon('chat')}</span><h3>Ask questions about this meeting</h3><p>Ask "What is he saying?", "Who is speaking?", or "Summarize the key points". The AI analyzes live transcripts in real time.</p></div>`}${meetingChatLoading&&!history.some(h=>h.streaming)?`<div class="meeting-chat-bubble assistant"><span class="chat-role">CloudCore Meeting AI</span><div class="chat-text live-pill"><span class="pulse-dot"></span> Analyzing meeting transcript...</div></div>`:''}</div><form id="meeting-chat-form" class="meeting-chat-composer"><input name="chatPrompt" placeholder="Ask what is being said, who spoke, or request a summary..." autocomplete="off" required ${meetingChatLoading?'disabled':''}><button class="primary" type="submit" ${meetingChatLoading?'disabled':''}>${icon('arrow')} Ask</button></form></section>`}
async function sendMeetingChat(meetingId,prompt){prompt=(prompt||'').trim();if(!prompt||meetingChatLoading)return;if(!meetingChats[meetingId])meetingChats[meetingId]=[];meetingChats[meetingId].push({role:'user',content:prompt});const assistantMsg={role:'assistant',content:'',streaming:true};meetingChats[meetingId].push(assistantMsg);meetingChatLoading=true;route({preserveScroll:true});setTimeout(()=>{const box=document.querySelector('.meeting-chat-messages');if(box)box.scrollTop=box.scrollHeight},10);try{const res=await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/chat?stream=true`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({message:prompt})});if(!res.ok){const err=await res.json().catch(()=>({}));throw Error(err.error?.message||err.detail||`AI service error (${res.status})`)}const reader=res.body?.getReader();if(!reader){const data=await res.json();assistantMsg.content=data.answer||data.reply||'No answer returned from AI.';}else{const decoder=new TextDecoder();let buffer='';while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()??'';for(const line of lines){const trimmed=line.trim();if(!trimmed||trimmed.startsWith(':'))continue;if(trimmed==='data: [DONE]')break;if(trimmed.startsWith('data: ')){try{const parsed=JSON.parse(trimmed.slice(6));if(parsed.full){assistantMsg.content=parsed.full}else if(parsed.delta){assistantMsg.content+=parsed.delta}else if(parsed.error){assistantMsg.content=`Error: ${parsed.error}`}const bubble=document.getElementById('active-meeting-stream-bubble')||document.querySelector('.meeting-chat-messages .meeting-chat-bubble.assistant:last-child .chat-text');if(bubble){const box=document.querySelector('.meeting-chat-messages');const shouldAutoScroll=isNearBottom(box,60);bubble.innerHTML=renderMarkdown(assistantMsg.content)+'<span class="typing-cursor"></span>';if(box&&shouldAutoScroll)box.scrollTop=box.scrollHeight}}catch{}}}}}}catch(err){assistantMsg.content=`Error: ${err.message}`}finally{delete assistantMsg.streaming;meetingChatLoading=false;const boxBefore=document.querySelector('.meeting-chat-messages');const wasNear=isNearBottom(boxBefore,60);const savedScrollTop=boxBefore?boxBefore.scrollTop:null;route({preserveScroll:true});setTimeout(()=>{const box=document.querySelector('.meeting-chat-messages');if(box){if(wasNear)box.scrollTop=box.scrollHeight;else if(savedScrollTop!==null)box.scrollTop=savedScrollTop}},10)}}
function meetingDetailTab(m){if(meetingTab==='mom')return momView(m);if(meetingTab==='chat')return meetingChatView(m);if(meetingTab==='transcript'){const term=(transcriptSearch||'').trim().toLowerCase();const all=m.transcript||[];const list=term?all.filter(s=>(s.text||'').toLowerCase().includes(term)||(s.speakerName||'').toLowerCase().includes(term)):all;const isLive=activeMeetingStatuses.includes(m.status);return `<section class="panel transcript-panel"><div class="transcript-toolbar"><div class="transcript-search">${icon('search')}<input id="transcript-filter" type="search" placeholder="Search transcript or speaker..." value="${esc(transcriptSearch)}" aria-label="Search transcript"></div><div class="transcript-meta-strip">${isLive?`<span class="live-pill"><span class="pulse-dot"></span> Live Transcribing</span>`:''}<span>${list.length} of ${all.length} segments</span></div></div><div class="transcript-list">${list.length?list.map(s=>`<article><time>${formatMeetingTime(s.startMs)}</time><div><span class="speaker-tag">${icon('user')}${esc(s.speakerName||'Participant')}</span><p>${esc(s.text)}</p></div></article>`).join(''):`<div class="meeting-empty"><span>${icon('chat')}</span><h3>${term?'No matching transcript segments':'Transcript not available yet'}</h3><p>${term?'Try searching with different terms.':'Live segments appear here while the bot is recording.'}</p></div>`}</div></section>`}if(meetingTab==='snapshots'){const isLive=activeMeetingStatuses.includes(m.status);const snaps=m.snapshots||[];return `<section class="panel snapshot-section"><div class="panel-heading" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;"><div><h2 style="font-size:18px;margin:0;">Meeting Screens & Snapshots</h2><p style="margin-top:4px;color:var(--muted);font-size:12px;">Live display from Teams bot and periodic screen captures.</p></div>${isLive?`<button class="outline" data-action="refresh-live-screenshot">${icon('history')} Refresh Live Screen</button>`:''}</div>${isLive?`<div class="live-bot-frame"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><span class="live-pill"><span class="pulse-dot"></span> Live Bot View (Teams Display)</span><small style="color:var(--muted);font-size:11px;">Display :99.0 · Updated live</small></div><div class="live-screen-wrap"><img id="live-bot-screen-img" src="/api/meetings/${encodeURIComponent(m.id)}/live-screenshot?t=${Date.now()}" alt="Live bot screen view" onerror="this.closest('.live-bot-frame').style.display='none';"></div></div>`:''}<div class="snapshot-grid">${snaps.length?snaps.map(s=>`<figure class="snapshot-card"><img src="/api/meetings/${encodeURIComponent(m.id)}/snapshots/${encodeURIComponent(s.id)}" alt="Screen snapshot at ${formatMeetingTime(s.capturedAtMs)}"><figcaption><span>${icon('image')} Shared Screen</span><time style="margin-left:auto;">${formatMeetingTime(s.capturedAtMs)}</time></figcaption></figure>`).join(''):(!isLive?`<div class="meeting-empty"><span>${icon('image')}</span><h3>No snapshots captured yet</h3><p>Screenshots taken during the session will appear here.</p></div>`:'')}</div></section>`}if(meetingTab==='audio'){const isRecording=activeMeetingStatuses.includes(m.status);return `<section class="panel audio-panel"><span class="feature-icon">${icon('signal')}</span><h2>Meeting Audio Recording</h2><p>Private encrypted recording stored securely. Accessible only to authorized CloudCore workspace members.</p>${isRecording?`<div class="audio-recording-notice"><span class="live-pill"><span class="pulse-dot"></span> Live Audio Recording In Progress</span><p>Teams bot is streaming and capturing 48kHz audio directly from the call. Full playback and export download are unlocked as soon as the meeting ends.</p></div>`:''}${m.recordingObjectKey?`<div class="audio-player-wrap"><audio controls preload="metadata" src="/api/meetings/${encodeURIComponent(m.id)}/audio"></audio><div class="audio-meta"><span>${icon('signal')} WebM Opus · 48kHz Stereo</span><a class="outline audio-download-btn" href="/api/meetings/${encodeURIComponent(m.id)}/audio" download="${esc(m.title||'meeting')}-audio.webm">${icon('download')} Download Audio</a></div></div>`:(!isRecording?'<div class="meeting-empty"><span>'+icon('signal')+'</span><h3>Audio not available</h3><p>Audio recording is only saved for meetings with recording enabled.</p></div>':'')}</section>`;}const recentSegments=(m.transcript||[]).slice(-3);return `<div class="meeting-overview"><section class="panel overview-metrics">${[['clock','Status',statusText(m.status)],['users','Participants',String((m.participants||[]).length)],['chat','Transcript segments',String((m.transcript||[]).length)],['image','Snapshots',String((m.snapshots||[]).length)]].map(([i,k,v])=>`<div><span>${icon(i)}</span><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</section>${recentSegments.length?`<section class="panel live-preview-strip" style="grid-column:1/-1;"><div style="display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:8px;">${activeMeetingStatuses.includes(m.status)?`<span class="live-pill"><span class="pulse-dot"></span> Real-time Speech</span>`:icon('spark')}<h3 style="font-size:14px;margin:0;">Recent Discussion</h3></div><button class="outline small" data-action="meeting-tab" data-tab="chat">${icon('spark')} Ask AI about this</button></div><div class="recent-segments">${recentSegments.map(s=>`<div class="recent-seg"><time>${formatMeetingTime(s.startMs)}</time><strong>${esc(s.speakerName||'Speaker')}:</strong><span>${esc(s.text)}</span></div>`).join('')}</div></section>`:''}<section class="panel participant-panel"><div class="panel-heading">${icon('users')}<h2>Meeting Participants</h2></div>${(m.participants||[]).length?(m.participants||[]).map(p=>`<div class="participant-row"><span>${esc((p.displayName||'U').charAt(0).toUpperCase())}</span><div><b>${esc(p.displayName||'Participant')}</b>${p.speakerId?`<small style="display:block;color:#75867e;">ID: ${esc(p.speakerId)}</small>`:''}</div><span class="p-status ${p.leftAt?'left':'active'}">${!p.leftAt?'<i></i>':''}${p.leftAt?'Left':'In meeting'}</span></div>`).join(''):'<div class="meeting-empty">Participant details appear after the bot is admitted.</div>'}</section><section class="panel privacy-panel"><h2>${icon('shield')} Recording & Privacy Controls</h2><p>Audio and transcript expire on ${new Date(m.expiresAt).toLocaleDateString()}. The Teams link is removed within 24 hours of completion.</p><div style="margin-top:14px;display:flex;gap:8px;"><button class="outline small" data-action="meeting-tab" data-tab="transcript">${icon('chat')} Full Transcript</button><button class="outline small" data-action="meeting-tab" data-tab="chat">${icon('spark')} Ask AI Assistant</button></div></section></div>`}
function lines(value){return value?value.split('\n').map(v=>v.trim()).filter(Boolean):[]}
function momView(m){if(!m.mom)return `<section class="panel meeting-empty mom-empty"><span>${icon('spark')}</span><h3>${m.status==='processing'?'Preparing Minutes of Meeting':'MOM is not available'}</h3><p>${m.status==='processing'?'CloudCore AI is reviewing the final transcript.':'Finish the meeting, then generate the MOM from its transcript.'}</p>${['completed','failed'].includes(m.status)?`<button class="primary" data-action="regenerate-mom" data-id="${esc(m.id)}">Generate MOM</button>`:''}</section>`;const mom=m.mom;return `<form id="mom-form" class="panel mom-editor"><div class="mom-toolbar"><div><span class="eyebrow">MINUTES OF MEETING</span><h2>Review and edit</h2></div><button type="button" class="outline" data-action="copy-mom">Copy</button><button type="button" class="outline" data-action="download-mom">${icon('download')} Markdown</button><button type="button" class="outline" data-action="preview-mom">${icon('arrow')} Preview Report</button><button type="button" class="primary" data-action="print-mom">${icon('download')} Download PDF / Print</button><button class="primary" type="submit">Save changes</button></div><label>Executive summary<textarea name="summary" required>${esc(mom.summary)}</textarea></label><div class="mom-form-grid"><label>Attendees<small>One name per line</small><textarea name="attendees">${esc((mom.attendees||[]).join('\n'))}</textarea></label><label>Topics<small>Title | Notes</small><textarea name="topics">${esc((mom.topics||[]).map(x=>`${x.title} | ${x.notes}`).join('\n'))}</textarea></label><label>Decisions<small>One decision per line</small><textarea name="decisions">${esc((mom.decisions||[]).map(x=>x.decision).join('\n'))}</textarea></label><label>Action items<small>Task | Owner | Due date</small><textarea name="actionItems">${esc((mom.actionItems||[]).map(x=>`${x.task} | ${x.owner||''} | ${x.dueDate||''}`).join('\n'))}</textarea></label><label>Risks<textarea name="risks">${esc((mom.risks||[]).join('\n'))}</textarea></label><label>Open questions<textarea name="openQuestions">${esc((mom.openQuestions||[]).join('\n'))}</textarea></label></div></form>`}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI',...(options.headers||{})}});let payload={};try{payload=await response.json()}catch{}if(response.status===401){appUser=null;location.hash='login';route();throw Error('Authentication required.')}if(!response.ok)throw Error(payload.error?.message||`Request failed (${response.status}).`);return payload}
function scheduleMeetingsPoll(){clearTimeout(meetingsTimer);meetingsTimer=null;if(!location.hash.startsWith('#meetings'))return;const isActive=selectedMeetingId&&activeMeetingStatuses.includes(meetingsState.detail?.status);const pollDelay=isActive?5000:8000;meetingsTimer=setTimeout(()=>refreshMeetings(),pollDelay)}
function updateMeetingsLiveDom(){if(!location.hash.startsWith('#meetings'))return;if(!selectedMeetingId){const listEl=document.querySelector('.meeting-list');if(listEl){listEl.innerHTML=meetingsState.meetings.length?meetingsState.meetings.map(meetingRowView).join(''):`<div class="meeting-empty"><span>${icon('video')}</span><h3>No meetings yet</h3><p>Your recorded Teams meetings will appear here.</p></div>`;document.querySelectorAll('[data-action="open-meeting"]').forEach(el=>el.onclick=()=>{meetingTab='overview';meetingsState.detail=null;location.hash=`meetings/${el.dataset.id}`;refreshMeetings(true)})}const capI=document.querySelector('.capacity i');const capSm=document.querySelector('.capacity small');if(capI)capI.style.width=`${Math.min(100,meetingsState.capacity.active/meetingsState.capacity.maximum*100)}%`;if(capSm)capSm.textContent=`${meetingsState.capacity.active} of ${meetingsState.capacity.maximum} meeting slots active`;return}const m=meetingsState.detail;if(!m||m.id!==selectedMeetingId)return;const statusBadge=document.querySelector('.meeting-detail-head .meeting-status');if(statusBadge){statusBadge.className=`meeting-status ${esc(m.status)}`;statusBadge.innerHTML=`<i></i>${esc(statusText(m.status))}`}const stopBtn=document.querySelector('[data-action="stop-meeting"]');if(stopBtn&&(!activeMeetingStatuses.includes(m.status)||m.status==='processing')){stopBtn.remove()}const tabs=document.querySelectorAll('.meeting-tabs button');tabs.forEach(tabBtn=>{const tabName=tabBtn.dataset.tab;const countEl=tabBtn.querySelector('small');if(countEl){const count=tabName==='transcript'?(m.transcript||[]).length:tabName==='snapshots'?(m.snapshots||[]).length:tabName==='chat'?(meetingChats[m.id]||[]).length:'';countEl.textContent=count}});const active=document.activeElement;if(meetingTab==='chat'){if(meetingChatLoading||(meetingChats[m.id]||[]).some(item=>item.streaming))return;const msgBox=document.querySelector('.meeting-chat-messages');if(msgBox){const history=meetingChats[m.id]||[];const rendered=history.length?history.map(item=>`<div class="meeting-chat-bubble ${item.role}"><span class="chat-role">${item.role==='user'?'You':'CloudCore Meeting AI'}</span><div class="chat-text">${renderMarkdown(item.content)}</div></div>`).join(''):`<div class="meeting-chat-empty"><span class="icon">${icon('chat')}</span><h3>Ask questions about this meeting</h3><p>Ask "What is he saying?", "Who is speaking?", or "Summarize the key points". The AI analyzes live transcripts in real time.</p></div>`;if(msgBox.innerHTML!==rendered){const wasNear=isNearBottom(msgBox,60);const savedTop=msgBox.scrollTop;msgBox.innerHTML=rendered;if(wasNear)msgBox.scrollTop=msgBox.scrollHeight;else msgBox.scrollTop=savedTop}}}else if(meetingTab==='transcript'&&active?.id!=='transcript-filter'){const term=(transcriptSearch||'').trim().toLowerCase();const all=m.transcript||[];const list=term?all.filter(s=>(s.text||'').toLowerCase().includes(term)||(s.speakerName||'').toLowerCase().includes(term)):all;const isLive=activeMeetingStatuses.includes(m.status);const metaStrip=document.querySelector('.transcript-meta-strip');if(metaStrip)metaStrip.innerHTML=`${isLive?`<span class="live-pill"><span class="pulse-dot"></span> Live Transcribing</span>`:''}<span>${list.length} of ${all.length} segments</span>`;const listWrap=document.querySelector('.transcript-list');if(listWrap){const wasNear=isNearBottom(listWrap,60);const savedTop=listWrap.scrollTop;const rendered=list.length?list.map(s=>`<article><time>${formatMeetingTime(s.startMs)}</time><div><span class="speaker-tag">${icon('user')}${esc(s.speakerName||'Participant')}</span><p>${esc(s.text)}</p></div></article>`).join(''):`<div class="meeting-empty"><span>${icon('chat')}</span><h3>${term?'No matching transcript segments':'Transcript not available yet'}</h3><p>${term?'Try searching with different terms.':'Live segments appear here while the bot is recording.'}</p></div>`;if(listWrap.innerHTML!==rendered){listWrap.innerHTML=rendered;if(wasNear)listWrap.scrollTop=listWrap.scrollHeight;else listWrap.scrollTop=savedTop}}}else if(meetingTab==='snapshots'){const snaps=m.snapshots||[];const snapGrid=document.querySelector('.snapshot-grid');if(snapGrid&&snaps.length){snapGrid.innerHTML=snaps.map(s=>`<figure class="snapshot-card"><img src="/api/meetings/${encodeURIComponent(m.id)}/snapshots/${encodeURIComponent(s.id)}" alt="Screen snapshot at ${formatMeetingTime(s.capturedAtMs)}"><figcaption><span>${icon('image')} Shared Screen</span><time style="margin-left:auto;">${formatMeetingTime(s.capturedAtMs)}</time></figcaption></figure>`).join('')}}}
async function refreshMeetings(force=false){if(meetingsLoading&&!force)return;if(meetingChatLoading||(meetingChats[selectedMeetingId]||[]).some(m=>m.streaming)){scheduleMeetingsPoll();return}meetingsLoading=true;try{if(!appUser){const identity=await api('/api/me');appUser=identity.user}if(selectedMeetingId){meetingsState.detail=await api(`/api/meetings/${encodeURIComponent(selectedMeetingId)}`)}else{const list=await api('/api/meetings');meetingsState={...meetingsState,...list};if(list.meetings?.length){meetingsState.preview=await api(`/api/meetings/${encodeURIComponent(list.meetings[0].id)}`).catch(()=>list.meetings[0])}else{meetingsState.preview=null}}meetingsState.lastLoaded=Date.now();meetingsError=''}catch(error){meetingsError=error.message}finally{meetingsLoading=false;if(meetingChatLoading||(meetingChats[selectedMeetingId]||[]).some(m=>m.streaming)){scheduleMeetingsPoll();return}if(location.hash.startsWith('#meetings')){const hasDetailDom=Boolean(document.querySelector('.meeting-detail-head'));const dialogOpen=Boolean(document.querySelector('#dialog[open]'));if((selectedMeetingId&&hasDetailDom)||(!selectedMeetingId&&dialogOpen)){updateMeetingsLiveDom()}else{route({preserveScroll:true})}}scheduleMeetingsPoll()}}
async function startMeeting(form){const data=new FormData(form);const meetingUrl=data.get('meetingUrl');const consent=data.get('consent')==='on';if($('#dialog')?.open)$('#dialog').close();meetingsLoading=true;meetingsError='';route();try{const meeting=await api('/api/meetings',{method:'POST',body:JSON.stringify({meetingUrl,consent})});location.hash=`meetings/${meeting.id}`;await refreshMeetings(true)}catch(error){meetingsError=error.message;meetingsLoading=false;toast(error.message);route()}}
async function meetingCommand(id,command,method='POST'){try{await api(`/api/meetings/${encodeURIComponent(id)}${command}`,{method});toast(command==='/stop'?'The bot is leaving the meeting.':command==='/regenerate-mom'?'MOM generation started.':'Meeting deletion started.');if(method==='DELETE')location.hash='meetings'}catch(error){toast(error.message)}finally{await refreshMeetings(true)}}
function momFromForm(form,mom){const data=new FormData(form),topics=lines(data.get('topics')).map((v,i)=>{const [title,...notes]=v.split('|');return{title:title.trim(),notes:notes.join('|').trim(),timestampMs:mom.topics?.[i]?.timestampMs}}),decisions=lines(data.get('decisions')).map((decision,i)=>({decision,timestampMs:mom.decisions?.[i]?.timestampMs})),actionItems=lines(data.get('actionItems')).map((v,i)=>{const [task,owner,dueDate]=v.split('|').map(x=>x.trim());return{task,owner:owner||undefined,dueDate:dueDate||undefined,timestampMs:mom.actionItems?.[i]?.timestampMs}});return{summary:String(data.get('summary')||''),attendees:lines(data.get('attendees')),topics,decisions,actionItems,risks:lines(data.get('risks')),openQuestions:lines(data.get('openQuestions'))}}
function momMarkdown(m){const formEl=typeof document!=='undefined'?document.querySelector('#mom-form'):null;const mom=formEl?momFromForm(formEl,m?.mom):m?.mom;if(!mom)return'';return `# ${m.title||'Meeting Minutes'}\n\n## Summary\n${mom.summary}\n\n## Attendees\n${(mom.attendees||[]).map(x=>`- ${x}`).join('\n')}\n\n## Topics\n${(mom.topics||[]).map(t=>`- **${typeof t==='string'?t:t.title}**${t?.notes?`: ${t.notes}`:''}`).join('\n')}\n\n## Decisions\n${(mom.decisions||[]).map(x=>`- ${typeof x==='string'?x:x.decision}`).join('\n')}\n\n## Action items\n${(mom.actionItems||[]).map(x=>`- ${x.task}${x.owner?` — ${x.owner}`:''}${x.dueDate?` (${x.dueDate})`:''}`).join('\n')}\n\n## Risks\n${(mom.risks||[]).map(x=>`- ${x}`).join('\n')}\n\n## Open questions\n${(mom.openQuestions||[]).map(x=>`- ${x}`).join('\n')}`}
function momPdfHtml(m,showTopBar=false){
  const mom=m?.mom||{};
  const title=(m?.title&&m.title!=='Untitled meeting')?m.title:'Meeting Minutes';
  const reportDate=m?.createdAt?new Date(m.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not specified';
  const summary=(mom.summary||'').trim()||'Not specified';
  const attendees=Array.isArray(mom.attendees)?mom.attendees.filter(Boolean):[];
  const attendeesHtml=attendees.length?attendees.map(a=>`<div class="mom-attendee-item">${esc(a)}</div>`).join(''):'<div class="mom-empty-text">Not specified</div>';
  const rawTopics=Array.isArray(mom.topics)?mom.topics:[];
  const topicsHtml=rawTopics.length?rawTopics.map((t,idx)=>{
    const tTitle=typeof t==='string'?t:(t.title||`Topic ${idx+1}`);
    const tNotes=typeof t==='string'?'':(t.notes||'');
    return `<div class="mom-topic-item"><div class="mom-topic-num">${idx+1}</div><div class="mom-topic-content"><div class="mom-topic-title">${esc(tTitle)}</div>${tNotes?`<div class="mom-topic-notes">${esc(tNotes)}</div>`:''}</div></div>`;
  }).join(''):'<div class="mom-empty-text">Not specified</div>';
  const rawDecisions=Array.isArray(mom.decisions)?mom.decisions:[];
  const decisionsHtml=rawDecisions.length?`<ul class="mom-bullets">${rawDecisions.map(d=>{const text=typeof d==='string'?d:(d.decision||'');return text?`<li>${esc(text)}</li>`:''}).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';
  const rawActions=Array.isArray(mom.actionItems)?mom.actionItems:[];
  const actionItemsHtml=rawActions.length?rawActions.map(a=>{
    const task=a.task||'';
    const owner=a.owner||'Not specified';
    const dueDate=a.dueDate||'Not specified';
    return `<tr><td style="font-weight:500;">${esc(task)}</td><td>${esc(owner)}</td><td>${esc(dueDate)}</td></tr>`;
  }).join(''):'<tr><td colspan="3" class="mom-empty-text" style="padding:12px 14px;">Not specified</td></tr>';
  const rawRisks=Array.isArray(mom.risks)?mom.risks.filter(Boolean):[];
  const risksHtml=rawRisks.length?`<ul class="mom-bullets">${rawRisks.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';
  const rawQuestions=Array.isArray(mom.openQuestions)?mom.openQuestions.filter(Boolean):[];
  const questionsHtml=rawQuestions.length?`<ul class="mom-bullets">${rawQuestions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Meeting Minutes - ${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4 portrait;margin:14mm 14mm 14mm 14mm}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0}
body{font-family:'Roboto',-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:${showTopBar?'#f1f5f9':'#ffffff'};color:#0f172a;font-size:13px;line-height:1.55;-webkit-font-smoothing:antialiased}
.mom-pdf-page{width:100%;max-width:780px;margin:${showTopBar?'24px auto 40px':'0 auto'};padding:24px;background:#ffffff;${showTopBar?'box-shadow:0 4px 20px rgba(0,0,0,0.08);border-radius:8px;':''}}
@media print{
body{background:#ffffff!important;margin:0!important}
.mom-pdf-page{max-width:100%!important;width:100%!important;margin:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important}
.no-print{display:none!important}
.mom-card,.mom-two-col-unequal,.mom-two-col-equal,tr,.mom-topic-item{page-break-inside:avoid!important;break-inside:avoid!important}
}
.top-bar{position:sticky;top:0;background:#0f172a;color:#ffffff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-family:'Roboto',sans-serif}
.top-bar-left{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500}
.top-bar-left b{color:#22c55e;font-weight:700}
.top-bar-actions{display:flex;gap:10px}
.btn-print{background:#0a8740;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px}
.btn-print:hover{background:#087337}
.btn-close{background:transparent;color:#cbd5e1;border:1px solid #475569;padding:8px 14px;border-radius:6px;font-size:12px;cursor:pointer}
.btn-close:hover{background:#1e293b;color:#ffffff}
.mom-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}
.mom-eyebrow{font-size:10.5px;font-weight:700;color:#486558;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:6px}
.mom-accent-bar{width:44px;height:4.5px;background:#0a8740;border-radius:3px;margin-bottom:12px}
.mom-title{font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;line-height:1.15}
.mom-header-right{display:flex;align-items:center;gap:10px;padding-top:4px}
.mom-calendar-icon{display:flex;align-items:center}
.mom-report-meta{text-align:left}
.mom-meta-label{font-size:11.5px;color:#64748b;font-weight:500}
.mom-meta-val{font-size:11.5px;color:#64748b;font-weight:500}
.mom-card{border-radius:8px;padding:16px 20px;margin-bottom:16px}
.mom-card-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.mom-badge{width:28px;height:28px;border-radius:50%;background:#0a8740;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ffffff}
.mom-badge svg{width:15px;height:15px}
.mom-section-title{font-size:13px;font-weight:800;color:#0b3d1f;letter-spacing:0.8px;text-transform:uppercase}
.mom-summary-card{background:#f3f8f5;border:1px solid #dce8e0}
.mom-summary-text{font-size:12.5px;line-height:1.6;color:#334155}
.mom-two-col-unequal{display:grid;grid-template-columns:31% calc(69% - 16px);gap:16px;margin-bottom:16px}
.mom-white-card{background:#ffffff;border:1px solid #e2e8f0}
.mom-attendees-list{font-size:12.5px;color:#334155;line-height:1.6}
.mom-attendee-item{margin-bottom:4px}
.mom-empty-text{color:#64748b;font-size:12.5px}
.mom-topics-list{display:flex;flex-direction:column}
.mom-topic-item{display:flex;gap:14px;align-items:flex-start;padding:4px 0}
.mom-topic-item:not(:first-child){border-top:1px solid #f1f5f9;padding-top:14px;margin-top:10px}
.mom-topic-num{width:26px;height:26px;border-radius:50%;background:#e0f0e6;color:#0a8740;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.mom-topic-content{flex:1}
.mom-topic-title{font-size:13.5px;font-weight:700;color:#0f172a;margin-bottom:4px}
.mom-topic-notes{font-size:12.5px;line-height:1.55;color:#475569}
.mom-bullets{padding-left:20px;margin:0}
.mom-bullets li{font-size:12.5px;line-height:1.6;color:#334155;margin-bottom:5px}
.mom-table{width:100%;border-collapse:collapse;margin-top:10px}
.mom-table th{background:#edf6f1;color:#0d4722;font-size:11px;font-weight:700;letter-spacing:0.6px;padding:9px 14px;text-align:left}
.mom-table td{padding:10px 14px;font-size:12.5px;color:#334155;border-top:1px solid #f1f5f9}
.mom-table tr:first-child td{border-top:none}
.mom-two-col-equal{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.mom-footer{margin-top:24px;padding-top:14px;border-top:1.5px solid #0a8740;page-break-inside:avoid;break-inside:avoid}
.mom-footer-text{text-align:center;font-size:11.5px;font-weight:700;color:#0f172a}
</style>
</head>
<body>
${showTopBar?`
<div class="top-bar no-print">
  <div class="top-bar-left">
    <b>CloudCore AI</b> &nbsp;|&nbsp; Minutes of Meeting &mdash; ${esc(title)}
  </div>
  <div class="top-bar-actions">
    <button class="btn-print" onclick="window.print()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print / Save as PDF
    </button>
    <button class="btn-close" onclick="window.close()">Close</button>
  </div>
</div>`:''}
<div class="mom-pdf-page">
  <header class="mom-header">
    <div class="mom-header-left">
      <div class="mom-eyebrow">MINUTES OF MEETING</div>
      <div class="mom-accent-bar"></div>
      <h1 class="mom-title">Meeting Minutes</h1>
    </div>
    <div class="mom-header-right">
      <div class="mom-calendar-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a8740" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>
      <div class="mom-report-meta">
        <div class="mom-meta-label">Generated report</div>
        <div class="mom-meta-val">${esc(reportDate)}</div>
      </div>
    </div>
  </header>

  <section class="mom-card mom-summary-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      </div>
      <h2 class="mom-section-title">EXECUTIVE SUMMARY</h2>
    </div>
    <p class="mom-summary-text">${esc(summary)}</p>
  </section>

  <div class="mom-two-col-unequal">
    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">ATTENDEES</h2>
      </div>
      <div class="mom-attendees-list">
        ${attendeesHtml}
      </div>
    </section>

    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">TOPICS</h2>
      </div>
      <div class="mom-topics-list">
        ${topicsHtml}
      </div>
    </section>
  </div>

  <section class="mom-card mom-white-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 class="mom-section-title">DECISIONS</h2>
    </div>
    ${decisionsHtml}
  </section>

  <section class="mom-card mom-white-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
        </svg>
      </div>
      <h2 class="mom-section-title">ACTION ITEMS</h2>
    </div>
    <table class="mom-table">
      <thead>
        <tr>
          <th style="width:54%;">TASK</th>
          <th style="width:24%;">OWNER</th>
          <th style="width:22%;">DUE DATE</th>
        </tr>
      </thead>
      <tbody>
        ${actionItemsHtml}
      </tbody>
    </table>
  </section>

  <div class="mom-two-col-equal">
    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 21h22L12 2zm0 3.8L20.2 19H3.8L12 5.8zM11 10h2v4h-2v-4zm0 6h2v2h-2v-2z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">RISKS</h2>
      </div>
      ${risksHtml}
    </section>

    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge" style="font-weight:800;font-size:15px;font-family:sans-serif;">
          ?
        </div>
        <h2 class="mom-section-title">OPEN QUESTIONS</h2>
      </div>
      ${questionsHtml}
    </section>
  </div>

  <footer class="mom-footer">
    <div class="mom-footer-text">Report generated by PTCL Cloudcore AI</div>
  </footer>
</div>
</body>
</html>`;
}
function printMomPdf(m){
  if(!m||typeof document==='undefined')return;
  const formEl=document.querySelector('#mom-form');
  const activeMom=formEl?momFromForm(formEl,m.mom):(m.mom||{});
  const data={...m,mom:activeMom};
  const html=momPdfHtml(data,false);
  let iframe=document.querySelector('#mom-print-frame');
  if(!iframe&&typeof document.createElement==='function'){
    iframe=document.createElement('iframe');
    iframe.id='mom-print-frame';
    iframe.style.position='fixed';
    iframe.style.right='0';
    iframe.style.bottom='0';
    iframe.style.width='0';
    iframe.style.height='0';
    iframe.style.border='0';
    document.body?.appendChild(iframe);
  }
  if(iframe){
    const doc=iframe.contentWindow?.document||iframe.contentDocument;
    if(doc){
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(()=>{
        try{
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }catch(e){
          if(typeof window!=='undefined'&&window.open){
            const win=window.open('','_blank');
            if(win){
              win.document.open();
              win.document.write(html);
              win.document.close();
              setTimeout(()=>{try{win.focus();win.print()}catch(_){}},300);
            }
          }
        }
      },250);
      return;
    }
  }
  if(typeof window!=='undefined'&&window.open){
    const win=window.open('','_blank');
    if(win){
      win.document.open();
      win.document.write(html);
      win.document.close();
      setTimeout(()=>{try{win.focus();win.print()}catch(_){}},300);
    }
  }
}
function previewMomPdf(m){
  if(!m||typeof window==='undefined'||!window.open)return;
  const formEl=document.querySelector('#mom-form');
  const activeMom=formEl?momFromForm(formEl,m.mom):(m.mom||{});
  const data={...m,mom:activeMom};
  const html=momPdfHtml(data,true);
  const win=window.open('','_blank');
  if(win){
    win.document.open();
    win.document.write(html);
    win.document.close();
  }else{
    printMomPdf(m);
  }
}
function assistant(){return `${title('YOUR INTELLIGENT WORKSPACE','AI Assistant','Answers, ideas and a little help moving your business forward.')}<section class="chat-panel panel"><div class="chat-top">${mark('chat-brand-mark')}<strong>CloudCore AI</strong><span>Frontend preview</span><button class="icon-button" data-action="new-chat" aria-label="Start new chat">${icon('plus')}</button></div><div class="messages" aria-live="polite">${messages.length?messages.map(m=>`<div class="message ${m.role}"><span class="message-avatar">${m.role==='user'?esc((appUser?.displayName||'A').charAt(0).toUpperCase()):mark('message-mark')}</span><div ${m.streaming?'id="active-assistant-stream-bubble"':''} class="chat-text">${m.streaming&&!m.content?`<span class="live-pill"><span class="pulse-dot"></span> CloudCore AI is thinking...</span><span class="typing-cursor"></span>`:renderMarkdown(m.content)+(m.streaming?'<span class="typing-cursor"></span>':'')}</div></div>`).join(''):`<div class="chat-welcome"><span class="feature-icon ai-feature-mark">${mark()}</span><h2>What can I help you with?</h2><p>Bring your questions. Let’s find a way forward.</p><div class="chat-starters">${['Explore PTCL cloud solutions','Help me draft a proposal','How can I analyze a document?','What can Image Analysis do?'].map(t=>`<button data-action="suggestion" data-prompt="${t}">${t}${icon('arrow')}</button>`).join('')}</div></div>`}</div>${composer('chat')}<p class="chat-caption">CloudCore AI assistant · Real-time Qwen intelligence</p></section>`}
function history(){const filtered=chats.filter(c=>c.title.toLowerCase().includes(historySearch.toLowerCase()));return `${title('YOUR CONVERSATIONS','Chat History','Pick up where you left off. Your conversations are saved on this device.')}<section class="panel history-panel"><div class="history-toolbar"><label>${icon('search')}<input id="history-search" aria-label="Search conversations" placeholder="Search your conversations..." value="${esc(historySearch)}"></label><button class="primary" data-action="new-chat">${icon('plus')}New Chat</button></div><div id="history-list">${filtered.length?filtered.map(c=>`<div class="history-row"><span class="mini-icon">${icon('chat')}</span><button class="history-open" data-action="open-chat" data-id="${c.id}"><b>${esc(c.title)}</b><small>${new Date(c.updated).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} · ${c.messages.filter(m=>m.role==='user').length} messages</small></button><button class="icon-button" data-action="delete-chat" data-id="${c.id}" aria-label="Delete conversation">${icon('trash')}</button></div>`).join(''):`<div class="history-empty"><span class="feature-icon">${icon('history')}</span><h2>${historySearch?'No matching conversations':'Your next great idea starts here'}</h2><p>${historySearch?'Try searching with a different word.':'Start a conversation with CloudCore AI and find it here whenever you need it.'}</p><button class="outline" data-action="new-chat">Start a new chat ${icon('arrow')}</button></div>`}</div></section>`}
function modal(content,{uncloseable=false}={}){
  $('#dialog-content').innerHTML=content;
  const closeBtn=document.querySelector('.dialog-close');
  if(closeBtn)closeBtn.style.display=uncloseable?'none':'block';
  if($('#dialog')){
    $('#dialog').classList.toggle('uncloseable',uncloseable);
    $('#dialog').showModal();
  }
  if(typeof bindDialog==='function')bindDialog();
}

function loginView(){
  return `<div class="login-page">
    <div class="hero-backdrop"></div>
    <header class="login-header">
      ${brand()}
      <a class="outline small" href="#landing">${icon('arrow')} Back to Website</a>
    </header>
    <main class="login-main">
      <div class="login-card panel">
        <div class="login-brand">
          ${mark('login-mark')}
          <h2>Sign in to <b>CloudCore AI</b></h2>
          <p>PTCL Smart Cloud Enterprise Workspace</p>
        </div>
        <form id="login-form" class="login-form">
          <div id="login-error" class="login-alert" style="display:none;"></div>
          <label class="login-label">
            <span>Username</span>
            <div class="input-with-icon">
              ${icon('user')}
              <input name="username" type="text" autocomplete="username" required placeholder="Enter your username" autofocus>
            </div>
          </label>
          <label class="login-label">
            <span>Password</span>
            <div class="input-with-icon">
              ${icon('shield')}
              <input name="password" type="password" autocomplete="current-password" required placeholder="Enter your password">
            </div>
          </label>
          <button type="submit" class="primary login-submit" id="login-submit-btn">
            ${icon('lock')} Sign In
          </button>
        </form>
        <div class="login-footnote">
          <small>Protected by PTCL Smart Cloud enterprise authentication.</small>
        </div>
      </div>
    </main>
    ${footer()}
  </div>`;
}

function bindLogin(){
  const form=document.querySelector('#login-form');
  if(!form)return;
  form.onsubmit=async(e)=>{
    e.preventDefault();
    const errBox=document.querySelector('#login-error'),submitBtn=document.querySelector('#login-submit-btn');
    if(errBox){errBox.style.display='none';errBox.textContent='';}
    if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Signing in...';}
    const data=new FormData(form);
    const username=String(data.get('username')||'').trim(),password=String(data.get('password')||'');
    try{
      const res=await fetch('/api/auth/login',{
        method:'POST',
        headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},
        body:JSON.stringify({username,password})
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(result.error?.message||'Invalid username or password.');
      appUser=result.user;
      toast(`Welcome back, ${appUser.displayName}!`);
      if(appUser.mustChangePassword){
        location.hash='home';
        route();
        checkMustChangePassword();
      }else{
        location.hash='home';
        route();
      }
    }catch(err){
      if(errBox){errBox.textContent=err.message;errBox.style.display='block';}
      else toast(err.message);
    }finally{
      if(submitBtn){submitBtn.disabled=false;submitBtn.innerHTML=`${icon('lock')} Sign In`;}
    }
  };
}

function checkMustChangePassword(){
  if(!appUser||!appUser.mustChangePassword)return;
  modal(`
    <div class="must-change-password-box">
      <span class="feature-icon">${icon('shield')}</span>
      <h2>Password Change Required</h2>
      <p style="font-size:13px;color:#5a7366;margin:8px 0 16px;">Your account was initialized with a temporary password. For security, you must set a new personal password before using CloudCore AI.</p>
      <form id="must-change-password-form" class="login-form">
        <div id="must-change-err" class="login-alert" style="display:none;"></div>
        <label class="login-label">
          <span>Current Temporary Password</span>
          <div class="input-with-icon">
            ${icon('shield')}
            <input name="currentPassword" type="password" required placeholder="Enter current temporary password">
          </div>
        </label>
        <label class="login-label">
          <span>New Password</span>
          <div class="input-with-icon">
            ${icon('shield')}
            <input name="newPassword" type="password" minlength="6" required placeholder="Minimum 6 characters">
          </div>
        </label>
        <label class="login-label">
          <span>Confirm New Password</span>
          <div class="input-with-icon">
            ${icon('shield')}
            <input name="confirmPassword" type="password" minlength="6" required placeholder="Re-enter new password">
          </div>
        </label>
        <button type="submit" class="primary login-submit" id="must-change-btn">
          ${icon('check')} Set Password & Continue
        </button>
      </form>
    </div>
  `,{uncloseable:true});

  const form=document.querySelector('#must-change-password-form');
  if(form){
    form.onsubmit=async(e)=>{
      e.preventDefault();
      const errBox=document.querySelector('#must-change-err'),btn=document.querySelector('#must-change-btn');
      if(errBox){errBox.style.display='none';errBox.textContent='';}
      const f=new FormData(form);
      const currentPassword=String(f.get('currentPassword')||''),newPassword=String(f.get('newPassword')||''),confirmPassword=String(f.get('confirmPassword')||'');
      if(newPassword.length<6){if(errBox){errBox.textContent='New password must be at least 6 characters.';errBox.style.display='block';}return;}
      if(newPassword!==confirmPassword){if(errBox){errBox.textContent='New password and confirmation do not match.';errBox.style.display='block';}return;}
      if(newPassword===currentPassword){if(errBox){errBox.textContent='New password must be different from current password.';errBox.style.display='block';}return;}
      if(btn){btn.disabled=true;btn.textContent='Updating...';}
      try{
        const res=await fetch('/api/auth/change-password',{
          method:'POST',
          headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},
          body:JSON.stringify({currentPassword,newPassword})
        });
        const payload=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(payload.error?.message||'Failed to update password.');
        appUser.mustChangePassword=false;
        $('#dialog').close();
        toast('Password updated successfully! Welcome to CloudCore AI.');
        route();
      }catch(err){
        if(errBox){errBox.textContent=err.message;errBox.style.display='block';}
        else toast(err.message);
      }finally{
        if(btn){btn.disabled=false;btn.innerHTML=`${icon('check')} Set Password & Continue`;}
      }
    };
  }
}

async function openSettingsModal(activeTab='profile'){
  let usersList=[];
  const isPrivileged=appUser?.role==='dev'||appUser?.role==='admin';
  if(isPrivileged){
    try{
      const res=await fetch('/api/admin/users');
      if(res.ok){
        const data=await res.json();
        usersList=data.users||[];
        if(appUser?.role==='admin')usersList=usersList.filter(u=>u.role==='user'||u.role==='member');
      }
    }catch{}
  }
  const roleBadge=`<span class="role-badge ${esc(appUser?.role||'user')}">${esc(appUser?.role||'user')}</span>`;
  const html=`<div style="max-width:700px;width:100%;text-align:left;">
    <h2>Settings & Security</h2>
    <div class="settings-tabs">
      <button class="settings-tab-btn ${activeTab==='profile'?'active':''}" data-settings-tab="profile">My Profile & Password</button>
      ${isPrivileged?`<button class="settings-tab-btn ${activeTab==='users'?'active':''}" data-settings-tab="users">User Management (${usersList.length})</button>`:''}
    </div>
    ${activeTab==='profile'?`
      <div style="margin-bottom:20px;padding:14px;background:#f8faf9;border-radius:10px;display:flex;align-items:center;gap:14px;">
        <span class="avatar">${esc((appUser?.displayName||'U').charAt(0))}</span>
        <div>
          <b>${esc(appUser?.displayName||'User')}</b> (${esc(appUser?.username||'')})
          <div style="margin-top:4px;">Role: ${roleBadge} · <i>${esc(appUser?.email||'')}</i></div>
        </div>
      </div>
      <h3>Change Your Password</h3>
      <p style="font-size:13px;color:#5a7366;margin-bottom:14px;">Update your personal password. Minimum 6 characters.</p>
      <form id="change-my-password-form" class="login-form">
        <div id="self-pw-err" class="login-alert" style="display:none;"></div>
        <label class="login-label">
          <span>Current Password</span>
          <div class="input-with-icon">${icon('shield')}<input name="currentPassword" type="password" required placeholder="Enter current password"></div>
        </label>
        <div class="settings-form-grid">
          <label class="login-label">
            <span>New Password</span>
            <div class="input-with-icon">${icon('shield')}<input name="newPassword" type="password" minlength="6" required placeholder="At least 6 characters"></div>
          </label>
          <label class="login-label">
            <span>Confirm New Password</span>
            <div class="input-with-icon">${icon('shield')}<input name="confirmPassword" type="password" minlength="6" required placeholder="Re-enter new password"></div>
          </label>
        </div>
        <button type="submit" class="primary" style="align-self:flex-start;">${icon('check')} Update Password</button>
      </form>
    `:`
      <h3>Create New User Account</h3>
      <p style="font-size:13px;color:#5a7366;margin-bottom:14px;">
        ${appUser?.role==='dev'?'As a Dev, you can create Admin or User accounts with custom passwords.':'As an Admin, you can create User accounts with temporary one-time passwords.'}
      </p>
      <form id="create-user-form" style="margin-bottom:24px;padding:16px;background:#f8faf9;border-radius:10px;border:1px solid #dde8e1;">
        <div id="create-user-err" class="login-alert" style="display:none;margin-bottom:12px;"></div>
        <div class="settings-form-grid">
          <label class="login-label">
            <span>Username</span>
            <div class="input-with-icon">${icon('user')}<input name="username" type="text" pattern="[a-zA-Z0-9_.-]{3,30}" required placeholder="e.g. employee1"></div>
          </label>
          <label class="login-label">
            <span>Display Name</span>
            <div class="input-with-icon">${icon('user')}<input name="displayName" type="text" required placeholder="e.g. Ali Ahmed"></div>
          </label>
        </div>
        <div class="settings-form-grid">
          <label class="login-label">
            <span>Password</span>
            <div class="input-with-icon">${icon('shield')}<input name="password" type="text" minlength="6" required placeholder="At least 6 characters"></div>
          </label>
          <label class="login-label">
            <span>Account Role</span>
            <div class="input-with-icon">${icon('users')}
              ${appUser?.role==='dev'?`<select name="role"><option value="user">User (Standard)</option><option value="admin">Admin</option></select>`:`<input name="role" value="user" readonly style="background:#eef4f0;color:#557063;">`}
            </div>
          </label>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#284336;margin-bottom:14px;">
          <input type="checkbox" name="mustChangePassword" ${appUser?.role==='admin'?'checked disabled':'checked'}>
          <span>Require password change on first login (One-Time Password / OTP)</span>
        </label>
        <button type="submit" class="primary">${icon('plus')} Create Account</button>
      </form>
      <h3>${appUser?.role==='dev'?'Existing User & Admin Accounts':'Existing User Accounts'}</h3>
      <div style="overflow-x:auto;">
        <table class="user-mgmt-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Display Name</th>
              <th>Role</th>
              <th>PW Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${usersList.map(u=>`<tr>
              <td><b>${esc(u.username)}</b></td>
              <td>${esc(u.displayName)}</td>
              <td><span class="role-badge ${esc(u.role)}">${esc(u.role)}</span></td>
              <td>${u.mustChangePassword?'<span style="color:#d97706;font-size:12px;font-weight:600;">Must change (OTP)</span>':'<span style="color:#059669;font-size:12px;">Active</span>'}</td>
              <td><small>${new Date(u.createdAt).toLocaleDateString()}</small></td>
              <td>
                <div class="user-mgmt-actions">
                  <button class="soft-button" style="padding:4px 8px;font-size:12px;" data-action="admin-reset-pw" data-id="${esc(u.id)}" data-user="${esc(u.username)}">Reset PW</button>
                  ${(u.role!=='dev'&&!(appUser?.role==='admin'&&u.role==='admin')&&u.id!==appUser?.id)?`<button class="icon-button danger" style="padding:4px;" data-action="admin-delete-user" data-id="${esc(u.id)}" data-user="${esc(u.username)}" title="Delete user">${icon('trash')}</button>`:''}
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `}
  </div>`;
  modal(html);

  document.querySelectorAll('[data-settings-tab]').forEach(btn=>{btn.onclick=()=>openSettingsModal(btn.dataset.settingsTab)});
  const selfPwForm=document.querySelector('#change-my-password-form');
  if(selfPwForm){
    selfPwForm.onsubmit=async(e)=>{
      e.preventDefault();
      const errBox=document.querySelector('#self-pw-err');if(errBox){errBox.style.display='none';errBox.textContent='';}
      const f=new FormData(selfPwForm),currentPassword=String(f.get('currentPassword')||''),newPassword=String(f.get('newPassword')||''),confirmPassword=String(f.get('confirmPassword')||'');
      if(newPassword.length<6){if(errBox){errBox.textContent='New password must be at least 6 characters.';errBox.style.display='block';}return;}
      if(newPassword!==confirmPassword){if(errBox){errBox.textContent='Passwords do not match.';errBox.style.display='block';}return;}
      try{
        const res=await fetch('/api/auth/change-password',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({currentPassword,newPassword})});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to update password.');
        toast('Your password has been changed successfully.');
        $('#dialog').close();
      }catch(err){if(errBox){errBox.textContent=err.message;errBox.style.display='block';}else toast(err.message);}
    };
  }
  const createUserForm=document.querySelector('#create-user-form');
  if(createUserForm){
    createUserForm.onsubmit=async(e)=>{
      e.preventDefault();
      const errBox=document.querySelector('#create-user-err');if(errBox){errBox.style.display='none';errBox.textContent='';}
      const f=new FormData(createUserForm),username=String(f.get('username')||'').trim(),displayName=String(f.get('displayName')||'').trim(),password=String(f.get('password')||''),role=String(f.get('role')||'user');
      const mustChangePassword=appUser?.role==='admin'?true:Boolean(f.get('mustChangePassword'));
      try{
        const res=await fetch('/api/admin/users',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({username,displayName,password,role,mustChangePassword})});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to create user.');
        toast(`User '${username}' created successfully.`);
        openSettingsModal('users');
      }catch(err){if(errBox){errBox.textContent=err.message;errBox.style.display='block';}else toast(err.message);}
    };
  }
  document.querySelectorAll('[data-action="admin-reset-pw"]').forEach(btn=>{
    btn.onclick=async()=>{
      const targetUser=btn.dataset.user,targetId=btn.dataset.id;
      const newPassword=window.prompt(`Enter new password for '${targetUser}' (min 6 characters):`);
      if(!newPassword)return;
      if(newPassword.length<6)return toast('Password must be at least 6 characters.');
      try{
        const res=await fetch(`/api/admin/users/${encodeURIComponent(targetId)}/reset-password`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({newPassword})});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to reset password.');
        toast(`Password for '${targetUser}' reset successfully.`);
        openSettingsModal('users');
      }catch(err){toast(err.message);}
    };
  });
  document.querySelectorAll('[data-action="admin-delete-user"]').forEach(btn=>{
    btn.onclick=async()=>{
      const targetUser=btn.dataset.user,targetId=btn.dataset.id;
      if(!window.confirm(`Are you sure you want to permanently delete user '${targetUser}'?`))return;
      try{
        const res=await fetch(`/api/admin/users/${encodeURIComponent(targetId)}`,{method:'DELETE',headers:{'x-requested-with':'CloudCoreAI'}});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error?.message||'Failed to delete user.');
        toast(`User '${targetUser}' deleted.`);
        openSettingsModal('users');
      }catch(err){toast(err.message);}
    };
  });
}

function openProfileModal(){
  modal(`
    <div style="text-align:center;padding:12px 0;">
      <span class="avatar" style="width:54px;height:54px;font-size:24px;margin:0 auto 12px;">${esc((appUser?.displayName||'U').charAt(0))}</span>
      <h2 style="margin-bottom:4px;">${esc(appUser?.displayName||'CloudCore user')}</h2>
      <p style="color:#5a7366;font-size:13px;margin-bottom:8px;">${esc(appUser?.username||'')} · ${esc(appUser?.email||'')}</p>
      <div><span class="role-badge ${esc(appUser?.role||'user')}">${esc(appUser?.role||'user')}</span></div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
        <button class="primary" data-action="open-settings-page">${icon('settings')} Settings</button>
        <button class="outline danger" data-action="signout">${icon('logout')} Sign out</button>
      </div>
    </div>
  `);
  document.querySelectorAll('#dialog [data-action="open-settings-page"]').forEach(el=>el.onclick=()=>{if($('#dialog')?.open)$('#dialog').close();location.hash='settings';route();});
  document.querySelectorAll('#dialog [data-action="signout"]').forEach(el=>el.onclick=()=>handleSignOut());
}

async function handleSignOut(){
  try{await fetch('/api/auth/logout',{method:'POST',headers:{'x-requested-with':'CloudCoreAI'}});}catch{}
  appUser=null;
  location.hash='landing';
  route();
  toast('You have signed out successfully.');
}
function saveChats(){try{localStorage.setItem('cloudcore-chats',JSON.stringify(chats))}catch{toast('Your browser could not save chat history.')}}
function pollIngestJob(jobId,filename,resolveUpload){const interval=setInterval(()=>{if(typeof fetch!=='function'){clearInterval(interval);if(resolveUpload)resolveUpload();return}fetch(`/api/jobs/${encodeURIComponent(jobId)}`).then(r=>r.json()).then(res=>{if(res.status==='finished'){clearInterval(interval);docIngesting=false;docIngested=true;docJobStatus=`Indexed "${filename}" — ready for questions in AI Assistant.`;pushNotification('Document Indexed',`"${filename}" is indexed and ready for AI questions.`);if(userPrefs?.notifications!=='off')toast(`"${filename}" indexed & ready for questions.`);route({preserveScroll:true});if(resolveUpload)resolveUpload();if(pendingDocAutoPrompt){const p=pendingDocAutoPrompt;pendingDocAutoPrompt='';sendMessage(p)}}else if(res.status==='failed'){clearInterval(interval);docIngesting=false;docIngested=false;docJobStatus=`Ingestion failed: ${res.error||'Unknown error'}`;toast(docJobStatus);route({preserveScroll:true});if(resolveUpload)resolveUpload()}else{docJobStatus=`Indexing "${filename}" (${res.status})...`;route({preserveScroll:true})}}).catch(err=>{clearInterval(interval);docIngesting=false;docJobStatus=`Status check failed: ${err.message}`;route({preserveScroll:true});if(resolveUpload)resolveUpload()})},1200)}
function ingestDocumentNow(file){
  if(!file||typeof fetch!=='function')return Promise.resolve();
  docIngesting=true;
  docIngested=false;
  docJobStatus=`Indexing "${file.name}"...`;
  route({preserveScroll:true});
  activeDocUploadPromise=new Promise((resolveUpload)=>{
    const form=new FormData();
    form.append('file',file);
    fetch('/api/documents/upload',{method:'POST',headers:{'x-requested-with':'CloudCoreAI'},body:form})
      .then(async r=>{if(!r.ok){const err=await r.json().catch(()=>({}));throw Error(err.error?.message||err.detail||`Upload failed (${r.status})`)}return r.json()})
      .then(data=>{
        if(data.status==='finished'){
          docIngesting=false;docIngested=true;
          docJobStatus=`Indexed "${file.name}" — ready for questions in AI Assistant.`;
          pushNotification('Document Indexed',`"${file.name}" is indexed and ready for AI questions.`);
          if(userPrefs?.notifications!=='off')toast(`"${file.name}" indexed & ready for questions.`);
          route({preserveScroll:true});
          resolveUpload();
          if(pendingDocAutoPrompt){const p=pendingDocAutoPrompt;pendingDocAutoPrompt='';sendMessage(p)}
        }else{
          pollIngestJob(data.job_id,data.filename||file.name,resolveUpload);
        }
      })
      .catch(err=>{
        docIngesting=false;docIngested=false;
        docJobStatus=`Ingestion failed: ${err.message}`;
        toast(docJobStatus);
        route({preserveScroll:true});
        resolveUpload();
      });
  });
  return activeDocUploadPromise;
}
async function sendMessage(t){
  t=(t||'').trim();
  const useVisionChat=Boolean(chatImageAttached&&imageFile);
  if(!t){
    if(useVisionChat)t=`Please analyze the attached image "${imageFile.name}" thoroughly and highlight key observations.`;
    else if(docFile)t=`Please summarize "${docFile.name}" and highlight key takeaways and action items.`;
    else return;
  }
  const attachedImageForThisTurn=useVisionChat?imageFile:null;
  if(useVisionChat)chatImageAttached=false;
  messages.push({role:'user',content:t});
  let response='This is the CloudCore AI frontend preview. Connect an AI service to receive live answers. You can already explore Document Insight, preview uploaded images and revisit conversations in Chat History.';
  if(/document|pdf|summari/i.test(t))response='Open Document Insight to select or drag in a PDF, DOCX, PPTX, XLSX or text file (up to 50 MB). You can explore an example summary and its Key Points and Actions tabs. Analysis of your own files will be available once an AI service is connected.';
  else if(/image|picture/i.test(t))response='Open Image Analysis to upload a JPG, PNG or WEBP image (up to 20 MB), or load one from an HTTPS URL. You can preview the image now. Object detection, OCR and contextual analysis require an AI service connection.';
  const assistantMsg={role:'assistant',content:response};
  messages.push(assistantMsg);
  if(!currentChat)currentChat=String(Date.now());
  const data={id:currentChat,title:messages.find(m=>m.role==='user').content.slice(0,90),updated:Date.now(),messages:[...messages]};
  chats=[data,...chats.filter(c=>c.id!==currentChat)];
  saveChats();
  if(typeof fetch==='function'){
    assistantMsg.streaming=true;
    assistantMsg.content='';
  }
  if(location.hash==='#assistant'||location.hash==='assistant'){
    route();
    const box=document.querySelector('.messages');
    if(box)box.scrollTop=box.scrollHeight;
  }else{
    location.hash='assistant';
  }

  if(typeof fetch==='function'){
    try{
      if(attachedImageForThisTurn){
        const form=new FormData();
        form.append('question',t);
        form.append('image',attachedImageForThisTurn);
        const r=await fetch('/api/vision',{method:'POST',headers:{'x-requested-with':'CloudCoreAI'},body:form});
        if(!r.ok){
          const err=await r.json().catch(()=>({}));
          throw Error(err.error?.message||err.detail||`Vision request failed (${r.status})`);
        }
        const vData=await r.json();
        assistantMsg.content=vData.answer||'No analysis returned.';
        visionResult=assistantMsg.content;
        pushNotification('Image Analyzed',`Completed Vision AI analysis for "${attachedImageForThisTurn.name}".`);
      }else{
        if(docFile&&activeDocUploadPromise){
          try{await activeDocUploadPromise}catch{}
        }
        const styleHint=userPrefs?.responseStyle==='concise'?'\n\n[Preference: Keep your answer concise, direct, and bulleted.]':userPrefs?.responseStyle==='detailed'?'\n\n[Preference: Provide a comprehensive executive breakdown with structured headings and actionable recommendations.]':'';
        const res=await fetch('/api/chat?stream=true',{
          method:'POST',
          headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},
          body:JSON.stringify({message:t+styleHint,use_rag:userPrefs?.autoRag!=='off',stream:true})
        });
        if(!res.ok){
          const err=await res.json().catch(()=>({}));
          throw Error(err.error?.message||err.detail||`AI service error (${res.status})`);
        }
        const reader=res.body?.getReader();
        if(!reader){
          const resData=await res.json();
          assistantMsg.content=resData.answer||'';
        }else{
          const decoder=new TextDecoder();
          let buffer='';
          while(true){
            const {done,value}=await reader.read();
            if(done)break;
            buffer+=decoder.decode(value,{stream:true});
            const lines=buffer.split('\n');
            buffer=lines.pop()??'';
            for(const line of lines){
              const trimmed=line.trim();
              if(!trimmed||trimmed.startsWith(':'))continue;
              if(trimmed==='data: [DONE]')break;
              if(trimmed.startsWith('data: ')){
                try{
                  const json=JSON.parse(trimmed.slice(6));
                  const delta=json.choices?.[0]?.delta?.content||json.delta;
                  if(delta){
                    assistantMsg.content+=delta;
                    const bubble=document.getElementById('active-assistant-stream-bubble')||document.querySelector('.messages .message.assistant:last-child .chat-text');
                    if(bubble){
                      const box=document.querySelector('.messages');
                      const shouldAutoScroll=isNearBottom(box,60);
                      bubble.innerHTML=renderMarkdown(assistantMsg.content)+'<span class="typing-cursor"></span>';
                      if(box&&shouldAutoScroll)box.scrollTop=box.scrollHeight;
                    }
                  }
                }catch(e){}
              }
            }
          }
        }
      }
    }catch(err){
      assistantMsg.content=`AI chat error: ${err.message}`;
    }finally{
      delete assistantMsg.streaming;
      const found=chats.find(c=>c.id===currentChat);
      if(found)found.messages=[...messages];
      saveChats();
      if(location.hash==='#assistant'||location.hash==='assistant'){
        const boxBefore=document.querySelector('.messages');
        const wasNear=isNearBottom(boxBefore,60);
        const savedScrollTop=boxBefore?boxBefore.scrollTop:null;
        route();
        const box=document.querySelector('.messages');
        if(box){
          if(wasNear)box.scrollTop=box.scrollHeight;
          else if(savedScrollTop!==null)box.scrollTop=savedScrollTop;
        }
      }
    }
  }
}
function selectDocument(file){
  if(!file)return;
  if(!/\.(pdf|docx|pptx|xlsx|txt|md|csv|json)$/i.test(file.name))return toast('Please choose a PDF, DOCX, PPTX, XLSX, CSV or text file.');
  if(file.size>50*1048576)return toast('Please choose a document smaller than 50 MB.');
  docFile=file;docJobStatus='Selected and ready.';docIngesting=false;docIngested=false;
  const cur=location.hash.replace(/^#/,'').split('/')[0];
  const stayInAssistant=cur==='assistant'||attachContext==='assistant';
  attachContext='';
  if(stayInAssistant){
    if(cur!=='assistant')location.hash='assistant';
  }else if(cur!=='documents'){
    location.hash='documents';
  }
  route({preserveScroll:true});
  if(typeof fetch==='function'){
    ingestDocumentNow(file);
  }else{
    toast(`"${file.name}" attached.`);
  }
}
function selectImage(file){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('Please choose a JPG, PNG or WEBP image.');
  if(file.size>20*1048576)return toast('Please choose an image smaller than 20 MB.');
  if(imageURL.startsWith('blob:'))URL.revokeObjectURL(imageURL);
  visionResult='';imageFile=file;imageURL=URL.createObjectURL(file);imageMode='upload';
  const cur=location.hash.replace(/^#/,'').split('/')[0];
  const stayInAssistant=cur==='assistant'||attachContext==='assistant';
  attachContext='';
  if(stayInAssistant){
    chatImageAttached=true;
    if(cur!=='assistant')location.hash='assistant';
    route({preserveScroll:true});
    toast(`"${file.name}" attached for Vision AI.`);
    if(pendingImageAutoPrompt){const p=pendingImageAutoPrompt;pendingImageAutoPrompt='';sendMessage(p)}
  }else{
    chatImageAttached=false;
    location.hash='images';
    route({preserveScroll:true});
    toast(`"${file.name}" loaded. Click Analyze Image to inspect.`);
  }
}
function actions(a,el){if(refHandleAction(a,el)){bindDialog();return;}if(a==='knowledge-scope'){switchKnowledgeScope(el.dataset.scope||'shared')}else if(a==='select-folder'){selectKnowledgeFolder(el.dataset.id||null)}else if(a==='clear-folder-filter'){selectKnowledgeFolder(null)}else if(a==='new-folder'){openNewFolderModal()}else if(a==='rename-folder'){openRenameFolderModal(el.dataset.id,el.dataset.name,el.dataset.shared==='true')}else if(a==='delete-folder'){openDeleteFolderModal(el.dataset.id,el.dataset.name,parseInt(el.dataset.count||'0',10))}else if(a==='batch-upload'){openBatchUploadModal()}else if(a==='filter-type'){knowledgeTypeFilter=el.dataset.type||'all';loadKnowledge()}else if(a==='toggle-select-all'){toggleSelectAllDocs()}else if(a==='toggle-doc-select'){toggleSelectDoc(el.dataset.id)}else if(a==='view-doc'||a==='preview-doc'){openDocumentViewerModal(el.dataset.id)}else if(a==='move-doc'){openMoveDocModal(el.dataset.id)}else if(a==='delete-doc'){openDeleteDocModal(el.dataset.id,el.dataset.filename)}else if(a==='confirm-delete-single-doc'){(async()=>{try{const res=await fetch(`/api/knowledge/documents/${encodeURIComponent(el.dataset.id)}`,{method:'DELETE',headers:{'x-requested-with':'CloudCoreAI'}});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error?.message||'Failed to delete document.');selectedKnowledgeDocIds.delete(el.dataset.id);$('#dialog')?.close();toast(`Document "${el.dataset.filename||'document'}" deleted.`);loadKnowledge();}catch(err){toast(err.message)}})()}else if(a==='batch-move-docs'){openBatchMoveDocsModal()}else if(a==='batch-delete-docs'){confirmBatchDeleteDocs()}else if(a==='confirm-delete-batch-docs'){const ids=[...selectedKnowledgeDocIds];(async()=>{try{const res=await fetch('/api/knowledge/batch-delete',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({documentIds:ids})});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error?.message||'Failed to batch delete documents.');selectedKnowledgeDocIds.clear();$('#dialog')?.close();toast(`${data.deletedIds?.length||ids.length} documents deleted.`);loadKnowledge();}catch(err){toast(err.message)}})()}else if(a==='clear-doc-selection'){selectedKnowledgeDocIds.clear();route({preserveScroll:true})}else if(a==='new-chat'){messages=[];currentChat=null;location.hash='assistant';route()}else if(a==='set-pref'){const k=el.dataset.key,v=el.dataset.val;if(k&&v){userPrefs[k]=v;saveUserPrefs();if(typeof refSyncMotion==='function')refSyncMotion();route({preserveScroll:true});toast('Preference saved.')}}else if(a==='export-chats'){if(!chats.length)return toast('No conversations to export yet.');const blob=new Blob([JSON.stringify(chats,null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`cloudcore-chats-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(link.href);toast('Chat history exported.')}else if(a==='clear-all-chats'){if(!chats.length)return toast('Your chat history is already empty.');modal(`<h2>Clear all local conversations?</h2><p>This will permanently remove ${chats.length} saved conversation${chats.length===1?'':'s'} from this browser.</p><div class="dialog-actions"><button type="button" class="outline" data-action="close-dialog">Cancel</button><button type="button" class="primary" data-action="confirm-clear-all-chats">Clear all history</button></div>`)}else if(a==='confirm-clear-all-chats'){chats=[];messages=[];currentChat=null;saveChats();if($('#dialog')?.open)$('#dialog').close();route({preserveScroll:true});toast('All local conversations cleared.')}else if(a==='refresh-settings-users'){loadSettingsUsers(true)}else if(a==='refresh-integrations'){loadAiHealth(true)}else if(a==='settings-reset-pw'){const targetUser=el.dataset.user,targetId=el.dataset.id;modal(`<h2>Reset Password for '${esc(targetUser)}'</h2><p>Enter a new temporary or permanent password (minimum 6 characters).</p><form id="modal-reset-user-pw-form" style="margin-top:12px;"><label style="display:block;font-size:12px;color:#5a7366;margin-bottom:6px;">New Password</label><input name="newPassword" type="text" minlength="6" required placeholder="At least 6 characters" style="width:100%;padding:10px 12px;border:1px solid #d4e2d9;border-radius:10px;margin-bottom:14px;"><div class="dialog-actions"><button type="button" class="outline" data-action="close-dialog">Cancel</button><button type="submit" class="primary">${icon('check')} Update Password</button></div></form>`);const rf=document.querySelector('#modal-reset-user-pw-form');if(rf)rf.onsubmit=async e=>{e.preventDefault();const newPassword=String(new FormData(rf).get('newPassword')||'');if(newPassword.length<6)return toast('Password must be at least 6 characters.');try{const res=await fetch(`/api/admin/users/${encodeURIComponent(targetId)}/reset-password`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({newPassword})});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error?.message||'Failed to reset password.');if($('#dialog')?.open)$('#dialog').close();toast(`Password for '${targetUser}' reset successfully.`);loadSettingsUsers();}catch(err){toast(err.message)}}}else if(a==='settings-delete-user'){const targetUser=el.dataset.user,targetId=el.dataset.id;modal(`<h2>Delete user '${esc(targetUser)}'?</h2><p>This permanently removes the account '${esc(targetUser)}' and reassigns any meeting records.</p><div class="dialog-actions"><button type="button" class="outline" data-action="close-dialog">Cancel</button><button type="button" class="primary" data-action="confirm-delete-user" data-id="${esc(targetId)}" data-user="${esc(targetUser)}">Delete User</button></div>`)}else if(a==='confirm-delete-user'){const targetId=el.dataset.id,targetUser=el.dataset.user;(async()=>{try{const res=await fetch(`/api/admin/users/${encodeURIComponent(targetId)}`,{method:'DELETE',headers:{'x-requested-with':'CloudCoreAI'}});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error?.message||'Failed to delete user.');if($('#dialog')?.open)$('#dialog').close();toast(`User '${targetUser}' deleted.`);loadSettingsUsers();}catch(err){toast(err.message)}})()}else if(a==='suggestion'){const t=el.dataset.prompt;if(t==='Summarize this document'){if(docFile)sendMessage(`Please summarize "${docFile.name}" and highlight key takeaways.`);else{attachContext='assistant';pendingDocAutoPrompt='Please summarize this document and highlight key takeaways and action items.';$('#document-input')?.click()}}else if(t==='What is in this image?'){if(imageFile){chatImageAttached=true;sendMessage(`What is in "${imageFile.name}"?`)}else{attachContext='assistant';pendingImageAutoPrompt='Please analyze this image and describe what is in it.';$('#image-input')?.click()}}else sendMessage(t)}else if(a==='assistant-doc-card'){if(docFile)sendMessage(`Please summarize "${docFile.name}" with key points and action items.`);else{attachContext='assistant';pendingDocAutoPrompt='Please summarize this document with key points and action items.';$('#document-input')?.click()}}else if(a==='assistant-image-card'){if(imageFile){chatImageAttached=true;sendMessage(`Please analyze "${imageFile.name}" and extract key observations.`)}else{attachContext='assistant';pendingImageAutoPrompt='Please analyze this image thoroughly and highlight key observations.';$('#image-input')?.click()}}else if(a==='attach-document'){attachContext='assistant';$('#document-input')?.click()}else if(a==='choose-document'){attachContext='documents';$('#document-input')?.click()}else if(a==='attach-image'){attachContext='assistant';$('#image-input')?.click()}else if(a==='choose-image'){attachContext='images';$('#image-input')?.click()}else if(a==='remove-attached-doc'){docFile=null;docIngested=false;docIngesting=false;docJobStatus='';route({preserveScroll:true});toast('Document attachment removed.')}else if(a==='remove-attached-image'){chatImageAttached=false;imageFile=null;route({preserveScroll:true});toast('Image attachment removed.')}else if(a==='clear-notifications'){appNotifications=[];openNotificationsModal()}else if(a==='ask-doc-ai'){if($('#dialog')?.open)$('#dialog').close();if(docFile)sendMessage(`Please summarize "${docFile.name}" and highlight its key takeaways and action items.`);else{location.hash='assistant';route()}}else if(a==='doc-tab'){docTab=el.dataset.tab;route({preserveScroll:true})}else if(a==='image-mode'){imageMode=el.dataset.mode;route({preserveScroll:true})}else if(a==='example-image'){visionResult='';if(imageURL.startsWith('blob:'))URL.revokeObjectURL(imageURL);imageFile=null;imageURL=({tower:'assets/example-tower.png',map:'assets/example-map.png',datacenter:'assets/example-datacenter.png',diagram:'assets/diagram.svg',screenshot:'assets/reference-home.png'})[el.dataset.example]||'assets/hero.png';imageMode='upload';route({preserveScroll:true});toast('Example image selected. Click Analyze Image to run Vision AI.')}else if(a==='cloud-source')modal(`<h2>Connect ${el.dataset.source}</h2><p>Cloud storage connections will be available when the account integration is configured. For now, download your document and choose it from your device.</p><button class="primary" data-action="choose-document">Choose a local file</button>`);else if(a==='full-analysis'||a==='document-action'){const actTitle=el.dataset.title||'Document Analysis';if(docFile){const promptMap={'Summarize document':`Please provide an executive summary of "${docFile.name}" with key takeaways.`,'Compare document':`Please analyze "${docFile.name}" and compare its key options, trade-offs, and recommendations.`,'Extract document':`Please extract all key facts, figures, dates, entities, and deliverables from "${docFile.name}".`,'Analyze document':`Please analyze "${docFile.name}" to identify key trends, risks, decisions, and action items.`};sendMessage(promptMap[actTitle]||`Please analyze "${docFile.name}" and provide key insights.`)}else{modal(`<span class="feature-icon">${icon('file')}</span><h2>${esc(actTitle)}</h2><p>Upload a PDF, Word, Excel, PowerPoint, or text file to run live AI analysis on your own document, or explore the example below.</p><p>${sampleSummary}</p><h3>Key points</h3><ul><li>Enterprise connectivity and cloud services</li><li>Flexible deployment options</li><li>Managed support and service-level agreements</li></ul><div class="dialog-actions"><button class="outline" data-action="close-dialog">Close</button><button class="primary" data-action="choose-document">${icon('upload')} Upload a document</button></div>`)}}else if(a==='view-documents')modal(`<h2>Recent Documents</h2><p>${docFile?esc(docFile.name)+' — indexed in workspace.':'No documents uploaded yet. The proposal displayed is an example.'}</p>`);else if(a==='menu')$('.sidebar').classList.toggle('mobile-open');else if(a==='close-dialog')$('#dialog').close();else if(a==='open-chat'){const c=chats.find(c=>c.id===el.dataset.id);messages=[...c.messages];currentChat=c.id;location.hash='assistant'}else if(a==='delete-chat')modal(`<h2>Delete this conversation?</h2><p>This removes the conversation from this device.</p><div class="dialog-actions"><button class="outline" data-action="close-dialog">Cancel</button><button class="primary" data-action="confirm-delete" data-id="${el.dataset.id}">Delete conversation</button></div>`);else if(a==='confirm-delete'){chats=chats.filter(c=>c.id!==el.dataset.id);saveChats();route();toast('Conversation deleted.')}else if(a==='settings'){location.hash='settings';route()}else if(a==='profile')openProfileModal();else if(a==='signout')handleSignOut();else if(a==='help')modal('<h2>How can we help?</h2><p><b>AI Assistant:</b> Start a conversation, or attach a PDF/Word file or image directly using the paperclip and image icons in the chat bar.</p><p><b>Document Insight:</b> Upload a document and use Summarize, Compare, Extract, or Analyze.</p><p><b>Image Analysis:</b> Upload an image or select an example and click Analyze Image.</p><p><b>Chat History:</b> Reopen or delete conversations saved on this device.</p>');else if(a==='solutions')modal(`<h2>PTCL Business Solutions</h2><p>Explore connectivity, cloud, security and intelligent support.</p><div class="solution-list">${[['signal','Reliable Connectivity','Keep your business connected.'],['cloud','Cloud & Data Solutions','Infrastructure that grows with you.'],['shield','Cyber Security','Protect your business and its data.'],['chip','AI-Powered Support','Find the right support for your business.']].map(([i,t,d])=>`<div>${icon(i)}<span><b>${t}</b><p>${d}</p></span></div>`).join('')}</div>`);else if(a==='ingest-document-ai'){if(!docFile)return toast('Please choose a document first.');if(typeof fetch!=='function')return toast('AI service connection required.');ingestDocumentNow(docFile)}else if(a==='analyze-image-ai'){if(!imageFile&&!imageURL)return toast('Please choose or upload an image first.');if(typeof fetch!=='function')return toast('AI service connection required.');visionLoading=true;visionResult='';route({preserveScroll:true});(async()=>{try{const form=new FormData();form.append('question','Please analyze this image thoroughly: identify all objects, extract visible text via OCR, describe layout and context, and highlight key actionable observations.');if(imageFile){form.append('image',imageFile)}else{const blob=await fetch(imageURL).then(r=>r.blob());form.append('image',blob,'image.png')}const r=await fetch('/api/vision',{method:'POST',headers:{'x-requested-with':'CloudCoreAI'},body:form});if(!r.ok){const err=await r.json().catch(()=>({}));throw Error(err.error?.message||err.detail||`Vision request failed (${r.status})`)}const data=await r.json();visionResult=data.answer||'No analysis returned.';pushNotification('Image Analyzed','Vision AI completed analysis of your selected image.');toast('Vision analysis complete.')}catch(err){toast(`Vision analysis failed: ${err.message}`);visionResult=`Analysis failed: ${err.message}`}finally{visionLoading=false;route({preserveScroll:true})}})()}else if(a==='clear-vision'){visionResult='';route({preserveScroll:true})}bindDialog()}
function bindDialog(){document.querySelectorAll('#dialog [data-action]').forEach(el=>el.onclick=()=>actions(el.dataset.action,el))}
const baseBind=bind;bind=function(){baseBind();document.querySelectorAll('.composer').forEach(f=>f.onsubmit=e=>{e.preventDefault();sendMessage(new FormData(f).get('prompt'))});if($('#search-form'))$('#search-form').onsubmit=e=>{e.preventDefault();const q=($('#search-form input').value||'').trim();if(!q)return;const exactMatch=navs.find(n=>n[2].toLowerCase()===q.toLowerCase()||n[0].toLowerCase()===q.toLowerCase());if(exactMatch)location.hash=exactMatch[0];else sendMessage(q)};if($('#document-input'))$('#document-input').onchange=e=>{const f=e.target.files[0];try{e.target.value=''}catch{}selectDocument(f)};if($('#image-input'))$('#image-input').onchange=e=>{const f=e.target.files[0];try{e.target.value=''}catch{}selectImage(f)};document.querySelectorAll('[data-drop]').forEach(d=>{d.ondragover=e=>{e.preventDefault();d.classList.add('dragging')};d.ondragleave=()=>d.classList.remove('dragging');d.ondrop=e=>{e.preventDefault();d.classList.remove('dragging');(d.dataset.drop==='image'?selectImage:selectDocument)(e.dataTransfer.files[0])}});if($('#url-form'))$('#url-form').onsubmit=e=>{e.preventDefault();const url=new FormData(e.target).get('url');try{if(new URL(url).protocol!=='https:')throw Error();}catch{return toast('Please enter a valid HTTPS image URL.')}const image=new Image();image.onload=()=>{visionResult='';if(imageURL.startsWith('blob:'))URL.revokeObjectURL(imageURL);imageFile=null;imageURL=url;imageMode='upload';route()};image.onerror=()=>toast('The image could not be loaded. Check the link or upload a file.');image.src=url};if($('#history-search'))$('#history-search').oninput=e=>{historySearch=e.target.value;const start=e.target.selectionStart;route();$('#history-search').focus();$('#history-search').setSelectionRange(start,start)};if($('#dialog'))$('#dialog').onclick=e=>{if(e.target===$('#dialog'))$('#dialog').close()};};
const productBind=bind;bind=function(){productBind();clearTimeout(meetingsTimer);meetingsTimer=null;const on=(selector,handler)=>document.querySelectorAll(selector).forEach(el=>el.onclick=()=>handler(el));on('[data-action="open-meeting"]',el=>{meetingTab='overview';meetingsState.detail=null;location.hash=`meetings/${el.dataset.id}`;refreshMeetings(true)});on('[data-action="refresh-meetings"]',()=>refreshMeetings(true));on('[data-action="meeting-tab"]',el=>{meetingTab=el.dataset.tab;route();if(meetingTab==='chat'){requestAnimationFrame(()=>{const box=document.querySelector('.meeting-chat-messages');if(box)box.scrollTop=box.scrollHeight})}});on('[data-action="stop-meeting"]',el=>meetingCommand(el.dataset.id,'/stop'));on('[data-action="regenerate-mom"]',el=>meetingCommand(el.dataset.id,'/regenerate-mom'));on('[data-action="delete-meeting"]',el=>{if(window.confirm('Permanently delete this meeting and all of its audio, transcript, snapshots and MOM?'))meetingCommand(el.dataset.id,'','DELETE')});on('[data-action="copy-mom"]',()=>{navigator.clipboard?.writeText(momMarkdown(meetingsState.detail));toast('MOM copied to clipboard.')});on('[data-action="download-mom"]',()=>{const blob=new Blob([momMarkdown(meetingsState.detail)],{type:'text/markdown'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='meeting-mom.md';link.click();URL.revokeObjectURL(link.href)});on('[data-action="preview-mom"]',()=>previewMomPdf(meetingsState.detail));on('[data-action="print-mom"]',()=>printMomPdf(meetingsState.detail));on('[data-action="profile"]',()=>openProfileModal());on('[data-action="settings"]',()=>{location.hash='settings';route()});on('[data-action="signout"]',()=>handleSignOut());on('[data-prompt="Start a Teams meeting bot"]',()=>location.hash='meetings');on('[data-action="quick-meeting-ask"]',el=>{if(selectedMeetingId)sendMeetingChat(selectedMeetingId,el.dataset.query)});on('[data-action="refresh-live-screenshot"]',()=>{const img=$('#live-bot-screen-img');if(img&&selectedMeetingId)img.src=`/api/meetings/${encodeURIComponent(selectedMeetingId)}/live-screenshot?t=${Date.now()}`});const transcriptInput=$('#transcript-filter');if(transcriptInput){transcriptInput.oninput=e=>{transcriptSearch=e.target.value;const term=transcriptSearch.trim().toLowerCase();const articles=document.querySelectorAll('.transcript-list article');let visible=0;articles.forEach(art=>{const match=!term||art.textContent.toLowerCase().includes(term);art.style.display=match?'':'none';if(match)visible++});const metaSpan=document.querySelector('.transcript-meta-strip span:last-child');if(metaSpan)metaSpan.textContent=`${visible} of ${articles.length} segments`}};const meetingChatForm=$('#meeting-chat-form');if(meetingChatForm){meetingChatForm.onsubmit=e=>{e.preventDefault();const p=new FormData(meetingChatForm).get('chatPrompt');if(selectedMeetingId)sendMeetingChat(selectedMeetingId,p)}};if($('#meeting-form'))$('#meeting-form').onsubmit=e=>{e.preventDefault();startMeeting(e.target)};if($('#mom-form'))$('#mom-form').onsubmit=async e=>{e.preventDefault();try{const mom=momFromForm(e.target,meetingsState.detail.mom);await api(`/api/meetings/${encodeURIComponent(meetingsState.detail.id)}/mom`,{method:'PUT',body:JSON.stringify(mom)});toast('MOM changes saved.');await refreshMeetings(true)}catch(error){toast(error.message)}};if(location.hash.startsWith('#meetings')){if(selectedMeetingId&&(!meetingsState.detail||meetingsState.detail.id!==selectedMeetingId)){refreshMeetings(true)}else if(!meetingsState.lastLoaded&&!meetingsLoading){refreshMeetings()}else{scheduleMeetingsPoll()}}};
const referenceBind=bind;bind=function(){referenceBind();refBind()};
window.addEventListener('hashchange',route);route();
if(typeof fetch==='function')api('/api/me').then(data=>{appUser=data.user;if(data.capacity)meetingsState.capacity=data.capacity;route({preserveScroll:true});if(appUser?.mustChangePassword)checkMustChangePassword();}).catch(()=>{});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'navigate_cloudcore',title:'Open a CloudCore AI screen',description:'Navigate to a CloudCore AI frontend screen. Does not send messages, join meetings, or upload files.',inputSchema:{type:'object',properties:{screen:{type:'string',enum:['landing','home','assistant','meetings','documents','images','history']}},required:['screen'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!['landing','home','assistant','meetings','documents','images','history'].includes(input.screen))throw new Error('Choose a supported CloudCore AI screen.');location.hash=input.screen;route();return{screen:input.screen,status:'opened'}}})).catch(()=>{})}catch{}}
