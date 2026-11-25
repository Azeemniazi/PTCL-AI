import * as studioModel from './model';
import { useEffect, useState } from 'react';
import { Icon } from '../shared/Brand';
import { Action, AssetActions, ErrorMessage, Menu, fileMeta, styleLabel } from './controls';
import { type StudioProps, type StudioState } from './types';

function Reference({ state }: { state: StudioState }) {
  const source = state.remix.source;
  return <div className="is-field"><div className="is-label-row"><label htmlFor="is-remix-upload">Reference image</label>
    {source && <Action action="remove-reference" className="is-text-button">Remove</Action>}</div>
    {source ? <div className="is-reference"><img src={source.url} alt="Reference for your remix" /><div><b>{source.name || 'Selected image'}</b>
      <Action action="choose-remix" className="is-text-button">Replace image</Action></div></div>
      : <div className="is-dropzone is-dropzone-small" data-studio-drop="remix"><Icon name="image" /><p>Give your idea a starting point.</p>
        <Action action="choose-remix"><Icon name="upload" /> Choose image</Action><small>JPG, PNG, WEBP · up to 20 MB</small>
        {Boolean(state.assets.length) && <Action action="choose-reference" className="is-text-button">Or choose from your gallery</Action>}
      </div>}
    <input type="file" id="is-remix-upload" className="is-sr-only" accept="image/png,image/jpeg,image/webp" data-studio-upload="remix" tabIndex={-1} />
  </div>;
}

function Editor({ state, onDraft, onAdvanced }: StudioProps) {
  const mode = state.tab === 'remix' ? 'remix' : 'create';
  const remix = mode === 'remix';
  const draft = state[mode];
  const capability = state.capabilities;
  const { styles, formats, terminal } = studioModel;
  const promptId = `is-${mode}-prompt`;
  return <aside className="is-composer" aria-label={remix ? 'Remix settings' : 'Image settings'}>
    {remix && <Reference state={state} />}
    <div className="is-field"><div className="is-label-row"><label htmlFor={promptId}>{remix ? 'Describe what to change' : 'Your prompt'}</label>
      <span id="is-prompt-count">{draft.prompt.length}/500</span></div>
      <textarea id={promptId} maxLength={500} rows={5} value={draft.prompt} onChange={event => onDraft(mode, 'prompt', event.target.value)}
        placeholder={remix ? 'Keep the composition, change the scene to golden hour…' : 'A quiet glass pavilion in the mountains, soft morning light, architectural photography…'} />
      <div className="is-editor-tools">
        <Action action="enhance" className="is-text-button" disabled={state.enhancing}><Icon name="spark" />{state.enhancing ? 'Enhancing…' : 'Enhance'}</Action>
        {draft.originalPrompt !== null && <Action action="undo-enhance" className="is-text-button">Undo</Action>}
        <Menu title="Prompt tools">
          <Action action="inspire" className="is-menu-item"><Icon name="bulb" /> Try an idea</Action>
          <Action action="history" className="is-menu-item"><Icon name="history" /> Prompt history</Action>
          <Action action="clear-prompt" className="is-menu-item"><Icon name="close" /> Clear prompt</Action>
        </Menu>
      </div>
    </div>
    <div className="is-field"><label htmlFor="is-style">Style</label><select id="is-style" value={draft.style} onChange={event => onDraft(mode, 'style', event.target.value)}>
      {styles.map(([id, title, description]) => <option key={id} value={id}>{title} — {description}</option>)}</select></div>
    <div className="is-field"><label htmlFor="is-format">Format</label><select id="is-format" value={draft.aspectRatio} onChange={event => onDraft(mode, 'aspectRatio', event.target.value)}>
      {formats.map(([id, title, width, height]) => <option key={id} value={id}>{title} · {id} · {width} × {height}</option>)}</select></div>
    {remix && capability?.controls?.strength && <div className="is-field"><div className="is-label-row"><label htmlFor="is-strength">Change strength</label>
      <output id="is-strength-value" htmlFor="is-strength">{Math.round(state.remix.strength * 100)}%</output></div>
      <input id="is-strength" type="range" min="0.1" max="0.9" step="0.05" value={state.remix.strength} onChange={event => onDraft(mode, 'strength', event.target.value)} />
      <div className="is-range-labels"><span>Closer to original</span><span>More change</span></div></div>}
    <details className="is-advanced" open={draft.advanced} onToggle={event => onAdvanced(mode, event.currentTarget.open)}>
      <summary><Icon name="sliders" /> Advanced settings <Icon name="chevron" /></summary>
      <div><div className="is-field"><label htmlFor="is-negative">Leave out</label><input id="is-negative" maxLength={500}
        placeholder="Blurry details, text, watermarks…" value={draft.negativePrompt} onChange={event => onDraft(mode, 'negativePrompt', event.target.value)} /></div>
        <div className="is-field"><label htmlFor="is-seed">Seed <span className="is-muted">Optional</span></label>
          <input id="is-seed" type="number" min="1" max="2147483647" placeholder="Random" value={draft.seed} onChange={event => onDraft(mode, 'seed', event.target.value)} /></div></div>
    </details>
    <div id="is-submit-error"><ErrorMessage message={state.error} />
      {state.error && (state.pollFailures >= 5 || state.submitFailed) && <>
        <Action action="reconnect" className="is-text-button">{state.pollFailures >= 5 ? 'Reconnect' : 'Check active job'}</Action>
        {state.submitFailed && <Action action="retry" className="is-text-button">Try again</Action>}
      </>}
    </div>
    {remix && capability && !capability.remix && <p className="is-notice"><Icon name="help" /> {capability.remixMessage || 'Image remix is unavailable on the connected engine.'}</p>}
    <Action action="generate" className="is-primary is-generate" disabled={state.submitting || Boolean(state.job && !terminal(state.job)) || (remix && !capability?.remix)}>
      <Icon name="spark" /><span>{state.submitting ? 'Starting…' : remix ? 'Remix image' : 'Generate image'}</span>
      <kbd aria-hidden="true">{/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} ↵</kbd></Action>
    <p className="is-composer-foot">{remix ? 'Your original image stays untouched.' : 'Your creations are saved to your gallery.'}</p>
  </aside>;
}

function JobStatus({ job }: Pick<StudioState, 'job'>) {
  const [now, setNow] = useState(Date.now);
  const done = studioModel.terminal(job);
  const running = Boolean(job && !done);
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, job?.createdAt, job?.startedAt]);
  if (!job || job.status === 'completed') return null;
  const queued = job.status === 'queued';
  const title = queued ? 'Waiting in the queue' : job.status === 'processing' ? 'Creating your image'
    : job.status === 'cancelled' ? 'Generation cancelled' : 'Something interrupted this image';
  const started = Date.parse(job.startedAt || job.createdAt || '');
  const elapsed = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  return <section className={`is-job ${done ? 'is-job-terminal' : ''}`} aria-label="Generation status">
    <span className={`is-job-mark ${done ? '' : 'is-breathing'}`}><Icon name={done ? 'help' : 'spark'} /></span><div>
      <b role="status">{title}</b><p>{done ? job.error || 'Your draft is ready when you are.' : queued ? 'You can keep exploring the studio.' : 'This can take a few minutes. Your previous image stays available.'}</p>
      {!done && <small>{Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed</small>}</div>
    <Action action={done ? 'retry' : 'cancel'}>{done ? 'Try again' : 'Cancel'}</Action>
  </section>;
}

function Canvas({ state }: { state: StudioState }) {
  const remix = state.tab === 'remix';
  const asset = remix ? state.remix.result : state.assets.find(item => item.id === state.activeId);
  const source = remix ? state.remix.source : null;
  const original = Boolean(source && state.remix.compare === 'original');
  const filename = studioModel.filename;
  return <section className="is-canvas-column" aria-label="Image preview"><div id="is-job-status"><JobStatus job={state.job} /></div>
    <div className="is-canvas-card"><div className="is-canvas-heading">
      <span>{asset ? (asset.renderKind === 'vector-preview' ? 'VECTOR PREVIEW · ENGINE UNAVAILABLE' : 'YOUR CREATION') : remix ? 'A NEW PERSPECTIVE' : 'ROOM FOR IMAGINATION'}</span>
      <small>{asset ? fileMeta(asset) : remix ? 'Original → reimagined' : 'Preview'}</small></div>
      {asset ? <>
        {source && <div className="is-compare-tabs" role="group" aria-label="Compare remix">
          <Action action="compare-original" className={`is-button ${original ? 'is-selected' : ''}`} aria-pressed={original}>Original</Action>
          <Action action="compare-result" className={`is-button ${original ? '' : 'is-selected'}`} aria-pressed={!original}>Result</Action>
        </div>}
        <Action action="view" className="is-artboard" data-id={asset.id} aria-label="Expand image">
          <img src={original ? source?.url : asset.url} alt={original ? 'Original reference image' : asset.prompt}
            width={original ? undefined : asset.width} height={original ? undefined : asset.height} />
          <span className="is-expand-hint"><Icon name="eye" /> View image</span></Action>
        <div className="is-canvas-toolbar"><span className="is-image-style"><Icon name="image" /> {styleLabel(asset.style)}</span><div>
          <a className="is-button" href={asset.url} download={filename(asset)}><Icon name="download" /> Download</a>
          <Action action="remix-asset" data-id={asset.id}><Icon name="sliders" /> Remix</Action><Menu><AssetActions asset={asset} /></Menu>
        </div></div>
        <details className="is-image-details" id="is-image-details" key={asset.id}><summary>Image details <Icon name="chevron" /></summary>
          <p>{asset.prompt}</p><dl><div><dt>Format</dt><dd>{fileMeta(asset)}</dd></div><div><dt>Seed</dt><dd>{asset.seed}</dd></div>
            <div><dt>Created</dt><dd>{new Date(asset.createdAt).toLocaleDateString()}</dd></div>
            {asset.operation === 'remix' && <div><dt>Process</dt><dd>Image-to-image remix</dd></div>}</dl>
          <Action action="reuse" className="is-text-button" data-id={asset.id}>Reuse settings</Action></details>
      </> : <div className="is-artboard is-artboard-empty"><div className="is-empty-art" aria-hidden="true"><span /><span /><span /><Icon name="image" /></div>
        <h2>{remix ? 'See where it takes you.' : 'What do you have in mind?'}</h2>
        <p>{remix ? 'Add a reference and describe your changes. Your new image will appear here.' : 'Describe your image and choose a style.'}</p></div>}
    </div>
    {!remix && !state.assets.length && !state.create.prompt && <div className="is-starters"><span>Need a starting point?</span>
      {studioModel.starters.map(([title], index) => <Action key={title} action="starter" className="is-starter" data-index={index}>{title} <Icon name="arrow" /></Action>)}</div>}
    {!remix && Boolean(state.assets.length) && <section className="is-recent"><div className="is-section-heading"><h2>Recent creations</h2>
      <Action action="gallery" className="is-text-button">View gallery <Icon name="arrow" /></Action></div><div className="is-recent-strip">
      {state.assets.slice(0, 8).map(item => <Action key={item.id} action="preview" className="is-thumb" data-id={item.id} aria-label={`Preview: ${item.prompt}`}
        aria-pressed={state.activeId === item.id}><img src={item.url} alt="" width={80} height={64} loading="lazy" /></Action>)}</div></section>}
  </section>;
}

export function Create(props: StudioProps) {
  return <div className="is-create-layout"><div id="is-editor"><Editor key={props.state.tab} {...props} /></div>
    <div id="is-canvas"><Canvas state={props.state} /></div></div>;
}
