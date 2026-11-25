import { useEffect, useMemo, useState } from 'react';
import { manualFilingName, sharedReferences, type FilingAction, type FilingEntry } from '../../src/knowledge-filing';
import { Icon } from '../shared/Brand';
import type { ApiClient } from '../shared/types';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';

const BASE = '/api/knowledge/filing';
const labels: Record<FilingAction, string> = { move: 'Suggested moves', review: 'Needs review', keep: 'Well placed' };
const statuses = ['move', 'review', 'keep'] as const;
interface Audit {
  entries: FilingEntry[];
  customers: Array<{ name: string; id: string; path: string[]; aliases: string[]; confirmedAliases: string[] }>;
}

export function KnowledgeFiling({ request, onClose, onChanged, onArchive, importIds }: {
  request: ApiClient; onClose: () => void; onChanged: (message: string, ids: string[]) => void;
  onArchive: (id: string) => Promise<void>; importIds?: string[];
}) {
  const [audit, setAudit] = useState<Audit>();
  const [status, setStatus] = useState<FilingAction>('move');
  const [customer, setCustomer] = useState('');
  const [location, setLocation] = useState('');
  const [term, setTerm] = useState('');
  const [onlyImport, setOnlyImport] = useState(Boolean(importIds?.length));
  const [selected, setSelected] = useState<Record<string, { destination: string; revision: string; confirmed?: true; manual?: true }>>({});
  const [manual, setManual] = useState<{ id: string; name: string }>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [limit, setLimit] = useState(30);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const requestController = new AbortController();
    request<Audit>(BASE, { signal: requestController.signal })
      .then(result => { if (!requestController.signal.aborted) setAudit(result); })
      .catch(problem => { if (!requestController.signal.aborted) setError(problem.message); });
    return () => requestController.abort();
  }, [reload, request]);

  const entries = useMemo(() => {
    const imported = new Set(importIds);
    return (audit?.entries ?? []).filter(item => !onlyImport || imported.has(item.id));
  }, [audit, importIds, onlyImport]);
  const counts = { move: 0, review: 0, keep: 0 };
  for (const item of entries) counts[item.action]++;
  const customers = [...new Set(entries.flatMap(item => item.customer ? [item.customer] : []))].sort();
  const locations = [...new Set(entries.flatMap(item => [item.region, item.site].filter(Boolean) as string[]))].sort();
  const rows = entries.filter(item => item.action === status && (!customer || item.customer === customer) &&
    (!location || item.region === location || item.site === location) &&
    (!term || [...item.source, item.filename, item.customer, ...item.destination ?? []].join(' ').toLowerCase().includes(term.trim().toLowerCase())));
  const approvals = Object.entries(selected).map(([id, approval]) => ({ id, ...approval }));
  const currentCustomer = audit?.customers.find(item => item.name === customer);
  const unverifiedAliases = currentCustomer?.aliases.filter(alias => alias !== customer && !currentCustomer.confirmedAliases.includes(alias)) ?? [];
  const selectable = status === 'review' ? [] : rows.filter(entry =>
    (entry.action === 'move' || entry.canConsolidate) && entry.destination?.[1] && !selected[entry.id]);

  async function apply() {
    setPending(true);
    setError('');
    try {
      const { movedIds, staleIds } = await request<{ movedIds: string[]; staleIds: string[] }>(BASE, {
        method: 'POST', body: JSON.stringify({ approvals }),
      });
      setSelected({});
      setManual(undefined);
      const message = `${movedIds.length} files moved.` + (staleIds.length ? ` ${staleIds.length} could not be moved. Review the refreshed suggestions.` : '');
      setNotice(message);
      if (movedIds.length) onChanged(message, movedIds);
      setReload(value => value + 1);
    } catch (problem) { setError((problem as Error).message); }
    finally { setPending(false); }
  }

  async function recover(entry: FilingEntry) {
    setPending(true);
    setError('');
    try {
      if (entry.recovery === 'archive') await onArchive(entry.id);
      else {
        await request('/api/knowledge/documents/' + entry.id + '/reindex', { method: 'POST' });
        setNotice('PDF queued for indexing. Refresh the review after processing finishes.');
        setReload(value => value + 1);
      }
    } catch (problem) { setError((problem as Error).message); }
    finally { setPending(false); }
  }

  return <WorkspaceDialog labelledBy="kh-filing-title" className="knowledge-import-dialog kh-filing-dialog" onClose={onClose} pending={pending}>
    <div className="ref-modal-box knowledge-import-box">
      <header className="knowledge-import-header">
        <span className="knowledge-import-hero-icon"><Icon name="folder" /></span>
        <div><h2 id="kh-filing-title">Customer filing review</h2><p>Cloud Contracts · Review the evidence before moving files</p></div>
        <button type="button" className="knowledge-import-close" aria-label="Close filing review" disabled={pending} onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="knowledge-import-body kh-filing-body">
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {!audit && !error && <p role="status">Checking folders and extracted text…</p>}
        {audit && <>
          <nav className="kh-filing-tabs" aria-label="Filing status">
            {statuses.map(action => <button key={action} type="button" className="kh-button" aria-pressed={status === action}
              onClick={() => { setStatus(action); setLimit(30); }}>{labels[action]} <strong>{counts[action]}</strong></button>)}
          </nav>
          <div className="kh-filing-filters">
            <input type="search" aria-label="Filter suggestions by name" placeholder="Find a file or customer" value={term} onChange={event => { setTerm(event.target.value); setLimit(30); }} />
            <select aria-label="Customer" value={customer} onChange={event => { setCustomer(event.target.value); setLimit(30); }}>
              <option value="">All customers</option>{customers.map(name => <option key={name}>{name}</option>)}
            </select>
            <select aria-label="Region or site" value={location} onChange={event => { setLocation(event.target.value); setLimit(30); }}>
              <option value="">All regions and sites</option>{locations.map(name => <option key={name}>{name}</option>)}
            </select>
          </div>
          {importIds?.length ? <label><input type="checkbox" checked={onlyImport} onChange={event => { setOnlyImport(event.target.checked); setCustomer(''); setLocation(''); }} /> This import only</label> : null}
          {unverifiedAliases.length > 0 && <p className="kh-muted">Folder name variants to verify · {unverifiedAliases.join(', ')}</p>}
          {Boolean(currentCustomer?.confirmedAliases.length) &&
            <p className="kh-muted">Confirmed aliases · {currentCustomer?.confirmedAliases.join(', ')}</p>}
          {status === 'keep' && <p className="kh-muted">These files are already together. Select them here if you want to bring them into the main customer list.</p>}
          {customer && selectable.length > 0 && <div><button type="button" className="kh-button" disabled={pending || approvals.length >= 100} onClick={() => {
            const additions = selectable.slice(0, 100 - approvals.length).map(entry =>
              [entry.id, { destination: entry.destination![1]!, revision: entry.revision }]);
            setSelected(previous => ({ ...previous, ...Object.fromEntries(additions) }));
          }}>Select {Math.min(selectable.length, 100 - approvals.length)} for {customer}</button></div>}
          {rows.length === 0 && <p>No files in this view.</p>}
          <datalist id="kh-filing-customer-options">
            <option value={sharedReferences} />{audit.customers.map(item => <option key={item.id} value={item.name} />)}
          </datalist>
          <ol className="kh-filing-list">
            {rows.slice(0, limit).map(entry => {
              const destination = entry.destination?.[1];
              const movable = destination && (entry.action === 'move' || entry.canConsolidate || entry.canConfirm);
              return <li key={entry.id}>
                {movable && !selected[entry.id]?.manual && <input type="checkbox" aria-label={'Approve ' + entry.filename} checked={Boolean(selected[entry.id])}
                  disabled={pending || (!selected[entry.id] && approvals.length >= 100)} onChange={event => {
                    const checked = event.target.checked;
                    setSelected(existing => {
                      const next = { ...existing };
                      if (checked) next[entry.id] = { destination, revision: entry.revision, confirmed: entry.canConfirm ? true : undefined };
                      else delete next[entry.id];
                      return next;
                    });
                  }} />}
                <div>
                  <a href={'/api/knowledge/documents/' + entry.id + '/view'} target="_blank" rel="noreferrer">{entry.filename}</a>
                  <p className="kh-muted">{[entry.documentType, entry.customer, entry.region, entry.site, entry.duplicate].filter(Boolean).join(' · ')}</p>
                  <p><span className="kh-muted">Current</span> {entry.source.join(' / ') || 'Shared root'}</p>
                  {entry.destination && <p><span className="kh-muted">{entry.action === 'keep' ? 'Customer folder' : 'Suggested'}</span> {entry.destination.join(' / ')}</p>}
                  <p>{entry.reason}</p>
                  {entry.canConfirm && <p className="kh-muted">Open the original. Select this file only after confirming the customer.</p>}
                  {entry.evidence && <blockquote><strong>{entry.evidence.section}</strong> {entry.evidence.excerpt}</blockquote>}
                  {entry.recovery && <button type="button" className="kh-button" disabled={pending} onClick={() => void recover(entry)}>
                    {entry.recovery === 'archive' ? 'Preview archive contents' : 'Retry PDF indexing'}
                  </button>}
                  {selected[entry.id]?.manual && <div className="kh-filing-filters">
                    <span className="kh-muted">Selected for filing in {selected[entry.id]?.destination}</span>
                    <button type="button" className="kh-button" disabled={pending} onClick={() => {
                      setSelected(previous => {
                        const next = { ...previous };
                        delete next[entry.id];
                        return next;
                      });
                    }}>Remove from selection</button>
                  </div>}
                  {entry.canFileManually && manual?.id !== entry.id && <button type="button" className="kh-button" disabled={pending}
                    onClick={() => setManual({ id: entry.id, name: selected[entry.id]?.destination ?? entry.customer ?? '' })}>
                    Choose customer after reviewing original
                  </button>}
                  {manual?.id === entry.id && <div className="kh-filing-filters">
                    <input aria-label={'Customer folder for ' + entry.filename} placeholder="Existing or new customer folder"
                      list="kh-filing-customer-options" maxLength={120} value={manual.name}
                      onChange={event => setManual({ id: entry.id, name: event.target.value })} />
                    <button type="button" className="kh-button" disabled={pending || (!selected[entry.id] && approvals.length >= 100) || !manualFilingName(manual.name)}
                      onClick={() => {
                        const name = manualFilingName(manual.name);
                        if (!name) return;
                        setSelected(previous => ({ ...previous, [entry.id]: {
                          destination: name, revision: entry.revision, confirmed: true, manual: true,
                        } }));
                        setManual(undefined);
                      }}>Confirm customer</button>
                    <button type="button" className="kh-button" onClick={() => setManual(undefined)}>Cancel</button>
                  </div>}
                </div>
              </li>;
            })}
          </ol>
          {rows.length > limit && <button type="button" className="kh-button" onClick={() => setLimit(value => value + 30)}>Show more ({rows.length - limit} left)</button>}
        </>}
      </div>
      <footer className="dialog-actions knowledge-import-actions">
        {approvals.length > 0 && <button type="button" className="outline small" disabled={pending} onClick={() => setSelected({})}>Clear selection</button>}
        <button type="button" className="outline small" disabled={pending} onClick={() => { setError(''); setReload(value => value + 1); }}>Refresh review</button>
        <button type="button" className="primary small" disabled={pending || !approvals.length} onClick={() => void apply()}>
          {pending ? 'Working…' : 'Approve and move' + (approvals.length ? ' ' + approvals.length : '')}
        </button>
      </footer>
    </div>
  </WorkspaceDialog>;
}
