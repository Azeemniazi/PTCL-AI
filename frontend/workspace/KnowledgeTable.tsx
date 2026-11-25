import type { DragEvent } from 'react';
import type { KnowledgeDocument, KnowledgeFolder } from '../../src/models';
import { supportsKnowledgeIndex } from '../../src/knowledge-formats';
import { Icon } from '../shared/Brand';
import { getFolderBreadcrumbs, knowledgePageSize } from './knowledgeController';

export interface KnowledgeTableProps {
  documents: KnowledgeDocument[];
  folders: KnowledgeFolder[];
  selected: Set<string>;
  page: number;
  search: string;
  filter: string;
  busy: boolean;
  error: string;
  activeFolder?: KnowledgeFolder;
  folderIcon: (folder?: KnowledgeFolder) => string;
  formatBytes: (value: number) => string;
  onDocument: (mode: 'preview' | 'move' | 'delete', document: KnowledgeDocument) => void;
  onUpload: () => void;
  onRefresh: () => void;
  onSearch: (search: string, immediate?: boolean) => void;
  onFilter: (type: string) => void;
  onPage: (page: number) => void;
  onSelect: (id: string) => void;
  onSelectPage: () => void;
}

const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function fileStatus(document: KnowledgeDocument) {
  if (document.status === 'ready') return { label: 'Searchable', tone: 'ready' };
  if (document.status === 'indexing') return { label: 'Processing', tone: 'processing' };
  if (/\.(zip|rar)$/i.test(document.filename) ||
      !document.indexError && !supportsKnowledgeIndex(document.filename, document.sizeBytes)) {
    return { label: 'File only', tone: 'stored' };
  }
  return { label: 'Needs attention', tone: 'failed' };
}

export function KnowledgeTable(props: KnowledgeTableProps & {
  childFolders: KnowledgeFolder[]; broader: boolean; previewId?: string; dropTarget?: string;
  onOpenFolder: (id: string) => void; onManageFolder: (folder: KnowledgeFolder) => void;
  onDropFolder: (event: DragEvent, id: string) => void;
}) {
  const { documents, childFolders, page, selected, broader, busy, error } = props;
  const start = (page - 1) * knowledgePageSize;
  const rows = documents.slice(start, start + knowledgePageSize);
  const totalPages = Math.max(1, Math.ceil(documents.length / knowledgePageSize));
  const folderPath = (id?: string | null) => getFolderBreadcrumbs(props.folders.find(folder => folder.id === id), props.folders)
    .map(folder => folder.name).join(' / ');

  return <div className="kh-list" aria-busy={busy}>
    {error && <p className="kh-message" role="alert">{error} <button type="button" onClick={props.onRefresh}>Retry</button></p>}
    <table className="kh-table">
      <thead><tr>
        <th className="kh-selection"><input type="checkbox" aria-label="Select all documents on this page" disabled={!rows.length}
          checked={rows.length > 0 && rows.every(document => selected.has(document.id))} onChange={props.onSelectPage} /></th>
        <th scope="col">Name</th><th scope="col" className="kh-status-column">Search status</th>
        <th scope="col" className="kh-date-column">Modified</th><th scope="col"><span className="kh-sr-only">Actions</span></th>
      </tr></thead>
      <tbody>
        {page === 1 && childFolders.map(folder => <tr key={folder.id} data-drop-folder={folder.id}
          data-drop-active={props.dropTarget === folder.id} onDrop={event => props.onDropFolder(event, folder.id)}>
          <td />
          <td><button className="kh-name kh-folder-name" type="button" aria-label={'Open folder ' + folder.name} onClick={() => props.onOpenFolder(folder.id)}>
            <Icon name="folder" /><span title={folder.name}>{folder.name}</span>
          </button></td>
          <td className="kh-status-column kh-muted">{folder.fileCount ? folder.fileCount + (folder.fileCount === 1 ? ' file' : ' files') : '—'}</td>
          <td className="kh-date-column kh-muted">—</td>
          <td><button type="button" className="kh-icon-button" aria-label={'Edit ' + folder.name} onClick={() => props.onManageFolder(folder)}><Icon name="more" /></button></td>
        </tr>)}
        {rows.map(document => {
          const status = fileStatus(document);
          const path = broader ? folderPath(document.folderId) || 'Root' : '';
          const when = new Date(document.updatedAt ?? document.createdAt ?? '');
          const base = '/api/knowledge/documents/' + encodeURIComponent(document.id);
          return <tr key={document.id} data-selected={selected.has(document.id) || props.previewId === document.id}>
            <td className="kh-selection"><input type="checkbox" checked={selected.has(document.id)} aria-label={'Select ' + document.filename}
              onChange={() => props.onSelect(document.id)} /></td>
            <td><a href={base + '/view'} className="kh-name" onClick={event => {
              if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault(); props.onDocument('preview', document);
            }}>
              <Icon name="file" /><span title={document.filename}>{document.filename}{path && <small title={path}>{path}</small>}</span>
            </a></td>
            <td className="kh-status-column"><span className="kh-status" data-tone={status.tone} title={document.indexError}>{status.label}</span></td>
            <td className="kh-date-column kh-muted">{Number.isNaN(when.valueOf()) ? '—' : date.format(when)}</td>
            <td><details className="kh-menu">
              <summary role="button" className="kh-icon-button" aria-label={'Actions for ' + document.filename}><Icon name="more" /></summary>
              <div onClick={event => { const menu = event.currentTarget.parentElement as HTMLDetailsElement; menu.open = false; }}>
                <a href={base + '/download'} download={document.filename} aria-label={'Download ' + document.filename}>Download</a>
                <button type="button" aria-label={'Move ' + document.filename} onClick={() => props.onDocument('move', document)}>Move to folder</button>
                <button type="button" aria-label={'Delete ' + document.filename} onClick={() => props.onDocument('delete', document)}>Delete</button>
              </div>
            </details></td>
          </tr>;
        })}
      </tbody>
    </table>
    {!rows.length && !childFolders.length && !error && <div className="kh-empty">
      <Icon name={props.search ? 'search' : 'folder'} />
      <strong>{busy ? 'Loading files…' : props.search || props.filter !== 'all' ? 'No matching files' : 'This location is empty'}</strong>
      {!busy && !props.search && props.filter === 'all' && <><p>Drop files or folders here to add them.</p>
        <button type="button" className="outline small" onClick={props.onUpload}>Upload</button></>}
    </div>}
    {documents.length > 0 && <footer className="kh-list-footer">
      <span>Showing {start + 1}–{start + rows.length} of {documents.length} files</span>
      {totalPages > 1 && <nav aria-label="File pages">
        <button type="button" className="kh-button" aria-label="Previous page" disabled={page === 1} onClick={() => props.onPage(page - 1)}>Previous</button>
        <span>{page} / {totalPages}</span>
        <button type="button" className="kh-button" aria-label="Next page" disabled={page === totalPages} onClick={() => props.onPage(page + 1)}>Next</button>
      </nav>}
    </footer>}
  </div>;
}
