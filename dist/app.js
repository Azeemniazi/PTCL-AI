const $=s=>document.querySelector(s);
const icons={cloud:'M7 18a5 5 0 0 1-1-9.9 7 7 0 0 1 13-1A5.5 5.5 0 0 1 18 18Z',home:'m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',chat:'M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.7-5A9 9 0 1 1 21 11ZM8 11h.01M12 11h.01M16 11h.01',file:'M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8',image:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 17l6-6 5 5 3-3 4 4M8 7h.01',history:'M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v6l4 2',plus:'M12 4v16M4 12h16',arrow:'M5 12h14m-6-6 6 6-6 6',chevron:'m9 5 7 7-7 7',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',user:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',lock:'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-7 4v3M7 11V7a5 5 0 0 1 10 0v4',grid:'M3 3h6v6H3ZM15 3h6v6h-6ZM3 15h6v6H3ZM15 15h6v6h-6Z',shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-4 9 3 3 5-6',signal:'M12 20V10M8 16a6 6 0 0 1 0-9M16 16a6 6 0 0 0 0-9M5 19a10 10 0 0 1 0-15M19 19a10 10 0 0 0 0-15',chip:'M6 6h12v12H6ZM9 9h6v6H9ZM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',users:'M16 21v-2a5 5 0 0 0-10 0v2M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M18 4a4 4 0 0 1 0 7M20 15a5 5 0 0 1 2 4v2M3 15a5 5 0 0 0-2 4',building:'M5 22V4l14-2v20M9 7h2M14 6h2M9 11h2M14 10h2M9 15h2M14 14h2M10 22v-4h4v4',chart:'M5 21v-6M12 21V9M19 21V3',play:'m8 4 12 8-12 8Z',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',paperclip:'m8 13 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L13 2M7 14l9-9',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM20 2v4M18 4h4',settings:'m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3Zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0',help:'M9 8a3 3 0 1 1 4 3c-1 0-1 2-1 3M12 18h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',logout:'M10 3H3v18h7M8 12h14m-5-5 5 5-5 5',folder:'M3 6V3h6l3 3h9v14H3Z',check:'m5 12 4 4L19 6',link:'m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',bulb:'M9 18h6M9 22h6M8 14a7 7 0 1 1 8 0l-1 4H9Z',box:'m12 2 10 5v10l-10 5-10-5V7Zm0 10v10M2 7l10 5 10-5',download:'M12 3v13m-5-5 5 5 5-5M3 17v5h18v-5',trash:'M3 6h18M8 6V3h8v3M5 6l1 16h12l1-16M10 10v8M14 10v8',menu:'M3 6h18M3 12h18M3 18h18',close:'m6 6 12 12M6 18 18 6',sliders:'M6 3v18M12 3v18M18 3v18M3 8h6M9 16h6M15 7h6',video:'M15 10l5-3v10l-5-3ZM3 6h12v12H3Z',clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
function icon(n,cl=''){return `<svg class="icon ${cl}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n]||icons.spark}"/></svg>`}
function mark(cl=''){return `<img class="brand-mark ${cl}" src="assets/cloudcore-mark.png" alt="" aria-hidden="true">`}
function brand(){return `<a class="brand" href="#landing" aria-label="CloudCore AI landing page">${mark()}<span><strong>CloudCore <b>AI</b></strong><small>A product of PTCL Smart Cloud</small></span></a>`}
function wave(cl=''){return `<svg class="wave ${cl}" viewBox="0 0 1400 260" preserveAspectRatio="none" aria-hidden="true">${Array.from({length:34},(_,i)=>`<path d="M-100 ${95+i*2} C210 ${-150+i*9}, 350 ${400-i*2}, 680 ${135+i} S 850 ${-40+i*6}, 1100 ${100+i*3} S1350 ${260-i*4},1500 ${55+i*3}"/>`).join('')}</svg>`}
function footer(){return `<footer class="page-footer"><span>Technology that moves Pakistan forward.</span><i></i><span>${mark('footer-mark')} A product of PTCL Smart Cloud</span></footer>`}
function landing(){return `<div class="landing"><div class="hero-backdrop"></div><header class="landing-header">${brand()}<nav aria-label="Main navigation"><a class="active" href="#landing">Home</a><a href="#site-solutions">Solutions</a><a href="#site-ai">AI Assistant</a><a href="#site-industries">Industries</a><a href="#site-resources">Resources</a><a href="#site-about">About</a></nav><a class="landing-search" href="#site-resources">${icon('search')}<span>Search solutions, insights, or support...</span></a><button class="icon-button notification" aria-label="Notifications" data-action="notifications">${icon('bell')}<i></i></button><a class="sign-in" href="${appUser?'#home':'#login'}">${icon('user')}<span>${appUser?'Open Workspace':'Sign In'}</span></a></header><main><section class="hero"><div class="eyebrow">CLOUDCORE AI</div><h1>Smarter Connections<br><span>for a Stronger Tomorrow</span></h1><p>Your AI-powered partner for business solutions,<br>insights and support — from PTCL Smart Cloud.</p><div class="hero-actions"><a class="primary" href="${appUser?'#home':'#login'}">${icon('chat')} Chat with CloudCore AI ${icon('arrow')}</a><a class="explore" href="#site-solutions"><span>${icon('play')}</span> Explore Our Solutions</a></div><div class="hero-motto">People<br>Technology<br><b>A Brighter Pakistan</b><i></i></div><div class="signature">Connected<br><span>for a Better</span><br><em>Tomorrow</em></div></section><section class="service-strip" aria-label="Our solutions">${[['signal','Reliable Connectivity','Keep your business always on'],['cloud','Cloud & Data Solutions','Scale with confidence'],['shield','Cyber Security','A safer, stronger tomorrow'],['chip','AI-Powered Support','Instant answers. Real progress.']].map(([i,t,d])=>`<a href="#site-solutions" class="service-card"><span class="service-icon">${icon(i)}</span><span><strong>${t}</strong><small>${d}</small></span>${icon('chevron')}</a>`).join('')}</section><section class="impact" id="about">${wave()}<div class="impact-intro"><div class="eyebrow">POWERING PAKISTAN’S BUSINESS GROWTH</div><h2>Technology that moves<br><span>Pakistan forward.</span></h2><p>From intelligent connectivity to cloud, security and AI —<br>PTCL Smart Cloud helps organizations work smarter,<br>grow faster and build a more connected Pakistan.</p><a class="outline small" href="#site-about">Learn More ${icon('arrow')}</a></div><div class="stats">${[['users','10,000+','Business Customers'],['building','200+','Enterprise Partners'],['cloud','99.9%','Network Reliability'],['chart','A Stronger<br>Pakistan','Our Shared Purpose']].map(([i,t,d])=>`<article class="stat"><span>${icon(i)}</span><h3>${t}</h3><p>${d}</p><i></i></article>`).join('')}</div></section></main><footer class="landing-footer">${brand()}<span class="footer-credit">A product of PTCL Smart Cloud</span><div><button data-action="privacy">Privacy</button><button data-action="terms">Terms</button><a href="#site-about">Contact</a><span class="connected">A Connected Pakistan. <i></i></span></div></footer></div>`}


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
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000)}
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
  if(preserveScroll){
    requestAnimationFrame(()=>{
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
      requestAnimationFrame(()=>{
        const mBox=document.querySelector('.meeting-chat-messages');
        if(mBox)mBox.scrollTop=mBox.scrollHeight;
      });
    }
  }
  if(r==='about')$('#about').scrollIntoView({behavior:'smooth'});
}
function bind(){
  document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{const a=el.dataset.action;if(a==='notifications')toast('You’re all caught up. No new notifications.');else if(a==='privacy')toast('This frontend stores chat history on this device only.');else if(a==='terms')toast('CloudCore AI frontend preview. AI services are not connected.');else actions(a,el)});
  const resourceSearch=$('#resource-search');
  if(resourceSearch&&resourceSearch.addEventListener)resourceSearch.addEventListener('input',()=>{const term=resourceSearch.value.trim().toLowerCase();document.querySelectorAll('[data-resource]').forEach(item=>item.hidden=term&&!item.dataset.resource.includes(term))});
}
let messages=[],currentChat=null,docFile=null,imageFile=null,imageURL='',docTab='Summary',imageMode='upload',historySearch='',selectedMeetingId=null,meetingTab='overview',meetingsTimer=null,meetingsLoading=false,meetingsError='',transcriptSearch='',meetingChats={},meetingChatLoading=false;
let docIngesting=false,docJobStatus='',visionLoading=false,visionResult='';
let appUser=null,meetingsState={meetings:[],capacity:{active:0,maximum:2},detail:null,lastLoaded:0};
let chats=[];try{chats=JSON.parse(localStorage.getItem('cloudcore-chats')||'[]')}catch{}
const navs=[['home','home','Home'],['assistant','chat','AI Assistant'],['meetings','video','Meetings AI'],['documents','file','Document Insight'],['images','image','Image Analysis'],['history','history','Chat History']];
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function sidebar(r){return `<aside class="sidebar">${brand()}<button class="primary new-chat" data-action="new-chat">${icon('plus')} New Chat</button><nav aria-label="Product navigation">${navs.map(([id,i,t])=>`<a href="#${id}" class="${r===id?'selected':''}">${icon(i)}<span>${t}</span></a>`).join('')}</nav><div class="sidebar-bottom"><button data-action="settings">${icon('settings')}<span>Settings</span></button><button data-action="help">${icon('help')}<span>Help</span></button><a href="#landing">${icon('logout')}<span>Back to website</span></a><div class="cloud-credit">${mark('credit-mark')}<span>A product of<strong>PTCL Smart Cloud</strong></span></div></div></aside>`}
function workspace(r){if(!navs.some(n=>n[0]===r))r='home';const name=appUser?.displayName||'CloudCore user',initial=name.charAt(0).toUpperCase();return `<div class="workspace ${r}-workspace">${sidebar(r)}<div class="workspace-body"><header class="workspace-header"><button class="mobile-menu icon-button" data-action="menu" aria-label="Toggle navigation">${icon('menu')}</button><form class="global-search" id="search-form">${icon('search')}<input aria-label="Search products, guides, solutions" placeholder="Search products, guides, solutions..."></form><div class="user-controls"><button class="icon-button notification" data-action="notifications" aria-label="Notifications">${icon('bell')}<i></i></button><button class="user-menu" data-action="profile"><span class="avatar">${esc(initial)}</span><span><small>Welcome,</small><strong>${esc(name)}</strong></span><span class="down">⌄</span></button></div></header><main class="workspace-main">${wave('workspace-wave')}${r==='home'?home():r==='meetings'?meetings():r==='documents'?documents():r==='images'?images():r==='history'?history():assistant()}</main>${footer()}</div></div><input hidden type="file" id="document-input" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md"><input hidden type="file" id="image-input" accept="image/png,image/jpeg,image/webp"><dialog id="dialog"><button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close">${icon('close')}</button><div id="dialog-content"></div></dialog>`}
function home(){return `<section class="home-intro"><h1>Hello ${esc((appUser?.displayName||'there').split(' ')[0])},<br><span>How can I help you today?</span></h1><p>Get answers, analyze documents, understand images, capture meetings and more — all in one place.</p><div class="workspace-motto">Smarter AI.<br>Stronger Business.<br><b>A Connected Pakistan.</b></div></section>${composer('home')}<div class="suggestions"><span>Try asking:</span>${['Start a Teams meeting bot','Summarize this document','What is in this image?','Compare cloud solutions'].map(t=>`<button data-action="suggestion" data-prompt="${t}">${t}</button>`).join('')}</div><section class="home-cards">${[['chat','Chat & Ask','Get instant answers<br>from PTCL knowledge','Start chatting','assistant'],['video','Meetings AI','Record Teams meetings,<br>transcribe and create MOM','Open Meetings AI','meetings'],['file','Analyze Documents','Upload contracts and<br>reports for insights','Upload a document','documents'],['image','Understand Images','Analyze equipment,<br>screenshots and diagrams','Upload an image','images']].map(([i,t,d,c,r])=>`<article><span class="feature-icon">${icon(i)}</span><h2>${t}</h2><p>${d}</p><a href="#${r}">${c} ${icon('arrow')}</a></article>`).join('')}</section><div class="mountain-banner"><h2>Technology that<br>moves Pakistan forward.<i></i></h2><span>A Brighter<br><b>Pakistan</b></span></div>`}
function composer(id){return `<form class="composer" id="${id}-composer"><div><input name="prompt" aria-label="Message CloudCore AI" placeholder="${id==='home'?'Ask anything about PTCL, our services, documents, or upload an image...':'Ask CloudCore AI anything...'}" autocomplete="off" required><button type="button" class="icon-button" data-action="attach-document" aria-label="Attach a document">${icon('paperclip')}</button><button type="button" class="icon-button" data-action="attach-image" aria-label="Upload an image">${icon('image')}</button></div><button type="submit" class="send" aria-label="Send message">${icon('arrow')}</button></form>`}
function title(eyebrow,title,sub){return `<div class="section-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${sub}</p></div><div class="heading-brand">${mark('heading-mark')}<span><b>CloudCore AI</b><small>A product of PTCL Smart Cloud</small></span></div></div>`}
const sampleSummary='This example document outlines PTCL’s enterprise connectivity solutions including dedicated internet, MPLS, cloud services and managed support SLAs for corporate clients. It highlights key service features, deployment options, benefits and commercial terms.';
function documents(){return `${title('DOCUMENT INTELLIGENCE','Document Insight','Upload, analyze and get key information from your documents using CloudCore AI.')}<div class="document-layout"><div><section class="panel upload-panel"><div class="dropzone" data-drop="document"><span class="upload-cloud">${icon('cloud')}${icon('upload')}</span><h3>${docFile?esc(docFile.name):'Drag and drop your file here'}</h3><p>${docFile?'Ready for review on this device':'or <button data-action="choose-document">click to browse</button>'}</p><small>Supports PDF, DOCX, PPTX, XLSX, TXT (Max 50MB)</small><button class="primary" data-action="choose-document">${icon('folder')} ${docFile?'Choose Another File':'Choose File'}</button></div><div class="divider-label"><span></span>Or upload from<span></span></div><div class="upload-sources"><button data-action="choose-document">${icon('folder')}My Device</button><button data-action="cloud-source" data-source="Google Drive"><span class="provider drive">▲</span>Google Drive</button><button data-action="cloud-source" data-source="OneDrive"><span class="provider onedrive">${icon('cloud')}</span>OneDrive</button><button data-action="cloud-source" data-source="SharePoint"><span class="provider sharepoint">S</span>SharePoint</button></div></section><section class="panel recent-docs"><div class="panel-heading">${icon('history')}<h2>Recent Uploaded Documents</h2><button data-action="view-documents">View All ${icon('chevron')}</button></div><div class="document-row"><span class="pdf-icon">${docFile?esc(docFile.name.split('.').pop().toUpperCase().slice(0,4)):'PDF'}</span><div><b>${docFile?esc(docFile.name):'PTCL_Enterprise_Proposal.pdf'}</b><small>${docFile?'Selected just now · '+(docFile.size/1048576).toFixed(2)+' MB':'Example document · 4.2 MB'}</small></div><span class="status">${icon(docFile?'file':'check')}${docFile?'Ready':'Example'}</span></div></section></div><div><section class="panel summary-panel"><div class="panel-heading">${icon('spark')}<div><h2>AI Summary</h2><p>Get instant insights and key information from your document.</p></div></div><div class="summary-content"><div class="tabs" role="tablist" aria-label="Document analysis">${['Summary','Key Points','Actions'].map(t=>`<button role="tab" aria-selected="${docTab===t}" class="${docTab===t?'active':''}" data-action="doc-tab" data-tab="${t}">${t}</button>`).join('')}</div><div class="summary-body"><span class="summary-file">${icon('file')}</span><div>${docFile?`<b>${esc(docFile.name)}</b><p>${docJobStatus?esc(docJobStatus):'Ready for AI analysis. Ingest your document to parse it with PaddleOCR and index into Qdrant for RAG.'}</p><div style="margin-top:10px;"><button class="primary" data-action="ingest-document-ai" ${docIngesting?'disabled':''}>${icon('cloud')} ${docIngesting?'Ingesting into AI...':'Ingest to AI Knowledge Base'}</button></div>`:docTab==='Summary'?`<span class="example-label">EXAMPLE ANALYSIS</span><p>${sampleSummary}</p>`:docTab==='Key Points'?'<span class="example-label">EXAMPLE ANALYSIS</span><ul><li>Enterprise connectivity and dedicated internet</li><li>Cloud services and deployment options</li><li>Managed support and service-level agreements</li></ul>':'<span class="example-label">EXAMPLE ANALYSIS</span><ul><li>Review deployment requirements</li><li>Compare connectivity options</li><li>Confirm service-level expectations</li></ul>'}</div></div><div class="summary-meta"><span>${icon('file')} ${docFile?'File selected':'2,304 words'}</span><span>${icon('history')} ${docFile?(docJobStatus||'Ready to ingest'):'Example preview'}</span><button class="outline" data-action="full-analysis">View Full Analysis ${icon('arrow')}</button></div></div></section><section class="panel smart-actions"><div class="panel-heading">${icon('spark')}<div><h2>Smart Actions</h2><p>Turn your documents into actionable intelligence.</p></div></div><div class="action-grid">${[['file','Generate Executive Summary','Get a concise overview of the document.'],['file','Extract Key Terms','Identify important entities, terms and definitions.'],['grid','Compare with Another Document','Find similarities and differences across documents.'],['chat','Ask Questions about this Document','Chat with your document using CloudCore AI.']].map(([i,t,d])=>`<button data-action="document-action" data-title="${t}"><span class="mini-icon">${icon(i)}</span><span><b>${t}</b><small>${d}</small></span>${icon('chevron')}</button>`).join('')}</div></section></div></div>`}
function images(){return `<div class="breadcrumb"><a href="#home">CloudCore AI</a>${icon('chevron')}<span>Image Analysis</span></div><div class="image-heading"><span class="feature-icon">${icon('image')}</span><div><h1>Image Analysis</h1><h2>Understand and analyze images with AI.</h2><p>Upload an image to identify, analyze and extract meaningful information. Get instant insights,<br>object detection, text extraction and more — powered by CloudCore AI.</p></div><div class="image-motto">Smarter AI.<br>Stronger Business.<br><b>A More Connected Pakistan.</b></div></div><div class="image-layout"><section class="panel image-upload"><div class="tabs image-tabs" role="tablist" aria-label="Image source"><button role="tab" aria-selected="${imageMode==='upload'}" class="${imageMode==='upload'?'active':''}" data-action="image-mode" data-mode="upload">${icon('image')}Upload Image</button><button role="tab" aria-selected="${imageMode==='url'}" class="${imageMode==='url'?'active':''}" data-action="image-mode" data-mode="url">${icon('link')}Analyze from URL</button></div>${imageMode==='upload'?`<div class="dropzone" data-drop="image">${imageURL?`<img class="uploaded-preview" src="${esc(imageURL)}" alt="Selected image preview">`:`<span class="upload-cloud">${icon('cloud')}${icon('upload')}</span>`}<h3>${imageFile?esc(imageFile.name):imageURL?'Image selected':'Drag and drop your image here'}</h3><p>or <button data-action="choose-image">click to browse</button></p><small>Supports JPG, PNG, WEBP (Max 20MB)</small><button class="soft-button" data-action="choose-image">${icon('upload')} ${imageURL?'Choose Another Image':'Choose Image'}</button></div>`:`<form id="url-form" class="url-form"><span class="feature-icon">${icon('link')}</span><h3>Add an image URL</h3><p>Paste a direct HTTPS link to a JPG, PNG or WEBP image.</p><input name="url" type="url" placeholder="https://example.com/image.jpg" aria-label="Image URL" required><button class="primary" type="submit">Load Image ${icon('arrow')}</button></form>`}<div class="examples-heading"><h3>Try with these examples</h3><p>Click an example to explore the preview</p></div><div class="image-examples">${[['building','Enterprise Campus','campus'],['image','Screenshots','screenshot'],['signal','Infrastructure Sites','infrastructure'],['grid','Diagrams & Flowcharts','diagram']].map(([i,t,id])=>`<button data-action="example-image" data-example="${id}"><div class="example-picture ${id}">${id==='campus'||id==='infrastructure'?'<img src="assets/hero.png" alt="PTCL enterprise campus">':id==='screenshot'?'<img src="assets/reference-home.png" alt="Example business dashboard screenshot">':`<div class="diagram-thumb">${icon('cloud')}<span>│</span><div>${icon('building')}${icon('chip')}${icon('cloud')}</div></div>`}</div><span>${t}</span></button>`).join('')}</div></section><section class="panel image-results"><div class="panel-heading">${icon('spark')}<div><h2>AI Analysis Results</h2><p>Insights and information extracted from your image.</p></div><span class="powered">${icon('chip')}CloudCore AI</span></div>${visionResult?`<div class="vision-result-card" style="padding:16px;background:var(--surface,#f8fafc);border-radius:12px;text-align:left;margin-bottom:16px;"><h3>Qwen3-VL Vision Insights</h3><div style="margin-top:8px;line-height:1.6;font-size:14px;white-space:pre-wrap;">${esc(visionResult)}</div><button style="margin-top:12px;" class="outline" data-action="clear-vision">Clear Result</button></div>`:`<div class="analysis-empty"><span>${icon(imageURL?'image':'file')}${!imageURL?icon('search'):''}</span><h3>${imageURL?'Your image is ready for analysis':'Upload an image to see AI analysis results'}</h3><p>${imageURL?'An AI service connection is needed to identify objects, extract text and interpret your image. Your local upload stays on this device.':'Our AI will analyze the image and provide detailed insights,<br>including detected objects, text, context and recommendations.'}</p></div>`}${imageURL&&!visionResult?`<div style="margin-top:12px;margin-bottom:16px;"><button class="primary" data-action="analyze-image-ai" ${visionLoading?'disabled':''}>${icon('spark')} ${visionLoading?'Analyzing with Qwen3-VL...':'Analyze with Vision AI'}</button></div>`:''}<div class="discover"><div class="discover-title">${icon('bulb')}<b>What you can discover</b><small>Advanced vision AI</small></div><div class="discover-grid">${[['box','Identify Objects','Detect equipment, infrastructure, people and more'],['file','Extract Text (OCR)','Read text from images, labels, screens and documents'],['chip','Understand Context','Get intelligent insights and business relevance'],['grid','Detect Diagrams','Recognize charts, diagrams and flowcharts'],['settings','Technical Analysis','Analyze network equipment, sites and infrastructure'],['chart','Generate Recommendations','Get actionable insights for business decisions']].map(([i,t,d])=>`<div><span class="mini-icon">${icon(i)}</span><span><b>${t}</b><p>${d}</p></span></div>`).join('')}</div></div></section></div>`}
const activeMeetingStatuses=['launching','lobby','joined','recording','stopping','processing'];
function statusText(status){return({launching:'Starting bot',lobby:'Waiting in lobby',joined:'Joined',recording:'Recording',stopping:'Stopping',processing:'Preparing MOM',completed:'Completed',failed:'Needs attention',deleted:'Deleted'})[status]||status}
function formatMeetingTime(ms){const total=Math.max(0,Math.floor(ms/1000)),minutes=Math.floor(total/60);return `${String(minutes).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function meetingRowView(m){const active=activeMeetingStatuses.includes(m.status);return `<button class="meeting-row" data-action="open-meeting" data-id="${esc(m.id)}"><span class="meeting-platform">T</span><span><b>${esc(m.title||'Microsoft Teams meeting')}</b><small>${new Date(m.createdAt).toLocaleString()} · ${esc(statusText(m.status))}</small></span><span class="meeting-status ${esc(m.status)}"><i></i>${active?'Live':esc(statusText(m.status))}</span>${icon('chevron')}</button>`}
function meetings(){return selectedMeetingId?meetingDetailView():`${title('MEETING INTELLIGENCE','Meetings AI','Send a visible PTCL AI notetaker to a Microsoft Teams meeting.')}<div class="meetings-grid"><section class="panel meeting-launch"><div class="meeting-card-heading"><span class="feature-icon">${icon('video')}</span><div><h2>Join a Teams meeting</h2><p>Paste a meeting invitation link. The organizer must admit the bot from the lobby.</p></div></div><form id="meeting-form"><label class="meeting-url"><span>Microsoft Teams link</span>${icon('link')}<input name="meetingUrl" type="url" required placeholder="https://teams.microsoft.com/meet/..."></label><div class="bot-identity"><span>${icon('chip')}</span><div><small>BOT DISPLAY NAME</small><b>PTCL AI NOTETAKER</b></div></div><label class="consent-check"><input name="consent" type="checkbox" required><span>I confirm that participants will be informed and recording is permitted for this meeting.</span></label>${meetingsError?`<p class="meeting-error">${esc(meetingsError)}</p>`:''}<button class="primary" type="submit" ${meetingsLoading?'disabled':''}>${icon('video')} ${meetingsLoading?'Starting bot…':'Join meeting now'}</button></form><div class="capacity"><span><i style="width:${Math.min(100,meetingsState.capacity.active/meetingsState.capacity.maximum*100)}%"></i></span><small>${meetingsState.capacity.active} of ${meetingsState.capacity.maximum} meeting slots active</small></div></section><section class="panel meeting-history"><div class="panel-heading">${icon('history')}<div><h2>Meeting history</h2><p>Audio and transcripts are retained for 30 days.</p></div><button class="icon-button" data-action="refresh-meetings" aria-label="Refresh">${icon('history')}</button></div><div class="meeting-list">${meetingsLoading&&!meetingsState.meetings.length?'<div class="meeting-empty">Loading meetings…</div>':meetingsState.meetings.length?meetingsState.meetings.map(meetingRowView).join(''):`<div class="meeting-empty"><span>${icon('video')}</span><h3>No meetings yet</h3><p>Your recorded Teams meetings will appear here.</p></div>`}</div></section></div>`}
function meetingDetailView(){const m=meetingsState.detail;if(!m||m.id!==selectedMeetingId)return `${title('MEETING INTELLIGENCE','Loading meeting…','Retrieving the latest meeting status.')}<section class="panel meeting-loading">${meetingsError?esc(meetingsError):'Please wait…'}</section>`;const chatCount=(meetingChats[m.id]||[]).length;const tabs=[['overview','Overview'],['mom','MOM'],['transcript','Transcript'],['snapshots','Snapshots'],['chat','AI Assistant Q&A'],['audio','Audio']];return `<div class="breadcrumb"><a href="#meetings">Meetings AI</a>${icon('chevron')}<span>${esc(m.title)}</span></div><section class="meeting-detail-head panel"><div><span class="meeting-status ${esc(m.status)}"><i></i>${esc(statusText(m.status))}</span><h1>${esc(m.title)}</h1><p>${new Date(m.createdAt).toLocaleString()} · Bot: ${esc(m.botName)}</p></div><div class="meeting-head-actions">${activeMeetingStatuses.includes(m.status)&&m.status!=='processing'?`<button class="outline" data-action="stop-meeting" data-id="${esc(m.id)}">Stop bot</button>`:''}<button class="icon-button danger" data-action="delete-meeting" data-id="${esc(m.id)}" aria-label="Delete meeting">${icon('trash')}</button></div></section>${m.failureMessage?`<div class="meeting-alert"><b>${esc(statusText(m.status))}</b><span>${esc(m.failureMessage)}</span></div>`:''}<div class="meeting-tabs" role="tablist">${tabs.map(([id,label])=>`<button class="${meetingTab===id?'active':''}" data-action="meeting-tab" data-tab="${id}">${label}<small>${id==='transcript'?(m.transcript||[]).length:id==='snapshots'?(m.snapshots||[]).length:id==='chat'?chatCount:''}</small></button>`).join('')}</div>${meetingDetailTab(m)}`}
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
function meetingChatView(m){const history=meetingChats[m.id]||[];const suggestions=['What is he saying right now?','Who is speaking in this meeting?','Summarize discussion so far','Any key decisions or action items mentioned?'];return `<section class="panel meeting-chat-panel"><div class="panel-heading" style="display:flex;justify-content:space-between;align-items:flex-start;"><div style="display:flex;gap:12px;align-items:center;"><span class="feature-icon" style="width:40px;height:40px;border-radius:12px;background:#e8f7ee;color:var(--green);display:grid;place-items:center;">${icon('spark')}</span><div><h2 style="font-size:18px;margin:0;">Meeting AI Assistant</h2><p style="margin-top:3px;color:var(--muted);font-size:12px;">Real-time Q&A powered by local Qwen 2.5 7B & Whisper transcription</p></div></div><span class="live-pill" style="margin-top:4px;"><span class="pulse-dot"></span> Qwen MOM / Q&A Active</span></div><div class="quick-queries">${suggestions.map(q=>`<button type="button" class="quick-query-btn" data-action="quick-meeting-ask" data-query="${esc(q)}">${icon('spark')} ${esc(q)}</button>`).join('')}</div><div class="meeting-chat-messages" aria-live="polite">${history.length?history.map(item=>`<div class="meeting-chat-bubble ${item.role}"><span class="chat-role">${item.role==='user'?'You':'CloudCore Meeting AI'}</span><div ${item.streaming?'id="active-meeting-stream-bubble"':''} class="chat-text">${item.streaming&&!item.content?`<span class="live-pill"><span class="pulse-dot"></span> Analyzing meeting transcript...</span><span class="typing-cursor"></span>`:renderMarkdown(item.content)+(item.streaming?'<span class="typing-cursor"></span>':'')}</div></div>`).join(''):`<div class="meeting-chat-empty"><span class="icon">${icon('chat')}</span><h3>Ask questions about this meeting</h3><p>Ask "What is he saying?", "Who is speaking?", or "Summarize the key points". The AI analyzes live transcripts in real time.</p></div>`}${meetingChatLoading&&!history.some(h=>h.streaming)?`<div class="meeting-chat-bubble assistant"><span class="chat-role">CloudCore Meeting AI</span><div class="chat-text live-pill"><span class="pulse-dot"></span> Analyzing meeting transcript...</div></div>`:''}</div><form id="meeting-chat-form" class="meeting-chat-composer"><input name="chatPrompt" placeholder="Ask what is being said, who spoke, or request a summary..." autocomplete="off" required ${meetingChatLoading?'disabled':''}><button class="primary" type="submit" ${meetingChatLoading?'disabled':''}>${icon('arrow')} Ask</button></form></section>`}
async function sendMeetingChat(meetingId,prompt){prompt=(prompt||'').trim();if(!prompt||meetingChatLoading)return;if(!meetingChats[meetingId])meetingChats[meetingId]=[];meetingChats[meetingId].push({role:'user',content:prompt});const assistantMsg={role:'assistant',content:'',streaming:true};meetingChats[meetingId].push(assistantMsg);meetingChatLoading=true;route({preserveScroll:true});setTimeout(()=>{const box=document.querySelector('.meeting-chat-messages');if(box)box.scrollTop=box.scrollHeight},10);try{const res=await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/chat?stream=true`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:prompt})});if(!res.ok){const err=await res.json().catch(()=>({}));throw Error(err.error?.message||err.detail||`AI service error (${res.status})`)}const reader=res.body?.getReader();if(!reader){const data=await res.json();assistantMsg.content=data.answer||data.reply||'No answer returned from AI.';}else{const decoder=new TextDecoder();let buffer='';while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()??'';for(const line of lines){const trimmed=line.trim();if(!trimmed||trimmed.startsWith(':'))continue;if(trimmed==='data: [DONE]')break;if(trimmed.startsWith('data: ')){try{const parsed=JSON.parse(trimmed.slice(6));if(parsed.full){assistantMsg.content=parsed.full}else if(parsed.delta){assistantMsg.content+=parsed.delta}else if(parsed.error){assistantMsg.content=`Error: ${parsed.error}`}const bubble=document.getElementById('active-meeting-stream-bubble')||document.querySelector('.meeting-chat-messages .meeting-chat-bubble.assistant:last-child .chat-text');if(bubble){const box=document.querySelector('.meeting-chat-messages');const shouldAutoScroll=isNearBottom(box,60);bubble.innerHTML=renderMarkdown(assistantMsg.content)+'<span class="typing-cursor"></span>';if(box&&shouldAutoScroll)box.scrollTop=box.scrollHeight}}catch{}}}}}}catch(err){assistantMsg.content=`Error: ${err.message}`}finally{delete assistantMsg.streaming;meetingChatLoading=false;const boxBefore=document.querySelector('.meeting-chat-messages');const wasNear=isNearBottom(boxBefore,60);const savedScrollTop=boxBefore?boxBefore.scrollTop:null;route({preserveScroll:true});setTimeout(()=>{const box=document.querySelector('.meeting-chat-messages');if(box){if(wasNear)box.scrollTop=box.scrollHeight;else if(savedScrollTop!==null)box.scrollTop=savedScrollTop}},10)}}
function meetingDetailTab(m){if(meetingTab==='mom')return momView(m);if(meetingTab==='chat')return meetingChatView(m);if(meetingTab==='transcript'){const term=(transcriptSearch||'').trim().toLowerCase();const all=m.transcript||[];const list=term?all.filter(s=>(s.text||'').toLowerCase().includes(term)||(s.speakerName||'').toLowerCase().includes(term)):all;const isLive=activeMeetingStatuses.includes(m.status);return `<section class="panel transcript-panel"><div class="transcript-toolbar"><div class="transcript-search">${icon('search')}<input id="transcript-filter" type="search" placeholder="Search transcript or speaker..." value="${esc(transcriptSearch)}" aria-label="Search transcript"></div><div class="transcript-meta-strip">${isLive?`<span class="live-pill"><span class="pulse-dot"></span> Live Transcribing</span>`:''}<span>${list.length} of ${all.length} segments</span></div></div><div class="transcript-list">${list.length?list.map(s=>`<article><time>${formatMeetingTime(s.startMs)}</time><div><span class="speaker-tag">${icon('user')}${esc(s.speakerName||'Participant')}</span><p>${esc(s.text)}</p></div></article>`).join(''):`<div class="meeting-empty"><span>${icon('chat')}</span><h3>${term?'No matching transcript segments':'Transcript not available yet'}</h3><p>${term?'Try searching with different terms.':'Live segments appear here while the bot is recording.'}</p></div>`}</div></section>`}if(meetingTab==='snapshots'){const isLive=activeMeetingStatuses.includes(m.status);const snaps=m.snapshots||[];return `<section class="panel snapshot-section"><div class="panel-heading" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;"><div><h2 style="font-size:18px;margin:0;">Meeting Screens & Snapshots</h2><p style="margin-top:4px;color:var(--muted);font-size:12px;">Live display from Teams bot and periodic screen captures.</p></div>${isLive?`<button class="outline" data-action="refresh-live-screenshot">${icon('history')} Refresh Live Screen</button>`:''}</div>${isLive?`<div class="live-bot-frame"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><span class="live-pill"><span class="pulse-dot"></span> Live Bot View (Teams Display)</span><small style="color:var(--muted);font-size:11px;">Display :99.0 · Updated live</small></div><div class="live-screen-wrap"><img id="live-bot-screen-img" src="/api/meetings/${encodeURIComponent(m.id)}/live-screenshot?t=${Date.now()}" alt="Live bot screen view" onerror="this.closest('.live-bot-frame').style.display='none';"></div></div>`:''}<div class="snapshot-grid">${snaps.length?snaps.map(s=>`<figure class="snapshot-card"><img src="/api/meetings/${encodeURIComponent(m.id)}/snapshots/${encodeURIComponent(s.id)}" alt="Screen snapshot at ${formatMeetingTime(s.capturedAtMs)}"><figcaption><span>${icon('image')} Shared Screen</span><time style="margin-left:auto;">${formatMeetingTime(s.capturedAtMs)}</time></figcaption></figure>`).join(''):(!isLive?`<div class="meeting-empty"><span>${icon('image')}</span><h3>No snapshots captured yet</h3><p>Screenshots taken during the session will appear here.</p></div>`:'')}</div></section>`}if(meetingTab==='audio'){const isRecording=activeMeetingStatuses.includes(m.status);return `<section class="panel audio-panel"><span class="feature-icon">${icon('signal')}</span><h2>Meeting Audio Recording</h2><p>Private encrypted recording stored securely. Accessible only to authorized CloudCore workspace members.</p>${isRecording?`<div class="audio-recording-notice"><span class="live-pill"><span class="pulse-dot"></span> Live Audio Recording In Progress</span><p>Teams bot is streaming and capturing 48kHz audio directly from the call. Full playback and export download are unlocked as soon as the meeting ends.</p></div>`:''}${m.recordingObjectKey?`<div class="audio-player-wrap"><audio controls preload="metadata" src="/api/meetings/${encodeURIComponent(m.id)}/audio"></audio><div class="audio-meta"><span>${icon('signal')} WebM Opus · 48kHz Stereo</span><a class="outline audio-download-btn" href="/api/meetings/${encodeURIComponent(m.id)}/audio" download="${esc(m.title||'meeting')}-audio.webm">${icon('download')} Download Audio</a></div></div>`:(!isRecording?'<div class="meeting-empty"><span>'+icon('signal')+'</span><h3>Audio not available</h3><p>Audio recording is only saved for meetings with recording enabled.</p></div>':'')}</section>`;}const recentSegments=(m.transcript||[]).slice(-3);return `<div class="meeting-overview"><section class="panel overview-metrics">${[['clock','Status',statusText(m.status)],['users','Participants',String((m.participants||[]).length)],['chat','Transcript segments',String((m.transcript||[]).length)],['image','Snapshots',String((m.snapshots||[]).length)]].map(([i,k,v])=>`<div><span>${icon(i)}</span><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</section>${recentSegments.length?`<section class="panel live-preview-strip" style="grid-column:1/-1;"><div style="display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:8px;">${activeMeetingStatuses.includes(m.status)?`<span class="live-pill"><span class="pulse-dot"></span> Real-time Speech</span>`:icon('spark')}<h3 style="font-size:14px;margin:0;">Recent Discussion</h3></div><button class="outline small" data-action="meeting-tab" data-tab="chat">${icon('spark')} Ask AI about this</button></div><div class="recent-segments">${recentSegments.map(s=>`<div class="recent-seg"><time>${formatMeetingTime(s.startMs)}</time><strong>${esc(s.speakerName||'Speaker')}:</strong><span>${esc(s.text)}</span></div>`).join('')}</div></section>`:''}<section class="panel participant-panel"><div class="panel-heading">${icon('users')}<h2>Meeting Participants</h2></div>${(m.participants||[]).length?(m.participants||[]).map(p=>`<div class="participant-row"><span>${esc((p.displayName||'U').charAt(0).toUpperCase())}</span><div><b>${esc(p.displayName||'Participant')}</b>${p.speakerId?`<small style="display:block;color:#75867e;">ID: ${esc(p.speakerId)}</small>`:''}</div><span class="p-status ${p.leftAt?'left':'active'}">${!p.leftAt?'<i></i>':''}${p.leftAt?'Left':'In meeting'}</span></div>`).join(''):'<div class="meeting-empty">Participant details appear after the bot is admitted.</div>'}</section><section class="panel privacy-panel"><h2>${icon('shield')} Recording & Privacy Controls</h2><p>Audio and transcript expire on ${new Date(m.expiresAt).toLocaleDateString()}. The Teams link is removed within 24 hours of completion.</p><div style="margin-top:14px;display:flex;gap:8px;"><button class="outline small" data-action="meeting-tab" data-tab="transcript">${icon('chat')} Full Transcript</button><button class="outline small" data-action="meeting-tab" data-tab="chat">${icon('spark')} Ask AI Assistant</button></div></section></div>`}
function lines(value){return value?value.split('\n').map(v=>v.trim()).filter(Boolean):[]}
function momView(m){if(!m.mom)return `<section class="panel meeting-empty mom-empty"><span>${icon('spark')}</span><h3>${m.status==='processing'?'Preparing Minutes of Meeting':'MOM is not available'}</h3><p>${m.status==='processing'?'CloudCore AI is reviewing the final transcript.':'Finish the meeting, then generate the MOM from its transcript.'}</p>${['completed','failed'].includes(m.status)?`<button class="primary" data-action="regenerate-mom" data-id="${esc(m.id)}">Generate MOM</button>`:''}</section>`;const mom=m.mom;return `<form id="mom-form" class="panel mom-editor"><div class="mom-toolbar"><div><span class="eyebrow">MINUTES OF MEETING</span><h2>Review and edit</h2></div><button type="button" class="outline" data-action="copy-mom">Copy</button><button type="button" class="outline" data-action="download-mom">${icon('download')} Markdown</button><button type="button" class="outline" data-action="preview-mom">${icon('arrow')} Preview Report</button><button type="button" class="primary" data-action="print-mom">${icon('download')} Download PDF / Print</button><button class="primary" type="submit">Save changes</button></div><label>Executive summary<textarea name="summary" required>${esc(mom.summary)}</textarea></label><div class="mom-form-grid"><label>Attendees<small>One name per line</small><textarea name="attendees">${esc((mom.attendees||[]).join('\n'))}</textarea></label><label>Topics<small>Title | Notes</small><textarea name="topics">${esc((mom.topics||[]).map(x=>`${x.title} | ${x.notes}`).join('\n'))}</textarea></label><label>Decisions<small>One decision per line</small><textarea name="decisions">${esc((mom.decisions||[]).map(x=>x.decision).join('\n'))}</textarea></label><label>Action items<small>Task | Owner | Due date</small><textarea name="actionItems">${esc((mom.actionItems||[]).map(x=>`${x.task} | ${x.owner||''} | ${x.dueDate||''}`).join('\n'))}</textarea></label><label>Risks<textarea name="risks">${esc((mom.risks||[]).join('\n'))}</textarea></label><label>Open questions<textarea name="openQuestions">${esc((mom.openQuestions||[]).join('\n'))}</textarea></label></div></form>`}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});let payload={};try{payload=await response.json()}catch{}if(response.status===401){appUser=null;location.hash='login';route();throw Error('Authentication required.')}if(!response.ok)throw Error(payload.error?.message||`Request failed (${response.status}).`);return payload}
function scheduleMeetingsPoll(){clearTimeout(meetingsTimer);meetingsTimer=null;if(!location.hash.startsWith('#meetings'))return;const isActive=selectedMeetingId&&activeMeetingStatuses.includes(meetingsState.detail?.status);const pollDelay=isActive?3000:6000;meetingsTimer=setTimeout(()=>refreshMeetings(),pollDelay)}
function updateMeetingsLiveDom(){if(!location.hash.startsWith('#meetings'))return;if(!selectedMeetingId){const listEl=document.querySelector('.meeting-list');if(listEl){listEl.innerHTML=meetingsState.meetings.length?meetingsState.meetings.map(meetingRowView).join(''):`<div class="meeting-empty"><span>${icon('video')}</span><h3>No meetings yet</h3><p>Your recorded Teams meetings will appear here.</p></div>`;document.querySelectorAll('[data-action="open-meeting"]').forEach(el=>el.onclick=()=>{meetingTab='overview';meetingsState.detail=null;location.hash=`meetings/${el.dataset.id}`;refreshMeetings(true)})}const capI=document.querySelector('.capacity i');const capSm=document.querySelector('.capacity small');if(capI)capI.style.width=`${Math.min(100,meetingsState.capacity.active/meetingsState.capacity.maximum*100)}%`;if(capSm)capSm.textContent=`${meetingsState.capacity.active} of ${meetingsState.capacity.maximum} meeting slots active`;return}const m=meetingsState.detail;if(!m||m.id!==selectedMeetingId)return;const statusBadge=document.querySelector('.meeting-detail-head .meeting-status');if(statusBadge){statusBadge.className=`meeting-status ${esc(m.status)}`;statusBadge.innerHTML=`<i></i>${esc(statusText(m.status))}`}const stopBtn=document.querySelector('[data-action="stop-meeting"]');if(stopBtn&&(!activeMeetingStatuses.includes(m.status)||m.status==='processing')){stopBtn.remove()}const tabs=document.querySelectorAll('.meeting-tabs button');tabs.forEach(tabBtn=>{const tabName=tabBtn.dataset.tab;const countEl=tabBtn.querySelector('small');if(countEl){const count=tabName==='transcript'?(m.transcript||[]).length:tabName==='snapshots'?(m.snapshots||[]).length:tabName==='chat'?(meetingChats[m.id]||[]).length:'';countEl.textContent=count}});const active=document.activeElement;if(meetingTab==='chat'){if(meetingChatLoading||(meetingChats[m.id]||[]).some(item=>item.streaming))return;const msgBox=document.querySelector('.meeting-chat-messages');if(msgBox){const history=meetingChats[m.id]||[];const rendered=history.length?history.map(item=>`<div class="meeting-chat-bubble ${item.role}"><span class="chat-role">${item.role==='user'?'You':'CloudCore Meeting AI'}</span><div class="chat-text">${renderMarkdown(item.content)}</div></div>`).join(''):`<div class="meeting-chat-empty"><span class="icon">${icon('chat')}</span><h3>Ask questions about this meeting</h3><p>Ask "What is he saying?", "Who is speaking?", or "Summarize the key points". The AI analyzes live transcripts in real time.</p></div>`;if(msgBox.innerHTML!==rendered){const wasNear=isNearBottom(msgBox,60);const savedTop=msgBox.scrollTop;msgBox.innerHTML=rendered;if(wasNear)msgBox.scrollTop=msgBox.scrollHeight;else msgBox.scrollTop=savedTop}}}else if(meetingTab==='transcript'&&active?.id!=='transcript-filter'){const term=(transcriptSearch||'').trim().toLowerCase();const all=m.transcript||[];const list=term?all.filter(s=>(s.text||'').toLowerCase().includes(term)||(s.speakerName||'').toLowerCase().includes(term)):all;const isLive=activeMeetingStatuses.includes(m.status);const metaStrip=document.querySelector('.transcript-meta-strip');if(metaStrip)metaStrip.innerHTML=`${isLive?`<span class="live-pill"><span class="pulse-dot"></span> Live Transcribing</span>`:''}<span>${list.length} of ${all.length} segments</span>`;const listWrap=document.querySelector('.transcript-list');if(listWrap){const wasNear=isNearBottom(listWrap,60);const savedTop=listWrap.scrollTop;const rendered=list.length?list.map(s=>`<article><time>${formatMeetingTime(s.startMs)}</time><div><span class="speaker-tag">${icon('user')}${esc(s.speakerName||'Participant')}</span><p>${esc(s.text)}</p></div></article>`).join(''):`<div class="meeting-empty"><span>${icon('chat')}</span><h3>${term?'No matching transcript segments':'Transcript not available yet'}</h3><p>${term?'Try searching with different terms.':'Live segments appear here while the bot is recording.'}</p></div>`;if(listWrap.innerHTML!==rendered){listWrap.innerHTML=rendered;if(wasNear)listWrap.scrollTop=listWrap.scrollHeight;else listWrap.scrollTop=savedTop}}}else if(meetingTab==='snapshots'){const snaps=m.snapshots||[];const snapGrid=document.querySelector('.snapshot-grid');if(snapGrid&&snaps.length){snapGrid.innerHTML=snaps.map(s=>`<figure class="snapshot-card"><img src="/api/meetings/${encodeURIComponent(m.id)}/snapshots/${encodeURIComponent(s.id)}" alt="Screen snapshot at ${formatMeetingTime(s.capturedAtMs)}"><figcaption><span>${icon('image')} Shared Screen</span><time style="margin-left:auto;">${formatMeetingTime(s.capturedAtMs)}</time></figcaption></figure>`).join('')}}}
async function refreshMeetings(force=false){if(meetingsLoading&&!force)return;if(meetingChatLoading||(meetingChats[selectedMeetingId]||[]).some(m=>m.streaming)){scheduleMeetingsPoll();return}meetingsLoading=true;try{if(!appUser){const identity=await api('/api/me');appUser=identity.user}if(selectedMeetingId){meetingsState.detail=await api(`/api/meetings/${encodeURIComponent(selectedMeetingId)}`)}else{const list=await api('/api/meetings');meetingsState={...meetingsState,...list}}meetingsState.lastLoaded=Date.now();meetingsError=''}catch(error){meetingsError=error.message}finally{meetingsLoading=false;if(meetingChatLoading||(meetingChats[selectedMeetingId]||[]).some(m=>m.streaming)){scheduleMeetingsPoll();return}if(location.hash.startsWith('#meetings')){const hasDetailDom=Boolean(document.querySelector('.meeting-detail-head'));if(selectedMeetingId&&hasDetailDom){updateMeetingsLiveDom()}else if(!selectedMeetingId){updateMeetingsLiveDom()}else{route({preserveScroll:true})}}scheduleMeetingsPoll()}}
async function startMeeting(form){meetingsLoading=true;meetingsError='';route();try{const data=new FormData(form);const meeting=await api('/api/meetings',{method:'POST',body:JSON.stringify({meetingUrl:data.get('meetingUrl'),consent:data.get('consent')==='on'})});location.hash=`meetings/${meeting.id}`;await refreshMeetings(true)}catch(error){meetingsError=error.message;meetingsLoading=false;route()}}
async function meetingCommand(id,command,method='POST'){try{await api(`/api/meetings/${encodeURIComponent(id)}${command}`,{method});toast(command==='/stop'?'The bot is leaving the meeting.':command==='/regenerate-mom'?'MOM generation started.':'Meeting deletion started.');if(method==='DELETE')location.hash='meetings'}catch(error){toast(error.message)}finally{await refreshMeetings(true)}}
function momFromForm(form,mom){const data=new FormData(form),topics=lines(data.get('topics')).map((v,i)=>{const [title,...notes]=v.split('|');return{title:title.trim(),notes:notes.join('|').trim(),timestampMs:mom.topics?.[i]?.timestampMs}}),decisions=lines(data.get('decisions')).map((decision,i)=>({decision,timestampMs:mom.decisions?.[i]?.timestampMs})),actionItems=lines(data.get('actionItems')).map((v,i)=>{const [task,owner,dueDate]=v.split('|').map(x=>x.trim());return{task,owner:owner||undefined,dueDate:dueDate||undefined,timestampMs:mom.actionItems?.[i]?.timestampMs}});return{summary:String(data.get('summary')||''),attendees:lines(data.get('attendees')),topics,decisions,actionItems,risks:lines(data.get('risks')),openQuestions:lines(data.get('openQuestions'))}}
function momMarkdown(m){const mom=m.mom;if(!mom)return'';return `# ${m.title}\n\n## Summary\n${mom.summary}\n\n## Attendees\n${mom.attendees.map(x=>`- ${x}`).join('\n')}\n\n## Decisions\n${mom.decisions.map(x=>`- ${x}`).join('\n')}\n\n## Action items\n${mom.actionItems.map(x=>`- ${x.task}${x.owner?` — ${x.owner}`:''}${x.dueDate?` (${x.dueDate})`:''}`).join('\n')}\n\n## Risks\n${mom.risks.map(x=>`- ${x}`).join('\n')}\n\n## Open questions\n${mom.openQuestions.map(x=>`- ${x}`).join('\n')}`}
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
function modal(content,{uncloseable=false}={}){
  $('#dialog-content').innerHTML=content;
  const closeBtn=document.querySelector('.dialog-close');
  if(closeBtn)closeBtn.style.display=uncloseable?'none':'block';
  if($('#dialog')){
    $('#dialog').classList.toggle('uncloseable',uncloseable);
    $('#dialog').showModal();
  }
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
              <input name="username" type="text" autocomplete="username" required placeholder="e.g. azeemniazi or muhammadali" autofocus>
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
        headers:{'content-type':'application/json'},
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
          headers:{'content-type':'application/json'},
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
      <h3>Existing User Accounts</h3>
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
        const res=await fetch('/api/auth/change-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});
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
        const res=await fetch('/api/admin/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,displayName,password,role,mustChangePassword})});
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
        const res=await fetch(`/api/admin/users/${encodeURIComponent(targetId)}/reset-password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({newPassword})});
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
        const res=await fetch(`/api/admin/users/${encodeURIComponent(targetId)}`,{method:'DELETE'});
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
        <button class="primary" data-action="open-settings-modal">${icon('settings')} Settings</button>
        <button class="outline danger" data-action="signout">${icon('logout')} Sign out</button>
      </div>
    </div>
  `);
  document.querySelectorAll('#dialog [data-action="open-settings-modal"]').forEach(el=>el.onclick=()=>openSettingsModal());
  document.querySelectorAll('#dialog [data-action="signout"]').forEach(el=>el.onclick=()=>handleSignOut());
}

async function handleSignOut(){
  try{await fetch('/api/auth/logout',{method:'POST'});}catch{}
  appUser=null;
  location.hash='landing';
  route();
  toast('You have signed out successfully.');
}
function saveChats(){try{localStorage.setItem('cloudcore-chats',JSON.stringify(chats))}catch{toast('Your browser could not save chat history.')}}
function pollIngestJob(jobId,filename){const interval=setInterval(()=>{if(typeof fetch!=='function'){clearInterval(interval);return}fetch(`/api/jobs/${encodeURIComponent(jobId)}`).then(r=>r.json()).then(res=>{if(res.status==='finished'){clearInterval(interval);docIngesting=false;docJobStatus=`Successfully indexed "${filename}" into AI knowledge base! You can now query it in AI Assistant.`;toast(`"${filename}" indexed into AI knowledge base!`);route()}else if(res.status==='failed'){clearInterval(interval);docIngesting=false;docJobStatus=`Ingestion failed: ${res.error||'Unknown error'}`;toast(docJobStatus);route()}else{docJobStatus=`Processing document: ${res.status}...`;route()}}).catch(err=>{clearInterval(interval);docIngesting=false;docJobStatus=`Status check failed: ${err.message}`;route()})},3000)}
async function sendMessage(t){
  t=(t||'').trim();
  if(!t)return;
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
      const res=await fetch('/api/chat?stream=true',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({message:t,use_rag:true,stream:true})
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
function selectDocument(file){if(!file)return;if(!/\.(pdf|docx|pptx|xlsx|txt|md)$/i.test(file.name))return toast('Please choose a PDF, DOCX, PPTX, XLSX or text file.');if(file.size>50*1048576)return toast('Please choose a document smaller than 50 MB.');docFile=file;location.hash='documents';route();toast('Document selected. Your file stays on this device.')}
function selectImage(file){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('Please choose a JPG, PNG or WEBP image.');if(file.size>20*1048576)return toast('Please choose an image smaller than 20 MB.');if(imageURL.startsWith('blob:'))URL.revokeObjectURL(imageURL);imageFile=file;imageURL=URL.createObjectURL(file);imageMode='upload';location.hash='images';route()}
function actions(a,el){if(a==='new-chat'){messages=[];currentChat=null;location.hash='assistant';route()}else if(a==='suggestion'){const t=el.dataset.prompt;if(t==='Summarize this document')location.hash='documents';else if(t==='What is in this image?')location.hash='images';else sendMessage(t)}else if(a==='choose-document'||a==='attach-document')$('#document-input').click();else if(a==='choose-image'||a==='attach-image')$('#image-input').click();else if(a==='doc-tab'){docTab=el.dataset.tab;route()}else if(a==='image-mode'){imageMode=el.dataset.mode;route()}else if(a==='example-image'){imageFile=null;imageURL=el.dataset.example==='screenshot'?'assets/reference-home.png':el.dataset.example==='diagram'?'assets/diagram.svg':'assets/hero.png';imageMode='upload';route();toast('Example selected. Connect an AI service for image analysis.')}else if(a==='cloud-source')modal(`<h2>Connect ${el.dataset.source}</h2><p>Cloud storage connections will be available when the account integration is configured. For now, download your document and choose it from your device.</p><button class="primary" data-action="choose-document">Choose a local file</button>`);else if(a==='full-analysis'||a==='document-action')modal(`<span class="feature-icon">${icon('file')}</span><h2>${el.dataset.title||'Document Analysis'}</h2><p>${docFile?'Your document is selected. Connect an AI service to analyze its contents.':'Example analysis — PTCL Enterprise Proposal'}</p>${!docFile?`<p>${sampleSummary}</p><h3>Key points</h3><ul><li>Enterprise connectivity and cloud services</li><li>Flexible deployment options</li><li>Managed support and service-level agreements</li></ul>`:''}`);else if(a==='view-documents')modal(`<h2>Recent Documents</h2><p>${docFile?esc(docFile.name)+' — selected on this device.':'No documents uploaded yet. The proposal displayed is an example.'}</p>`);else if(a==='menu')$('.sidebar').classList.toggle('mobile-open');else if(a==='close-dialog')$('#dialog').close();else if(a==='open-chat'){const c=chats.find(c=>c.id===el.dataset.id);messages=[...c.messages];currentChat=c.id;location.hash='assistant'}else if(a==='delete-chat')modal(`<h2>Delete this conversation?</h2><p>This removes the conversation from this device.</p><div class="dialog-actions"><button class="outline" data-action="close-dialog">Cancel</button><button class="primary" data-action="confirm-delete" data-id="${el.dataset.id}">Delete conversation</button></div>`);else if(a==='confirm-delete'){chats=chats.filter(c=>c.id!==el.dataset.id);saveChats();route();toast('Conversation deleted.')}else if(a==='settings')openSettingsModal();else if(a==='profile')openProfileModal();else if(a==='signout')handleSignOut();else if(a==='help')modal('<h2>How can we help?</h2><p><b>AI Assistant:</b> Start a conversation and explore the chat interface.</p><p><b>Document Insight:</b> Upload a file and explore an example analysis.</p><p><b>Image Analysis:</b> Preview an uploaded image or use a direct image URL.</p><p><b>Chat History:</b> Reopen or delete conversations saved on this device.</p>');else if(a==='solutions')modal(`<h2>PTCL Business Solutions</h2><p>Explore connectivity, cloud, security and intelligent support.</p><div class="solution-list">${[['signal','Reliable Connectivity','Keep your business connected.'],['cloud','Cloud & Data Solutions','Infrastructure that grows with you.'],['shield','Cyber Security','Protect your business and its data.'],['chip','AI-Powered Support','Find the right support for your business.']].map(([i,t,d])=>`<div>${icon(i)}<span><b>${t}</b><p>${d}</p></span></div>`).join('')}</div>`);else if(a==='ingest-document-ai'){if(!docFile)return toast('Please choose a document first.');if(typeof fetch!=='function')return toast('AI service connection required.');docIngesting=true;docJobStatus='Uploading to AI platform...';route();const form=new FormData();form.append('file',docFile);fetch('/api/documents/upload',{method:'POST',body:form}).then(async r=>{if(!r.ok){const err=await r.json().catch(()=>({}));throw Error(err.error?.message||err.detail||`Upload failed (${r.status})`)}return r.json()}).then(data=>{toast(`Document queued (Job: ${data.job_id.slice(0,8)}). Ingesting...`);docJobStatus=`Ingestion queued (Job: ${data.job_id.slice(0,8)})...`;route();pollIngestJob(data.job_id,data.filename)}).catch(err=>{docIngesting=false;docJobStatus=`Ingestion failed: ${err.message}`;toast(docJobStatus);route()})}else if(a==='analyze-image-ai'){if(!imageFile&&!imageURL)return toast('Please choose or upload an image first.');if(typeof fetch!=='function')return toast('AI service connection required.');visionLoading=true;visionResult='';route();(async()=>{try{const form=new FormData();form.append('question','Please analyze this image thoroughly: identify all objects, extract visible text via OCR, describe layout and context, and highlight key actionable observations.');if(imageFile){form.append('image',imageFile)}else{const blob=await fetch(imageURL).then(r=>r.blob());form.append('image',blob,'image.png')}const r=await fetch('/api/vision',{method:'POST',body:form});if(!r.ok){const err=await r.json().catch(()=>({}));throw Error(err.error?.message||err.detail||`Vision request failed (${r.status})`)}const data=await r.json();visionResult=data.answer||'No analysis returned.';toast('Vision analysis complete.')}catch(err){toast(`Vision analysis failed: ${err.message}`);visionResult=`Analysis failed: ${err.message}`}finally{visionLoading=false;route()}})()}else if(a==='clear-vision'){visionResult='';route()}bindDialog()}
function bindDialog(){document.querySelectorAll('#dialog [data-action]').forEach(el=>el.onclick=()=>actions(el.dataset.action,el))}
const baseBind=bind;bind=function(){baseBind();document.querySelectorAll('.composer').forEach(f=>f.onsubmit=e=>{e.preventDefault();sendMessage(new FormData(f).get('prompt'))});if($('#search-form'))$('#search-form').onsubmit=e=>{e.preventDefault();const q=$('#search-form input').value.toLowerCase();const match=navs.find(n=>n[2].toLowerCase().includes(q));if(q&&match)location.hash=match[0];else if(q)sendMessage(q)};if($('#document-input'))$('#document-input').onchange=e=>selectDocument(e.target.files[0]);if($('#image-input'))$('#image-input').onchange=e=>selectImage(e.target.files[0]);document.querySelectorAll('[data-drop]').forEach(d=>{d.ondragover=e=>{e.preventDefault();d.classList.add('dragging')};d.ondragleave=()=>d.classList.remove('dragging');d.ondrop=e=>{e.preventDefault();d.classList.remove('dragging');(d.dataset.drop==='image'?selectImage:selectDocument)(e.dataTransfer.files[0])}});if($('#url-form'))$('#url-form').onsubmit=e=>{e.preventDefault();const url=new FormData(e.target).get('url');try{if(new URL(url).protocol!=='https:')throw Error();}catch{return toast('Please enter a valid HTTPS image URL.')}const image=new Image();image.onload=()=>{imageFile=null;imageURL=url;imageMode='upload';route()};image.onerror=()=>toast('The image could not be loaded. Check the link or upload a file.');image.src=url};if($('#history-search'))$('#history-search').oninput=e=>{historySearch=e.target.value;const start=e.target.selectionStart;route();$('#history-search').focus();$('#history-search').setSelectionRange(start,start)};if($('#dialog'))$('#dialog').onclick=e=>{if(e.target===$('#dialog'))$('#dialog').close()};};
const productBind=bind;bind=function(){productBind();clearTimeout(meetingsTimer);meetingsTimer=null;const on=(selector,handler)=>document.querySelectorAll(selector).forEach(el=>el.onclick=()=>handler(el));on('[data-action="open-meeting"]',el=>{meetingTab='overview';meetingsState.detail=null;location.hash=`meetings/${el.dataset.id}`;refreshMeetings(true)});on('[data-action="refresh-meetings"]',()=>refreshMeetings(true));on('[data-action="meeting-tab"]',el=>{meetingTab=el.dataset.tab;route();if(meetingTab==='chat'){requestAnimationFrame(()=>{const box=document.querySelector('.meeting-chat-messages');if(box)box.scrollTop=box.scrollHeight})}});on('[data-action="stop-meeting"]',el=>meetingCommand(el.dataset.id,'/stop'));on('[data-action="regenerate-mom"]',el=>meetingCommand(el.dataset.id,'/regenerate-mom'));on('[data-action="delete-meeting"]',el=>{if(window.confirm('Permanently delete this meeting and all of its audio, transcript, snapshots and MOM?'))meetingCommand(el.dataset.id,'','DELETE')});on('[data-action="copy-mom"]',()=>{navigator.clipboard?.writeText(momMarkdown(meetingsState.detail));toast('MOM copied to clipboard.')});on('[data-action="download-mom"]',()=>{const blob=new Blob([momMarkdown(meetingsState.detail)],{type:'text/markdown'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='meeting-mom.md';link.click();URL.revokeObjectURL(link.href)});on('[data-action="preview-mom"]',()=>previewMomPdf(meetingsState.detail));on('[data-action="print-mom"]',()=>printMomPdf(meetingsState.detail));on('[data-action="profile"]',()=>openProfileModal());on('[data-action="settings"]',()=>openSettingsModal());on('[data-action="signout"]',()=>handleSignOut());on('[data-prompt="Start a Teams meeting bot"]',()=>location.hash='meetings');on('[data-action="quick-meeting-ask"]',el=>{if(selectedMeetingId)sendMeetingChat(selectedMeetingId,el.dataset.query)});on('[data-action="refresh-live-screenshot"]',()=>{const img=$('#live-bot-screen-img');if(img&&selectedMeetingId)img.src=`/api/meetings/${encodeURIComponent(selectedMeetingId)}/live-screenshot?t=${Date.now()}`});const transcriptInput=$('#transcript-filter');if(transcriptInput){transcriptInput.oninput=e=>{transcriptSearch=e.target.value;const term=transcriptSearch.trim().toLowerCase();const articles=document.querySelectorAll('.transcript-list article');let visible=0;articles.forEach(art=>{const match=!term||art.textContent.toLowerCase().includes(term);art.style.display=match?'':'none';if(match)visible++});const metaSpan=document.querySelector('.transcript-meta-strip span:last-child');if(metaSpan)metaSpan.textContent=`${visible} of ${articles.length} segments`}};const meetingChatForm=$('#meeting-chat-form');if(meetingChatForm){meetingChatForm.onsubmit=e=>{e.preventDefault();const p=new FormData(meetingChatForm).get('chatPrompt');if(selectedMeetingId)sendMeetingChat(selectedMeetingId,p)}};if($('#meeting-form'))$('#meeting-form').onsubmit=e=>{e.preventDefault();startMeeting(e.target)};if($('#mom-form'))$('#mom-form').onsubmit=async e=>{e.preventDefault();try{const mom=momFromForm(e.target,meetingsState.detail.mom);await api(`/api/meetings/${encodeURIComponent(meetingsState.detail.id)}/mom`,{method:'PUT',body:JSON.stringify(mom)});toast('MOM changes saved.');await refreshMeetings(true)}catch(error){toast(error.message)}};if(location.hash.startsWith('#meetings')){if(selectedMeetingId&&(!meetingsState.detail||meetingsState.detail.id!==selectedMeetingId)){refreshMeetings(true)}else if(!meetingsState.lastLoaded&&!meetingsLoading){refreshMeetings()}else{scheduleMeetingsPoll()}}};
window.addEventListener('hashchange',route);route();
if(typeof fetch==='function')api('/api/me').then(data=>{appUser=data.user;if(location.hash.startsWith('#home')||location.hash.startsWith('#meetings'))route({preserveScroll:true});if(appUser?.mustChangePassword)checkMustChangePassword();}).catch(()=>{});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'navigate_cloudcore',title:'Open a CloudCore AI screen',description:'Navigate to a CloudCore AI frontend screen. Does not send messages, join meetings, or upload files.',inputSchema:{type:'object',properties:{screen:{type:'string',enum:['landing','home','assistant','meetings','documents','images','history']}},required:['screen'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!['landing','home','assistant','meetings','documents','images','history'].includes(input.screen))throw new Error('Choose a supported CloudCore AI screen.');location.hash=input.screen;route();return{screen:input.screen,status:'opened'}}})).catch(()=>{})}catch{}}
