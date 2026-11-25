import * as model from './model';
import type { Asset, AssetOperationResult, Capabilities, Job, RestoreSettings, SaveOptions, Source, StudioDialog, StudioDialogContent, StudioProps, Tab } from './types';

interface StudioDependencies {
  getUserId: () => string | undefined;
  notify: (message: string) => void;
  onUnauthorized: () => void;
  onSavedToKnowledge: () => void;
  renderView: (container: HTMLElement, props: StudioProps) => void;
}

const tabs = ['create', 'remix', 'gallery', 'analyze'] as const;
const isTab = (value: string | undefined): value is Tab => typeof value === 'string' && tabs.some(tab => tab === value);
const isUploadMode = (value: string | undefined): value is 'remix' | 'analyze' => value === 'remix' || value === 'analyze';

class StudioRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function errorMessage(error: unknown, fallback = 'Request failed.') {
  return error instanceof Error ? error.message || fallback : fallback;
}

export function createStudioController(dependencies: StudioDependencies) {
  let s = model.createState();
  let owner: string | undefined, bound = false, mounted = false, epoch = 0;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let pollController: AbortController | undefined, analysisController: AbortController | undefined;
  let initPromise: Promise<unknown> | undefined, enhanceVersion = 0;
  let uploadVersion = 0, historyVersion = 0, removedIds = new Set<string>();
  let dialogKey = 0, dialog: StudioDialog | null = null, announcement = '';
  const root = () => document.querySelector<HTMLElement>('#premium-studio');
  const byId = (id: string | null | undefined) => s.assets.find(a => a.id === id);
  const draft = () => s.tab === 'remix' ? s.remix : s.create;
  const afterRender = (callback: () => void) => requestAnimationFrame(callback);
  function announce(message: string) {
    announcement = message;
    refresh();
    dependencies.notify(message);
  }
  async function request<T = unknown>(path: string, { timeout: duration, ...options }: RequestInit & { timeout?: number } = {}): Promise<T> {
    const version = epoch;
    const timeout = AbortSignal.timeout(duration || 20000);
    const headers = new Headers(options.headers);
    headers.set('x-requested-with', 'CloudCoreAI');
    if (options.body && !(options.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await fetch(path, { ...options, headers, signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout });
    const data = await response.json().catch(() => ({}));
    options.signal?.throwIfAborted();
    if (response.status === 401) {
      if (version === epoch && !options.signal?.aborted) { reset(); dependencies.onUnauthorized(); }
      throw Error('Please sign in again.');
    }
    if (!response.ok) { throw new StudioRequestError(response.status, data?.error?.message || `Request failed (${response.status}). Please try again.`); }
    return data as T;
  }
  function refresh() {
    const container = root();
    if (!container || !mounted) return;
    dependencies.renderView(container, {
      state:s, announcement, dialog,
      request, onClose:closeDialog, onImport:importUrl, onAssetOperation:operateAssets,
      onDraft:(mode,key,value)=>{
        if (key === 'strength') s.remix.strength = Number(value);
        else s[mode][key] = value;
        if (key === 'prompt') enhanceVersion++;
        refresh();
      },
      onAdvanced:(mode,open)=>{s[mode].advanced=open;},
      onQuery:value=>{s.query=value;refresh();},
      onFilter:value=>{s.filter=value;refresh();},
      onSelect:(id,selected)=>{if(selected)s.selected.add(id);else s.selected.delete(id);refresh();},
    });
  }
  function setTab(tab: string | undefined, focus = false) {
    if (!isTab(tab)) return;
    const previous = s.tab; s.tab = tab; s.error = '';
    if (tab !== previous) enhanceVersion++;
    window.history.replaceState(null,'',`#images/${tab}`);
    refresh();
    if (focus) afterRender(() => document.getElementById(`is-tab-${tab}`)?.focus());
  }
  async function loadHistory() {
    const version = epoch, token = ++historyVersion;
    const knownAtStart = new Set(s.assets.map(a=>a.id));
    s.historyStatus = 'loading'; s.historyError = '';
    if (s.tab === 'gallery') refresh();
    try {
      const data = await request<{ assets?: Asset[] }>('/api/images/history');
      if (version !== epoch || token !== historyVersion) return;
      const addedDuringRequest = s.assets.filter(a=>!knownAtStart.has(a.id));
      s.assets = model.mergeAssets(addedDuringRequest,data.assets || []).filter(a=>!removedIds.has(a.id));
      if (!byId(s.activeId)) s.activeId = s.assets[0]?.id || null;
      s.historyStatus = 'ready';
    } catch (err) { if (version !== epoch || token !== historyVersion) return; s.historyStatus = 'error'; s.historyError = errorMessage(err); }
    if (mounted) refresh();
  }
  async function loadCapabilities() {
    const version = epoch;
    try { const result = await request<Capabilities>('/api/images/capabilities'); if (version !== epoch) return; s.capabilities = result; s.capabilityError = ''; }
    catch (err) { if (version !== epoch) return; s.capabilityError = errorMessage(err); }
    if (mounted) refresh();
  }
  async function reconnect() {
    const version = epoch;
    try {
      const data = await request<{ activeJob?: Job; recentCompleted?: Job }>('/api/images/jobs/active');
      if (version !== epoch) return;
      if (data.activeJob) { s.job = data.activeJob; startPolling(); if (mounted) refresh(); }
      else if (data.recentCompleted?.asset) complete(data.recentCompleted,false);
      else if (s.job && !model.terminal(s.job)) {
        const id = s.job.id;
        try {
          const status = await request<{ job: Job }>(`/api/images/jobs/${encodeURIComponent(id)}`);
          if (version !== epoch || s.job?.id !== id) return;
          if (status.job?.status === 'completed') complete(status.job);
          else { s.job = status.job; if (model.terminal(s.job)) stopPolling(); else startPolling(); refresh(); }
        } catch (error) {
          if (version !== epoch || s.job?.id !== id) return;
          if (error instanceof StudioRequestError && error.status === 404) { stopPolling(); s.job = {...s.job,status:'failed',error:'This job is no longer available. Your draft is ready to try again.'}; s.error = ''; refresh(); }
          else throw error;
        }
      }
    } catch (err) { if (version === epoch && s.job && !model.terminal(s.job)) { s.error = 'Connection interrupted. Check the job status before trying again.'; refresh(); } }
  }
  function stopPolling() { clearTimeout(pollTimer); pollController?.abort(); pollController = undefined; }
  function startPolling() {
    stopPolling();
    if (!mounted || !s.job || model.terminal(s.job)) return;
    const jobId = s.job.id, version = epoch;
    async function poll() {
      if (!mounted || document.hidden || version !== epoch || s.job?.id !== jobId) return;
      const controller = new AbortController();
      pollController = controller;
      try {
        const data = await request<{ job: Job }>(`/api/images/jobs/${encodeURIComponent(jobId)}`,{signal:controller.signal});
        if (version !== epoch || controller.signal.aborted || s.job?.id !== jobId || model.terminal(s.job)) return;
        s.job = data.job; s.pollFailures = 0;
        if (data.job?.status === 'completed') { complete(data.job); return; }
        if (model.terminal(data.job)) { stopPolling(); s.error = ''; refresh(); announce(data.job.error || (data.job.status === 'cancelled' ? 'Generation cancelled.' : 'Generation failed. Your draft is safe.')); return; }
        refresh();
      } catch (err) {
        if (version !== epoch || !mounted || controller.signal.aborted) return;
        s.pollFailures++;
        if (s.pollFailures >= 5) {
          stopPolling(); s.error = 'The connection to this job was interrupted. Reconnect to check its status; your draft is safe.';
          refresh(); return;
        }
      }
      if (version === epoch && mounted && !model.terminal(s.job)) pollTimer = setTimeout(poll,Math.min(15000,3000*Math.max(1,s.pollFailures)));
    }
    pollTimer = setTimeout(poll,750);
  }
  function complete(job: Job, notify = true) {
    if (s.job?.id === job.id && s.job.status === 'cancelled') return;
    const a = job.asset || job.resultAsset;
    if (!a) return;
    const wasKnown = !!byId(a.id);
    if (wasKnown && !notify) return;
    s.job = job; stopPolling(); s.submitting = false; s.error = '';
    s.assets = model.mergeAssets(s.assets,[a]); s.activeId = a.id;
    if (a.operation === 'remix' || job.operation === 'remix') { s.remix.result = a; s.remix.compare = 'result'; }
    if (mounted) refresh();
    if (notify && !wasKnown) announce('Your image is ready.');
  }
  async function generate() {
    if (s.submitting || (s.job && !model.terminal(s.job))) return;
    const remix = s.tab === 'remix', d = draft();
    s.submitFailed = false;
    const validation = model.validateDraft(d);
    if (validation) { s.error = validation; refresh(); document.getElementById(`is-${s.tab}-prompt`)?.focus(); return; }
    if (remix && (!s.remix.source || !s.capabilities?.remix)) { s.error = !s.remix.source ? 'Choose a reference image first.' : s.capabilities?.remixMessage || 'Remix is not connected yet.'; refresh(); return; }
    const version = epoch;
    s.submitting = true; s.error = ''; s.lastOperation = remix ? 'remix' : 'generate';
    s.job = null; refresh();
    try {
      let body: string | FormData = JSON.stringify(model.requestBody(d));
      if (remix) {
        body = new FormData();
        for (const [key,value] of Object.entries(model.requestBody(d))) if (value !== undefined) body.append(key,String(value));
        const source = s.remix.source;
        if (source?.assetId) body.append('sourceAssetId', source.assetId);
        else if (source?.file) body.append('image', source.file);
        else throw Error('Choose a reference image first.');
        if (s.capabilities?.controls?.strength) body.append('strength',String(s.remix.strength));
      }
      const data = await request<{ job?: Job; asset?: Asset }>(remix ? '/api/images/remix' : '/api/images/generate',{method:'POST',body});
      if (version !== epoch) return;
      if (!data.job && !data.asset) throw Error('The server did not return a job. Reconnect before retrying.');
      if (data.asset) complete({...data.job,id:data.job?.id ?? data.asset.id,status:'completed',asset:data.asset});
      else if (data.job) { s.job = data.job; startPolling(); }
    } catch (err) { if (version !== epoch) return; s.error = errorMessage(err); s.submitFailed = true; }
    finally { if (version === epoch) { s.submitting = false; refresh(); } }
  }
  async function cancel() {
    if (!s.job || model.terminal(s.job)) return;
    const id = s.job.id, version = epoch;
    try {
      const result = await request<{ success?: boolean; message?: string }>(`/api/images/jobs/${encodeURIComponent(id)}/cancel`,{method:'POST'});
      if (version !== epoch || s.job?.id !== id) return;
      if (!result.success) { await reconnect(); announce(result.message || 'This job has already finished.'); return; }
      // Ignore a concurrent poll response before replacing the job.
      stopPolling(); s.job = {...s.job,status:'cancelled',error:result.message};
      refresh(); announce(result.message || 'Generation cancelled.');
    } catch (err) { announce(errorMessage(err)); }
  }
  async function enhance() {
    if (s.enhancing) return;
    const d = draft(), raw = d.prompt, version = epoch, token = ++enhanceVersion;
    if (!raw.trim()) { announce('Write a prompt first, then enhance it.'); return; }
    s.enhancing = true; refresh();
    try {
      const data = await request<{ enhancedPrompt?: string }>('/api/images/enhance-prompt',{method:'POST',body:JSON.stringify({prompt:raw})});
      if (version !== epoch || token !== enhanceVersion || d.prompt !== raw) return;
      if (!data.enhancedPrompt) throw Error('No enhanced prompt was returned. Try again.');
      d.originalPrompt = raw; d.prompt = data.enhancedPrompt.slice(0,500); announce('Prompt enhanced. You can undo this change.');
    } catch (err) { if (version === epoch) announce(errorMessage(err)); }
    finally { if (version === epoch) { s.enhancing = false; refresh(); } }
  }
  function release(source: Source | null) { if (source?.url?.startsWith('blob:')) URL.revokeObjectURL(source.url); }
  async function selectFile(file: File, mode: 'remix' | 'analyze', signal?: AbortSignal) {
    const version = epoch, token = ++uploadVersion;
    const err = model.validateFile(file);
    if (err) { if (signal) throw Error(err); announce(err); return false; }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) throw Error('Choose an image smaller than 40 megapixels.');
    } catch (err) { URL.revokeObjectURL(url); if (signal) throw err; announce(errorMessage(err) || 'This image could not be opened.'); return false; }
    if (version !== epoch || token !== uploadVersion || signal?.aborted) { URL.revokeObjectURL(url); return false; }
    const source = {url,file,name:file.name};
    if (mode === 'remix') { release(s.remix.source); s.remix.source = source; s.remix.result = null; }
    else { analysisController?.abort(); release(s.analyze.source); s.analyze = {...s.analyze,source,result:'',kind:'',error:'',loading:false,example:false,sourceVersion:s.analyze.sourceVersion+1}; }
    refresh();
    return true;
  }
  function useReference(a: Asset) {
    release(s.remix.source);
    s.remix.source = {url:a.url,assetId:a.id,name:model.filename(a)};
    s.remix.result = null; s.remix.aspectRatio = a.aspectRatio || '1:1';
    closeDialog(); setTab('remix');
    afterRender(() => document.getElementById('is-remix-prompt')?.focus());
  }
  function openDialog(next: StudioDialogContent) {
    dialog = {key:++dialogKey, ...next};
    refresh();
  }
  function closeDialog() {
    if (!dialog) return;
    dialog = null;
    refresh();
  }
  async function copy(a: Asset) {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw Error('Image copying is unavailable in this browser. Use Download instead.');
      const response = await fetch(a.url); if (!response.ok) throw Error('The image could not be loaded.');
      const blob = await response.blob(), bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      try {
        const context = canvas.getContext('2d');
        if (!context) throw Error('This image could not be copied. Use Download instead.');
        context.drawImage(bitmap, 0, 0);
      } finally { bitmap.close(); }
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,'image/png'));
      if (!png) throw Error('This image could not be copied. Use Download instead.');
      await navigator.clipboard.write([new ClipboardItem({'image/png':png})]); announce('Image copied.');
    } catch (err) { announce(errorMessage(err) || 'Copy failed. Use Download instead.'); }
  }
  async function operateAssets(ids: string[], mode: 'save' | 'delete', options: SaveOptions | undefined, signal: AbortSignal): Promise<AssetOperationResult> {
    const version = epoch, succeeded: string[] = [], failed: AssetOperationResult['failed'] = [];
    for (const id of ids) {
      if (version !== epoch || signal.aborted) break;
      const path = `/api/images/${encodeURIComponent(id)}`;
      try {
        await request(mode === 'save' ? `${path}/save-to-knowledge` : path,
          mode === 'save' ? {method:'POST',body:JSON.stringify(options),signal} : {method:'DELETE',signal});
        if (version !== epoch) break;
        succeeded.push(id);
        s.selected.delete(id);
        if (mode === 'delete') {
          removedIds.add(id);
          s.assets = s.assets.filter(asset => asset.id !== id);
          if (s.remix.result?.id === id) s.remix.result = null;
          if (s.remix.source?.assetId === id) { release(s.remix.source); s.remix.source = null; }
          if (s.activeId === id) s.activeId = s.assets[0]?.id || null;
        }
      } catch (error) {
        if (version === epoch && !signal.aborted) failed.push({id,message:errorMessage(error)});
      }
    }
    if (version === epoch) {
      if (mode === 'save' && succeeded.length) dependencies.onSavedToKnowledge();
      refresh();
      if (!failed.length && !signal.aborted) {
        announce(`${succeeded.length} image${succeeded.length === 1 ? '' : 's'} ${mode === 'save' ? 'saved to Knowledge Hub' : 'deleted'}.`);
      }
    }
    return {succeeded, failed};
  }
  async function analyze() {
    if (s.analyze.loading || !s.analyze.source) return;
    const a = s.analyze, source = s.analyze.source, version = epoch, sourceVersion = a.sourceVersion;
    analysisController?.abort();
    const controller = new AbortController();
    analysisController = controller;
    a.loading = true; a.result = ''; a.error = ''; refresh();
    try {
      const body = new FormData(); body.append('question','Analyze this image: describe its content and context, identify visible objects, and extract visible text. Distinguish observation from uncertainty.');
      if (source.file) body.append('image',source.file);
      else { const response = await fetch(source.url,{signal:controller.signal}); if (!response.ok) throw Error('This image is no longer available. Choose another image.'); body.append('image',await response.blob(),source.name || 'image.png'); }
      const data = await request<{ answer?: string; analysisKind?: string }>('/api/vision',{method:'POST',body,signal:controller.signal,timeout:180000});
      if (version !== epoch || sourceVersion !== s.analyze.sourceVersion) return;
      a.result = data.answer || 'No report was returned. Try again.'; a.kind = data.analysisKind || 'metadata';
    } catch (err) { if (version === epoch && sourceVersion === s.analyze.sourceVersion && !controller.signal.aborted) a.error = errorMessage(err); }
    finally { if (version === epoch && sourceVersion === s.analyze.sourceVersion) { a.loading = false; refresh(); } }
  }
  async function importUrl(value: string, signal: AbortSignal) {
    const version = epoch;
    let url;
    try { url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw Error(); }
    catch { throw Error('Enter a direct HTTPS image URL without credentials.'); }
    const response = await fetch('/api/images/import-url',{
      method:'POST',headers:{'content-type':'application/json','x-requested-with':'CloudCoreAI'},
      body:JSON.stringify({url:url.href}),signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),
    });
    if (!response.ok) {
      const error = await response.json().catch(()=>({}));
      throw Error(error.error?.message || 'This image could not be loaded. Try another URL or upload it instead.');
    }
    const file = new File([await response.blob()],'linked-image.png',{type:'image/png'});
    if (version === epoch && !signal.aborted) await selectFile(file,'analyze',signal);
  }
  async function handle(action: string | undefined, button: HTMLButtonElement) {
    const id = button.dataset.id, a = byId(id);
    if (action === 'tab') return setTab(button.dataset.tab,true);
    if (action === 'create' || action === 'gallery') { closeDialog(); return setTab(action); }
    if (action === 'generate') return generate();
    if (action === 'cancel') return cancel();
    if (action === 'retry') { if (s.job && !model.terminal(s.job)) return reconnect(); setTab(s.lastOperation === 'remix' ? 'remix' : 'create'); return generate(); }
    if (action === 'reconnect') { await reconnect(); refresh(); return; }
    if (action === 'refresh-capabilities') return loadCapabilities();
    if (action === 'reload-history') return loadHistory();
    if (action === 'preview' && a) { s.activeId = a.id; refresh(); return; }
    if (action === 'reuse' && a) { s.create = model.restoreDraft(s.create,a); closeDialog(); setTab('create'); return; }
    if ((action === 'remix-asset' || action === 'reference-asset') && a) return useReference(a);
    if (action === 'choose-reference') return openDialog({kind:'reference'});
    if (action === 'view' && a) return openDialog({kind:'view',asset:a});
    if (action === 'details' && a) { s.activeId = a.id; if (s.tab !== 'create') setTab('create'); else refresh(); afterRender(() => { const details = document.querySelector<HTMLDetailsElement>('#is-image-details'); if (details) { details.open = true; details.scrollIntoView({block:'nearest'}); } }); return; }
    if (action === 'copy' && a) return copy(a);
    if (action === 'enhance') return enhance();
    if (action === 'undo-enhance') { const d = draft(); if (d.originalPrompt !== null) { d.prompt = d.originalPrompt; d.originalPrompt = null; refresh(); } return; }
    if (action === 'inspire' || action === 'starter') { const starter = model.starters[action === 'starter' ? Number(button.dataset.index) : Math.floor(Math.random()*model.starters.length)]; if (!starter) return; draft().prompt = starter[1]; draft().originalPrompt = null; refresh(); document.getElementById(`is-${s.tab}-prompt`)?.focus(); return; }
    if (action === 'clear-prompt') { draft().prompt = ''; draft().originalPrompt = null; refresh(); return; }
    if (action === 'history') return openDialog({kind:'history'});
    if (action === 'save' && a) return openDialog({kind:'save',ids:[a.id]});
    if (action === 'save-selected') return openDialog({kind:'save',ids:[...s.selected]});
    if (action === 'delete' && a) return openDialog({kind:'delete',ids:[a.id]});
    if (action === 'delete-selected') return openDialog({kind:'delete',ids:[...s.selected]});
    if (action === 'select-mode') { s.selectionMode = !s.selectionMode; if (!s.selectionMode) s.selected.clear(); refresh(); return; }
    if (action === 'deselect') { s.selected.clear(); refresh(); return; }
    if (action === 'clear-filters') { s.query = ''; s.filter = 'all'; refresh(); return; }
    if (action === 'choose-remix' || action === 'choose-analyze') return document.getElementById(action === 'choose-remix' ? 'is-remix-upload' : 'is-analyze-upload')?.click();
    if (action === 'remove-reference') { release(s.remix.source); s.remix.source = null; s.remix.result = null; refresh(); return; }
    if (action === 'compare-original' || action === 'compare-result') { s.remix.compare = action === 'compare-original' ? 'original' : 'result'; refresh(); return; }
    if (action === 'analyze-asset' && a) { analysisController?.abort(); release(s.analyze.source); s.analyze = {...s.analyze,source:{url:a.url,name:model.filename(a)},result:'',kind:'',loading:false,error:'',example:false,sourceVersion:s.analyze.sourceVersion+1}; closeDialog(); setTab('analyze'); return; }
    if (action === 'example' && button.dataset.url) { release(s.analyze.source); s.analyze = {...s.analyze,source:{url:button.dataset.url,name:button.dataset.name},example:true,result:'',kind:'',error:'',sourceVersion:s.analyze.sourceVersion+1}; refresh(); return; }
    if (action === 'remove-analysis') { analysisController?.abort(); release(s.analyze.source); s.analyze = {...s.analyze,source:null,result:'',error:'',loading:false,sourceVersion:s.analyze.sourceVersion+1}; refresh(); return; }
    if (action === 'analyze') return analyze();
    if (action === 'clear-report') { s.analyze.result = ''; refresh(); return; }
    if (action === 'copy-report') { try { await navigator.clipboard.writeText(s.analyze.result); announce('Report copied.'); } catch { announce('The report could not be copied. Select and copy its text instead.'); } return; }
    if (action === 'url') return openDialog({kind:'url'});
  }
  function bind() {
    if (bound || typeof document.addEventListener !== 'function') return;
    bound = true;
    document.addEventListener('click',event => {
      const target = event.target as Element | null;
      if (!target?.closest?.('.is-menu')) document.querySelectorAll('#premium-studio .is-menu[open]').forEach(menu => menu.removeAttribute('open'));
      const button = target?.closest?.<HTMLButtonElement>('[data-studio-action]');
      if (!button || !button.closest('#premium-studio,.studio-dialog') || button.disabled) return;
      event.preventDefault();
      button.closest('.is-menu')?.removeAttribute('open');
      handle(button.dataset.studioAction,button).catch(err=>announce(errorMessage(err)));
    });
    document.addEventListener('change',event => {
      const input = event.target as HTMLInputElement | null;
      const mode = input?.dataset?.studioUpload;
      if (!input || !isUploadMode(mode)) return;
      const file = input.files?.[0];
      if (file) void selectFile(file, mode);
      input.value = '';
    });
    document.addEventListener('keydown',event => {
      if (event.key === 'Escape') document.querySelectorAll('#premium-studio .is-menu[open]').forEach(d=>d.removeAttribute('open'));
      const target = event.target as Element | null;
      if (!target?.closest?.('#premium-studio')) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && ['create','remix'].includes(s.tab) && !document.querySelector('dialog[open]')) { event.preventDefault(); generate(); }
      if (!target.closest('[role=tab]') || !['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const index = tabs.indexOf(s.tab);
      setTab(event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
    });
    document.addEventListener('dragover', event => {
      const zone = (event.target as Element | null)?.closest?.('[data-studio-drop]');
      if (!zone) return;
      event.preventDefault();
      zone.classList.add('is-dragover');
    });
    document.addEventListener('dragleave', event => (event.target as Element | null)?.closest?.('[data-studio-drop]')?.classList.remove('is-dragover'));
    document.addEventListener('drop', event => {
      const zone = (event.target as Element | null)?.closest?.<HTMLElement>('[data-studio-drop]');
      if (!zone) return;
      event.preventDefault();
      zone.classList.remove('is-dragover');
      const file = event.dataTransfer?.files[0], mode = zone.dataset.studioDrop;
      if (file && isUploadMode(mode)) void selectFile(file, mode);
    });
    document.addEventListener('error', event => {
      const image = event.target as HTMLImageElement | null;
      if (image?.tagName === 'IMG' && image.closest('#premium-studio,.studio-dialog')) {
        image.classList.add('is-broken-image');
        image.alt = 'Image unavailable. Try reloading the gallery.';
      }
    }, true);
    document.addEventListener('visibilitychange',() => { if (!mounted) return; if (document.hidden) stopPolling(); else reconnect(); });
  }
  function mount() {
    const userId = dependencies.getUserId();
    if (!userId) return;
    bind();
    if (owner !== userId) { reset(); owner = userId; }
    const tab = location.hash.split('/')[1];
    if (isTab(tab)) s.tab = tab;
    mounted = true;
    // The app may have rendered with a previous user's state before mount.
    refresh();
    if (typeof fetch !== 'function') return;
    if (!initPromise) initPromise = Promise.allSettled([loadHistory(),loadCapabilities(),reconnect()]);
    else if (s.job && !model.terminal(s.job)) startPolling();
  }
  function pause() { mounted = false; dialog = null; stopPolling(); }
  function reset() { epoch++; uploadVersion++; historyVersion++; stopPolling(); analysisController?.abort(); release(s.remix.source); release(s.analyze.source); s = model.createState(); announcement = ''; removedIds = new Set<string>(); initPromise = undefined; owner = undefined; dialog = null; }
  function findAsset(url: string,prompt: string) {
    if (owner !== dependencies.getUserId()) return;
    return s.assets.find(asset => asset.url === url || asset.prompt === prompt);
  }
  function usePrompt(prompt: string, settings: RestoreSettings) {
    const id = dependencies.getUserId();
    if (!id || !prompt) return;
    if (owner !== id) { reset(); owner = id; }
    enhanceVersion++;
    s.create = model.restoreDraft(s.create,{...settings,prompt});
    if (location.hash.startsWith('#images')) setTab('create');
    else location.hash='images/create';
  }
  return {mount,pause,reset,findAsset,usePrompt};
}
