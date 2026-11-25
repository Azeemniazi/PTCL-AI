import { useState, type FormEvent } from 'react';
import type { KnowledgeFolder } from '../../src/models';
import type { ApiClient } from '../shared/types';
import { Icon } from '../shared/Brand';
import { useWorkspaceRequest } from '../shared/useWorkspaceRequest';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';

const icons = [
  ['server', 'Datacenter'], ['partnership', 'Partnerships'], ['documents', 'Product Docs'], ['cloud', 'Cloud / QCloud'],
  ['security', 'Security'], ['analytics', 'Analytics'], ['tech', 'Engineering'], ['general', 'General'],
] as const;

export type FolderOperation =
  | { mode: 'create'; parentFolder?: KnowledgeFolder; parentId?: string | null; defaultShared?: boolean }
  | { mode: 'edit' | 'delete'; folder: KnowledgeFolder };

export function KnowledgeFolderDialog({ operation, folderIcon, request, onCancel, onChanged }: {
  operation: FolderOperation;
  folderIcon: (folder?: KnowledgeFolder) => string;
  request: ApiClient;
  onCancel: () => void;
  onChanged: (message: string, removedId?: string) => void;
}) {
  const action = useWorkspaceRequest();
  const folder = operation.mode === 'create' ? undefined : operation.folder;
  const parentFolder = operation.mode === 'create' ? operation.parentFolder : undefined;
  const parentId = operation.mode === 'create' ? (operation.parentId ?? operation.parentFolder?.id ?? null) : null;
  const initialShared = folder?.isShared ?? parentFolder?.isShared ??
    (operation.mode === 'create' ? operation.defaultShared ?? true : true);
  const [color, setColor] = useState(folder ? folderIcon(folder) : (parentFolder ? folderIcon(parentFolder) : 'server'));
  const deleting = operation.mode === 'delete';
  const count = folder?.fileCount || 0;
  const title = deleting
    ? `Delete Folder "${folder?.name}"?`
    : folder
      ? 'Edit Folder'
      : parentFolder
        ? `Create Subfolder in "${parentFolder.name}"`
        : 'Create New Folder';
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const isShared = data.get('isShared') === 'true';
    void action.run(async signal => {
      const base = '/api/knowledge/folders';
      const path = folder ? `${base}/${encodeURIComponent(folder.id)}` : base;
      if (deleting && folder) {
        const cascade = data.get('cascade') === 'true';
        await request(`${path}?cascade=${cascade}`, { method: 'DELETE', signal });
        if (!signal.aborted) onChanged(`Folder "${folder.name}" deleted.`, folder.id);
      } else {
        if (!name) throw Error('Folder name is required.');
        const payload: Record<string, any> = { name, isShared, color };
        if (parentId) payload.parentId = parentId;
        await request(path, { method: folder ? 'PATCH' : 'POST', signal, body: JSON.stringify(payload) });
        if (!signal.aborted) {
          const successMsg = folder ? 'Folder updated.' : parentFolder ? `Subfolder "${name}" created.` : `Folder "${name}" created.`;
          onChanged(successMsg);
        }
      }
    });
  }
  return <WorkspaceDialog labelledBy="knowledge-folder-dialog-title" onClose={onCancel} pending={action.pending}>
    <div className="ref-modal-box" style={{ maxWidth: 540 }}>
      <div className="panel-heading"><span className="feature-icon"><Icon name={deleting ? 'trash' : 'folder'} /></span>
        <div><h2 id="knowledge-folder-dialog-title">{title}</h2>
          <p>{deleting ? `This folder contains ${count} document${count === 1 ? '' : 's'}.`
            : folder ? 'Change folder name, icon, or sharing scope.'
            : parentFolder ? `Create a nested subfolder inside "${parentFolder.name}".`
            : 'Organize documents and choose who can access the folder.'}</p></div>
      </div>
      <form onSubmit={submit}>
        {action.error && <div className="login-alert" role="alert">{action.error}</div>}
        {deleting ? count > 0 && <fieldset className="ref-knowledge-folder-fields">
          <legend>Files in this folder</legend>
          <label><input type="radio" name="cascade" value="false" defaultChecked /> <span><b>Keep files</b> and move them to Unfiled</span></label>
          <label><input type="radio" name="cascade" value="true" /> <span><b>Delete files</b> permanently</span></label>
        </fieldset> : <>
          <label className="login-label">
            <span>Folder Name</span>
            <input name="name" required maxLength={120} defaultValue={folder?.name} placeholder={parentFolder ? "e.g. Sub-project A" : "e.g. Cloud Operations"} autoFocus />
          </label>
          {parentFolder && <div style={{ fontSize: '0.82rem', color: '#64748b', margin: '-4px 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Parent Folder:</span> <b style={{ color: '#0f172a' }}>{parentFolder.name}</b>
          </div>}
          <fieldset className="ref-knowledge-folder-fields"><legend>Folder Icon</legend>
            <div className="ref-folder-icon-grid">{icons.map(([id, label]) => <label key={id} className={`ref-folder-icon-option ${color === id ? 'selected' : ''}`}>
              <input type="radio" name="folderColor" value={id} checked={color === id} onChange={() => setColor(id)} />
              <img src={`assets/folders/folder-${id}.svg`} alt="" className="ref-icon-preview" /><span>{label}</span>
            </label>)}</div>
          </fieldset>
          <fieldset className="ref-knowledge-folder-fields"><legend>Folder Scope</legend>
            <label><input type="radio" name="isShared" value="true" defaultChecked={initialShared} disabled={parentFolder ? !parentFolder.isShared : false} /> <span><b>Workspace Shared</b> for team access</span></label>
            <label><input type="radio" name="isShared" value="false" defaultChecked={!initialShared} /> <span><b>My Personal Drive</b> for private access</span></label>
          </fieldset>
        </>}
        <div className="dialog-actions">
          <button type="button" className="outline" onClick={onCancel} disabled={action.pending}>Cancel</button>
          <button type="submit" className={deleting ? 'primary danger-outline' : 'primary'} disabled={action.pending}>
            <Icon name={deleting ? 'trash' : 'check'} /> {deleting ? 'Confirm Delete' : folder ? 'Save Changes' : parentFolder ? 'Create Subfolder' : 'Create Folder'}</button>
        </div>
      </form>
    </div>
  </WorkspaceDialog>;
}
