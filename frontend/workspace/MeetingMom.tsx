import { useEffect, useRef, useState } from 'react';
import { Icon } from '../shared/Brand';
import type { Meeting } from '../../src/models';
import { copyMeetingReport, downloadMeetingReport, openMeetingReport } from './meetingReport';

export interface MomActions {
  onGenerate: () => void;
  onSave: (form: HTMLFormElement) => void;
  notify: (message: string) => void;
}

export function MeetingMom({ meeting, actions }: { meeting: Meeting; actions: MomActions }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const { mom, status } = meeting;
  if (!mom) return <section className="panel meeting-empty mom-empty"><span><Icon name="spark" /></span>
    <h3>{status === 'processing' ? 'Preparing Minutes of Meeting' : 'MOM is not available'}</h3>
    <p>{status === 'processing' ? 'CloudCore AI is reviewing the final transcript.' : 'Finish the meeting, then generate the MOM from its transcript.'}</p>
    {['completed', 'failed'].includes(status) && <button type="button" className="primary" onClick={actions.onGenerate}>Generate MOM</button>}
  </section>;

  const fields = [
    ['attendees', 'Attendees', 'One name per line', mom.attendees ?? []],
    ['topics', 'Topics', 'Title | Notes', (mom.topics ?? []).map(item => typeof item === 'string' ? item : `${item.title} | ${item.notes}`)],
    ['decisions', 'Decisions', 'One decision per line', (mom.decisions ?? []).map(item => typeof item === 'string' ? item : item.decision)],
    ['actionItems', 'Action items', 'Task | Owner | Due date', (mom.actionItems ?? []).map(item => `${item.task} | ${item.owner || ''} | ${item.dueDate || ''}`)],
    ['risks', 'Risks', '', mom.risks ?? []],
    ['openQuestions', 'Open questions', '', mom.openQuestions ?? []],
  ] as const;
  return <form id="mom-form" className="panel mom-editor" onSubmit={event => { event.preventDefault(); actions.onSave(event.currentTarget); }}>
    <div className="mom-toolbar"><div><span className="eyebrow">MINUTES OF MEETING</span><h2>Review and edit</h2></div>
      <button type="button" className={`outline${copied ? ' cc-pulse-ok' : ''}`} onClick={async event => {
        try {
          await copyMeetingReport(meeting, event.currentTarget.form);
          setCopied(true);
          clearTimeout(copyTimer.current);
          copyTimer.current = setTimeout(() => setCopied(false), 1500);
          actions.notify('MOM copied to clipboard.');
        } catch { actions.notify('Could not copy meeting minutes.'); }
      }}>{copied ? <span className="cc-icon-swapped" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669' }}><Icon name="check" /> Copied</span> : 'Copy'}</button>
      <button type="button" className="outline" onClick={event => downloadMeetingReport(meeting, event.currentTarget.form)}><Icon name="download" /> Markdown</button>
      <button type="button" className="outline" onClick={event => openMeetingReport(meeting, event.currentTarget.form, true)}><Icon name="arrow" /> Preview Report</button>
      <button type="button" className="primary" onClick={event => openMeetingReport(meeting, event.currentTarget.form)}><Icon name="download" /> Download PDF / Print</button>
      <button className="primary" type="submit">Save changes</button>
    </div>
    <label>Executive summary<textarea name="summary" required defaultValue={mom.summary} /></label>
    <div className="mom-form-grid">{fields.map(([name, label, hint, values]) => <label key={name}>{label}
      {hint && <small>{hint}</small>}<textarea name={name} defaultValue={values.join('\n')} />
    </label>)}</div>
  </form>;
}
