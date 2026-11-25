import { useEffect, useLayoutEffect, useState, type DragEvent } from 'react';
import type { KnowledgeDocument } from '../../src/models';
import type { ApiClient } from '../shared/types';
import { Icon, Mark } from '../shared/Brand';
import { useFollowScroll } from '../shared/useFollowScroll';
import { Markdown } from '../shared/Markdown';
import { Citations, type AssistantMessage } from './Assistant';
import { KnowledgeTable, type KnowledgeTableProps } from './KnowledgeTable';
import { KnowledgeFolderDialog, type FolderOperation } from './KnowledgeFolders';
import { KnowledgeDocumentActions, type DocumentOperation } from './KnowledgeDocumentActions';
import { KnowledgeUpload } from './KnowledgeUpload';
import { isKnowledgeFileDrop, readKnowledgeDrop } from './KnowledgeImport';
import { KnowledgePreview } from './KnowledgePreview';
import { getFolderBreadcrumbs, knowledgePageSize, type KnowledgeRange } from './knowledgeController';
import { contractsRoot, filingFolderPath, filingLocation } from '../../src/knowledge-filing';
import { KnowledgeTree } from './KnowledgeTree';
import { KnowledgeFiling } from './KnowledgeFiling';
import { KnowledgeArchive } from './KnowledgeArchive';
import { KnowledgePanel } from './KnowledgePanel';
import { pipActivity } from './Pip';

const scopes = [['shared', 'globe', 'Shared'], ['personal', 'lock', 'Personal'], ['all', 'folder', 'All Files']] as const;
type Scope = typeof scopes[number][0];
type Inspector = { mode: 'preview'; id: string } | { mode: 'ask'; document?: KnowledgeDocument };

export interface KnowledgeHubProps extends Omit<KnowledgeTableProps, 'onUpload' | 'onDocument'> {
  scope: Scope;
  userId: string;
  canManage: boolean;
  filingImportIds?: string[];
  name?: string;
  messages: AssistantMessage[];
  chatBusy: boolean;
  request: ApiClient;
  range: KnowledgeRange;
  sort: 'name' | 'modified';
  onFolderChanged: (message: string, removedId?: string) => void;
  onDocumentsChanged: (message: string, completedIds: string[]) => void;
  onScope: (scope: Scope) => void;
  onFolder: (id: string | null) => void;
  onDeselect: () => void;
  onAsk: (prompt: string, documentId?: string) => void;
  onPipDocument?: (document?: Pick<KnowledgeDocument, 'id' | 'filename'>) => void;
  onClear: (announce?: boolean) => void;
  onRange: (range: KnowledgeRange) => void;
  onSort: (sort: 'name' | 'modified') => void;
  onImport: (folderId?: string, source?: ReturnType<typeof readKnowledgeDrop>) => void;
}

function KnowledgeChat({ document, props, onClose }: { document?: KnowledgeDocument; props: KnowledgeHubProps; onClose: () => void }) {
  const { activeFolder, name, messages, chatBusy, onAsk, onClear, request } = props;
  const scroll = useFollowScroll();
  const [coverage, setCoverage] = useState<{ ready: number; indexing: number; failed: number }>();
  const [draft, setDraft] = useState('');
  const scopeLabel = document?.filename ?? activeFolder?.name ?? 'All accessible documents';
  const currentDocument = props.documents.find(item => item.id === document?.id) ?? document;
  useEffect(() => {
    if (document) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const path = '/api/knowledge/coverage' + (activeFolder ? '?folderId=' + encodeURIComponent(activeFolder.id) : '');
    const load = () => request<NonNullable<typeof coverage>>(path, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted || typeof result?.ready !== 'number') return;
      setCoverage(result);
      if (result.indexing) timer = setTimeout(load, 5000);
    }).catch(() => {});
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [activeFolder?.id, document, request]);
  const coverageLabel = currentDocument
    ? currentDocument.status === 'ready' ? 'This file is searchable' : 'This file is not searchable yet'
    : coverage ? [
      coverage.ready + ' searchable',
      coverage.indexing ? coverage.indexing + ' processing' : '',
      coverage.failed ? coverage.failed + ' unavailable to search' : '',
    ].filter(Boolean).join(' · ') : '';
  return <KnowledgePanel label="Ask Knowledge" className="kh-ask">{({ button }) => <>
    <header><div><h2 id="kh-ask-title"><Icon name="spark" /> Ask Knowledge</h2><p title={scopeLabel}>{scopeLabel}{activeFolder && !document ? ' and subfolders' : ''}</p></div>
      <div className="kh-panel-actions">{button}<button type="button" className="kh-icon-button" aria-label="Close Ask Knowledge" onClick={onClose}><Icon name="close" /></button></div></header>
    {coverageLabel && <p className="kh-coverage" role="status">{coverageLabel}</p>}
    <div className="kh-thread" {...scroll}>
      {!messages.length ? <div className="kh-question-start"><span className="kh-question-mark"><Icon name="spark" /></span>
        <h3>What would you like to find?</h3>
        <div className="kh-question-starters">
          {(document ? ['Summarize this file', 'Find key dates'] : ['Summarize this collection', 'Find key dates']).map(prompt =>
            <button key={prompt} type="button" className="kh-button" onClick={() => {
              setDraft(prompt);
              documentInput()?.focus();
            }}>{prompt}<Icon name="arrow" /></button>)}
        </div></div> :
        <button type="button" className="kh-button" onClick={() => onClear()}>Clear chat</button>}
      {messages.map((message, index) => <div className={'ref-knowledge-message ' + message.role} key={index}>
        <span className="ref-msg-avatar">{message.role === 'user' ? (name || 'U').charAt(0) : <Mark />}</span>
        <div className="ref-msg-body chat-text">
          {message.role === 'user' ? message.content : <><Markdown text={message.content} />
            {Boolean(message.citations?.length) && <section className="kh-answer-sources" aria-label="Sources">
              <h3>Sources</h3><Citations citations={message.citations ?? []} /></section>}</>}
          {message.streaming && <span className="typing-cursor" aria-label="Generating reply" />}
        </div>
      </div>)}
    </div>
    <form className="kh-ask-form" id="knowledge-chat-form" onSubmit={event => {
      event.preventDefault();
      const form = event.currentTarget;
      const prompt = String(new FormData(form).get('knowledgePrompt') ?? '').trim();
      if (!prompt || chatBusy) return;
      setDraft('');
      onAsk(prompt, document?.id);
    }}>
      <textarea name="knowledgePrompt" id="knowledge-prompt-input" aria-label="Ask about your documents" rows={2}
        placeholder="Ask a question…" value={draft} onChange={event => setDraft(event.currentTarget.value)} disabled={chatBusy} required />
      <button type="submit" className="primary small" disabled={chatBusy}>{chatBusy ? 'Searching…' : 'Ask'}<Icon name="arrow" /></button>
    </form>
  </>}</KnowledgePanel>;
}

function documentInput() { return window.document.getElementById('knowledge-prompt-input') as HTMLTextAreaElement | null; }

export function KnowledgeHub(props: KnowledgeHubProps) {
  const { documents, folders, scope, selected, formatBytes, request, activeFolder, onFolder, userId } = props;
  const [operation, setOperation] = useState<FolderOperation>();
  const [documentDialog, setDocumentDialog] = useState<DocumentOperation | { mode: 'upload' }>();
  const [archive, setArchive] = useState<KnowledgeDocument>();
  const [inspector, setInspector] = useState<Inspector>();
  const [treeOpen, setTreeOpen] = useState(false);
  const [highlight, setHighlight] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const [filing, setFiling] = useState<{ importIds?: string[] }>();
  const [locationFilter, setLocationFilter] = useState('');
  const [actionError, setActionError] = useState('');
  const breadcrumbs = getFolderBreadcrumbs(activeFolder, folders);
  const contractRoot = contractsRoot(folders);
  const inContracts = Boolean(contractRoot && breadcrumbs[0]?.id === contractRoot.id);
  const folderMap = new Map(folders.map(folder => [folder.id, folder]));
  const documentLocations = inContracts ? documents.map(doc => filingLocation(
    filingFolderPath(folderMap, doc.folderId).map(folder => folder.name), doc.filingLocation)) : [];
  const locations = [...new Set(documentLocations.flatMap(item => [item.region, item.site].flatMap(value => value ? [value] : [])))].sort();
  const currentLocation = locations.includes(locationFilter) ? locationFilter : '';
  const filteredDocuments = currentLocation ? documents.filter((_doc, index) => {
    const item = documentLocations[index];
    return item?.region === currentLocation || item?.site === currentLocation;
  }) : documents;
  const page = Math.min(props.page, Math.max(1, Math.ceil(filteredDocuments.length / knowledgePageSize)));
  const term = props.search.trim().toLocaleLowerCase();
  const childFolders = folders.filter(folder => (folder.parentId ?? null) === (activeFolder?.id ?? null) &&
    props.filter === 'all' && (!term || folder.name.toLocaleLowerCase().includes(term)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const viewName = scopes.find(([id]) => id === scope)?.[2] ?? 'Shared';
  const previewDocument = inspector?.mode === 'preview' ? documents.find(doc => doc.id === inspector.id) : undefined;
  const pipDocument = inspector?.mode === 'ask' ? inspector.document : previewDocument;
  const pipDocumentId = pipDocument?.id;
  const pipDocumentName = pipDocument?.filename;
  const { onPipDocument } = props;
  useLayoutEffect(() => { setInspector(undefined); setActionError(''); setLocationFilter(''); }, [activeFolder?.id, scope]);
  useEffect(() => {
    if (props.canManage && props.filingImportIds?.length) setFiling({ importIds: props.filingImportIds });
  }, [props.canManage, props.filingImportIds]);
  useLayoutEffect(() => {
    onPipDocument?.(pipDocumentId && pipDocumentName ? { id: pipDocumentId, filename: pipDocumentName } : undefined);
  }, [onPipDocument, pipDocumentId, pipDocumentName]);
  useEffect(() => {
    function openPipConversation(event: Event) {
      const id = (event as CustomEvent<string | undefined>).detail;
      const target = id ? documents.find(doc => doc.id === id) ?? (pipDocument?.id === id ? pipDocument : undefined) : undefined;
      if (id && !target) return;
      setInspector({ mode: 'ask', document: target });
    }
    window.addEventListener('cloudcore:pip-open-knowledge', openPipConversation);
    return () => window.removeEventListener('cloudcore:pip-open-knowledge', openPipConversation);
  }, [documents, pipDocument]);

  function openDrop(event: DragEvent, folderId?: string) {
    if (!isKnowledgeFileDrop(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setHighlight(undefined);
    if (documentDialog || operation || archive || filing) return;
    const source = readKnowledgeDrop(event.dataTransfer);
    void source.catch(() => {});
    props.onImport(folderId, source);
  }

  function openFolder(id: string | null) {
    setTreeOpen(false);
    onFolder(id);
    if (id && id !== activeFolder?.id) pipActivity('folder');
  }

  function ask(document?: KnowledgeDocument) {
    if (inspector?.mode === 'ask' && inspector.document?.id === document?.id) return;
    props.onClear(false);
    setInspector({ mode: 'ask', document });
    pipActivity('ask');
  }

  async function retryIndexing() {
    if (retrying || props.busy) return;
    setRetrying(true);
    setActionError('');
    try {
      const result = await request<{ queued: number }>('/api/knowledge/retry-indexing', {
        method: 'POST', body: JSON.stringify({ folderId: activeFolder?.id ?? null, scope })
      });
      if (result.queued) pipActivity('queued');
      props.onDocumentsChanged(result.queued
        ? result.queued + (result.queued === 1 ? ' file queued for indexing.' : ' files queued for indexing.')
        : 'No failed files eligible for retry in this location.', []);
    } catch (cause) { setActionError((cause as Error).message); }
    finally { setRetrying(false); }
  }

  const openUpload = () => setDocumentDialog({ mode: 'upload' });
  const openImport = () => props.onImport(activeFolder?.id);
  return <section className="kh-workspace" data-drag={highlight} onDragOver={event => {
    if (!isKnowledgeFileDrop(event)) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
    const folder = (event.target as HTMLElement).closest('[data-drop-folder]')?.getAttribute('data-drop-folder');
    setHighlight(folder || 'current');
  }} onDragLeave={event => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setHighlight(undefined);
  }} onDrop={event => openDrop(event, activeFolder?.id)}>
    <header className="kh-header">
      <div><h1>Knowledge Hub</h1><p>{folders.length} folders in {viewName}</p></div>
      <button type="button" className="kh-ask-button" aria-pressed={inspector?.mode === 'ask'} onClick={() => ask()}><Icon name="spark" /> Ask Knowledge</button>
    </header>
    <div className="kh-explorer" data-inspector={Boolean(inspector)}>
      <aside className="kh-sidebar" data-open={treeOpen} aria-label="Folder navigation">
        <nav className="kh-scopes" aria-label="Knowledge Hub scope">{scopes.map(([id, icon, label]) =>
          <button type="button" key={id} aria-pressed={scope === id} onClick={() => { props.onScope(id); setTreeOpen(false); }}>
            <Icon name={icon} /> {label}</button>)}</nav>
        <div className="kh-tree-label"><span>Folders</span><button type="button" className="kh-icon-button kh-tree-close" aria-label="Close folders"
          onClick={() => setTreeOpen(false)}><Icon name="close" /></button></div>
        <KnowledgeTree key={userId} folders={folders} active={activeFolder} userId={userId} onFolder={openFolder} onDrop={openDrop} dropTarget={highlight} />
      </aside>
      <div className="kh-main">
        <div className="kh-location">
          <button type="button" className="kh-button kh-tree-trigger" aria-expanded={treeOpen} onClick={() => setTreeOpen(value => !value)}><Icon name="menu" /> Folders</button>
          <nav className="ref-knowledge-breadcrumb kh-crumbs" aria-label="Folder hierarchy">
            <button type="button" onClick={() => openFolder(null)} aria-label="Knowledge Hub">{viewName}</button>
            {breadcrumbs.map((folder, index) => <span key={folder.id}><Icon name="chevron" />
              {index === breadcrumbs.length - 1 ? <strong aria-current="location" title={folder.name}>{folder.name}</strong>
                : <button type="button" title={folder.name} onClick={() => openFolder(folder.id)}>{folder.name}</button>}</span>)}
          </nav>
          {activeFolder && <span className="kh-access"><Icon name={activeFolder.isShared ? 'globe' : 'lock'} /> {activeFolder.isShared ? 'Shared' : 'Private'}</span>}
        </div>
        <div className="kh-tools">
          <details className="kh-menu kh-upload"><summary role="button" className="kh-button kh-primary"><Icon name="upload" /> Upload</summary>
            <div onClick={event => { (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
              <button type="button" onClick={openUpload}>Upload files</button>
              <button type="button" onClick={openImport}>Import files and folders</button>
            </div></details>
          <button type="button" className="kh-button" onClick={() => setOperation({
            mode: 'create', parentFolder: activeFolder, parentId: activeFolder?.id, defaultShared: scope === 'shared'
          })}>
            <Icon name="plus" /> {activeFolder ? 'New subfolder' : 'New folder'}</button>
          <button type="button" className="kh-button" disabled={retrying || props.busy}
            title={activeFolder ? 'Retry failed files in this folder and its subfolders' : 'Retry failed files in ' + viewName}
            onClick={() => void retryIndexing()}><Icon name="history" /> {retrying ? 'Queueing…' : 'Retry indexing'}</button>
          {props.canManage && contractRoot && <button type="button" className="kh-button" onClick={() => setFiling({})}>
            <Icon name="folder" /> Review customer filing
          </button>}
          {activeFolder && <details className="kh-menu"><summary role="button" className="kh-icon-button" aria-label="Folder actions"><Icon name="more" /></summary>
            <div onClick={event => { (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
              {activeFolder && <><button type="button" onClick={() => setOperation({ mode: 'edit', folder: activeFolder })}>Edit folder</button>
                <button type="button" onClick={() => setOperation({ mode: 'delete', folder: activeFolder })}>Delete folder</button></>}
            </div></details>}
        </div>
        <div className="kh-filters">
          <label className="kh-search"><Icon name="search" /><input type="search" aria-label="Search filenames"
            placeholder="Search filenames" value={props.search} onChange={event => props.onSearch(event.target.value)} /></label>
          <select aria-label="Search location" value={props.range} onChange={event => props.onRange(event.target.value as KnowledgeRange)}>
            <option value="folder">This folder</option>{activeFolder && <option value="branch">Include subfolders</option>}
            <option value="scope">Everywhere in {viewName}</option>
          </select>
          <select aria-label="File type" value={props.filter} onChange={event => props.onFilter(event.target.value)}>
            <option value="all">All types</option><option value="pdf">PDF</option><option value="word">Word</option><option value="excel">Excel</option>
            <option value="text">Text / Markdown</option><option value="archive">ZIP / RAR</option>
          </select>
          <select aria-label="Sort files" value={props.sort} onChange={event => props.onSort(event.target.value as KnowledgeHubProps['sort'])}>
            <option value="name">Name</option><option value="modified">Last modified</option></select>
          {locations.length > 0 && <select aria-label="Region or site" value={currentLocation} onChange={event => {
            setLocationFilter(event.target.value); props.onPage(1);
          }}><option value="">All regions and sites</option>{locations.map(loc => <option key={loc}>{loc}</option>)}</select>}
        </div>
        {actionError && <p className="kh-message" role="alert">{actionError}</p>}
        <KnowledgeTable {...props} documents={filteredDocuments} page={page} childFolders={childFolders} broader={props.range !== 'folder'} previewId={previewDocument?.id} dropTarget={highlight}
          onSelectPage={currentLocation ? () => {
            const visible = filteredDocuments.slice((page - 1) * knowledgePageSize, page * knowledgePageSize);
            const deselect = visible.every(doc => selected.has(doc.id));
            visible.filter(doc => selected.has(doc.id) === deselect).forEach(doc => props.onSelect(doc.id));
          } : props.onSelectPage}
          onUpload={openUpload} onOpenFolder={openFolder} onDropFolder={openDrop} onManageFolder={folder => setOperation({ mode: 'edit', folder })}
          onDocument={(mode, document) => {
            if (mode === 'preview') {
              setInspector({ mode, id: document.id });
              pipActivity('preview');
            }
            else setDocumentDialog({ mode, ids: [document.id], document });
          }} />
        {selected.size > 0 && <div className="kh-batch"><strong>{selected.size} selected</strong>
          <button type="button" className="kh-button" onClick={() => setDocumentDialog({ mode: 'move', ids: [...selected] })}>Move to Folder</button>
          <button type="button" className="kh-button" onClick={() => setDocumentDialog({ mode: 'delete', ids: [...selected] })}>Delete Selected</button>
          <button type="button" className="kh-icon-button" aria-label="Deselect" onClick={props.onDeselect}><Icon name="close" /></button>
        </div>}
      </div>
      {inspector?.mode === 'ask' && <KnowledgeChat key={inspector.document?.id ?? activeFolder?.id ?? 'root'} document={inspector.document}
        props={props} onClose={() => setInspector(undefined)} />}
      {inspector?.mode === 'preview' && <KnowledgePreview inline key={inspector.id} id={inspector.id} request={request}
        formatBytes={formatBytes} onClose={() => setInspector(undefined)} statusDocument={previewDocument}
        canManage={props.canManage || previewDocument?.userId === userId}
        onAsk={previewDocument ? () => ask(previewDocument) : undefined} onArchive={setArchive}
        onRetry={() => props.onDocumentsChanged('Indexing queued.', [])} onRenamed={() => props.onDocumentsChanged('File renamed.', [])} />}
    </div>
    {operation && <KnowledgeFolderDialog operation={operation} folderIcon={props.folderIcon} request={request} onCancel={() => setOperation(undefined)}
      onChanged={(message, removedId) => { setOperation(undefined); props.onFolderChanged(message, removedId); }} />}
    {documentDialog?.mode === 'upload' && <KnowledgeUpload folders={folders} folderId={activeFolder?.id}
      personal={activeFolder ? !activeFolder.isShared : scope !== 'shared'}
      formatBytes={formatBytes} request={request} onClose={() => setDocumentDialog(undefined)} onUploaded={message => {
        setDocumentDialog(undefined); props.onDocumentsChanged(message, []);
      }} />}
    {archive && <KnowledgeArchive key={archive.id} document={archive} folders={folders} request={request} rootShared={scope === 'shared'}
      userId={userId} formatBytes={formatBytes} onClose={() => setArchive(undefined)} onChanged={props.onRefresh} />}
    {filing && <KnowledgeFiling request={request} importIds={filing.importIds} onClose={() => setFiling(undefined)}
      onChanged={props.onDocumentsChanged} onArchive={async id => {
        const result = await request<{ document: KnowledgeDocument }>('/api/knowledge/documents/' + id);
        setFiling(undefined);
        setArchive(result.document);
      }} />}
    {(documentDialog?.mode === 'move' || documentDialog?.mode === 'delete') && <KnowledgeDocumentActions operation={documentDialog}
      folders={folders} request={request} onClose={() => setDocumentDialog(undefined)} onChanged={(message, ids) => {
        setDocumentDialog(undefined); props.onDocumentsChanged(message, ids);
      }} />}
  </section>;
}
