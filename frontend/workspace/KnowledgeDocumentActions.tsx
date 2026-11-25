import type { FormEvent } from 'react';
import type { KnowledgeDocument, KnowledgeFolder } from '../../src/models';
import type { ApiClient } from '../shared/types';
import { Icon } from '../shared/Brand';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';
import { useWorkspaceRequest } from '../shared/useWorkspaceRequest';
import { buildFolderTree } from './knowledgeController';

export type DocumentOperation = { mode: 'move' | 'delete'; ids: string[]; document?: KnowledgeDocument };

export function KnowledgeDocumentActions({ operation, folders, request, onClose, onChanged }: {
  operation: DocumentOperation; folders: KnowledgeFolder[]; request: ApiClient; onClose: () => void;
  onChanged: (message: string, changed: string[]) => void;
}) {
  const action = useWorkspaceRequest();
  const { mode, ids, document } = operation;
  const deleting = mode === 'delete';
  const label = deleting ? 'Delete' : 'Move';
  const subject = document ? 'Document' : `${ids.length} Document${ids.length === 1 ? '' : 's'}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const folderId = new FormData(event.currentTarget).get('folderId') || null;
    void action.run(async signal => {
      let changed: string[];
      if (document) {
        await request(`/api/knowledge/documents/${encodeURIComponent(document.id)}`, deleting
          ? { method: 'DELETE', signal } : { method: 'PATCH', signal, body: JSON.stringify({ folderId }) });
        changed = ids;
      } else {
        const result = await request<{ deletedIds?: string[]; movedIds?: string[] }>(
          `/api/knowledge/batch-${mode}`, { method: 'POST', signal,
            body: JSON.stringify(deleting ? { documentIds: ids } : { documentIds: ids, targetFolderId: folderId }) });
        changed = (deleting ? result.deletedIds : result.movedIds) ?? [];
      }
      if (signal.aborted) return;
      const verb = deleting ? 'deleted' : 'moved';
      onChanged(changed.length < ids.length ? `${changed.length} of ${ids.length} documents ${verb}.`
        : `${changed.length} document${changed.length === 1 ? '' : 's'} ${verb}.`, changed);
    });
  }

  return <WorkspaceDialog labelledBy="knowledge-document-action-title" onClose={onClose} pending={action.pending}>
    <div className="ref-modal-box">
      <div className="panel-heading"><span className="feature-icon"><Icon name={deleting ? 'trash' : 'folder'} /></span>
        <div><h2 id="knowledge-document-action-title">{label} {subject}{deleting ? '?' : ''}</h2>
          <p>{deleting ? (document ? `Permanently remove "${document.filename}" from Knowledge Hub.` : `Permanently remove the ${ids.length} selected documents.`)
            : document ? `Change the folder for "${document.filename}".` : 'Choose a destination for the selected documents.'}</p>
        </div></div>
      <form onSubmit={submit}>
        {action.error && <div className="login-alert" role="alert">{action.error}</div>}
        {!deleting && <label className="login-label"><span>Destination Folder</span><select name="folderId" className="ref-select" defaultValue={document?.folderId ?? ''}>
          <option value="">(None / Root Directory)</option>
          {buildFolderTree(folders).map(folder => <option value={folder.id} key={folder.id}>{folder.label}</option>)}
        </select></label>}
        <div className="dialog-actions" style={{ marginTop: 18 }}>
          <button type="button" className="outline" onClick={onClose} disabled={action.pending}>Cancel</button>
          <button type="submit" className={`primary ${deleting ? 'danger-outline' : ''}`} disabled={action.pending}>
            <Icon name={deleting ? 'trash' : 'check'} /> {label} {subject}</button>
        </div>
      </form>
    </div>
  </WorkspaceDialog>;
}
