import { Icon } from '../shared/Brand';
import { Markdown } from '../shared/Markdown';
import { Action, ErrorMessage } from './controls';
import type { StudioProps } from './types';

const examples = [['Telecom tower', 'assets/example-tower.png'], ['Data center', 'assets/example-datacenter.png'], ['Satellite map', 'assets/example-map.png']];

export function Analyze({ state }: StudioProps) {
  const { source, example, loading, error, result, kind } = state.analyze;
  return <section className="is-analyze">
    <div className="is-gallery-heading"><div><h2>A closer look.</h2><p>Explore an image, understand its details, and inspect visible text.</p></div></div>
    {source ? <div className="is-analysis-layout"><section className="is-analysis-source"><div className="is-section-heading"><h3>Your image</h3>
      <Action action="choose-analyze" className="is-text-button">Replace</Action><Action action="remove-analysis" className="is-text-button">Remove</Action></div>
      <img src={source.url} alt="Selected image for analysis" /><p>{source.name || 'Selected image'}</p>
      {example && <span className="is-example-label">Example image · analysis is generated on request</span>}
      <Action action="analyze" className="is-primary" disabled={loading}><Icon name="spark" /> {loading ? 'Analyzing…' : 'Analyze image'}</Action>
    </section><section className="is-analysis-report" aria-busy={loading}><div className="is-section-heading"><h3>Image report</h3>
      {result && <Action action="copy-report" className="is-text-button"><Icon name="file" /> Copy</Action>}</div>
      <ErrorMessage message={error} />
      {loading ? <div className="is-report-placeholder"><span className="is-breathing"><Icon name="spark" /></span><h3>Analyzing image…</h3></div>
        : result ? <><span className="is-analysis-kind">{kind === 'metadata' ? 'File and metadata inspection · not visual recognition or OCR' : 'AI visual analysis · review for accuracy'}</span>
          <Markdown className="is-report-body" text={result} /><Action action="clear-report" className="is-text-button">Clear report</Action>
        </> : <div className="is-report-placeholder"><Icon name="eye" /><p>Select Analyze image to generate a report.</p></div>}
    </section></div> : <>
      <div className="is-dropzone is-analysis-dropzone" data-studio-drop="analyze"><span className="is-upload-mark"><Icon name="upload" /></span>
        <h3>Choose an image to analyze</h3><p>Drop it here, or choose a file.</p><Action action="choose-analyze" className="is-primary"><Icon name="plus" /> Choose image</Action>
        <small>JPG, PNG, WEBP · up to 20 MB</small></div>
      <ErrorMessage message={error} /><div className="is-analysis-secondary"><Action action="url" className="is-text-button"><Icon name="link" /> Use an image URL</Action>
        <span>or explore an example</span><div className="is-examples">{examples.map(([title, url]) => <Action key={title} action="example" className="is-example"
          data-name={title} data-url={url}><img src={url} width={48} height={40} alt="" /><span>{title}</span><Icon name="arrow" /></Action>)}</div></div>
    </>}
    <input type="file" id="is-analyze-upload" className="is-sr-only" accept="image/png,image/jpeg,image/webp" data-studio-upload="analyze" tabIndex={-1} />
  </section>;
}
