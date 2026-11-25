import { useEffect, useState } from 'react';
import type { KnowledgeDocument, KnowledgeFolder } from '../../src/models';
import type { ApiClient } from '../shared/types';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';
import { Icon } from '../shared/Brand';
import { buildFolderTree } from './knowledgeController';

interface Listing {
  preview: string; size: number; directories: string[];
  files: Array<{ path: string; size: number }>;
}

interface Extraction {
  running: boolean; error?: string;
  report?: { cancelled: boolean; items: Array<{ id: string; path: string; status: string; indexing?: string }> };
}

export function KnowledgeArchive({ document, folders, request, formatBytes, onClose, onChanged, userId, rootShared }: {
  document: KnowledgeDocument; folders: KnowledgeFolder[]; request: ApiClient; formatBytes: (size: number) => string;
  onClose: () => void; onChanged: () => void; userId: string; rootShared: boolean;
}) {
  const base = '/api/knowledge/imports/';
  const endpoint = base + 'archive/' + encodeURIComponent(document.id);
  const storageKey = 'cloudcore.archive.' + userId + '.' + document.id;
  const [saved] = useState<{ id: string; destinationId: string; isShared: boolean } | undefined>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? 'null') ?? undefined; } catch { return undefined; }
  });
  const [id, setId] = useState(saved?.id ?? '');
  const [destinationId, setDestination] = useState(saved?.destinationId ?? document.folderId ?? '');
  const [shared, setShared] = useState(saved?.isShared ?? (document.folderId ? document.isShared : rootShared));
  const [listing, setListing] = useState<Listing>();
  const [extraction, setExtraction] = useState<Extraction>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const destination = folders.find(folder => folder.id === destinationId);
  const isShared = destination?.isShared ?? shared;
  const committed = extraction?.report?.items.filter(item => item.status === 'uploaded' || item.status === 'skipped').length ?? 0;
  const complete = Boolean(extraction?.report && !extraction.running && !extraction.report.cancelled && committed === extraction.report.items.length);

  useEffect(() => {
    const controller = new AbortController();
    if ((!id || extraction) && !extraction?.running && !listing && !complete) {
      request<Listing>(endpoint, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setListing(data); })
        .catch(problem => { if (!controller.signal.aborted) setError(problem.message); });
    }
    return () => controller.abort();
  }, [endpoint, request, previewAttempt, id, Boolean(extraction), extraction?.running, listing, complete]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await request<Extraction>(base + 'archive-status/' + id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setExtraction(result);
        if (result.running || result.report?.items.some(item => item.indexing === 'indexing')) timer = setTimeout(poll, 1500);
      } catch (problem) { if (!controller.signal.aborted) setError((problem as Error).message); }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, request, busy]);

  useEffect(() => { if (complete) onChanged(); }, [complete]); // completion changes only once per run

  function chooseDestination(id: string) {
    setDestination(id);
    setExtraction(undefined);
    setId('');
  }
  async function start() {
    if (!listing) return;
    const job = id || crypto.randomUUID();
    setBusy(true);
    setError('');
    try {
      await request(endpoint, { method: 'POST', body: JSON.stringify({
        id: job, destinationId: destinationId || null, isShared, preview: listing.preview,
      }) });
      try { localStorage.setItem(storageKey, JSON.stringify({ id: job, destinationId, isShared })); } catch { /* Private browsing may disable storage. */ }
      setExtraction(undefined);
      setId(job);
    } catch (problem) { setError((problem as Error).message); }
    finally { setBusy(false); }
  }
  const paths = listing ? [...listing.directories.map(path => ({ path, folder: true })), ...listing.files.map(file => ({ ...file, folder: false }))]
    .sort((a, b) => a.path.localeCompare(b.path)) : [];

  return <WorkspaceDialog labelledBy="kh-archive-title" onClose={onClose} className="knowledge-import-dialog">
    <div className="ref-modal-box knowledge-import-box">
      <header className="knowledge-import-header">
        <span className="knowledge-import-hero-icon"><Icon name="folder" /></span>
        <div><h2 id="kh-archive-title">Extract archive</h2><p>{document.filename}</p></div>
        <button type="button" className="knowledge-import-close" aria-label="Close archive" onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="knowledge-import-body">
        {(error || extraction?.error) && <p role="alert" className="login-alert">{error || extraction?.error}</p>}
        {!listing && !error && !extraction?.running && <p role="status">Reading archive…</p>}
        {!listing && error && <button type="button" className="outline small" onClick={() => { setError(''); setPreviewAttempt(value => value + 1); }}>Retry preview</button>}
        {listing && <><p>{listing.files.length} files · {listing.directories.length} folders · {formatBytes(listing.size)} expanded</p>
          <label className="login-label"><span>Extract to</span><select className="ref-select" value={destinationId}
            disabled={busy || extraction?.running || Boolean(extraction?.report)} onChange={event => chooseDestination(event.target.value)}>
            <option value="">Knowledge Hub root</option>
            {buildFolderTree(folders).map(folder => <option key={folder.id} value={folder.id}>{folder.label}</option>)}
          </select></label>
          {!destinationId && <label className="login-label"><span>Visibility</span><select className="ref-select" disabled={busy || extraction?.running || Boolean(extraction?.report)}
            value={String(shared)} onChange={event => { chooseDestination(''); setShared(event.target.value === 'true'); }}>
            <option value="false">Personal</option><option value="true">Workspace shared</option>
          </select></label>}
          {!complete && <ul className="ref-knowledge-upload-files" aria-label="Archive contents">{paths.map(entry => <li key={entry.path}>
            <span className="kh-archive-entry"><Icon name={entry.folder ? 'folder' : 'file'} /> {entry.path}</span>
            {'size' in entry && typeof entry.size === 'number' && <span>{formatBytes(entry.size)}</span>}
          </li>)}</ul>}
        </>}
        {extraction?.running && <p role="status">Extracting archive… {committed} files placed</p>}
        {extraction?.report && <p role="status">
          {extraction.report.cancelled ? 'Cancelled · ' : ''}{committed} of {extraction.report.items.length} files placed ·{' '}
          {extraction.report.items.filter(item => item.indexing === 'ready').length} searchable ·{' '}
          {extraction.report.items.filter(item => item.indexing === 'indexing').length} processing ·{' '}
          {extraction.report.items.filter(item => item.indexing === 'failed').length} need attention
        </p>}
        {complete && <ul className="ref-knowledge-upload-files" aria-label="Archive import results">
          {extraction?.report?.items.map(item => <li key={item.id}><span>{item.path}</span><span>{item.status}{item.indexing ? ' · ' + item.indexing : ''}</span></li>)}
        </ul>}
      </div>
      <footer className="dialog-actions knowledge-import-actions">
        <button type="button" className="outline" onClick={onClose}>{extraction?.running ? 'Run in background' : 'Close'}</button>
        {listing && !complete && !extraction?.running && !extraction?.report?.cancelled &&
          <button type="button" className="primary" disabled={busy || Boolean(destinationId && !destination)} onClick={() => void start()}>
            {busy ? 'Starting…' : id ? 'Retry extraction' : 'Extract files'}<Icon name="arrow" />
          </button>}
      </footer>
    </div>
  </WorkspaceDialog>;
}
