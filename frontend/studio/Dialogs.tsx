import * as studioModel from './model';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { KnowledgeFolder } from '../../src/models';
import { Icon } from '../shared/Brand';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';
import { useWorkspaceRequest } from '../shared/useWorkspaceRequest';
import { Action, ErrorMessage, fileMeta, styleLabel } from './controls';
import { type Asset, type StudioProps } from './types';

function Dialog({ title, onClose, children, wide = false, pending = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean; pending?: boolean;
}) {
  return <WorkspaceDialog className={`studio-dialog${wide ? ' is-wide-dialog' : ''}`} labelledBy="is-dialog-title" onClose={onClose} pending={pending}>
    <div className="image-studio"><h2 id="is-dialog-title">{title}</h2>
      <button type="button" className="dialog-close icon-button" aria-label="Close" disabled={pending} onClick={onClose}><Icon name="close" /></button>
      {children}
    </div>
  </WorkspaceDialog>;
}

function Viewer({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [zoom, setZoom] = useState<'fit' | '100' | '200'>('fit');
  const [naturalWidth, setNaturalWidth] = useState(asset.width || 0);
  return <Dialog title="A closer look" onClose={onClose} wide>
    <div className="is-viewer-tools" role="group" aria-label="Image zoom">
      {(['fit', '100', '200'] as const).map(value => <button type="button" key={value} className="is-button" aria-pressed={zoom === value}
        onClick={() => setZoom(value)}>{value === 'fit' ? 'Fit' : `${value}%`}</button>)}
      <a className="is-button" href={asset.url} download={studioModel.filename(asset)}><Icon name="download" /> Download</a>
    </div>
    <div className="is-viewer" data-zoom={zoom}><img src={asset.url} alt={asset.prompt} width={asset.width} height={asset.height}
      onLoad={event => setNaturalWidth(event.currentTarget.naturalWidth)} style={{ width: zoom === 'fit' || !naturalWidth ? undefined : naturalWidth * Number(zoom) / 100 }} /></div>
    <p className="is-viewer-caption">{asset.prompt}</p><p className="is-muted">{fileMeta(asset)} · {styleLabel(asset.style)}</p>
    <div className="is-dialog-actions"><Action action="remix-asset" data-id={asset.id}>Remix this image</Action>
      <Action action="save" data-id={asset.id}>Save to Knowledge Hub</Action><button type="button" className="is-primary" onClick={onClose}>Done</button></div>
  </Dialog>;
}

function PromptHistory({ assets, onClose }: { assets: Asset[]; onClose: () => void }) {
  const seen = new Set<string>();
  const prompts = assets.filter(asset => { const key = asset.prompt.trim().toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  return <Dialog title="Prompt history" onClose={onClose}>
    <div className="is-prompt-history">{prompts.length ? prompts.map(asset => <article key={asset.id}>
      <small>{styleLabel(asset.style)} · {asset.aspectRatio}</small><p>{asset.prompt}</p><Action action="reuse" data-id={asset.id}>Reuse settings</Action>
    </article>) : <p>Your prompts will appear here after you create an image.</p>}</div>
  </Dialog>;
}

function References({ assets, onClose }: { assets: Asset[]; onClose: () => void }) {
  return <Dialog title="Choose a reference" onClose={onClose} wide>
    {assets.length ? <div className="is-gallery-grid">{assets.map(asset => <article key={asset.id} className="is-gallery-card">
      <Action action="reference-asset" className="is-gallery-preview" data-id={asset.id} aria-label={`Use as reference: ${asset.prompt}`}>
        <img src={asset.url} width={asset.width} height={asset.height} loading="lazy" alt="" /></Action>
      <div className="is-card-caption"><p>{asset.prompt}</p></div></article>)}</div> : <p>No saved images yet.</p>}
  </Dialog>;
}

function AssetOperation({ ids, mode, state, request, onClose, onAssetOperation }: Pick<StudioProps, 'state' | 'request' | 'onClose' | 'onAssetOperation'> & {
  ids: string[]; mode: 'save' | 'delete';
}) {
  const [remaining, setRemaining] = useState(ids);
  const [folders, setFolders] = useState<KnowledgeFolder[] | null>(null);
  const [shared, setShared] = useState(true);
  const destinations = useWorkspaceRequest();
  const operation = useWorkspaceRequest();
  const saving = mode === 'save';
  const asset = ids.length === 1 ? state.assets.find(item => item.id === ids[0]) : undefined;
  const load = destinations.run;
  useEffect(() => {
    if (!saving) return;
    void load(async signal => {
      const response = await request<{ folders?: KnowledgeFolder[] }>('/api/knowledge/folders?scope=all', { signal });
      if (!signal.aborted) setFolders(response.folders || []);
    }, true);
  }, [request, load, saving]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const options = saving ? { folderId: String(form.get('folderId') ?? '') || null,
      filename: asset ? String(form.get('filename') ?? '') : undefined, isShared: shared } : undefined;
    void operation.run(async signal => {
      const result = await onAssetOperation(remaining, mode, options, signal);
      if (signal.aborted) return;
      if (!result.failed.length) { onClose(); return; }
      setRemaining(result.failed.map(item => item.id));
      const verb = saving ? 'saved' : 'deleted';
      throw Error(`${result.succeeded.length} ${verb}; ${result.failed.length} could not be ${verb}. ${result.failed[0]?.message || ''} Retry will only include failed images.`);
    });
  }
  const title = saving ? 'Save to Knowledge Hub' : ids.length > 1 ? `Delete ${ids.length} images?` : 'Delete this image?';
  return <Dialog title={title} onClose={onClose} pending={operation.pending}>
    {saving ? <p className="is-muted">{ids.length > 1 ? `${ids.length} images will use the same destination and sharing settings.` : 'Keep this image with your workspace documents.'}</p>
      : <p>This permanently removes {ids.length > 1 ? 'these images' : 'this image'} from your gallery.</p>}
    {saving && !folders ? destinations.error ? <ErrorMessage message={destinations.error} /> : <p className="is-muted" role="status">Loading destinations…</p> :
      <form onSubmit={submit}>
        {saving && <>
          <div className="is-field"><label htmlFor="is-save-folder">Destination folder</label><select name="folderId" id="is-save-folder"
            onChange={event => { const chosen = folders?.find(folder => folder.id === event.target.value); if (chosen) setShared(chosen.isShared); }}>
            <option value="">Unfiled documents</option>{folders?.map(folder => <option key={folder.id} value={folder.id}>{folder.name} · {folder.isShared ? 'Shared' : 'Personal'}</option>)}
          </select></div>
          {asset && <div className="is-field"><label htmlFor="is-save-name">File name</label><input id="is-save-name" name="filename" required
            maxLength={180} defaultValue={studioModel.filename(asset)} /></div>}
          <label className="is-checkbox"><input type="checkbox" name="isShared" checked={shared} onChange={event => setShared(event.target.checked)} /> Share with workspace team members</label>
        </>}
        <ErrorMessage message={operation.error} />
        <div className="is-dialog-actions"><button className="is-button" type="button" onClick={onClose} disabled={operation.pending}>{saving ? 'Cancel' : 'Keep images'}</button>
          <button type="submit" className={`is-primary${saving ? '' : ' is-danger-fill'}`} disabled={operation.pending}>
            {operation.pending ? (saving ? 'Saving…' : 'Deleting…') : saving ? `Save ${remaining.length === 1 ? 'image' : 'images'}` : 'Delete permanently'}</button></div>
      </form>}
  </Dialog>;
}

function ImportUrl({ onClose, onImport }: Pick<StudioProps, 'onClose' | 'onImport'>) {
  const operation = useWorkspaceRequest();
  return <Dialog title="Analyze an image from a URL" onClose={onClose} pending={operation.pending}>
    <p className="is-muted">Use a direct HTTPS link to a publicly accessible JPG, PNG, or WEBP image.</p>
    <form onSubmit={event => {
      event.preventDefault();
      const value = String(new FormData(event.currentTarget).get('url') ?? '');
      void operation.run(async signal => { await onImport(value, signal); if (!signal.aborted) onClose(); });
    }}>
      <div className="is-field"><label htmlFor="is-url">Image URL</label><input id="is-url" name="url" type="url" placeholder="https://example.com/image.png" required /></div>
      <ErrorMessage message={operation.error} /><div className="is-dialog-actions">
        <button type="button" className="is-button" onClick={onClose} disabled={operation.pending}>Cancel</button>
        <button type="submit" className="is-primary" disabled={operation.pending}>{operation.pending ? 'Loading…' : 'Load image'}</button>
      </div>
    </form>
  </Dialog>;
}

export function StudioDialogs(props: StudioProps) {
  const { dialog, onClose, state } = props;
  if (!dialog) return null;
  if (dialog.kind === 'view') return <Viewer asset={dialog.asset} onClose={onClose} />;
  if (dialog.kind === 'history') return <PromptHistory assets={state.assets} onClose={onClose} />;
  if (dialog.kind === 'reference') return <References assets={state.assets} onClose={onClose} />;
  if (dialog.kind === 'url') return <ImportUrl {...props} />;
  if (dialog.kind === 'save' || dialog.kind === 'delete') return <AssetOperation {...props} ids={dialog.ids} mode={dialog.kind} />;
  return null;
}
