import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { KnowledgeFolder } from '../../src/models';
import { knowledgeImportMaxBytes, knowledgeProcessingMaxBytes } from '../../src/knowledge-formats';
import { contractsRoot, customerFolders, customerKey, filingFolderPath } from '../../src/knowledge-filing';
import type { ApiClient } from '../shared/types';
import { Icon } from '../shared/Brand';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';
import { buildFolderTree, getFolderBreadcrumbs } from './knowledgeController';
import { ImportTray } from './ImportTray';
import { pipActivity } from './Pip';

interface Source {
  files: Map<string, File>;
  directories: Set<string>;
  issues: string[];
}
interface Item {
  id: string; path: string; sourcePath: string; size: number;
  status: 'pending' | 'failed' | 'uploaded' | 'skipped';
  indexing?: 'ready' | 'indexing' | 'failed' | 'unsupported'; documentId?: string; error?: string; storedName?: string;
}
interface ImportReport { id: string; destinationId: string | null; isShared: boolean; cancelled: boolean; items: Item[] }
interface ImportSummary { id: string; createdAt: string; complete: number; total: number; cancelled: boolean }
interface DirectoryHandle { kind: 'directory'; name: string; values(): AsyncIterable<DirectoryHandle | FileHandle> }
interface FileHandle { kind: 'file'; name: string; getFile(): Promise<File> }

const empty = (): Source => ({ files: new Map(), directories: new Set(), issues: [] });
const cleanPath = (path: string) => path.normalize('NFC');
const base = '/api/knowledge/imports';
const maxEntries = 1400;

export function isKnowledgeFileDrop(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function addFile(result: Source, path: string, file: File) {
  if (result.files.has(path)) result.issues.push(`Duplicate source path: ${path}`);
  else result.files.set(path, file);
}

export async function readKnowledgeDrop(transfer: DataTransfer): Promise<Source> {
  const result = empty();
  const fallback = Array.from(transfer.files);
  const items = Array.from(transfer.items || []).filter(item => item.kind === 'file' || !item.kind).map(item => {
    const compatible = item as DataTransferItem & { getAsEntry?: () => FileSystemEntry | null };
    const entry = compatible.getAsEntry?.() ?? item.webkitGetAsEntry?.();
    return { entry, file: entry ? null : item.getAsFile() };
  });
  async function walk(entry: FileSystemEntry, parent = '') {
    if (result.files.size + result.directories.size > maxEntries) throw Error('Select up to 1,400 files and folders at a time.');
    const path = cleanPath(parent + entry.name);
    if (entry.isFile) {
      try {
        addFile(result, path, await new Promise<File>((done, fail) => (entry as FileSystemFileEntry).file(done, fail)));
      } catch { result.issues.push(`Could not read ${path}`); }
    } else if (entry.isDirectory) {
      result.directories.add(path);
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      while (true) {
        let entries: FileSystemEntry[];
        try { entries = await new Promise((done, fail) => reader.readEntries(done, fail)); }
        catch { result.issues.push(`Could not read everything in ${path}`); return; }
        if (!entries.length) break;
        for (const child of entries) await walk(child, path + '/');
      }
    }
  }
  for (const { entry, file } of items) {
    if (entry) await walk(entry);
    else if (file) addFile(result, cleanPath(file.webkitRelativePath || file.name), file);
    else result.issues.push('One dropped entry could not be opened. Use Select Folder to try again.');
  }
  if (!items.length) for (const file of fallback) addFile(result, cleanPath(file.webkitRelativePath || file.name), file);
  if (!result.directories.size) {
    result.issues.push('The browser supplied file paths only. Empty folders may be missing.');
  }
  for (const path of result.files.keys()) {
    const parts = path.split('/');
    parts.pop();
    while (parts.length) { result.directories.add(parts.join('/')); parts.pop(); }
  }
  return result;
}

export function KnowledgeImport({ folders, initialFolder, scope, initialSource, request, onClose, onChanged, onOpenFolder, formatBytes, openVersion, onReview }: {
  folders: KnowledgeFolder[]; initialFolder?: string; scope: 'all' | 'shared' | 'personal'; initialSource?: Promise<Source>;
  request: ApiClient; onClose: () => void; onChanged: (message: string) => void;
  onOpenFolder: (id: string, isShared: boolean) => void; formatBytes: (value: number) => string; openVersion: number;
  onReview?: (ids: string[]) => void;
}) {
  const [source, setSource] = useState<Source>(empty);
  const [destination, setDestination] = useState(initialFolder ?? '');
  const [shared, setShared] = useState(scope === 'shared');
  const [contents, setContents] = useState(false);
  const [report, setReport] = useState<ImportReport>();
  const [history, setHistory] = useState<ImportSummary[]>([]);
  const [reading, setReading] = useState(Boolean(initialSource));
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [trayHidden, setTrayHidden] = useState(false);
  const [uploadedThisRun, setUploadedThisRun] = useState(0);
  const [previouslyPlaced, setPreviouslyPlaced] = useState(0);
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const filesPicker = useRef<HTMLInputElement>(null);
  const upload = useRef<AbortController | undefined>(undefined);
  const manifestId = useRef<string | undefined>(undefined);
  const target = folders.find(folder => folder.id === destination);
  const topPaths = new Set([...source.directories, ...source.files.keys()].map(path => path.split('/')[0]));
  const roots = Array.from(topPaths);
  const root = roots[0];
  const canStrip = Boolean(destination && root && roots.length === 1 && source.directories.has(root) && !source.files.has(root));
  const strip = contents && canStrip;
  const placed = (path: string) => strip ? path.split('/').slice(1).join('/') : path;
  const totalBytes = Array.from(source.files.values()).reduce((sum, file) => sum + file.size, 0);
  const totalEntries = source.files.size + source.directories.size;
  const oversized = [...source.files].filter(([, file]) => file.size > knowledgeImportMaxBytes);
  const storedOnlyCount = [...source.files.values()].filter(file => file.size > knowledgeProcessingMaxBytes).length;
  const tooLarge = totalBytes > knowledgeImportMaxBytes || totalEntries > maxEntries;
  const pending = report?.items.filter(item => item.status === 'pending' || item.status === 'failed') ?? [];
  const matched = pending.filter(item => source.files.get(item.sourcePath)?.size === item.size);
  const waitIndexing = report?.items.some(item => item.indexing === 'indexing');
  const indexingCount = report?.items.filter(item => item.indexing === 'indexing').length ?? 0;
  const searchableCount = report?.items.filter(item => item.indexing === 'ready').length ?? 0;
  const failedIndexCount = report?.items.filter(item => item.indexing === 'failed').length ?? 0;
  const finished = report ? report.items.length - pending.length : 0;
  const visiblePlaced = busy ? Math.max(finished, previouslyPlaced + uploadedThisRun) : finished;
  const canMinimize = busy || Boolean(report);
  const placedItems = report?.items.filter(item => item.status === 'uploaded' || item.status === 'skipped') ?? [];
  const firstPath = placedItems[0]?.path.split('/');
  const commonRoot = firstPath && firstPath.length > 1 && placedItems.every(item =>
    item.sourcePath === item.path && item.path.startsWith(firstPath[0] + '/'))
    ? firstPath[0] : undefined;
  const importedFolder = (report && commonRoot ? folders.find(folder =>
    (folder.parentId ?? null) === report.destinationId && folder.name.toLowerCase() === commonRoot.toLowerCase() &&
    folder.isShared === report.isShared) : undefined) ?? folders.find(folder => folder.id === report?.destinationId);
  const selectionLabel = root && roots.length === 1 ? root : 'Selected files and folders';
  const pathLabels = target ? getFolderBreadcrumbs(target, folders).map(folder => folder.name) : ['Knowledge Hub'];
  if (canStrip && !strip && root) pathLabels.push(root);
  const archives = Array.from(source.files.keys()).filter(path => /\.(zip|rar|7z|tar|gz)$/i.test(path)).length;
  const previewFolders = new Set(Array.from(source.directories, placed));
  const cloudContracts = contractsRoot(folders);
  const folderById = new Map(folders.map(folder => [folder.id, folder]));
  const isContracts = Boolean(cloudContracts && filingFolderPath(folderById, report?.destinationId ?? destination)[0]?.id === cloudContracts.id);
  const folderSuggestion = !report && cloudContracts && (target?.isShared ?? shared) && root && roots.length === 1
    ? customerFolders(cloudContracts, folders).get(customerKey(root)) : undefined;
  const reviewIds = placedItems.flatMap(item => item.documentId ? [item.documentId] : []);

  useEffect(() => { setMinimized(false); setTrayHidden(false); }, [openVersion]);
  const reactedTo = useRef('');
  useEffect(() => {
    if (!report || !report.items.length || busy || waitIndexing || report.cancelled || reactedTo.current === report.id) return;
    const needsAttention = Boolean(error || report.items.some(item => item.status === 'failed' || item.indexing === 'failed'));
    if (!needsAttention && pending.length) return;
    reactedTo.current = report.id;
    pipActivity(needsAttention ? 'concerned' : 'happy');
  }, [report, busy, waitIndexing, pending.length, error]);
  useEffect(() => {
    if (!canMinimize) return;
    const minimize = () => setMinimized(true);
    window.addEventListener('hashchange', minimize);
    return () => window.removeEventListener('hashchange', minimize);
  }, [canMinimize]);

  function changeSource(next: Source) {
    setSource(next);
    manifestId.current = undefined;
  }

  useEffect(() => {
    let cancelled = false;
    if (initialSource) initialSource.then(input => { if (!cancelled) setSource(input); })
      .catch(problem => { if (!cancelled) setError(String(problem instanceof Error ? problem.message : problem)); })
      .finally(() => { if (!cancelled) setReading(false); });
    request<{imports: ImportSummary[]}>(base).then(data => { if (!cancelled) setHistory(data.imports); })
      .catch(problem => { if (!cancelled) setError(problem.message); });
    return () => { cancelled = true; upload.current?.abort(); };
  }, [initialSource, request]);

  const reportId = report?.id;
  useEffect(() => {
    if (busy || !waitIndexing || !reportId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await request<ImportReport>(`${base}/${reportId}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setReport(next);
        if (!next.items.some(item => item.indexing === 'indexing')) return;
      } catch { /* Retry a transient connection failure while the import stays open. */ }
      if (!controller.signal.aborted) timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 3000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [reportId, request, waitIndexing, busy]);

  async function readSelection(input: HTMLInputElement, nested: boolean) {
    const result = empty();
    for (const file of Array.from(input.files ?? [])) {
      const path = cleanPath(nested ? file.webkitRelativePath || file.name : file.name);
      addFile(result, path, file);
      const parts = path.split('/');
      parts.pop();
      while (parts.length) { result.directories.add(parts.join('/')); parts.pop(); }
    }
    input.value = '';
    if (nested) result.issues.push('This picker supplies file paths only. Empty folders may be missing.');
    if (result.files.size) changeSource(result);
  }

  async function chooseFolder() {
    const browser = window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> };
    if (!browser.showDirectoryPicker) { picker.current?.click(); return; }
    const result = empty();
    async function walk(entry: DirectoryHandle | FileHandle, parent: string) {
      if (result.files.size + result.directories.size > maxEntries) throw Error('Select up to 1,400 files and folders at a time.');
      const path = cleanPath(parent + entry.name);
      if (entry.kind === 'file') {
        try { addFile(result, path, await entry.getFile()); } catch { result.issues.push(`Could not read ${path}`); }
      } else {
        result.directories.add(path);
        for await (const child of entry.values()) await walk(child, path + '/');
      }
    }
    setReading(true);
    try {
      await walk(await browser.showDirectoryPicker(), '');
      changeSource(result);
    } catch (problem) {
      if ((problem as Error).name === 'SecurityError') picker.current?.click();
      else if ((problem as Error).name !== 'AbortError') setError((problem as Error).message);
    } finally { setReading(false); }
  }

  async function start() {
    if (upload.current) return;
    const controller = new AbortController();
    upload.current = controller;
    setBusy(true);
    setUploadedThisRun(0);
    setPreviouslyPlaced(finished);
    setError('');
    try {
      const id = manifestId.current ??= crypto.randomUUID();
      const batch = report ?? await request<ImportReport>(base, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ id, destinationId: destination || null, isShared: shared,
          directories: [...source.directories].map(placed).filter(Boolean),
          files: [...source.files].map(([path, file]) => ({ path: placed(path), sourcePath: path, size: file.size, type: file.type })) })
      });
      if (controller.signal.aborted) return;
      setReport(batch);
      setPreviouslyPlaced(batch.items.filter(item => item.status === 'uploaded' || item.status === 'skipped').length);
      const work = batch.items.filter(item => (item.status === 'pending' || item.status === 'failed') &&
        source.files.get(item.sourcePath)?.size === item.size);
      let cursor = 0;
      let uploadFailed = false;
      const refresh = async () => setReport(await request<ImportReport>(`${base}/${batch.id}`, { signal: controller.signal }));
      async function worker() {
        while (!controller.signal.aborted && cursor < work.length) {
          const item = work[cursor++]!;
          try {
            await request(`${base}/${batch.id}/items/${item.id}`, { method: 'PUT',
              headers: { 'Content-Type': 'application/octet-stream' }, body: source.files.get(item.sourcePath)!,
              signal: controller.signal });
            if (!controller.signal.aborted) setUploadedThisRun(count => count + 1);
          } catch { if (!controller.signal.aborted) uploadFailed = true; }
          if (!controller.signal.aborted && cursor % 8 === 0) await refresh().catch(() => {});
        }
      }
      await Promise.all([worker(), worker()]);
      if (controller.signal.aborted) return;
      await refresh();
      if (uploadFailed) setError('Some files could not be imported. Review the results and retry the remaining files.');
      if (!controller.signal.aborted) onChanged('Knowledge import updated.');
    } catch (problem) {
      if (!controller.signal.aborted) setError((problem as Error).message);
    } finally {
      if (upload.current === controller) { upload.current = undefined; setBusy(false); }
    }
  }

  async function cancel() {
    if (!report) return;
    try {
      const stopped = await request<ImportReport>(`${base}/${report.id}/cancel`, { method: 'POST' });
      upload.current?.abort();
      upload.current = undefined;
      setBusy(false);
      setReport(stopped);
      onChanged('Import cancelled. Completed files were kept.');
    } catch (problem) { setError((problem as Error).message); }
  }

  async function retryIndex(item: Item) {
    try {
      await request(`/api/knowledge/documents/${item.documentId}/reindex`, { method: 'POST' });
      setReport(await request<ImportReport>(`${base}/${report!.id}`));
    } catch (problem) { setError((problem as Error).message); }
  }

  const closeOrMinimize = () => canMinimize ? setMinimized(true) : onClose();
  if (minimized) {
    if (trayHidden) return null;
    const title = busy ? 'Uploading to Knowledge Hub' : report?.cancelled ? 'Import cancelled' :
      waitIndexing ? 'Indexing imported files' : pending.length || error || failedIndexCount ? 'Import needs attention' : 'Import complete';
    const total = report?.items.length ?? source.files.size;
    const summary = (target?.name ?? importedFolder?.name ?? 'Knowledge Hub') + ' · ' + visiblePlaced + ' / ' + total + ' files placed' +
      (report ? ' · ' + searchableCount + ' searchable' + (indexingCount ? ' · ' + indexingCount + ' indexing' : '') +
        (failedIndexCount ? ' · ' + failedIndexCount + ' need attention' : '') : '');
    return <ImportTray title={title} summary={summary} busy={busy} placed={visiblePlaced} total={total}
      onExpand={() => setMinimized(false)} onHide={() => setTrayHidden(true)}
      onDismiss={!busy && !waitIndexing ? onClose : undefined} />;
  }

  return <WorkspaceDialog labelledBy="knowledge-import-title" onClose={closeOrMinimize} className="knowledge-import-dialog">
    <div className="ref-modal-box knowledge-import-box">
      <header className="knowledge-import-header">
        <span className="knowledge-import-hero-icon"><Icon name={report ? 'check' : 'upload'} /></span>
        <div><h2 id="knowledge-import-title">{report ? 'Import results' : 'Import files and folders'}</h2>
          <p>{report ? 'Upload and search status' : 'Knowledge Hub'}</p></div>
        <button type="button" className="knowledge-import-close" aria-label={canMinimize ? 'Minimize import' : 'Close import dialog'}
          onClick={closeOrMinimize}>{canMinimize ? <span aria-hidden="true">−</span> : <Icon name="close" />}</button>
      </header>
      <div className="knowledge-import-body">
      {error && <p role="alert" className="login-alert">{error}</p>}
      {busy && <p className="knowledge-import-note">You can minimize this window and keep working. Keep this tab open until the upload finishes.</p>}
      {!busy && !report?.cancelled && (!report || pending.length > 0) && <div className={totalEntries ? 'knowledge-import-selection' : 'ref-upload-dropzone'}
        onDragOver={event => { if (isKnowledgeFileDrop(event)) event.preventDefault(); }}
        onDrop={event => {
          if (!isKnowledgeFileDrop(event)) return;
          event.preventDefault(); event.stopPropagation(); setReading(true);
          readKnowledgeDrop(event.dataTransfer).then(changeSource).catch(problem => setError(problem.message))
            .finally(() => setReading(false));
        }}>
        {totalEntries > 0 && <span className="knowledge-import-source-icon"><Icon name={root && source.directories.has(root) ? 'folder' : 'file'} /></span>}
        <div className="knowledge-import-source-copy">
          {totalEntries > 0 ? <><strong>{selectionLabel}</strong>
            <p>{source.files.size} files · {source.directories.size} folders · {formatBytes(totalBytes)}</p></> :
            <p>{report ? 'Select the original files to resume.' : 'Drop files or folders here.'}</p>}
        </div>
        <input type="file" hidden multiple ref={filesPicker} onChange={event => void readSelection(event.currentTarget, false)} />
        <input type="file" hidden multiple ref={element => { picker.current = element; element?.setAttribute('webkitdirectory', ''); }}
          onChange={event => void readSelection(event.currentTarget, true)} />
        {totalEntries > 0 ? <button className="outline small" type="button" disabled={reading} onClick={() => changeSource(empty())}>Change selection</button> :
          <div className="knowledge-import-picker">
            <button className="outline small" type="button" disabled={reading} onClick={() => filesPicker.current?.click()}>Select Files</button>
            <button className="outline small" type="button" disabled={reading} onClick={() => void chooseFolder()}>Select Folder</button>
          </div>}
      </div>}
      {reading && <p role="status">Reading folders…</p>}
      {source.issues.length > 0 && <details><summary>{source.issues.length} source notices</summary><ul>
        {source.issues.slice(0, 40).map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
      {!report && <>
        <div className={canStrip ? 'knowledge-import-settings has-placement' : 'knowledge-import-settings'}>
        <div className="knowledge-import-target">
        <label className="login-label"><span>Destination</span>
          <select className="ref-select" value={destination} onChange={event => { manifestId.current = undefined; setDestination(event.target.value); }}>
            <option value="">Knowledge Hub</option>{buildFolderTree(folders).map(folder => <option key={folder.id} value={folder.id}>{folder.label}</option>)}
          </select>
        </label>
        {target ? <p className="knowledge-import-access"><Icon name={target.isShared ? 'globe' : 'lock'} />
          {target.isShared ? 'Workspace Shared' : 'Personal Drive'}</p> :
        <label className="login-label"><span>Visibility</span>
          <select className="ref-select" value={String(shared)} onChange={event => {
            manifestId.current = undefined; setShared(event.target.value === 'true');
          }}><option value="true">Workspace Shared</option><option value="false">Personal Drive</option></select>
        </label>}
        </div>
        {canStrip && <fieldset className="knowledge-import-placement">
          <legend>Folder placement</legend>
          {[false, true].map(contentsOnly => <label key={String(contentsOnly)}>
            <input type="radio" name="import-placement" checked={strip === contentsOnly} onChange={() => {
              manifestId.current = undefined; setContents(contentsOnly);
            }} />
            <span><strong>{contentsOnly ? 'Import contents only' : 'Keep folder'}</strong>
              <small>{contentsOnly ? 'Place files directly in the destination' : `Add “${root}” as a subfolder`}</small></span>
          </label>)}
        </fieldset>}
        </div>
        {totalEntries > 0 && <>
          <div className="knowledge-import-path"><Icon name="folder" /><div><strong>Files will go to</strong>
            <ol aria-label="Final destination">{pathLabels.map((label, index) => <li key={index}>
              {index > 0 && <Icon name="chevron" />}<span>{label}</span></li>)}</ol></div></div>
          {folderSuggestion && folderSuggestion.folder.id !== destination && <div className="knowledge-import-path">
            <Icon name="folder" /><div><strong>Possible customer folder</strong>
              <p>{folderSuggestion.path.map(folder => folder.name).join(' / ')} · Based on the selected folder name</p></div>
            <button type="button" className="outline small" onClick={() => {
              manifestId.current = undefined;
              setDestination(folderSuggestion.folder.id);
              setContents(true);
            }}>Use this folder</button>
          </div>}
          {archives > 0 && <p className="knowledge-import-note">To extract a ZIP or RAR after importing, open it in Knowledge Hub and choose Preview archive contents.</p>}
          <details className="knowledge-import-preview"><summary><Icon name="file" /> Preview files and folders <Icon name="chevron" /></summary>
            <ul className="ref-knowledge-upload-files" aria-label="Proposed folder tree">{[...source.directories, ...source.files.keys()]
              .map(placed).filter(Boolean).sort().slice(0, 100).map(path => <li key={path} title={path}
                style={{paddingInlineStart: Math.min(path.split('/').length - 1, 6) * 0.75 + 0.5 + 'rem'}}>
                <Icon name={previewFolders.has(path) ? 'folder' : 'file'} /> {path.split('/').pop()}</li>)}</ul>
            {totalEntries > 100 && <p>Showing the first 100 entries. All selected entries will import.</p>}
          </details></>}
        {oversized.length > 0 ? <p role="alert">{oversized[0]![0]} exceeds the 2 GiB per-file limit.
          {oversized.length > 1 && ` ${oversized.length - 1} other files also exceed it.`}</p> :
          totalBytes > knowledgeImportMaxBytes && <p role="alert">The selection exceeds 2 GiB. Split it into smaller imports.</p>}
        {totalEntries > maxEntries && <p role="alert">The selection exceeds 1,400 files and folders.</p>}
        {!tooLarge && storedOnlyCount > 0 && <p className="knowledge-import-note">
          {storedOnlyCount} {storedOnlyCount === 1 ? 'file is' : 'files are'} over 250 MiB and will be stored for download.
        </p>}
      </>}
      {report && <>
        {importedFolder && finished > 0 && <div className="knowledge-import-path">
          <Icon name="folder" /><div><strong>Imported to</strong><ol aria-label="Imported folder">
            {getFolderBreadcrumbs(importedFolder, folders).map((folder, index) => <li key={folder.id}>
              {index > 0 && <Icon name="chevron" />}<span>{folder.name}</span></li>)}
          </ol></div>
          <button type="button" className="outline small knowledge-import-open-folder" onClick={() => {
            if (busy || waitIndexing) setMinimized(true);
            else onClose();
            onOpenFolder(importedFolder.id, importedFolder.isShared);
          }}>
            Open imported folder <Icon name="arrow" />
          </button>
        </div>}
        <p role="status">{report.cancelled ? 'Cancelled · ' : ''}{visiblePlaced} / {report.items.length} files placed ·
          {' '}{report.items.filter(item => item.status === 'uploaded').length} uploaded ·
          {' '}{report.items.filter(item => item.status === 'skipped').length} skipped ·
          {' '}{report.items.filter(item => item.status === 'failed').length} failed</p>
        <p>{report.items.filter(item => item.indexing === 'ready').length} searchable ·
          {' '}{report.items.filter(item => item.indexing === 'indexing').length} indexing ·
          {' '}{report.items.filter(item => item.indexing === 'failed').length} indexing failed ·
          {' '}{report.items.filter(item => item.indexing === 'unsupported').length} unsupported</p>
        {pending.length > 0 && !report.cancelled && <p>{matched.length} of {pending.length} unfinished files matched the selected source.</p>}
        <ul className="ref-knowledge-upload-files">{report.items.map(item => <li key={item.id}>
          <span>{item.path}{item.storedName && item.storedName !== item.path.split('/').pop() ? ` → ${item.storedName}` : ''} · {item.status}
            {item.indexing ? ` · ${item.indexing === 'ready' ? 'searchable' : item.indexing === 'failed' ? 'indexing failed' :
              item.indexing === 'unsupported' ? 'stored, unsupported for search' : 'indexing'}` : ''}
            {item.error ? ` · ${item.error}` : ''}</span>
          {item.status === 'uploaded' && item.indexing === 'failed' && item.documentId &&
            <button className="outline small" type="button" onClick={() => void retryIndex(item)}>Retry indexing</button>}
        </li>)}</ul>
      </>}
      {!report && history.length > 0 && <details><summary>Recent imports</summary><ul className="ref-knowledge-upload-files">
        {history.map(item => <li key={item.id}><span>{new Date(item.createdAt).toLocaleString()} · {item.complete}/{item.total} files{item.cancelled ? ' · Cancelled' : ''}</span>
          <button type="button" className="outline small" disabled={busy} onClick={() => {
            request<ImportReport>(`${base}/${item.id}`).then(setReport).catch(problem => setError(problem.message));
          }}>Open import</button></li>)}</ul></details>}
      </div>
      <div className="dialog-actions knowledge-import-actions">
        {isContracts && report?.isShared && onReview && reviewIds.length > 0 && !busy && !waitIndexing &&
          <button type="button" className="outline" onClick={() => onReview(reviewIds)}>Review customer filing</button>}
        {report && !report.cancelled && pending.length > 0 &&
          <button type="button" className="outline" onClick={() => void cancel()}>Cancel import</button>}
        {(busy || waitIndexing) && <button type="button" className="outline" onClick={closeOrMinimize}>Minimize</button>}
        {(busy || !waitIndexing) && <button type="button" className="outline" onClick={onClose}>
          {busy ? 'Pause and close' : 'Close'}</button>}
        {(!report || !report.cancelled && pending.length > 0) && <button type="button" className="primary"
          disabled={busy || reading || (report ? !matched.length : !totalEntries || tooLarge || strip && totalEntries === 1)}
          onClick={() => void start()}>{busy ? 'Uploading…' : report ? 'Retry remaining files' : 'Start import'}<Icon name="arrow" /></button>}
      </div>
    </div>
  </WorkspaceDialog>;
}
