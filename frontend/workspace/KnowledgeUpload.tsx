import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import type { KnowledgeFolder } from '../../src/models';
import type { ApiClient } from '../shared/types';
import { Icon } from '../shared/Brand';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';
import { useWorkspaceRequest } from '../shared/useWorkspaceRequest';
import { buildFolderTree } from './knowledgeController';

interface UploadEntry { file: File; path: string; key: number }
type SelectedFile = Omit<UploadEntry, 'key'>;

async function readEntry(entry: FileSystemEntry, parent = ''): Promise<SelectedFile[]> {
  const path = parent ? `${parent}/${entry.name}` : entry.name;
  if (entry.isFile) {
    return new Promise(resolve => (entry as FileSystemFileEntry).file(file => resolve([{ file, path }]), () => resolve([])));
  }
  if (!entry.isDirectory) return [];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>(resolve => reader.readEntries(resolve, () => resolve([])));
    if (!batch.length) break;
    children.push(...batch);
  }
  const files: SelectedFile[] = [];
  for (const child of children) files.push(...await readEntry(child, path));
  return files;
}

export function KnowledgeUpload({ folders, folderId, personal, request, formatBytes, onClose, onUploaded }: {
  folders: KnowledgeFolder[]; folderId?: string; personal: boolean; request: ApiClient;
  formatBytes: (bytes: number) => string; onClose: () => void; onUploaded: (message: string) => void;
}) {
  const filePicker = useRef<HTMLInputElement>(null);
  const folderPicker = useRef<HTMLInputElement>(null);
  const key = useRef(0);
  const [files, setFiles] = useState<UploadEntry[]>([]);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const action = useWorkspaceRequest();
  const rootFolders = new Set(files.map(({ path }) => path.replace(/\\/g, '/')).filter(path => path.includes('/')).map(path => path.split('/')[0]));
  const count = `${files.length} file${files.length === 1 ? '' : 's'}`;
  const appendFiles = (selected: SelectedFile[]) => {
    const entries = selected.map(entry => ({ ...entry, key: key.current++ }));
    setFiles(previous => [...previous, ...entries]);
  };
  const fromPicker = (input: HTMLInputElement, preserveFolders: boolean) => {
    appendFiles(Array.from(input.files ?? [], file => ({ file, path: preserveFolders ? file.webkitRelativePath || file.name : file.name })));
    input.value = '';
  };

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (action.pending || reading) return;
    const transfer = event.dataTransfer;
    const fallback = Array.from(transfer.files, file => ({ file, path: file.webkitRelativePath || file.name }));
    const transfers = Array.from(transfer.items ?? [], item => {
      const compatible = item as DataTransferItem & { getAsEntry?: () => FileSystemEntry | null };
      return { entry: item.webkitGetAsEntry?.() || compatible.getAsEntry?.(), file: item.getAsFile() };
    });
    setReading(true);
    try {
      const dropped = (await Promise.all(transfers.map(({ entry, file }) => entry ? readEntry(entry) : file ? [{ file, path: file.name }] : []))).flat();
      appendFiles(dropped.length ? dropped : fallback);
    } finally {
      setReading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length || reading) return;
    const values = new FormData(event.currentTarget);
    const targetFolder = values.get('folderId');
    void action.run(async signal => {
      if (files.reduce((size, entry) => size + entry.file.size, 0) > 250 * 1048576) throw Error('Uploads are limited to 250 MB per batch.');
      const body = new FormData();
      for (const { file, path } of files) {
        body.append('files', file, file.name);
        body.append('paths', path);
      }
      if (targetFolder) body.append('folderId', targetFolder);
      body.append('isShared', String(values.get('isShared') ?? 'true'));
      const result = await request<{ failedCount?: number; successCount?: number; total?: number; uploaded?: unknown[] }>(
        '/api/knowledge/upload', { method: 'POST', signal, body });
      if (!signal.aborted) onUploaded(result.failedCount
        ? `${result.successCount ?? 0} of ${result.total ?? files.length} files uploaded. ${result.failedCount} had issues.`
        : `${result.successCount ?? result.uploaded?.length ?? files.length} file(s) uploaded successfully.`);
    });
  }

  return <WorkspaceDialog labelledBy="knowledge-upload-title" onClose={onClose} pending={action.pending}>
    <div className="ref-modal-box">
      <div className="panel-heading"><span className="feature-icon"><Icon name="upload" /></span><div>
        <h2 id="knowledge-upload-title">Upload Documents &amp; Folders</h2><p>Upload files or full folders while preserving their folder structure.</p>
      </div></div>
      <form onSubmit={submit}>
        {action.error && <div className="login-alert" role="alert">{action.error}</div>}
        <div className={`ref-upload-dropzone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <span className="mini-icon"><Icon name="upload" /></span><b style={{ display: 'block', margin: '6px 0 2px' }}>Choose files, a folder, or drag and drop here</b>
          <small style={{ color: '#64748b', display: 'block', marginBottom: 12 }}>Up to 250 MB per batch</small>
          <input type="file" id="batch-file-input" multiple hidden ref={filePicker} onChange={event => fromPicker(event.target, false)} />
          <input type="file" id="batch-folder-input" multiple hidden ref={element => {
            folderPicker.current = element;
            element?.setAttribute('webkitdirectory', '');
          }} onChange={event => fromPicker(event.target, true)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="outline small" disabled={action.pending} onClick={() => filePicker.current?.click()}><Icon name="plus" /> Select Files</button>
            <button type="button" className="outline small" disabled={action.pending} onClick={() => folderPicker.current?.click()}><Icon name="folder" /> Select Folder</button>
          </div>
        </div>
        {reading && <p role="status">Reading folders…</p>}
        {files.length > 0 && <ul className="ref-knowledge-upload-files">{files.map(({ file, path, key: entryKey }) => <li key={entryKey}>
          <span title={path}>{path} <small>({formatBytes(file.size)})</small></span>
          <button type="button" className="icon-button" disabled={action.pending} aria-label={`Remove ${path}`}
            onClick={() => setFiles(previous => previous.filter(item => item.key !== entryKey))}>×</button>
        </li>)}</ul>}
        <div className="ref-knowledge-upload-options">
          <label className="login-label"><span>Target Folder</span><select name="folderId" className="ref-select" defaultValue={folderId ?? ''}>
            <option value="">(None / Root Directory)</option>{buildFolderTree(folders).map(folder => <option key={folder.id} value={folder.id}>{folder.label}</option>)}
          </select></label>
          <label className="login-label"><span>Visibility Scope</span><select name="isShared" className="ref-select" defaultValue={String(!personal)}>
            <option value="true">Workspace Shared</option><option value="false">My Personal Drive</option>
          </select></label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="outline" onClick={onClose} disabled={action.pending}>Cancel</button>
          <button type="submit" className="primary" disabled={!files.length || action.pending || reading}><Icon name="upload" />
            {' '}{action.pending ? `Uploading & parsing ${count}…` : files.length
              ? `Upload ${count}${rootFolders.size ? ` (${rootFolders.size} folder${rootFolders.size === 1 ? '' : 's'})` : ''}` : 'Upload Documents'}</button>
        </div>
      </form>
    </div>
  </WorkspaceDialog>;
}
