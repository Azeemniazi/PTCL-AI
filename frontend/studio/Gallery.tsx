import * as studioModel from './model';
import { Icon } from '../shared/Brand';
import { Action, AssetActions, Menu, styleLabel } from './controls';
import { type StudioProps } from './types';

export function Gallery({ state, onQuery, onFilter, onSelect }: StudioProps) {
  const { assets, query, filter, selected, selectionMode, historyStatus, historyError } = state;
  const filtered = query || filter !== 'all';
  const model = studioModel;
  const list = model.filterAssets(assets, query, filter);
  return <section className="is-gallery">
    <div className="is-gallery-heading"><div><h2>Your visual library</h2><p>Find, reuse, or organize your images.</p></div>
      <Action action="create">Create an image <Icon name="plus" /></Action></div>
    <div className="is-gallery-tools"><label className="is-search"><Icon name="search" /><input type="search" id="is-gallery-query"
      aria-label="Search your images" placeholder="Search by prompt or style…" value={query} onChange={event => onQuery(event.target.value)} /></label>
      <label className="is-filter"><span className="is-sr-only">Filter by style</span><select value={filter} onChange={event => onFilter(event.target.value)}>
        <option value="all">All styles</option>{model.styles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label><Action action="select-mode" aria-pressed={selectionMode}><Icon name="check" /> {selectionMode ? 'Done' : 'Select'}</Action></div>
    <div id="is-gallery-results">
      {historyStatus === 'loading' && !assets.length ? <div className="is-gallery-grid" aria-label="Loading images" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="is-skeleton" />)}</div>
        : historyStatus === 'error' ? <div className="is-empty-library"><Icon name="help" /><h3>Your library couldn’t load</h3>
          <p>{historyError}</p><Action action="reload-history">Try again</Action></div> : <>
          {selected.size > 0 && <div className="is-selection-bar" role="region" aria-label="Selected image actions"><b>{selected.size} selected</b><div>
            <Action action="save-selected"><Icon name="folder" /> Save to Hub</Action>
            <Action action="delete-selected" className="is-button is-danger"><Icon name="trash" /> Delete</Action>
            <Action action="deselect" className="is-text-button">Clear</Action></div></div>}
          <p className="is-result-count" role="status">{list.length} image{list.length === 1 ? '' : 's'}{filtered ? ' found' : ''}</p>
          {list.length ? <div className="is-gallery-grid">{list.map(asset => <article key={asset.id}
            className={`is-gallery-card ${selected.has(asset.id) ? 'is-card-selected' : ''} ${selectionMode ? 'is-selecting' : ''}`}>
            <label className="is-card-check"><input type="checkbox" aria-label={`Select image: ${asset.prompt}`} checked={selected.has(asset.id)}
              onChange={event => onSelect(asset.id, event.target.checked)} /></label>
            <Action action="view" className="is-gallery-preview" data-id={asset.id} aria-label={`View image: ${asset.prompt}`}>
              <img src={asset.url} alt="" width={asset.width} height={asset.height} loading="lazy" /></Action>
            <div className="is-card-caption"><p>{asset.prompt}</p><footer><span>{styleLabel(asset.style)} · {asset.aspectRatio}</span>
              <Menu><AssetActions asset={asset} /><Action action="delete" data-id={asset.id} className="is-menu-item is-danger"><Icon name="trash" /> Delete image</Action></Menu>
            </footer></div>
          </article>)}</div> : <div className="is-empty-library"><Icon name="image" />
            <h3>{filtered ? 'No images match.' : 'No saved images yet.'}</h3>
            <p>{filtered ? 'Try another search or clear your filters.' : 'Images you create appear here.'}</p>
            <Action action={filtered ? 'clear-filters' : 'create'}>{filtered ? 'Clear filters' : 'Create an image'}</Action></div>}
        </>}
    </div>
  </section>;
}
