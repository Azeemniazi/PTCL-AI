/* Reference-theme views. The application owns state, authentication and API calls. */
function refVideoBackground(kind){
  const asset=kind==='sidebar'?'sidebar':'assistant';
  const file=asset==='sidebar'?'sidebar-motion-slim':'assistant-motion';
  return `<video class="ref-background-video ref-${asset}-video" data-motion-background data-video-src="assets/${file}.mp4" poster="assets/${file}-poster.jpg" autoplay muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video>`;
}
let refMotionQuery=null,refMotionObserver=null,refMotionListenersReady=false,refMotionVideos=[],refMotionCache=new Map();
function refAttachLoopGuard(video){
  if(video.dataset.motionLoopBound||typeof video.addEventListener!=='function')return;
  video.dataset.motionLoopBound='true';
  video.loop=true;
  video.addEventListener('timeupdate',()=>{
    if(video.duration>0.5&&video.currentTime>=video.duration-0.05){
      video.currentTime=0.001;
      if(video.paused&&!refMotionQuery?.matches&&!document.hidden&&video.dataset.motionVisible!=='false'){
        const p=video.play();if(p?.catch)p.catch(()=>{});
      }
    }
  });
  video.addEventListener('ended',()=>{
    video.currentTime=0.001;
    if(!refMotionQuery?.matches&&!document.hidden&&video.dataset.motionVisible!=='false'){
      const p=video.play();if(p?.catch)p.catch(()=>{});
    }
  });
}
function refSyncMotion(){
  if(!refMotionListenersReady){
    refMotionListenersReady=true;
    if(typeof window.matchMedia==='function'){
      refMotionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
      if(refMotionQuery.addEventListener)refMotionQuery.addEventListener('change',refSyncMotion);
      else if(refMotionQuery.addListener)refMotionQuery.addListener(refSyncMotion);
    }
    if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',refSyncMotion);
    if(typeof IntersectionObserver!=='undefined')refMotionObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>entry.target.dataset.motionVisible=String(entry.isIntersecting&&entry.intersectionRatio>0));
      refSyncMotion();
    },{threshold:0.01});
  }
  const rawVideos=Array.from(document.querySelectorAll('[data-motion-background]'));
  const videos=rawVideos.map(video=>{
    const key=video.dataset?.videoSrc;
    if(key&&typeof video.replaceWith==='function'){
      const cached=refMotionCache.get(key);
      if(cached&&cached!==video&&cached.getAttribute?.('src')){
        cached.className=video.className;
        video.replaceWith(cached);
        return cached;
      }
      refMotionCache.set(key,video);
    }
    return video;
  });
  refMotionVideos.filter(video=>!videos.includes(video)).forEach(video=>{video.pause();refMotionObserver?.unobserve(video);if(video.dataset)delete video.dataset.motionObserved;});
  refMotionVideos=videos;
  videos.forEach(video=>{
    refAttachLoopGuard(video);
    if(refMotionObserver&&!video.dataset.motionObserved){video.dataset.motionObserved='true';refMotionObserver.observe(video);}
    const prefMode=(typeof userPrefs==='object'&&userPrefs&&userPrefs.motionMode)||'auto';
    const reduced=prefMode==='off'?true:prefMode==='on'?false:Boolean(refMotionQuery?.matches);
    const enabled=!reduced&&!document.hidden&&video.dataset.motionVisible!=='false';
    if(!enabled){video.pause();return;}
    video.muted=true;
    if(!video.getAttribute('src'))video.setAttribute('src',video.dataset.videoSrc);
    if(video.paused){const playback=video.play();if(playback?.catch)playback.catch(()=>{});}
  });
}
function refHeader(active='landing') {
  return `<header class="ref-site-header">${brand()}<nav aria-label="Main navigation">${[['site-solutions','Solutions'],['site-ai','AI Workspace'],['site-industries','Industries'],['site-resources','Resources'],['site-about','About']].map(([id,t])=>`<a href="#${id}" ${active===id?'aria-current="page"':''}>${t}</a>`).join('')}</nav><div class="ref-site-actions"><a href="#site-resources" aria-label="Search resources">${icon('search')}</a><a class="ref-glass-button" href="${appUser?'#home':'#login'}">${appUser?'Workspace':'Sign in'}</a><a class="ref-lime-button" href="${appUser?'#home':'#login'}">Get Started ${icon('arrow')}</a></div></header>`;
}
function refLanding() {
  return `<div class="ref-landing">${refHeader()}<main><section class="ref-landing-hero"><span class="ref-kicker">AI FOR A BRIGHTER TOMORROW</span><h1>A Smarter<br><span>Connected</span><br><em>Pakistan</em></h1><h2>Secure. Intelligent. Built for what’s next.</h2><p>CloudCore AI brings people, information and ideas together — helping organizations work smarter, faster and more securely.</p><div class="ref-hero-actions"><a class="ref-lime-button" href="${appUser?'#home':'#login'}">Explore AI Workspace ${icon('arrow')}</a><a class="ref-watch" href="#site-ai"><span>${icon('play')}</span>Discover CloudCore AI</a></div></section><section class="ref-service-strip">${[['chat','AI Workspace','Chat, meet and get insights — all in one place.','site-ai'],['shield','Enterprise Security','Your data. Your priority. Built for trust at scale.','site-about'],['file','Document Intelligence','Understand, compare and extract insights instantly.','site-solutions'],['chart','Real Impact','Turn information into your next business decision.','site-industries']].map(([i,t,d,r])=>`<a href="#${r}"><span class="ref-dark-icon">${icon(i)}</span><div><b>${t}</b><p>${d}</p></div><span class="ref-round-arrow">${icon('arrow')}</span></a>`).join('')}</section><footer class="ref-landing-footer"><span>A product of<br><b>PTCL Smart Cloud</b></span><span>Grounded answers</span><span>Meeting intelligence</span><span>Document & image insight</span><a href="#site-solutions">Scroll to explore ${icon('arrow')}</a></footer></main></div>`;
}
function refSidebar(r) {
  const name=appUser?.displayName||'CloudCore user';
  return `<aside class="sidebar ref-sidebar">${refVideoBackground("sidebar")}<div class="ref-sidebar-inner">${brand()}<nav aria-label="Product navigation">${[...navs.filter(n=>n[0]!=='history'),['settings','settings','Settings']].map(([id,i,t])=>`<a href="#${id}" class="${(r===id||(id==='documents'&&r==='knowledge')||(id==='knowledge'&&r==='documents'))?'selected':''}" ${r===id?'aria-current="page"':''}>${icon(id==='documents'?'folder':i)}<span>${id==='meetings'?'Meeting Intelligence':id==='documents'?'Knowledge Hub':t}</span></a>`).join('')}<a class="ref-history-link ${r==='history'?'selected':''}" href="#history">${icon('history')}<span>Chat History</span></a></nav><div class="ref-sidebar-bottom"><a class="ref-future-card" href="#landing"><span>Hello<br>to the Future</span><i>${icon('arrow')}</i></a><button class="ref-sidebar-user" data-action="profile"><span class="avatar">${esc(name.charAt(0))}</span><span><b>${esc(name)}</b><small>${esc(appUser?.role||'Workspace member')}</small></span><span>⌄</span></button></div></div></aside>`;
}
function refWorkspace(r) {
  if(!navs.some(n=>n[0]===r)&&r!=='settings'&&r!=='knowledge')r='home';
  const body=r==='home'?refHome():r==='meetings'?refMeetings():(r==='documents'||r==='knowledge')?refKnowledge():r==='images'?refImages():r==='history'?refHistory():r==='settings'?refSettings():refAssistant();
  const unread=typeof hasUnreadNotifications==='function'&&hasUnreadNotifications();
  return `<div class="workspace ref-workspace ${r}-workspace ${r==='assistant'&&!messages.length?'ref-assistant-empty':''}">${refSidebar(r)}<div class="workspace-body">${r==='assistant'&&!messages.length?refVideoBackground("assistant"):''}<header class="workspace-header"><button class="mobile-menu icon-button" data-action="menu" aria-label="Toggle navigation">${icon('menu')}</button><form class="global-search" id="search-form">${icon('search')}<input aria-label="Search products, guides, solutions" placeholder="Search across your workspace, documents, meetings, images..."></form><button class="icon-button notification ${unread?'has-unread':''}" data-action="notifications" aria-label="Notifications">${icon('bell')}${unread?'<i></i>':''}</button>${r==='assistant'?'<button class="ref-glass-button ref-new-chat" data-action="new-chat">'+icon('spark')+' New Chat</button>':''}</header><main class="workspace-main">${body}</main></div></div><input hidden type="file" id="document-input" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json"><input hidden type="file" id="image-input" accept="image/png,image/jpeg,image/webp"><dialog id="dialog"><button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close">${icon('close')}</button><div id="dialog-content"></div></dialog>`;
}
function refHome() {
  const name=(appUser?.displayName||'there').split(' ')[0];
  const recent=chats.slice(0,3);
  return `<section class="ref-home-heading"><div><h1>Good morning, ${esc(name)}</h1><p>Let’s make today productive.</p></div><time>${new Date().toLocaleDateString('en-GB',{weekday:'long',timeZone:'Asia/Karachi'})}<br>${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Karachi'})}</time></section><section class="ref-home-hero"><span class="ref-kicker">CLOUDCORE AI WORKSPACE</span><h2>Your AI Workspace<br><span>for a more connected tomorrow.</span></h2><p>One intelligent workspace. Four powerful capabilities.<br>Built for Pakistan. Designed for what’s next.</p><a class="ref-lime-button" href="#assistant">Explore AI Workspace ${icon('arrow')}</a></section><section class="home-cards ref-home-cards">${[['chat','Chat with CloudCore','Get answers, draft content, analyze information and more.','Research · Summarize · Plan','assistant'],['video','Meeting Intelligence','Turn discussions into actionable insights.','Transcribe · Summarize · Act','meetings'],['file','Document Insights','Understand and extract key information.','Compare · Extract · Analyze','documents'],['image','Image Analysis','Analyze images, diagrams and visual content.','Identify · Extract text · Explain','images']].map(([i,t,d,tags,r],n)=>`<a class="ref-capability capability-${n}" href="#${r}"><span class="feature-icon">${icon(i)}</span><h2>${t}</h2><p>${d}</p><div><small>${tags}</small><span class="ref-round-arrow">${icon('arrow')}</span></div></a>`).join('')}</section><div class="ref-home-lists"><section class="panel"><div class="panel-heading">${icon('clock')}<h2>Recent Activity</h2><a href="#history">View all →</a></div>${recent.length?recent.map(c=>`<button class="ref-activity-row" data-action="open-chat" data-id="${esc(c.id)}"><span class="mini-icon">${icon('chat')}</span><span><b>${esc(c.title)}</b><small>Conversation · ${new Date(c.updated).toLocaleDateString()}</small></span><span>Continue →</span></button>`).join(''):'<div class="ref-empty-inline">Your recent conversations will appear here.<a href="#assistant">Start a conversation →</a></div>'}</section><section class="panel"><div class="panel-heading">${icon('folder')}<h2>Continue where you left off</h2><a href="#documents">View all →</a></div>${docFile?`<button class="ref-activity-row" data-action="ref-document-route"><span class="mini-icon">${icon('file')}</span><span><b>${esc(docFile.name)}</b><small>Document · ${docIngested?'Indexed & ready':'Selected on this device'}</small></span><span>Continue →</span></button>`:'<div class="ref-empty-inline">Bring your documents and meetings into one workspace.<a href="#meetings">Open Meeting Intelligence →</a></div>'}</section></div>`;
}
function refAssistant() {
  if(messages.length)return `<section class="ref-conversation"><div class="ref-conversation-heading"><h1>AI Assistant</h1><button class="outline" data-action="new-chat">${icon('plus')} New Chat</button></div><div class="messages">${messages.map((m,i)=>`<article class="message ${m.role==='user'?'user':'assistant'}"><span class="message-avatar">${m.role==='user'?esc((appUser?.displayName||'U')[0]):mark()}</span><div class="chat-text" ${m.streaming?'id="active-assistant-stream-bubble"':''}>${m.role==='user'?esc(m.content):renderMarkdown(m.content)}${m.streaming?'<span class="typing-cursor"></span>':''}</div></article>`).join('')}</div>${composer('assistant')}</section>`;
  const items=[
    ['file','Summarize<br>this document','Attach a PDF, Word or text file right here in chat.','assistant-doc-card',''],
    ['video','Draft a meeting<br>summary','Turn discussions into clear, actionable notes.','suggestion','Help me draft a structured executive meeting summary with key discussion points, decisions, and action items.'],
    ['chart','Compare<br>strategies','Analyze options and find the best path forward.','suggestion','Compare cloud migration strategies and hybrid infrastructure options for an enterprise.'],
    ['image','Analyze<br>this image','Attach an image right here in chat for Vision AI.','assistant-image-card','']
  ];
  return `<section class="ref-assistant-stage"><div class="ref-assistant-options">${items.map(([i,t,d,act,prompt],n)=>`<button type="button" class="ref-assistant-option option-${n}" data-action="${act}" ${prompt?`data-prompt="${esc(prompt)}"`:''}><span class="ref-dark-icon">${icon(i)}</span><h2>${t}</h2><p>${d}</p><i class="ref-round-arrow">${icon('arrow')}</i></button>`).join('')}</div><div class="ref-assistant-name"><h1>CloudCore AI</h1><p>Your intelligent partner at PTCL Smart Cloud.</p></div></section><div class="ref-assistant-composer">${composer('assistant')}</div><nav class="ref-assistant-shortcuts" aria-label="Assistant tools"><button type="button" data-action="attach-document">${icon('file')}Attach Document</button><button type="button" data-action="attach-image">${icon('image')}Attach Image</button><a href="#meetings">${icon('video')}Meeting Intelligence</a><a href="#history">${icon('history')}Chat History</a></nav>`;
}
function assistant(){return refAssistant();}
function history(){return refHistory();}
function refHistory() {
  const items=chats.filter(c=>!historySearch||c.title.toLowerCase().includes(historySearch.toLowerCase()));
  return `${title('YOUR WORKSPACE','Chat History','Revisit your conversations and continue your work.')}<section class="panel ref-history-panel"><label class="ref-search">${icon('search')}<input id="history-search" type="search" placeholder="Search conversations..." value="${esc(historySearch)}" aria-label="Search conversations"></label>${items.length?items.map(c=>`<article class="ref-history-row"><span class="mini-icon">${icon('chat')}</span><button data-action="open-chat" data-id="${esc(c.id)}"><b>${esc(c.title)}</b><small>${new Date(c.updated).toLocaleString()} · ${c.messages.length} messages</small></button><button class="icon-button danger" data-action="delete-chat" data-id="${esc(c.id)}" aria-label="Delete conversation">${icon('trash')}</button></article>`).join(''):`<div class="ref-empty"><span class="feature-icon">${icon('chat')}</span><h2>${historySearch?'No matching conversations':'Your history starts here'}</h2><p>${historySearch?'Try another search.':'Conversations are saved on this device.'}</p><a class="primary" href="#assistant">Start a conversation ${icon('arrow')}</a></div>`}</section>`;
}
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024, dm = 1, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function refKnowledge() {
  const folders = (typeof knowledgeFolders !== 'undefined' && Array.isArray(knowledgeFolders)) ? knowledgeFolders : [];
  const docs = (typeof knowledgeDocs !== 'undefined' && Array.isArray(knowledgeDocs)) ? knowledgeDocs : [];
  const scope = typeof knowledgeScope === 'string' ? knowledgeScope : 'shared';
  const activeFolder = activeKnowledgeFolderId ? folders.find(f => f.id === activeKnowledgeFolderId) : null;
  const filterType = typeof knowledgeTypeFilter === 'string' ? knowledgeTypeFilter : 'all';
  const searchVal = typeof knowledgeSearch === 'string' ? knowledgeSearch : '';
  const selectedSet = (typeof selectedKnowledgeDocIds !== 'undefined' && selectedKnowledgeDocIds instanceof Set) ? selectedKnowledgeDocIds : new Set();

  const totalDocs = docs.length;
  const totalFolders = folders.length;
  const totalBytes = docs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0);
  const sharedDocs = docs.filter(d => d.isShared).length;
  const personalDocs = docs.filter(d => !d.isShared).length;

  const typePills = [
    ['all', 'All Files'],
    ['pdf', 'PDF'],
    ['word', 'Word'],
    ['excel', 'Excel / CSV'],
    ['text', 'Text / MD']
  ];

  const breadcrumb = activeFolder
    ? `<div class="ref-knowledge-breadcrumb"><button type="button" class="ref-crumb-btn" data-action="select-folder" data-id="">Knowledge Hub</button> <span class="ref-crumb-sep">/</span> <span class="ref-crumb-cur">${esc(activeFolder.name)}</span> <button type="button" class="soft-button small" data-action="clear-folder-filter" title="Back to all files">✕ Back</button></div>`
    : `<div class="ref-knowledge-breadcrumb"><span class="ref-crumb-cur">Knowledge Hub</span> <span class="ref-crumb-sep">/</span> <span style="color:#78889a;">${scope === 'shared' ? 'Workspace Shared' : scope === 'personal' ? 'My Personal Drive' : 'All Accessible Files'}</span></div>`;

  const activeFolderBanner = activeFolder ? `
    <div class="ref-active-folder-banner">
      <div class="ref-active-folder-info">
        <span class="ref-folder-icon">${icon('folder')}</span>
        <div>
          <h3>${esc(activeFolder.name)}</h3>
          <p>${activeFolder.fileCount || 0} file${activeFolder.fileCount === 1 ? '' : 's'} · ${formatBytes(activeFolder.totalSizeBytes || 0)} · Created by <b>${esc(activeFolder.creatorName || 'User')}</b> · <span class="ref-folder-badge ${activeFolder.isShared ? 'shared' : 'private'}">${activeFolder.isShared ? '🌐 Workspace Shared' : '🔒 Private'}</span></p>
        </div>
      </div>
      <div class="ref-folder-actions">
        <button type="button" class="outline small" data-action="rename-folder" data-id="${esc(activeFolder.id)}" data-name="${esc(activeFolder.name)}" data-shared="${activeFolder.isShared}">${icon('sliders')} Rename</button>
        <button type="button" class="outline danger-outline small" data-action="delete-folder" data-id="${esc(activeFolder.id)}" data-name="${esc(activeFolder.name)}" data-count="${activeFolder.fileCount || 0}">${icon('trash')} Delete Folder</button>
      </div>
    </div>
  ` : '';

  const foldersShelf = (!activeFolder) ? `
    <section class="ref-folder-section">
      <div class="ref-folder-header">
        <div>
          <h2>Folders (${folders.length})</h2>
          <p>Organize team knowledge by department, project, or category.</p>
        </div>
        <button type="button" class="soft-button" data-action="new-folder">${icon('plus')} New Folder</button>
      </div>
      <div class="ref-folder-grid">
        ${folders.length ? folders.map(f => `
          <div class="ref-folder-card" data-action="select-folder" data-id="${esc(f.id)}">
            <div class="ref-folder-card-top">
              <span class="ref-folder-card-icon" style="color:${esc(f.color || '#005437')}">${icon('folder')}</span>
              <span class="ref-folder-badge ${f.isShared ? 'shared' : 'private'}">${f.isShared ? '🌐 Shared' : '🔒 Private'}</span>
            </div>
            <h4 title="${esc(f.name)}">${esc(f.name)}</h4>
            <div class="ref-folder-card-meta">
              <span>${f.fileCount || 0} file${f.fileCount === 1 ? '' : 's'}</span>
              <span>${formatBytes(f.totalSizeBytes || 0)}</span>
            </div>
            <div class="ref-folder-card-footer">
              <small>By ${esc(f.creatorName || 'Team')}</small>
              <div class="ref-card-actions" onclick="event.stopPropagation()">
                <button type="button" class="icon-button" data-action="rename-folder" data-id="${esc(f.id)}" data-name="${esc(f.name)}" data-shared="${f.isShared}" title="Rename folder">${icon('sliders')}</button>
                <button type="button" class="icon-button danger" data-action="delete-folder" data-id="${esc(f.id)}" data-name="${esc(f.name)}" data-count="${f.fileCount || 0}" title="Delete folder">${icon('trash')}</button>
              </div>
            </div>
          </div>
        `).join('') : `
          <div class="ref-folder-empty-card" data-action="new-folder">
            <span class="mini-icon">${icon('plus')}</span>
            <b>Create First Folder</b>
            <small>Organize documents into shared or personal folders</small>
          </div>
        `}
      </div>
    </section>
  ` : '';

  const batchBar = selectedSet.size > 0 ? `
    <div class="ref-batch-bar">
      <span><b>${selectedSet.size}</b> document${selectedSet.size === 1 ? '' : 's'} selected</span>
      <div class="ref-batch-actions">
        <button type="button" class="outline small" data-action="batch-move-docs">${icon('folder')} Move to Folder</button>
        <button type="button" class="outline danger-outline small" data-action="batch-delete-docs">${icon('trash')} Delete Selected</button>
        <button type="button" class="soft-button small" data-action="clear-doc-selection">${icon('close')} Deselect</button>
      </div>
    </div>
  ` : '';

  return `
    <div class="ref-page-heading">
      <div>
        <h1>Knowledge Hub</h1>
        <p>Centralized repository for enterprise manuals, technical specs, and team knowledge.</p>
      </div>
      <div class="ref-page-heading-tools">
        <button type="button" class="outline" data-action="new-folder">${icon('plus')} New Folder</button>
        <button type="button" class="primary" data-action="batch-upload">${icon('upload')} Upload Files</button>
      </div>
    </div>

    <div class="ref-knowledge-stats-strip">
      <div class="ref-stat-card">
        <span class="ref-stat-icon">${icon('file')}</span>
        <div><b>${totalDocs}</b><small>Total Documents</small></div>
      </div>
      <div class="ref-stat-card">
        <span class="ref-stat-icon">${icon('folder')}</span>
        <div><b>${totalFolders}</b><small>Active Folders</small></div>
      </div>
      <div class="ref-stat-card">
        <span class="ref-stat-icon">${icon('chart')}</span>
        <div><b>${formatBytes(totalBytes)}</b><small>Total Storage</small></div>
      </div>
      <div class="ref-stat-card">
        <span class="ref-stat-icon">${icon('shield')}</span>
        <div><b>${scope === 'shared' ? 'Workspace Shared' : scope === 'personal' ? 'My Personal Drive' : 'All Files'}</b><small>Current Scope</small></div>
      </div>
    </div>

    <nav class="ref-knowledge-scope-tabs" role="tablist" aria-label="Knowledge Hub scope">
      <button type="button" role="tab" aria-selected="${scope === 'shared'}" class="${scope === 'shared' ? 'active' : ''}" data-action="knowledge-scope" data-scope="shared">
        ${icon('globe')} Workspace Shared <span class="ref-scope-chip">${sharedDocs}</span>
      </button>
      <button type="button" role="tab" aria-selected="${scope === 'personal'}" class="${scope === 'personal' ? 'active' : ''}" data-action="knowledge-scope" data-scope="personal">
        ${icon('lock')} My Personal Drive <span class="ref-scope-chip">${personalDocs}</span>
      </button>
      <button type="button" role="tab" aria-selected="${scope === 'all'}" class="${scope === 'all' ? 'active' : ''}" data-action="knowledge-scope" data-scope="all">
        ${icon('folder')} All Files <span class="ref-scope-chip">${totalDocs}</span>
      </button>
    </nav>

    ${activeFolderBanner}
    ${foldersShelf}

    <section class="panel ref-knowledge-files-panel">
      <div class="ref-knowledge-toolbar">
        ${breadcrumb}
        <div class="ref-toolbar-controls">
          <label class="ref-search">
            ${icon('search')}
            <input id="ref-knowledge-search-input" placeholder="Search filenames or extracted text..." value="${esc(searchVal)}" aria-label="Search documents">
          </label>
          <div class="ref-type-pills" role="group" aria-label="Filter by file type">
            ${typePills.map(([val, label]) => `
              <button type="button" class="${filterType === val ? 'active' : ''}" data-action="filter-type" data-type="${val}">${label}</button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="ref-table-wrap" style="margin-top:12px;">
        <table class="ref-knowledge-table">
          <thead>
            <tr>
              <th style="width:40px;"><input type="checkbox" id="ref-select-all-docs" ${docs.length && selectedSet.size === docs.length ? 'checked' : ''} data-action="toggle-select-all" aria-label="Select all documents"></th>
              <th>Filename</th>
              <th>Folder</th>
              <th>Scope</th>
              <th>Size</th>
              <th>Owner</th>
              <th>Uploaded</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${docs.length ? docs.map(d => {
              const ext = d.filename.split('.').pop()?.toUpperCase() || 'FILE';
              const isChecked = selectedSet.has(d.id);
              return `
                <tr class="${isChecked ? 'row-selected' : ''}">
                  <td><input type="checkbox" ${isChecked ? 'checked' : ''} data-action="toggle-doc-select" data-id="${esc(d.id)}" aria-label="Select ${esc(d.filename)}"></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span class="ref-ext-badge ext-${esc(ext.toLowerCase())}">${esc(ext)}</span>
                      <a href="#view" class="ref-doc-name-cell ref-doc-name-link" data-action="view-doc" data-id="${esc(d.id)}" title="Click to view online without downloading">${esc(d.filename)}</a>
                    </div>
                  </td>
                  <td><span class="ref-crumb-pill">${esc(d.folderName || 'Unfiled')}</span></td>
                  <td><span class="ref-folder-badge ${d.isShared ? 'shared' : 'private'}">${d.isShared ? '🌐 Shared' : '🔒 Private'}</span></td>
                  <td>${formatBytes(d.sizeBytes)}</td>
                  <td>${esc(d.creatorName || 'User')}</td>
                  <td>${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div class="ref-row-actions">
                      <button type="button" class="ref-view-btn" data-action="view-doc" data-id="${esc(d.id)}" title="View file online without downloading">${icon('eye')} View</button>
                      <button type="button" class="icon-button" data-action="move-doc" data-id="${esc(d.id)}" title="Move to folder">${icon('folder')}</button>
                      <a class="icon-button" href="/api/knowledge/documents/${encodeURIComponent(d.id)}/download" download="${esc(d.filename)}" title="Download file">${icon('download')}</a>
                      <button type="button" class="icon-button danger" data-action="delete-doc" data-id="${esc(d.id)}" data-filename="${esc(d.filename)}" title="Delete document">${icon('trash')}</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="8" style="text-align:center;padding:36px 16px;color:#6b7c8f;">
                  <span class="feature-icon" style="margin:0 auto 12px;">${icon('file')}</span>
                  <h3 style="margin:0 0 4px;font-size:15px;color:#182820;">No documents in this view</h3>
                  <p style="margin:0 0 16px;font-size:13px;">${searchVal ? `No results matching "${esc(searchVal)}"` : activeFolder ? `Folder "${esc(activeFolder.name)}" is empty.` : 'Upload documents or choose a different scope above.'}</p>
                  <button type="button" class="primary" data-action="batch-upload">${icon('upload')} Upload Files</button>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </section>

    ${batchBar}
  `;
}

function refDocuments() {
  return refKnowledge();
}
function refImages() {
  const examples=[['tower','Telecom Tower','Identify equipment and infrastructure','assets/example-tower.png'],['map','Satellite Map','Analyze locations and land use','assets/example-map.png'],['datacenter','Data Center','Identify assets and infrastructure','assets/example-datacenter.png'],['diagram','Diagram','Extract text and understand diagrams','assets/diagram.svg']];
  return `<div class="ref-page-heading"><h1>Image Analysis</h1><p>Upload an image to analyze, extract information or get insights.</p></div><section class="ref-image-upload"><div class="tabs image-tabs" role="tablist" aria-label="Image source"><button role="tab" aria-selected="${imageMode==='upload'}" class="${imageMode==='upload'?'active':''}" data-action="image-mode" data-mode="upload">Upload Image</button><button role="tab" aria-selected="${imageMode==='url'}" class="${imageMode==='url'?'active':''}" data-action="image-mode" data-mode="url">Analyze from URL</button></div>${imageMode==='upload'?`<div class="dropzone" data-drop="image">${icon('image')}<h3>Drag and drop an image here</h3><p>or <button data-action="choose-image">click to upload</button></p><small>JPG, PNG, WEBP (Max 20MB)</small><button class="primary" data-action="choose-image">${icon('upload')}Upload Image</button></div>`:`<form id="url-form" class="ref-url-form"><label for="ref-image-url">Direct HTTPS image URL</label><input id="ref-image-url" name="url" type="url" required placeholder="https://example.com/image.jpg"><button class="primary" type="submit">Load image ${icon('arrow')}</button></form>`}</section><div class="ref-example-heading"><h2>Try an example</h2><small>Illustrative previews</small></div><section class="ref-image-examples">${examples.map(([id,t,d,src])=>`<button data-action="example-image" data-example="${id}"><img src="${src}" alt="${t} example"><span><b>${t}</b><small>${d}</small></span></button>`).join('')}</section><section class="panel ref-image-results"><div class="panel-heading"><div><h2>Analysis Results</h2><p>AI-powered analysis with detailed insights and extracted information.</p></div>${imageURL?`<button class="outline" data-action="ref-view-image">${icon('image')}View Full Image</button><button class="primary" data-action="analyze-image-ai" ${visionLoading?'disabled':''}>${icon('spark')}${visionLoading?'Analyzing…':'Analyze Image'}</button>`:''}</div>${imageURL?`${refVisionCards()}`:`<div class="ref-vision-placeholder"><span class="feature-icon">${icon('image')}</span><h3>Select an image to see its analysis</h3><p>Preview equipment, maps and diagrams, or upload your own image.</p></div>`}</section>`;
}
function refVisionCards() {
  const isExample=!imageFile&&imageURL==='assets/example-tower.png'&&!visionResult;
  return `<div class="ref-vision-layout"><img class="ref-vision-preview" src="${esc(imageURL)}" alt="Selected image for analysis"><section class="ref-vision-content"><h3>${icon('image')}Overview</h3>${visionResult?`<div class="vision-result-card">${renderMarkdown(visionResult)}</div>`:isExample?'<span class="example-label">ILLUSTRATIVE EXAMPLE</span><p>A telecommunications tower with antennas and microwave dishes, overlooking Islamabad. Upload or analyze an image to generate your own observations.</p>':'<p>Your image is ready. Select Analyze Image to generate observations and extract visible text.</p>'}<div class="ref-vision-reminder">${icon('shield')}Review observations before acting.</div>${visionResult?'<button class="outline" data-action="clear-vision">Clear result</button>':''}</section><section class="ref-vision-content ref-vision-objects"><h3>${icon('box')}Detected Objects</h3>${isExample?['Telecom tower','Antenna','Microwave dish','Support structure'].map((t,i)=>`<div class="ref-object-row"><span class="mini-icon">${icon(['signal','signal','grid','building'][i])}</span><span>${t}</span></div>`).join(''):'<p>Object observations appear in the analysis overview when returned by the AI service.</p>'}</section><section class="ref-vision-content ref-vision-ocr"><h3>${icon('file')}Extracted Text (OCR)</h3><p>${visionResult?'Any visible text reported by the AI service is included in the analysis overview.':'Analyze your image to extract its visible text.'}</p><div class="ref-vision-reminder">${icon('file')}No extracted text yet</div></section></div>`;
}
function refLaunchForm() {
  return `<div class="meeting-card-heading"><span class="feature-icon">${icon('video')}</span><div><h2>Join a Teams meeting</h2><p>The organizer must admit the bot from the lobby.</p></div></div><form id="meeting-form"><label class="meeting-url"><span>Microsoft Teams link</span><input name="meetingUrl" type="text" inputmode="url" required placeholder="https://teams.microsoft.com/meet/..."></label><div class="bot-identity"><span>${icon('chip')}</span><div><small>BOT DISPLAY NAME</small><b>PTCL AI NOTETAKER</b></div></div><label class="consent-check"><input name="consent" type="checkbox" required><span>I confirm that participants will be informed and recording is permitted for this meeting.</span></label>${meetingsError?`<p class="meeting-error">${esc(meetingsError)}</p>`:''}<button class="primary" type="submit" ${meetingsLoading?'disabled':''}>${icon('video')}${meetingsLoading?'Starting bot…':'Join meeting now'}</button></form><p class="ref-capacity">${meetingsState.capacity.active} of ${meetingsState.capacity.maximum} meeting slots active</p>`;
}
function refMeetings() {
  if(selectedMeetingId)return meetingDetailView();
  const list=meetingsState.meetings||[],m=meetingsState.preview||list[0];
  return `<div class="ref-meetings-heading"><div><h1>Meeting Intelligence</h1><p>Capture. Understand. Act.</p></div><button class="primary" data-action="ref-new-meeting">${icon('plus')}New Meeting</button></div><div class="ref-meetings-layout"><section><div class="ref-meeting-filters"><b>All Meetings</b><a href="#history">My conversations</a></div><section class="panel ref-meeting-list"><label class="ref-search">${icon('search')}<input id="ref-meeting-search" placeholder="Search meetings..." aria-label="Search meetings"></label><div class="meeting-list">${list.length?list.map(meetingRowView).join(''):`<div class="ref-empty"><span class="feature-icon">${icon('video')}</span><h2>${meetingsLoading?'Loading meetings…':'No meetings yet'}</h2><p>Recorded Teams meetings and their summaries will appear here.</p></div>`}</div><button class="outline" data-action="refresh-meetings">${icon('history')}Refresh meetings</button></section></section><section class="panel ref-meeting-preview">${m?refMeetingPreview(m):`<div class="ref-meeting-cover"></div>${refLaunchForm()}`}</section></div>`;
}
function refMeetingPreview(m) {
  const mom=m.mom,topics=mom?.topics||[],actions=mom?.actionItems||[];
  return `<div class="ref-meeting-cover"></div><h2>${esc(m.title||'Microsoft Teams meeting')}</h2><div class="ref-meeting-meta"><span>${icon('clock')}${new Date(m.createdAt).toLocaleString()}</span><span class="meeting-status ${esc(m.status)}">${esc(statusText(m.status))}</span></div><div class="ref-meeting-preview-actions"><span>${(m.participants||[]).length} participants</span><button class="primary" data-action="open-meeting" data-id="${esc(m.id)}">${icon('file')}View meeting</button></div><div class="tabs"><button class="active" data-action="ref-preview-tab" data-tab="mom" data-id="${esc(m.id)}">Summary</button><button data-action="ref-preview-tab" data-tab="mom" data-id="${esc(m.id)}">Action Items</button><button data-action="ref-preview-tab" data-tab="transcript" data-id="${esc(m.id)}">Transcript</button></div><h3>${icon('bulb')}Key Discussion Points</h3>${topics.length?`<ol class="ref-discussion-points">${topics.slice(0,4).map(t=>`<li><b>${esc(t.title)}</b><p>${esc(t.notes)}</p></li>`).join('')}</ol>`:`<p class="ref-analysis-note">${mom?esc(mom.summary):'Open this meeting to see its transcript, recording and meeting minutes.'}</p>`}<h3>${icon('check')}Action Items</h3>${actions.length?actions.slice(0,4).map(a=>`<div class="ref-preview-action">${icon('check')}<span>${esc(a.task)}</span><small>${esc(a.owner||'Unassigned')}</small></div>`).join(''):'<p class="ref-analysis-note">Action items appear after meeting minutes have been generated.</p>'}`;
}
function refSettings() {
  const u=appUser||{};
  const isPrivileged=['dev','admin'].includes(u.role);
  const curTab=typeof settingsTab==='string'?settingsTab:'account';
  const prefs=(typeof userPrefs==='object'&&userPrefs)||{motionMode:'auto',responseStyle:'balanced',autoRag:'on',notifications:'on'};
  const nav=`<div class="ref-page-heading"><h1>Settings</h1><p>Manage your account, preferences, security, and workspace integrations.</p></div><nav class="ref-settings-tabs" role="tablist" aria-label="Settings sections"><button type="button" role="tab" aria-selected="${curTab==='account'}" class="${curTab==='account'?'active':''}" data-action="ref-settings-tab" data-tab="account">${icon('user')}Account</button><button type="button" role="tab" aria-selected="${curTab==='preferences'}" class="${curTab==='preferences'?'active':''}" data-action="ref-settings-tab" data-tab="preferences">${icon('sliders')}Preferences</button><button type="button" role="tab" aria-selected="${curTab==='security'}" class="${curTab==='security'?'active':''}" data-action="ref-settings-tab" data-tab="security">${icon('shield')}${isPrivileged?'Security & Users':'Security'}</button><button type="button" role="tab" aria-selected="${curTab==='integrations'}" class="${curTab==='integrations'?'active':''}" data-action="ref-settings-tab" data-tab="integrations">${icon('link')}Integrations</button></nav>`;

  if(curTab==='preferences'){
    const totalMsgs=chats.reduce((acc,c)=>acc+(c.messages?.length||0),0);
    return `${nav}
      <section class="panel ref-profile-panel">
        <div class="panel-heading"><span class="feature-icon">${icon('sliders')}</span><div><h2>Appearance & Motion</h2><p>Control workspace visual effects, animations, and notifications on this device.</p></div></div>
        <div class="ref-pref-list">
          <div class="ref-pref-row">
            <div><b>Background Motion Animations</b><p>Control the looping ambient video in the sidebar and AI Assistant.</p></div>
            <div class="ref-toggle-group" role="group" aria-label="Background motion mode">
              <button type="button" class="${prefs.motionMode==='auto'?'active':''}" data-action="set-pref" data-key="motionMode" data-val="auto">System Default</button>
              <button type="button" class="${prefs.motionMode==='on'?'active':''}" data-action="set-pref" data-key="motionMode" data-val="on">Always On</button>
              <button type="button" class="${prefs.motionMode==='off'?'active':''}" data-action="set-pref" data-key="motionMode" data-val="off">Off (Static)</button>
            </div>
          </div>
          <div class="ref-pref-row">
            <div><b>Workspace Toast Alerts</b><p>Show non-blocking top-right status alerts when documents finish indexing or tasks complete.</p></div>
            <div class="ref-toggle-group" role="group" aria-label="Workspace toast alerts">
              <button type="button" class="${prefs.notifications!=='off'?'active':''}" data-action="set-pref" data-key="notifications" data-val="on">Enabled</button>
              <button type="button" class="${prefs.notifications==='off'?'active':''}" data-action="set-pref" data-key="notifications" data-val="off">Muted</button>
            </div>
          </div>
        </div>
      </section>
      <section class="panel ref-workspace-details">
        <div class="panel-heading"><span class="feature-icon">${icon('spark')}</span><div><h2>AI Assistant Defaults</h2><p>Customize how CloudCore AI formats responses and grounds answers in your uploaded documents.</p></div></div>
        <div class="ref-pref-list">
          <div class="ref-pref-row">
            <div><b>Default Response Style</b><p>Choose the level of detail for AI Assistant replies.</p></div>
            <div class="ref-toggle-group" role="group" aria-label="Default response style">
              <button type="button" class="${prefs.responseStyle==='concise'?'active':''}" data-action="set-pref" data-key="responseStyle" data-val="concise">Concise</button>
              <button type="button" class="${(!prefs.responseStyle||prefs.responseStyle==='balanced')?'active':''}" data-action="set-pref" data-key="responseStyle" data-val="balanced">Balanced</button>
              <button type="button" class="${prefs.responseStyle==='detailed'?'active':''}" data-action="set-pref" data-key="responseStyle" data-val="detailed">Executive Detail</button>
            </div>
          </div>
          <div class="ref-pref-row">
            <div><b>Automatic Document Grounding (RAG)</b><p>Automatically include relevant excerpts from your attached document when asking questions in chat.</p></div>
            <div class="ref-toggle-group" role="group" aria-label="Automatic document grounding">
              <button type="button" class="${prefs.autoRag!=='off'?'active':''}" data-action="set-pref" data-key="autoRag" data-val="on">Automatic</button>
              <button type="button" class="${prefs.autoRag==='off'?'active':''}" data-action="set-pref" data-key="autoRag" data-val="off">Manual Only</button>
            </div>
          </div>
        </div>
      </section>
      <section class="panel ref-workspace-details">
        <div class="panel-heading"><span class="feature-icon">${icon('history')}</span><div><h2>Local Data & Conversation Storage</h2><p>${chats.length} conversation${chats.length===1?'':'s'} (${totalMsgs} messages) saved on this device · ${docFile?`Active document: ${esc(docFile.name)}`:'No active document attached'}.</p></div></div>
        <div class="ref-settings-actions">
          <button type="button" class="outline" data-action="export-chats">${icon('download')} Export Chat History (.json)</button>
          <button type="button" class="outline danger-outline" data-action="clear-all-chats">${icon('trash')} Clear All Local Conversations</button>
        </div>
      </section>`;
  }

  if(curTab==='security'){
    const usersList=(typeof settingsUsersList!=='undefined'&&Array.isArray(settingsUsersList))?settingsUsersList:[];
    return `${nav}
      <section class="panel ref-profile-panel">
        <div class="panel-heading"><span class="feature-icon">${icon('shield')}</span><div><h2>Change Your Password</h2><p>Update your personal account password. Minimum 6 characters required.</p></div></div>
        <form id="settings-password-form" class="ref-settings-form">
          <div id="settings-pw-err" class="login-alert" style="display:none;margin-bottom:12px;"></div>
          <div class="ref-profile-fields">
            <label><span>Current PW</span><input name="currentPassword" type="password" required placeholder="Enter current password"></label>
            <label><span>New PW</span><input name="newPassword" type="password" minlength="6" required placeholder="At least 6 characters"></label>
            <label><span>Confirm PW</span><input name="confirmPassword" type="password" minlength="6" required placeholder="Re-enter new password"></label>
          </div>
          <div class="ref-settings-actions"><button type="submit" class="primary">${icon('check')} Update Password</button></div>
        </form>
      </section>
      <section class="panel ref-workspace-details">
        <div class="panel-heading"><span class="feature-icon">${icon('lock')}</span><div><h2>Session & Security Posture</h2><p>Enterprise authentication and session controls active for your account.</p></div><button type="button" class="outline danger-outline" data-action="signout">${icon('logout')} Sign Out</button></div>
        <div class="ref-profile-fields">
          <label><span>Auth Mode</span><input readonly value="Role-Based Access Control (RBAC)"></label>
          <label><span>Lockout Policy</span><input readonly value="6 failed attempts / 15m window"></label>
          <label><span>Session Cookie</span><input readonly value="HttpOnly · SameSite=Lax · 8h TTL"></label>
          <label><span>Password Status</span><input readonly value="${u.mustChangePassword?'Action Required (OTP)':'Verified & Active'}"></label>
        </div>
      </section>
      ${isPrivileged?`
      <section class="panel ref-workspace-details" id="settings-users-panel">
        <div class="panel-heading"><span class="feature-icon">${icon('users')}</span><div><h2>Workspace User Management (${usersList.length})</h2><p>${u.role==='dev'?'As a Dev, you can provision Admin or User accounts and manage credentials.':'As an Admin, you can provision User accounts with one-time passwords.'}</p></div><button type="button" class="soft-button" data-action="refresh-settings-users">${icon('history')} Refresh Users</button></div>
        <form id="settings-create-user-form" class="ref-create-user-box">
          <h3>Create New User Account</h3>
          <div id="settings-create-user-err" class="login-alert" style="display:none;margin-bottom:12px;"></div>
          <div class="ref-profile-fields">
            <label><span>Username</span><input name="username" type="text" pattern="[a-zA-Z0-9_.-]{3,30}" required placeholder="e.g. employee1"></label>
            <label><span>Display Name</span><input name="displayName" type="text" required placeholder="e.g. Ali Ahmed"></label>
            <label><span>Initial PW</span><input name="password" type="text" minlength="6" required placeholder="At least 6 characters"></label>
            <label><span>Role</span>${u.role==='dev'?`<select name="role" class="ref-select"><option value="user">User (Standard)</option><option value="admin">Admin</option></select>`:`<input name="role" value="user" readonly>`}</label>
          </div>
          <div class="ref-settings-actions" style="justify-content:space-between;margin-top:14px;">
            <label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#284336;cursor:pointer;">
              <input type="checkbox" name="mustChangePassword" ${u.role==='admin'?'checked disabled':'checked'}>
              <span>Require password change on first login (One-Time Password / OTP)</span>
            </label>
            <button type="submit" class="primary">${icon('plus')} Create Account</button>
          </div>
        </form>
        <div class="ref-table-wrap" style="margin-top:16px;">
          <table>
            <thead><tr><th>Username</th><th>Display Name</th><th>Role</th><th>PW Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${usersList.length?usersList.map(item=>`<tr>
                <td><b>${esc(item.username)}</b></td>
                <td>${esc(item.displayName)}</td>
                <td><span class="role-badge ${esc(item.role)}">${esc(item.role)}</span></td>
                <td>${item.mustChangePassword?'<span style="color:#d97706;font-weight:600;">Must change (OTP)</span>':'<span style="color:#059669;font-weight:500;">Active</span>'}</td>
                <td>${item.createdAt?new Date(item.createdAt).toLocaleDateString():'—'}</td>
                <td>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <button type="button" class="soft-button" data-action="settings-reset-pw" data-id="${esc(item.id)}" data-user="${esc(item.username)}">Reset PW</button>
                    ${(item.role!=='dev'&&!(u.role==='admin'&&item.role==='admin')&&item.id!==u.id)?`<button type="button" class="icon-button danger" data-action="settings-delete-user" data-id="${esc(item.id)}" data-user="${esc(item.username)}" title="Delete user">${icon('trash')}</button>`:''}
                  </div>
                </td>
              </tr>`).join(''):`<tr><td colspan="6" style="text-align:center;color:#647087;padding:18px;">Loading workspace users…</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>`:''}`;
  }

  if(curTab==='integrations'){
    const health=(typeof aiHealthStatus==='object'&&aiHealthStatus)||null;
    const aiConnected=health?Boolean(health.connected):true;
    const chatModel=health?.services?.chatModel||health?.model||'Qwen3.5-27B';
    const visionModel=health?.services?.visionModel||'Qwen2.5-VL-7B-Instruct';
    const botName=health?.services?.botName||'PTCL AI NOTETAKER';
    return `${nav}
      <section class="panel ref-profile-panel">
        <div class="panel-heading"><span class="feature-icon">${icon('link')}</span><div><h2>Connected Workspace Services</h2><p>Live status of CloudCore AI engines, Microsoft Teams meeting bot, and enterprise intelligence pipelines.</p></div><button type="button" class="soft-button" data-action="refresh-integrations">${icon('history')} Refresh Status</button></div>
        <div class="ref-integration-grid">
          <article class="ref-status-card">
            <div class="ref-status-top"><span class="mini-icon">${icon('chat')}</span><span class="ref-status-badge ${aiConnected?'online':'offline'}">${aiConnected?'Connected':'Checking / Offline'}</span></div>
            <h3>Conversational AI & MOM Engine</h3>
            <p>Primary reasoning and structured meeting-minutes model for PTCL Smart Cloud.</p>
            <small>Model: <b>${esc(chatModel)}</b> · Context: 8,192 tokens</small>
            <div class="ref-status-actions"><a class="outline" href="#assistant">Open AI Assistant ${icon('arrow')}</a></div>
          </article>
          <article class="ref-status-card">
            <div class="ref-status-top"><span class="mini-icon">${icon('video')}</span><span class="ref-status-badge online">${meetingsState.capacity.active||0} / ${meetingsState.capacity.maximum} Active</span></div>
            <h3>Microsoft Teams Intelligence</h3>
            <p>Automated live meeting bot, Whisper speech transcription, speaker attribution, and executive MOM.</p>
            <small>Bot Identity: <b>${esc(botName)}</b></small>
            <div class="ref-status-actions"><a class="outline" href="#meetings">Open Meetings AI ${icon('arrow')}</a></div>
          </article>
          <article class="ref-status-card">
            <div class="ref-status-top"><span class="mini-icon">${icon('file')}</span><span class="ref-status-badge online">${docFile?(docIngested?'Document Indexed':'Document Selected'):'Ready'}</span></div>
            <h3>Enterprise Document RAG</h3>
            <p>Instant text extraction and context-window-safe semantic chunking for uploaded files.</p>
            <small>${docFile?`Active file: <b>${esc(docFile.name)}</b>`:'Formats: PDF, DOCX, PPTX, XLSX, CSV, TXT'}</small>
            <div class="ref-status-actions"><a class="outline" href="#documents">Open Document Insights ${icon('arrow')}</a></div>
          </article>
          <article class="ref-status-card">
            <div class="ref-status-top"><span class="mini-icon">${icon('image')}</span><span class="ref-status-badge online">Ready</span></div>
            <h3>Vision AI & Optical Character Recognition</h3>
            <p>Visual inspection for telecom infrastructure, diagrams, satellite imagery, and OCR extraction.</p>
            <small>Model: <b>${esc(visionModel)}</b></small>
            <div class="ref-status-actions"><a class="outline" href="#images">Open Image Analysis ${icon('arrow')}</a></div>
          </article>
        </div>
      </section>`;
  }

  return `${nav}
    <section class="panel ref-profile-panel">
      <div class="panel-heading"><span class="feature-icon">${icon('settings')}</span><div><h2>Profile</h2><p>Your personal information and role in the CloudCore AI workspace.</p></div><button type="button" class="outline danger-outline" data-action="signout">${icon('logout')} Sign Out</button></div>
      <div class="ref-profile-identity"><span class="avatar">${esc((u.displayName||'U')[0])}</span><div><h2>${esc(u.displayName||'CloudCore user')}</h2><p>PTCL Smart Cloud · <span class="role-badge ${esc(u.role||'user')}">${esc(u.role||'user')}</span></p></div></div>
      <form id="settings-profile-form">
        <div class="ref-profile-fields">
          <label><span>Name</span><input name="displayName" required minlength="2" maxlength="50" value="${esc(u.displayName||'')}" aria-label="Name"></label>
          <label><span>Username</span><input readonly value="${esc(u.username||'Not provided')}" aria-label="Username"></label>
          <label><span>Email</span><input name="email" type="email" maxlength="100" value="${esc(u.email||'')}" placeholder="name@ptcl.net.pk" aria-label="Email"></label>
          <label><span>Role</span><input readonly value="${esc(u.role||'Member')}" aria-label="Role"></label>
          <label><span>Workspace</span><input readonly value="CloudCore AI" aria-label="Workspace"></label>
          <label><span>Time Zone</span><input readonly value="Asia/Karachi (PKT)" aria-label="Time Zone"></label>
        </div>
        <div class="ref-settings-actions"><button type="submit" class="primary">${icon('check')} Save Profile Changes</button></div>
      </form>
    </section>
    <section class="panel ref-workspace-details">
      <div class="panel-heading"><span class="feature-icon">${icon('building')}</span><div><h2>Workspace Details</h2><p>Information about your current PTCL Smart Cloud workspace and capacity.</p></div></div>
      <div class="ref-profile-fields">
        <label><span>Workspace Name</span><input readonly value="CloudCore AI Workspace"></label>
        <label><span>Meeting Capacity</span><input readonly value="${meetingsState.capacity.active||0} active / ${meetingsState.capacity.maximum} concurrent meetings"></label>
        <label><span>Account</span><input readonly value="${esc(u.username||u.displayName||'Workspace member')}"></label>
        <label><span>Access</span><input readonly value="${esc(u.role||'Member')}"></label>
      </div>
      <div class="ref-settings-actions">
        <button type="button" class="outline" data-action="ref-settings-tab" data-tab="security">${icon('shield')} Security & Password</button>
        ${isPrivileged?`<button type="button" class="outline" data-action="ref-users">${icon('users')} Manage workspace users</button>`:''}
      </div>
    </section>`;
}
function refHandleAction(a,el) {
  if(a==='ref-preview-tab'){meetingTab=el.dataset.tab;meetingsState.detail=null;location.hash=`meetings/${el.dataset.id}`;refreshMeetings(true);return true;}
  if(a==='ref-new-meeting'){modal(refLaunchForm());bind();return true;}
  if(a==='ref-document-route'){location.hash='documents';return true;}
  if(a==='ref-example-document'){modal(`<h2>Example document analysis</h2><span class="example-label">EXAMPLE ANALYSIS</span><div class="tabs" role="tablist" aria-label="Document analysis">${['Summary','Key Points','Actions'].map(t=>`<button role="tab" aria-selected="${docTab===t}" data-action="ref-example-tab" data-tab="${t}" class="${docTab===t?'active':''}">${t}</button>`).join('')}</div><p>${docTab==='Summary'?sampleSummary:docTab==='Key Points'?'Enterprise connectivity, cloud deployment options and managed support.':'Review deployment requirements, compare connectivity options and confirm service expectations.'}</p>`);return true;}
  if(a==='ref-example-tab'){docTab=el.dataset.tab;refHandleAction('ref-example-document',el);return true;}
  if(a==='ref-view-image'){modal(`<h2>Selected image</h2><img class="ref-full-image" src="${esc(imageURL)}" alt="Selected image">`);return true;}
  if(a==='ref-settings-tab'){if(typeof switchSettingsTab==='function')switchSettingsTab(el.dataset.tab||'account');return true;}
  if(a==='ref-settings-account'){if(typeof switchSettingsTab==='function')switchSettingsTab('account');return true;}
  if(a==='ref-preferences'){if(typeof switchSettingsTab==='function')switchSettingsTab('preferences');return true;}
  if(a==='ref-security'){if(typeof switchSettingsTab==='function')switchSettingsTab('security');return true;}
  if(a==='ref-integrations'){if(typeof switchSettingsTab==='function')switchSettingsTab('integrations');return true;}
  if(a==='ref-users'){if(typeof switchSettingsTab==='function')switchSettingsTab('security',true);return true;}
  return false;
}
function refBind() {
  refSyncMotion();
  const search=$('#ref-document-search');if(search)search.oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('[data-document-name]').forEach(row=>row.hidden=!row.dataset.documentName.includes(q));};
  const meetingsSearch=$('#ref-meeting-search');if(meetingsSearch)meetingsSearch.oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.meeting-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));};
  const kSearch=$('#ref-knowledge-search-input');
  if(kSearch){
    let kTimer;
    kSearch.oninput=e=>{
      if(typeof knowledgeSearch!=='undefined')knowledgeSearch=e.target.value;
      clearTimeout(kTimer);
      kTimer=setTimeout(()=>{
        if(typeof loadKnowledge==='function')loadKnowledge();
      },300);
    };
    kSearch.onkeydown=e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        clearTimeout(kTimer);
        if(typeof loadKnowledge==='function')loadKnowledge();
      }
    };
  }
  if(typeof bindSettingsForms==='function')bindSettingsForms();
}
