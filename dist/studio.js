/* Image Studio controller. Owns drafts, API calls and lifecycle independently of the app shell. */
var ImageStudio = (() => {
  let s = StudioModel.createState(), owner = null, bound = false, mounted = false, epoch = 0;
  let pollTimer = null, elapsedTimer = null, pollController = null, analysisController = null;
  let initPromise = null, enhanceVersion = 0, dialogReturnFocus = null, dialogBusy = false;
  let uploadVersion = 0, historyVersion = 0, removedIds = new Set();
  let dialogVersion = 0;
  const v = StudioView;
  const root = () => document.querySelector('#premium-studio');
  const byId = id => s.assets.find(a => a.id === id);
  const draft = () => s.tab === 'remix' ? s.remix : s.create;
  function announce(message) {
    const el = document.querySelector('#is-announcement');
    if (el) el.textContent = message;
    if (typeof toast === 'function') toast(message);
  }
  async function request(path, options = {}) {
    const timeout = AbortSignal.timeout(options.timeout || 20000);
    const response = await fetch(path,{...options,signal: options.signal ? AbortSignal.any([options.signal,timeout]) : timeout,
      headers: {'x-requested-with':'CloudCoreAI',...(options.body && !(options.body instanceof FormData) ? {'content-type':'application/json'} : {}),...options.headers}});
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { reset(); appUser = null; location.hash = 'login'; route(); throw Error('Please sign in again.'); }
    if (!response.ok) { const error = Error(data.error?.message || `Request failed (${response.status}). Please try again.`); error.status = response.status; throw error; }
    return data;
  }
  function patch(selector, html) {
    if (!mounted || !root()) return;
    const target = document.querySelector(selector);
    if (target) target.innerHTML = html;
  }
  function refresh() {
    if (!root()) return;
    const current = document.activeElement;
    const focusedId = current?.id, start = current?.selectionStart, end = current?.selectionEnd;
    const y = window.scrollY;
    root().innerHTML = v.header(s)+v.body(s)+'<div class="is-sr-only" id="is-announcement" role="status" aria-live="polite"></div>';
    const restored = focusedId && document.getElementById(focusedId);
    if (restored) { restored.focus({preventScroll:true}); try { restored.setSelectionRange(start,end); } catch {} }
    if (window.scrollY !== y) window.scrollTo(window.scrollX,y);
  }
  function updateCanvas() { patch('#is-canvas',v.canvas(s,s.tab === 'remix')); }
  function setTab(tab, focus = false) {
    if (!['create','remix','gallery','analyze'].includes(tab)) return;
    const previous = s.tab; s.tab = tab; s.error = '';
    if (tab !== previous) enhanceVersion++;
    window.history.replaceState(null,'',`#images/${tab}`);
    refresh();
    if (focus) document.getElementById(`is-tab-${tab}`)?.focus();
  }
  async function loadHistory() {
    const version = epoch, token = ++historyVersion;
    const knownAtStart = new Set(s.assets.map(a=>a.id));
    s.historyStatus = 'loading'; s.historyError = '';
    if (s.tab === 'gallery') patch('#is-gallery-results',v.galleryResults(s));
    try {
      const data = await request('/api/images/history');
      if (version !== epoch || token !== historyVersion) return;
      const addedDuringRequest = s.assets.filter(a=>!knownAtStart.has(a.id));
      s.assets = StudioModel.mergeAssets(addedDuringRequest,data.assets || []).filter(a=>!removedIds.has(a.id));
      if (!byId(s.activeId)) s.activeId = s.assets[0]?.id || null;
      s.historyStatus = 'ready';
    } catch (err) { if (version !== epoch || token !== historyVersion) return; s.historyStatus = 'error'; s.historyError = err.message; }
    if (mounted) refresh();
  }
  async function loadCapabilities() {
    const version = epoch;
    try { const result = await request('/api/images/capabilities'); if (version !== epoch) return; s.capabilities = result; s.capabilityError = ''; }
    catch (err) { if (version !== epoch) return; s.capabilityError = err.message; }
    if (mounted) refresh();
  }
  async function reconnect() {
    const version = epoch;
    try {
      const data = await request('/api/images/jobs/active');
      if (version !== epoch) return;
      if (data.activeJob) { s.job = data.activeJob; startPolling(); if (mounted) refresh(); }
      else if (data.recentCompleted?.asset) complete(data.recentCompleted,false);
      else if (s.job && !StudioModel.terminal(s.job)) {
        const id = s.job.id;
        try {
          const status = await request(`/api/images/jobs/${encodeURIComponent(id)}`);
          if (version !== epoch || s.job?.id !== id) return;
          if (status.job?.status === 'completed') complete(status.job);
          else { s.job = status.job; if (StudioModel.terminal(s.job)) stopPolling(); else startPolling(); refresh(); }
        } catch (error) {
          if (version !== epoch || s.job?.id !== id) return;
          if (error.status === 404) { stopPolling(); s.job = {...s.job,status:'failed',error:'This job is no longer available. Your draft is ready to try again.'}; s.error = ''; refresh(); }
          else throw error;
        }
      }
    } catch (err) { if (version === epoch && s.job && !StudioModel.terminal(s.job)) { s.error = 'Connection interrupted. Check the job status before trying again.'; refresh(); } }
  }
  function stopPolling() { clearTimeout(pollTimer); clearInterval(elapsedTimer); pollController?.abort(); pollController = null; }
  function startPolling() {
    stopPolling();
    if (!mounted || !s.job || StudioModel.terminal(s.job)) return;
    const jobId = s.job.id, version = epoch;
    elapsedTimer = setInterval(() => {
      const el = document.querySelector('[data-studio-elapsed]');
      const elapsed = Math.max(0,Math.floor((Date.now()-Date.parse(s.job?.startedAt || s.job?.createdAt))/1000));
      if (el && Number.isFinite(elapsed)) el.textContent = `${Math.floor(elapsed/60)}m ${elapsed%60}s elapsed`;
    },1000);
    async function poll() {
      if (!mounted || document.hidden || version !== epoch || s.job?.id !== jobId) return;
      pollController = new AbortController();
      try {
        const data = await request(`/api/images/jobs/${encodeURIComponent(jobId)}`,{signal:pollController.signal});
        if (version !== epoch || s.job?.id !== jobId || StudioModel.terminal(s.job)) return;
        s.job = data.job; s.pollFailures = 0;
        if (data.job?.status === 'completed') { complete(data.job); return; }
        if (StudioModel.terminal(data.job)) { stopPolling(); s.error = ''; refresh(); announce(data.job.error || (data.job.status === 'cancelled' ? 'Generation cancelled.' : 'Generation failed. Your draft is safe.')); return; }
        patch('#is-job-status',v.status(s));
      } catch (err) {
        if (version !== epoch || !mounted || err.name === 'AbortError') return;
        s.pollFailures++;
        if (s.pollFailures >= 5) {
          stopPolling(); s.error = 'The connection to this job was interrupted. Reconnect to check its status; your draft is safe.';
          refresh(); patch('#is-submit-error',v.error(s.error)+v.act('reconnect','Reconnect','is-button')); return;
        }
      }
      if (version === epoch && mounted && !StudioModel.terminal(s.job)) pollTimer = setTimeout(poll,Math.min(15000,3000*Math.max(1,s.pollFailures)));
    }
    pollTimer = setTimeout(poll,750);
  }
  function complete(job, notify = true) {
    if (s.job?.id === job.id && s.job.status === 'cancelled') return;
    const a = job.asset || job.resultAsset;
    if (!a) return;
    const wasKnown = !!byId(a.id);
    if (wasKnown && !notify) return;
    s.job = job; stopPolling(); s.submitting = false; s.error = '';
    s.assets = StudioModel.mergeAssets(s.assets,[a]); s.activeId = a.id;
    if (a.operation === 'remix' || job.operation === 'remix') { s.remix.result = a; s.remix.compare = 'result'; }
    if (mounted) refresh();
    if (notify && !wasKnown) announce('Your image is ready.');
  }
  async function generate() {
    if (s.submitting || (s.job && !StudioModel.terminal(s.job))) return;
    const remix = s.tab === 'remix', d = draft();
    const validation = StudioModel.validateDraft(d);
    if (validation) { s.error = validation; patch('#is-submit-error',v.error(validation)); document.getElementById(`is-${s.tab}-prompt`)?.focus(); return; }
    if (remix && (!s.remix.source || !s.capabilities?.remix)) { s.error = !s.remix.source ? 'Choose a reference image first.' : s.capabilities?.remixMessage || 'Remix is not connected yet.'; patch('#is-submit-error',v.error(s.error)); return; }
    const version = epoch;
    s.submitting = true; s.error = ''; s.lastOperation = remix ? 'remix' : 'generate';
    s.job = null; refresh();
    try {
      let body = JSON.stringify(StudioModel.requestBody(d));
      if (remix) {
        body = new FormData();
        for (const [key,value] of Object.entries(StudioModel.requestBody(d))) if (value !== undefined) body.append(key,String(value));
        if (s.remix.source.assetId) body.append('sourceAssetId',s.remix.source.assetId);
        else body.append('image',s.remix.source.file);
        if (s.capabilities.controls?.strength) body.append('strength',String(s.remix.strength));
      }
      const data = await request(remix ? '/api/images/remix' : '/api/images/generate',{method:'POST',body});
      if (version !== epoch) return;
      if (!data.job && !data.asset) throw Error('The server did not return a job. Reconnect before retrying.');
      if (data.asset) complete({...data.job,status:'completed',asset:data.asset});
      else { s.job = data.job; startPolling(); }
    } catch (err) { if (version !== epoch) return; s.error = err.message; }
    finally { if (version === epoch) { s.submitting = false; refresh(); if (s.error) patch('#is-submit-error',v.error(s.error)+v.act('reconnect','Check active job','is-text-button')+v.act('retry','Try again','is-text-button')); } }
  }
  async function cancel() {
    if (!s.job || StudioModel.terminal(s.job)) return;
    const id = s.job.id, version = epoch;
    try {
      const result = await request(`/api/images/jobs/${encodeURIComponent(id)}/cancel`,{method:'POST'});
      if (version !== epoch || s.job?.id !== id) return;
      if (!result.success) { await reconnect(); announce(result.message || 'This job has already finished.'); return; }
      // Ignore a concurrent poll response before replacing the job.
      stopPolling(); s.job = {...s.job,status:'cancelled',error:result.message};
      refresh(); announce(result.message || 'Generation cancelled.');
    } catch (err) { announce(err.message); }
  }
  async function enhance() {
    if (s.enhancing) return;
    const d = draft(), raw = d.prompt, version = epoch, token = ++enhanceVersion;
    if (!raw.trim()) { announce('Write a prompt first, then enhance it.'); return; }
    s.enhancing = true; refresh();
    try {
      const data = await request('/api/images/enhance-prompt',{method:'POST',body:JSON.stringify({prompt:raw})});
      if (version !== epoch || token !== enhanceVersion || d.prompt !== raw) return;
      if (!data.enhancedPrompt) throw Error('No enhanced prompt was returned. Try again.');
      d.originalPrompt = raw; d.prompt = data.enhancedPrompt.slice(0,500); announce('Prompt enhanced. You can undo this change.');
    } catch (err) { if (version === epoch) announce(err.message); }
    finally { if (version === epoch) { s.enhancing = false; refresh(); } }
  }
  function release(source) { if (source?.url?.startsWith('blob:')) URL.revokeObjectURL(source.url); }
  async function selectFile(file, mode) {
    const version = epoch, token = ++uploadVersion;
    const err = StudioModel.validateFile(file);
    if (err) { announce(err); return; }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) throw Error('Choose an image smaller than 40 megapixels.');
    } catch (err) { URL.revokeObjectURL(url); announce(err.message || 'This image could not be opened.'); return; }
    if (version !== epoch || token !== uploadVersion) { URL.revokeObjectURL(url); return; }
    const source = {url,file,name:file.name};
    if (mode === 'remix') { release(s.remix.source); s.remix.source = source; s.remix.result = null; }
    else { analysisController?.abort(); release(s.analyze.source); s.analyze = {...s.analyze,source,result:'',kind:'',error:'',loading:false,example:false,sourceVersion:s.analyze.sourceVersion+1}; }
    refresh();
  }
  function useReference(a) {
    release(s.remix.source);
    s.remix.source = {url:a.url,assetId:a.id,name:StudioModel.filename(a)};
    s.remix.result = null; s.remix.aspectRatio = a.aspectRatio || '1:1';
    closeDialog(); setTab('remix');
    document.getElementById('is-remix-prompt')?.focus();
  }
  function showDialog(title, content, wide = false) {
    dialogVersion++;
    dialogReturnFocus = document.activeElement;
    const dialog = document.getElementById('dialog');
    dialog.classList.add('studio-dialog'); dialog.classList.toggle('is-wide-dialog',wide);
    dialog.setAttribute('aria-labelledby','is-dialog-title');
    modal(`<div class="image-studio"><h2 id="is-dialog-title">${v.e(title)}</h2>${content}</div>`);
    dialog.querySelector('input:not([type=hidden]),textarea,select,button:not(.dialog-close)')?.focus();
  }
  function closeDialog() { document.getElementById('dialog')?.close(); }
  function view(a) {
    if (!a) return;
    showDialog('A closer look',`<div class="is-viewer-tools" role="group" aria-label="Image zoom">${['fit','100','200'].map(z => v.act('zoom',z === 'fit' ? 'Fit' : z+'%','is-button',`data-zoom="${z}" aria-pressed="${z === 'fit'}"`)).join('')}<a class="is-button" href="${v.e(a.url)}" download="${v.e(StudioModel.filename(a))}">${v.i('download')} Download</a></div><div class="is-viewer" data-zoom="fit"><img id="is-viewer-image" src="${v.e(a.url)}" alt="${v.e(a.prompt)}" width="${a.width}" height="${a.height}"></div><p class="is-viewer-caption">${v.e(a.prompt)}</p><p class="is-muted">${v.e(v.fileMeta(a))} · ${v.e(v.label(a.style))}</p><div class="is-dialog-actions">${v.act('remix-asset','Remix this image','is-button',`data-id="${v.e(a.id)}"`)}${v.act('save','Save to Knowledge Hub','is-button',`data-id="${v.e(a.id)}"`)}${v.act('close','Done','is-primary')}</div>`,true);
  }
  async function copy(a) {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw Error('Image copying is unavailable in this browser. Use Download instead.');
      const response = await fetch(a.url); if (!response.ok) throw Error('The image could not be loaded.');
      const blob = await response.blob(), bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap,0,0); bitmap.close();
      const png = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
      if (!png) throw Error('This image could not be copied. Use Download instead.');
      await navigator.clipboard.write([new ClipboardItem({'image/png':png})]); announce('Image copied.');
    } catch (err) { announce(err.message || 'Copy failed. Use Download instead.'); }
  }
  function promptHistory() {
    const seen = new Set();
    const prompts = s.assets.filter(a=>{const key=a.prompt.trim().toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
    showDialog('Prompt history',`<p class="is-muted">Pick up an idea where you left it.</p><div class="is-prompt-history">${prompts.length ? prompts.map(a => `<article><small>${v.e(v.label(a.style))} · ${v.e(a.aspectRatio)}</small><p>${v.e(a.prompt)}</p>${v.act('reuse','Reuse settings','is-button',`data-id="${v.e(a.id)}"`)}</article>`).join('') : '<p>Your prompts will appear here after you create an image.</p>'}</div>`);
  }
  async function saveDialog(ids) {
    const version = epoch;
    showDialog(ids.length > 1 ? `Save ${ids.length} images` : 'Save to Knowledge Hub',`<p class="is-muted" role="status">Loading destinations…</p>`);
    const token = dialogVersion;
    try {
      const data = await request('/api/knowledge/folders?scope=all');
      if (version !== epoch || token !== dialogVersion || !document.getElementById('dialog')?.open) return;
      const a = byId(ids[0]);
      document.querySelector('#dialog-content .image-studio').innerHTML = `<h2 id="is-dialog-title">Save to Knowledge Hub</h2><p class="is-muted">${ids.length > 1 ? `${ids.length} images will use the same destination and sharing settings.` : 'Keep this image with your workspace documents.'}</p><form id="is-save-form" data-ids="${v.e(JSON.stringify(ids))}"><div class="is-field"><label for="is-save-folder">Destination folder</label><select name="folderId" id="is-save-folder"><option value="">Unfiled documents</option>${(data.folders || []).map(f=>`<option data-shared="${f.isShared}" value="${v.e(f.id)}">${v.e(f.name)}${f.isShared ? ' · Shared' : ' · Personal'}</option>`).join('')}</select></div>${ids.length === 1 ? `<div class="is-field"><label for="is-save-name">File name</label><input id="is-save-name" name="filename" value="${v.e(StudioModel.filename(a))}" maxlength="180" required><small>The ${v.e(StudioModel.filename(a).split('.').pop().toUpperCase())} file format will be preserved.</small></div>` : ''}<label class="is-checkbox"><input type="checkbox" name="isShared" checked> Share with workspace team members</label><div id="is-dialog-error"></div><div class="is-dialog-actions">${v.act('close','Cancel','is-button')}<button type="submit" class="is-primary">Save ${ids.length > 1 ? 'images' : 'image'}</button></div></form>`;
      document.getElementById('is-save-folder')?.focus();
    } catch (err) { patchDialogError(err.message); }
  }
  function patchDialogError(message) {
    const el = document.getElementById('is-dialog-error') || document.querySelector('#dialog-content .image-studio');
    if (el) el.insertAdjacentHTML('beforeend',v.error(message));
  }
  async function save(form) {
    if (dialogBusy) return;
    const ids = JSON.parse(form.dataset.ids), data = new FormData(form), version = epoch, token = dialogVersion;
    dialogBusy = true; form.querySelector('[type=submit]').disabled = true;
    const failed = [], succeeded = [];
    try {
      for (const id of ids) {
        try { await request(`/api/images/${encodeURIComponent(id)}/save-to-knowledge`,{method:'POST',body:JSON.stringify({folderId:data.get('folderId') || null,filename:ids.length === 1 ? data.get('filename') : undefined,isShared:data.get('isShared') === 'on'})}); succeeded.push(id); }
        catch (err) { failed.push({id,message:err.message}); }
        if (version !== epoch) return;
      }
      for (const id of succeeded) s.selected.delete(id);
      if (token !== dialogVersion) { refresh(); announce(`${succeeded.length} saved; ${failed.length} failed.`); return; }
      if (!failed.length) { closeDialog(); refresh(); announce(`${succeeded.length} image${succeeded.length === 1 ? '' : 's'} saved to Knowledge Hub.`); }
      else { form.dataset.ids = JSON.stringify(failed.map(f=>f.id)); document.getElementById('is-dialog-error').innerHTML = v.error(`${succeeded.length} saved; ${failed.length} could not be saved. ${failed[0].message} Retry will only include failed images.`); patch('#is-gallery-results',v.galleryResults(s)); }
    } finally { if (version === epoch) { dialogBusy = false; const button = form.querySelector('[type=submit]'); if (button) button.disabled = false; } }
  }
  function confirmDelete(ids) {
    showDialog(ids.length > 1 ? `Delete ${ids.length} images?` : 'Delete this image?',`<p>This permanently removes ${ids.length > 1 ? 'these images' : 'this image'} from your gallery. This cannot be undone.</p><div id="is-dialog-error"></div><div class="is-dialog-actions">${v.act('close','Keep images','is-button')}${v.act('confirm-delete','Delete permanently','is-primary is-danger-fill',`data-ids="${v.e(JSON.stringify(ids))}"`)}</div>`);
  }
  async function remove(ids, button) {
    if (dialogBusy) return;
    dialogBusy = true; button.disabled = true;
    const version = epoch, token = dialogVersion, failed = [], removed = [];
    try {
      for (const id of ids) {
        try { await request(`/api/images/${encodeURIComponent(id)}`,{method:'DELETE'}); removed.push(id); }
        catch (err) { failed.push({id,message:err.message}); }
        if (version !== epoch) return;
      }
      s.assets = s.assets.filter(a => !removed.includes(a.id)); removed.forEach(id => {s.selected.delete(id);removedIds.add(id);});
      if (!byId(s.activeId)) s.activeId = s.assets[0]?.id || null;
      if (removed.includes(s.remix.result?.id)) s.remix.result = null;
      if (removed.includes(s.remix.source?.assetId)) { release(s.remix.source); s.remix.source = null; }
      refresh();
      if (token !== dialogVersion) { announce(`${removed.length} deleted; ${failed.length} failed.`); return; }
      if (failed.length) { button.dataset.ids = JSON.stringify(failed.map(f=>f.id)); document.getElementById('is-dialog-error').innerHTML = v.error(`${removed.length} deleted; ${failed.length} could not be deleted. ${failed[0].message}`); }
      else { closeDialog(); announce(`${removed.length} image${removed.length === 1 ? '' : 's'} deleted.`); }
    } finally { if (version === epoch) { dialogBusy = false; button.disabled = false; } }
  }
  async function analyze() {
    if (s.analyze.loading || !s.analyze.source) return;
    const a = s.analyze, version = epoch, sourceVersion = a.sourceVersion;
    analysisController?.abort(); analysisController = new AbortController();
    a.loading = true; a.result = ''; a.error = ''; refresh();
    try {
      const body = new FormData(); body.append('question','Analyze this image: describe its content and context, identify visible objects, and extract visible text. Distinguish observation from uncertainty.');
      if (a.source.file) body.append('image',a.source.file);
      else { const response = await fetch(a.source.url,{signal:analysisController.signal}); if (!response.ok) throw Error('This image is no longer available. Choose another image.'); body.append('image',await response.blob(),a.source.name || 'image.png'); }
      const data = await request('/api/vision',{method:'POST',body,signal:analysisController.signal,timeout:180000});
      if (version !== epoch || sourceVersion !== s.analyze.sourceVersion) return;
      a.result = data.answer || 'No report was returned. Try again.'; a.kind = data.analysisKind || 'metadata';
    } catch (err) { if (version === epoch && sourceVersion === s.analyze.sourceVersion && err.name !== 'AbortError') a.error = err.message; }
    finally { if (version === epoch && sourceVersion === s.analyze.sourceVersion) { a.loading = false; refresh(); } }
  }
  async function loadUrl(form) {
    if (dialogBusy) return;
    const input = form.elements.url, version = epoch;
    let url;
    try { url = new URL(input.value); if (url.protocol !== 'https:' || url.username || url.password) throw Error(); }
    catch { patchDialogError('Enter a direct HTTPS image URL without credentials.'); return; }
    dialogBusy = true; form.querySelector('[type=submit]').disabled = true;
    try {
      const response = await fetch('/api/images/import-url',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},body:JSON.stringify({url:url.href}),signal:AbortSignal.timeout(20000)});
      if (!response.ok) { const error = await response.json().catch(()=>({})); throw Error(error.error?.message || 'This image could not be loaded. Try another URL or upload it instead.'); }
      const file = new File([await response.blob()],'linked-image.png',{type:'image/png'});
      const validation = StudioModel.validateFile(file); if (validation) throw Error(validation);
      if (version !== epoch) return;
      await selectFile(file,'analyze'); closeDialog();
    } catch (err) { if (version === epoch) patchDialogError(err.message.includes('fetch') ? 'This site does not allow direct image access. Download the image and upload it here.' : err.message); }
    finally { if (version === epoch) { dialogBusy = false; const button = form.querySelector('[type=submit]'); if (button) button.disabled = false; } }
  }
  async function handle(action, button) {
    const id = button.dataset.id, a = byId(id);
    if (action === 'tab') return setTab(button.dataset.tab,true);
    if (['create','gallery'].includes(action)) { closeDialog(); return setTab(action); }
    if (action === 'generate') return generate();
    if (action === 'cancel') return cancel();
    if (action === 'retry') { if (s.job && !StudioModel.terminal(s.job)) return reconnect(); setTab(s.lastOperation === 'remix' ? 'remix' : 'create'); return generate(); }
    if (action === 'reconnect') { await reconnect(); refresh(); return; }
    if (action === 'refresh-capabilities') return loadCapabilities();
    if (action === 'reload-history') return loadHistory();
    if (action === 'preview' && a) { s.activeId = a.id; updateCanvas(); return; }
    if (action === 'reuse' && a) { s.create = StudioModel.restoreDraft(s.create,a); closeDialog(); setTab('create'); return; }
    if ((action === 'remix-asset' || action === 'reference-asset') && a) return useReference(a);
    if (action === 'choose-reference') return showDialog('Choose a reference',v.galleryResults({...s,query:'',filter:'all'},true),true);
    if (action === 'view' && a) return view(a);
    if (action === 'details' && a) { s.activeId = a.id; if (s.tab !== 'create') setTab('create'); else updateCanvas(); const details = document.getElementById('is-image-details'); if (details) { details.open = true; details.scrollIntoView({block:'nearest'}); } return; }
    if (action === 'copy' && a) return copy(a);
    if (action === 'enhance') return enhance();
    if (action === 'undo-enhance') { const d = draft(); if (d.originalPrompt !== null) { d.prompt = d.originalPrompt; d.originalPrompt = null; refresh(); } return; }
    if (action === 'inspire' || action === 'starter') { draft().prompt = StudioModel.starters[action === 'starter' ? Number(button.dataset.index) : Math.floor(Math.random()*StudioModel.starters.length)][1]; draft().originalPrompt = null; refresh(); document.getElementById(`is-${s.tab}-prompt`)?.focus(); return; }
    if (action === 'clear-prompt') { draft().prompt = ''; draft().originalPrompt = null; refresh(); return; }
    if (action === 'history') return promptHistory();
    if (action === 'save' && a) return saveDialog([a.id]);
    if (action === 'save-selected') return saveDialog([...s.selected]);
    if (action === 'delete' && a) return confirmDelete([a.id]);
    if (action === 'delete-selected') return confirmDelete([...s.selected]);
    if (action === 'confirm-delete') return remove(JSON.parse(button.dataset.ids),button);
    if (action === 'close') { if (!dialogBusy) closeDialog(); return; }
    if (action === 'select-mode') { s.selectionMode = !s.selectionMode; if (!s.selectionMode) s.selected.clear(); refresh(); return; }
    if (action === 'deselect') { s.selected.clear(); patch('#is-gallery-results',v.galleryResults(s)); return; }
    if (action === 'clear-filters') { s.query = ''; s.filter = 'all'; refresh(); return; }
    if (action === 'choose-remix' || action === 'choose-analyze') return document.getElementById(action === 'choose-remix' ? 'is-remix-upload' : 'is-analyze-upload')?.click();
    if (action === 'remove-reference') { release(s.remix.source); s.remix.source = null; s.remix.result = null; refresh(); return; }
    if (action === 'compare-original' || action === 'compare-result') { s.remix.compare = action === 'compare-original' ? 'original' : 'result'; updateCanvas(); return; }
    if (action === 'analyze-asset' && a) { analysisController?.abort(); release(s.analyze.source); s.analyze = {...s.analyze,source:{url:a.url,name:StudioModel.filename(a)},result:'',kind:'',loading:false,error:'',example:false,sourceVersion:s.analyze.sourceVersion+1}; closeDialog(); setTab('analyze'); return; }
    if (action === 'example') { release(s.analyze.source); s.analyze = {...s.analyze,source:{url:button.dataset.url,name:button.dataset.name},example:true,result:'',kind:'',error:'',sourceVersion:s.analyze.sourceVersion+1}; refresh(); return; }
    if (action === 'remove-analysis') { analysisController?.abort(); release(s.analyze.source); s.analyze = {...s.analyze,source:null,result:'',error:'',loading:false,sourceVersion:s.analyze.sourceVersion+1}; refresh(); return; }
    if (action === 'analyze') return analyze();
    if (action === 'clear-report') { s.analyze.result = ''; refresh(); return; }
    if (action === 'copy-report') { try { await navigator.clipboard.writeText(s.analyze.result); announce('Report copied.'); } catch { announce('The report could not be copied. Select and copy its text instead.'); } return; }
    if (action === 'url') return showDialog('Analyze an image from a URL',`<p class="is-muted">Use a direct HTTPS link to a JPG, PNG, or WEBP image. Use a publicly accessible image link.</p><form id="is-url-form"><div class="is-field"><label for="is-url">Image URL</label><input id="is-url" name="url" type="url" placeholder="https://example.com/image.png" required></div><div id="is-dialog-error"></div><div class="is-dialog-actions">${v.act('close','Cancel','is-button')}<button class="is-primary" type="submit">Load image</button></div></form>`);
    if (action === 'zoom') { const img = document.getElementById('is-viewer-image'); if (!img) return; const z = button.dataset.zoom; img.parentElement.dataset.zoom = z; img.style.width = z === 'fit' ? '' : img.naturalWidth*Number(z)/100+'px'; document.querySelectorAll('[data-studio-action=zoom]').forEach(b=>b.setAttribute('aria-pressed',String(b === button))); }
  }
  function bind() {
    if (bound || typeof document.addEventListener !== 'function') return;
    bound = true;
    document.addEventListener('click',event => {
      if (!event.target.closest('.is-menu')) document.querySelectorAll('#premium-studio .is-menu[open]').forEach(d=>d.removeAttribute('open'));
      const button = event.target.closest('[data-studio-action]');
      if (!button || !button.closest('#premium-studio,.studio-dialog') || button.disabled) return;
      event.preventDefault();
      button.closest('.is-menu')?.removeAttribute('open');
      handle(button.dataset.studioAction,button).catch(err=>announce(err.message));
    });
    document.addEventListener('input',event => {
      const el = event.target, key = el.dataset.studioField;
      if (!key || !el.closest('#premium-studio')) return;
      if (key === 'query') { s.query = el.value; patch('#is-gallery-results',v.galleryResults(s)); }
      else if (el.dataset.draft) {
        s[el.dataset.draft][key] = key === 'strength' ? Number(el.value) : el.value;
        if (key === 'prompt') { enhanceVersion++; const count = document.getElementById('is-prompt-count'); if (count) count.textContent = el.value.length+'/500'; }
        if (key === 'strength') { const out = document.getElementById('is-strength-value'); if (out) out.textContent = Math.round(el.value*100)+'%'; }
      }
    });
    document.addEventListener('change',event => {
      const el = event.target;
      if (el.id === 'is-save-folder' && el.value) { const shared = el.selectedOptions[0].dataset.shared === 'true'; const checkbox = document.querySelector('#is-save-form [name=isShared]'); if (checkbox) checkbox.checked = shared; }
      if (el.dataset.studioUpload) { if (el.files[0]) selectFile(el.files[0],el.dataset.studioUpload); el.value = ''; }
      if (el.dataset.studioField === 'filter') { s.filter = el.value; patch('#is-gallery-results',v.galleryResults(s)); }
      if (el.dataset.studioSelect) { el.checked ? s.selected.add(el.dataset.studioSelect) : s.selected.delete(el.dataset.studioSelect); patch('#is-gallery-results',v.galleryResults(s)); document.querySelector(`[data-studio-select="${el.dataset.studioSelect}"]`)?.focus(); }
    });
    document.addEventListener('toggle',event => { if (event.target.matches?.('.is-advanced')) draft().advanced = event.target.open; },true);
    document.addEventListener('submit',event => {
      if (event.target.id === 'is-save-form') { event.preventDefault(); save(event.target).catch(err=>patchDialogError(err.message)); }
      if (event.target.id === 'is-url-form') { event.preventDefault(); loadUrl(event.target).catch(err=>patchDialogError(err.message)); }
    });
    document.addEventListener('keydown',event => {
      if (event.key === 'Escape') document.querySelectorAll('#premium-studio .is-menu[open]').forEach(d=>d.removeAttribute('open'));
      if (!event.target.closest('#premium-studio')) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && ['create','remix'].includes(s.tab) && !document.querySelector('dialog[open]')) { event.preventDefault(); generate(); }
      const tab = event.target.closest('[role=tab]');
      if (tab && ['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) { event.preventDefault(); const tabs = ['create','remix','gallery','analyze'], index = tabs.indexOf(s.tab); setTab(event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[3] : tabs[(index+(event.key === 'ArrowRight' ? 1 : 3))%4],true); }
    });
    document.addEventListener('dragover',event => { const zone = event.target.closest('[data-studio-drop]'); if (zone) { event.preventDefault(); zone.classList.add('is-dragover'); } });
    document.addEventListener('dragleave',event => event.target.closest('[data-studio-drop]')?.classList.remove('is-dragover'));
    document.addEventListener('drop',event => { const zone = event.target.closest('[data-studio-drop]'); if (zone) { event.preventDefault(); zone.classList.remove('is-dragover'); if (event.dataTransfer.files[0]) selectFile(event.dataTransfer.files[0],zone.dataset.studioDrop); } });
    document.addEventListener('error',event => { if (event.target.tagName === 'IMG' && event.target.closest('#premium-studio,.studio-dialog')) { event.target.classList.add('is-broken-image'); event.target.alt = 'Image unavailable. Try reloading the gallery.'; } },true);
    document.addEventListener('cancel',event=>{if(event.target.classList?.contains('studio-dialog')&&dialogBusy)event.preventDefault();},true);
    document.addEventListener('close',event => { if (event.target.id === 'dialog' && event.target.classList.contains('studio-dialog')) { dialogVersion++; event.target.classList.remove('studio-dialog','is-wide-dialog'); event.target.removeAttribute('aria-labelledby'); dialogBusy = false; if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus(); } },true);
    document.addEventListener('visibilitychange',() => { if (!mounted) return; if (document.hidden) stopPolling(); else reconnect(); });
  }
  function render() {
    const tab = typeof location !== 'undefined' ? location.hash.split('/')[1] : '';
    if (['create','remix','gallery','analyze'].includes(tab)) s.tab = tab;
    return v.render(s);
  }
  function mount() {
    bind();
    if (owner !== appUser?.id) { reset(); owner = appUser?.id; const tab = location.hash.split('/')[1]; if (['create','remix','gallery','analyze'].includes(tab)) s.tab = tab; }
    mounted = true;
    // The app may have rendered with a previous user's state before mount.
    refresh();
    if (typeof fetch !== 'function') return;
    if (!initPromise) initPromise = Promise.allSettled([loadHistory(),loadCapabilities(),reconnect()]);
    else if (s.job && !StudioModel.terminal(s.job)) startPolling();
  }
  function pause() { mounted = false; stopPolling(); }
  function reset() { epoch++; uploadVersion++; historyVersion++; stopPolling(); analysisController?.abort(); release(s.remix.source); release(s.analyze.source); s = StudioModel.createState(); removedIds = new Set(); initPromise = null; owner = null; dialogBusy = false; }
  return {render,mount,pause,reset};
})();
