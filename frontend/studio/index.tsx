import { createRoot, type Root } from 'react-dom/client';
import { Icon } from '../shared/Brand';
import { Action } from './controls';
import { Create } from './Create';
import { Gallery } from './Gallery';
import { Analyze } from './Analyze';
import { StudioDialogs } from './Dialogs';
import type { StudioProps } from './types';

const tabs = [['create', 'spark', 'Create'], ['remix', 'sliders', 'Remix'], ['gallery', 'grid', 'Gallery'], ['analyze', 'eye', 'Analyze']] as const;

function Studio(props: StudioProps) {
  const { state, announcement } = props;
  return <>
    <header className="is-header"><div><h1>Image Studio<span className="is-title-dot" /></h1></div>
      <details className="is-menu is-model-menu"><summary className="is-button is-model-info"><Icon name="chip" /> Studio info <Icon name="chevron" /></summary>
        <div className="is-menu-list"><strong>{state.capabilities?.model || 'Image engine'}</strong>
          <p>{state.capabilities?.message || state.capabilityError || 'Checking engine availability…'}</p>
          <small>Output dimensions depend on the selected format. Generation may take several minutes.</small>
          <Action action="refresh-capabilities" className="is-text-button">Refresh connection</Action></div></details></header>
    <nav className="is-nav" role="tablist" aria-label="Image Studio">{tabs.map(([id, icon, label]) => <Action key={id} action="tab" role="tab"
      id={`is-tab-${id}`} aria-selected={state.tab === id} aria-controls="is-panel" tabIndex={state.tab === id ? 0 : -1} data-tab={id}>
      <Icon name={icon} />{label}{id === 'gallery' && state.assets.length > 0 && <span>{state.assets.length}</span>}
    </Action>)}</nav>
    <section id="is-panel" role="tabpanel" aria-labelledby={`is-tab-${state.tab}`} tabIndex={0}>
      {state.tab === 'gallery' ? <Gallery {...props} /> : state.tab === 'analyze' ? <Analyze {...props} /> : <Create {...props} />}
    </section>
    <div className="is-sr-only" id="is-announcement" role="status" aria-live="polite">{announcement}</div>
    {props.dialog && <StudioDialogs key={props.dialog.key} {...props} />}
  </>;
}

let root: Root | undefined;
let host: HTMLElement | undefined;

export const imageStudioPages = {
  unmount() { root?.unmount(); root = undefined; host = undefined; },
  mount(container: HTMLElement, props: StudioProps) {
    if (host !== container) {
      this.unmount();
      host = container;
      root = createRoot(container);
    }
    root?.render(<Studio {...props} />);
  },
};
