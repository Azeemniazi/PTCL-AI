import { useDeferredValue, useEffect, useState, type ReactNode } from 'react';
import type { KnowledgeDocument } from '../../src/models';
import type { ApiClient } from '../shared/types';
import { Icon } from '../shared/Brand';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';
import { useWorkspaceRequest } from '../shared/useWorkspaceRequest';
import { fileStatus } from './KnowledgeTable';
import { KnowledgePanel } from './KnowledgePanel';

interface Sheet { name: string; totalRows: number; rows: Array<Array<string | number | null>> }

function columnLabel(index: number) {
  let label = '';
  for (let column = index; column >= 0; column = Math.floor(column / 26) - 1) {
    label = String.fromCharCode(65 + column % 26) + label;
  }
  return label;
}

function PreviewHeader({ doc, extension, base, formatBytes, onClose, isImage, sheetSearch, toolbar }: {
  doc: KnowledgeDocument; extension: string; base: string; formatBytes: (value: number) => string; onClose: () => void;
  isImage?: boolean; sheetSearch?: { query: string; setQuery: (value: string) => void };
  toolbar?: ReactNode;
}) {
  const pdf = extension === 'pdf';
  const badge = isImage ? 'png' : /^[a-z0-9]{1,12}$/.test(extension) ? extension : 'file';
  return <div className="ref-viewer-header">
    <div className="ref-viewer-meta"><span className={`ref-ext-badge ext-${badge}`}>{isImage ? 'IMG' : badge.toUpperCase()}</span>
      <div><h3 id="knowledge-preview-title" title={doc.filename}>{doc.filename}</h3>
        <details className="kh-preview-details"><summary>Details</summary><p>{formatBytes(doc.sizeBytes)} · {doc.folderName || 'Root'} · {doc.creatorName || 'User'} · {doc.isShared ? 'Shared' : 'Private'}</p></details></div>
    </div>
    <div className="ref-viewer-header-actions">
      {toolbar}
      {sheetSearch && <label className="ref-sheet-search"><Icon name="search" /><input type="search" aria-label="Search rows"
        placeholder="Search sheet rows…" value={sheetSearch.query} onChange={event => sheetSearch.setQuery(event.target.value)} /></label>}
      {(pdf || isImage) && <a className="outline small" href={`${base}/view`} target="_blank" rel="noopener"><Icon name="arrow" /> {pdf ? 'Pop out' : 'Full Size'}</a>}
      <a className="outline small" href={`${base}/download`} download={doc.filename}><Icon name="download" /> Download</a>
      <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close preview"><Icon name="close" /></button>
    </div>
  </div>;
}

function ExtractedText({ text }: { text?: string }) {
  return <div className="ref-viewer-body" style={{ height: '72vh', overflowY: 'auto', padding: '24px 30px', background: '#fbfdfc' }}>
    <article className="ref-doc-formatted-reader" style={{ maxWidth: 860, margin: '0 auto', padding: '32px 36px', background: '#fff',
      border: '1px solid #dce8e0', borderRadius: 14, lineHeight: 1.75, fontSize: 14, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
      {text || 'No text could be extracted from this document.'}
    </article>
  </div>;
}

function Spreadsheet({ doc, extension, base, formatBytes, request, onClose, toolbar }: {
  doc: KnowledgeDocument; extension: string; base: string; formatBytes: (value: number) => string; request: ApiClient; onClose: () => void; toolbar?: ReactNode;
}) {
  const { run, error } = useWorkspaceRequest();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState('');
  const term = useDeferredValue(query).trim().toLowerCase();
  useEffect(() => {
    void run(async signal => {
      const result = await request<{ sheets?: Sheet[] }>(`${base}/sheet-data`, { signal });
      if (!result.sheets?.length) throw Error('No sheet tables found.');
      if (!signal.aborted) setSheets(result.sheets);
    }, true);
  }, [base, request, run]);
  const sheet = sheets[index];
  const rows = sheet?.rows ?? [];
  const visible = term ? rows.filter(row => row.some(cell => String(cell ?? '').toLowerCase().includes(term))) : rows;
  const columns = visible.reduce((count, row) => Math.max(count, row.length), 1);
  const headings = Array.from({ length: columns }, (_, column) => columnLabel(column));
  return <>
    <PreviewHeader doc={doc} extension={extension} base={base} formatBytes={formatBytes} onClose={onClose} toolbar={toolbar} sheetSearch={sheets.length ? { query, setQuery } : undefined} />
    {sheets.length > 1 && <div className="ref-sheet-tabs-bar" aria-label="Worksheets">{sheets.map((item, itemIndex) => <button type="button"
      key={itemIndex} className={`ref-sheet-tab-btn ${index === itemIndex ? 'active' : ''}`} aria-pressed={index === itemIndex}
      onClick={() => setIndex(itemIndex)}><Icon name="chart" /> {item.name} <small>({item.totalRows} rows)</small></button>)}</div>}
    {error ? <><p className="login-alert" role="alert">Spreadsheet grid unavailable. Showing extracted text.</p><ExtractedText text={doc.extractedText} /></>
      : <div className="ref-viewer-body ref-sheet-scroll" style={{ height: '68vh', overflow: 'auto', background: '#fff' }}>
        {!sheet ? <p role="status">Parsing spreadsheet data…</p> : visible.length ? <table className="ref-excel-table">
          <thead><tr><th className="ref-cell-num">#</th>{headings.map(heading => <th key={heading} className="ref-cell-col-header">{heading}</th>)}</tr></thead>
          <tbody>{visible.map((row, rowIndex) => <tr key={rowIndex}><td className="ref-cell-num">{rowIndex + 1}</td>{headings.map((heading, column) => {
            const value = String(row[column] ?? '');
            return <td key={heading} className={/^-?\d+(\.\d+)?%?$/.test(value.trim()) ? 'ref-cell-number' : ''}>{value}</td>;
          })}</tr>)}</tbody>
        </table> : <p style={{ textAlign: 'center', padding: 40 }}>{term ? `No rows matching "${query}"` : 'No rows in this sheet'}</p>}
      </div>}
    {sheet && <div className="ref-sheet-statusbar" style={{ display: 'flex' }}>
      <span>Showing <b>{visible.length}</b> of {rows.length} rows · Active Sheet: <b>{sheet.name}</b></span>
    </div>}
  </>;
}

export function KnowledgePreview({ id, request, onClose, formatBytes, inline = false, onAsk, onArchive, onRetry, onRenamed, canManage, statusDocument }: {
  id: string; request: ApiClient; onClose: () => void; formatBytes: (value: number) => string;
  inline?: boolean; canManage?: boolean; statusDocument?: KnowledgeDocument;
  onAsk?: () => void; onArchive?: (doc: KnowledgeDocument) => void; onRetry?: () => void; onRenamed?: () => void;
}) {
  const { run, error } = useWorkspaceRequest();
  const [doc, setDocument] = useState<KnowledgeDocument>();
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const base = `/api/knowledge/documents/${encodeURIComponent(id)}`;
  useEffect(() => {
    void run(async signal => {
      const result = await request<{ document?: KnowledgeDocument }>(base, { signal });
      if (!result.document) throw Error('Document not found.');
      if (!signal.aborted) setDocument(result.document);
    }, true);
  }, [base, request, run]);
  const extension = doc?.filename.split('.').pop()?.toLowerCase() || 'file';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(extension);
  const status = doc && fileStatus(statusDocument ?? doc);
  const refreshedText = statusDocument?.status === 'ready' && doc?.status === 'indexing';
  useEffect(() => {
    if (!refreshedText) return;
    void run(async signal => {
      const response = await request<{ document?: KnowledgeDocument }>(base, { signal });
      if (!signal.aborted && response.document) setDocument(response.document);
    }, true);
  }, [refreshedText, base, request, run]);
  const body = (expand?: ReactNode) => {
    const toolbar = <>{status && <span className="kh-status" data-tone={status.tone}>{status.label}</span>}
      {onAsk && <button type="button" className="kh-button" onClick={onAsk}><Icon name="spark" /> Ask about this file</button>}
      {expand}</>;
    return (
    <div className="ref-viewer-modal">
      {!doc ? <div className="ref-viewer-header"><h3 id="knowledge-preview-title">Document preview</h3>
        <p role={error ? 'alert' : 'status'}>{error || 'Loading document…'}</p>
        <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close preview"><Icon name="close" /></button>
      </div> : <>{inline && (canManage || status?.tone === 'failed' || ['zip','rar'].includes(extension)) && <div className="kh-preview-actions">
        {onArchive && ['zip', 'rar'].includes(extension) && <button type="button" className="kh-button" onClick={() => onArchive(doc)}>
          <Icon name="folder" /> Preview archive contents
        </button>}
        {canManage && <button type="button" className="kh-button" onClick={() => setRenaming(value => !value)}>Rename</button>}
        {canManage && status?.tone === 'failed' && <button type="button" className="kh-button" disabled={busy} onClick={async () => {
          setBusy(true); setActionError('');
          try { await request(base + '/reindex', { method: 'POST' }); setDocument({ ...doc, status: 'indexing', indexError: undefined }); onRetry?.(); }
          catch (cause) { setActionError((cause as Error).message); }
          finally { setBusy(false); }
        }}>Retry indexing</button>}
        {renaming && <form className="kh-rename" onSubmit={async event => {
          event.preventDefault();
          const filename = String(new FormData(event.currentTarget).get('filename') ?? '').trim();
          if (!filename || busy) return;
          setBusy(true); setActionError('');
          try {
            await request(base, { method: 'PATCH', body: JSON.stringify({ filename }) });
            setDocument({ ...doc, filename });
            setRenaming(false);
            onRenamed?.();
          } catch (cause) { setActionError((cause as Error).message); }
          finally { setBusy(false); }
        }}><input name="filename" aria-label="New filename" defaultValue={doc.filename} required /><button className="kh-button" disabled={busy}>Save</button></form>}
        {status?.tone === 'failed' && <p>{(statusDocument ?? doc).indexError || 'Indexing failed. You can still download the original.'}</p>}
        {actionError && <p role="alert">{actionError}</p>}
      </div>}{['xlsx', 'xlsm', 'xltx', 'xls', 'csv'].includes(extension)
        ? <Spreadsheet doc={doc} extension={extension} base={base} request={request} formatBytes={formatBytes} onClose={onClose} toolbar={toolbar} />
        : <>
          <PreviewHeader doc={doc} extension={extension} base={base} formatBytes={formatBytes} onClose={onClose} isImage={isImage} toolbar={toolbar} />
          {extension === 'pdf' ? <div className="ref-viewer-body" style={{ height: '74vh', background: '#525659' }}>
            <iframe src={`${base}/view#toolbar=1&navpanes=1`} style={{ width: '100%', height: '100%', border: 0 }} title={doc.filename} />
          </div> : isImage ? <div className="ref-viewer-body" style={{ height: '72vh', display: 'grid', placeItems: 'center', background: '#0f172a', padding: 20 }}>
            <img src={`${base}/view`} style={{ maxHeight: '68vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} alt={doc.filename} />
          </div> : ['zip', 'rar'].includes(extension) ? null : <ExtractedText text={doc.extractedText} />}
        </>}
      </>}
    </div>
    );
  };
  return inline ? <KnowledgePanel label="Document preview" className="kh-preview">{({button}) => body(button)}</KnowledgePanel>
    : <WorkspaceDialog labelledBy="knowledge-preview-title" onClose={onClose}>{body()}</WorkspaceDialog>;
}
