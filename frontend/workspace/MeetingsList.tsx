import { useState } from 'react';
import { Icon } from '../shared/Brand';

interface Meeting {
  id: string;
  title?: string;
  status: string;
  createdAt: string;
  participants?: unknown[];
  mom?: {
    summary?: string;
    topics?: Array<{ title?: string; notes?: string }>;
    actionItems?: Array<{ task: string; owner?: string }>;
  };
}

export interface MeetingLaunchProps {
  capacity: { active: number; maximum: number };
  loading: boolean;
  error: string;
  draftUrl?: string;
  draftConsent?: boolean;
  onSubmit: (form: HTMLFormElement) => void;
}

export type MeetingDestination = 'overview' | 'mom' | 'transcript';
export interface MeetingsListProps extends MeetingLaunchProps {
  meetings: Meeting[];
  loadingList: boolean;
  preview?: Meeting | null;
  statusText: (status: string) => string;
  isActive: (status: string) => boolean;
  onOpen: (id: string, destination: MeetingDestination) => void;
  onNew: () => void;
  onRefresh: () => void;
}

export function MeetingLaunch({ capacity, loading, error, draftUrl, draftConsent, onSubmit }: MeetingLaunchProps) {
  return <>
    <div className="meeting-card-heading"><span className="feature-icon"><Icon name="video" /></span>
      <div><h2>Join a Teams meeting</h2><p>The organizer must admit the bot from the lobby.</p></div>
    </div>
    <form id="meeting-form" onSubmit={event => { event.preventDefault(); onSubmit(event.currentTarget); }}>
      <label className="meeting-url"><span>Microsoft Teams link</span>
        <input name="meetingUrl" type="text" inputMode="url" required defaultValue={draftUrl}
          placeholder="https://teams.microsoft.com/meet/..." />
      </label>
      <div className="bot-identity"><span><Icon name="chip" /></span>
        <div><small>BOT DISPLAY NAME</small><b>PTCL AI NOTETAKER</b></div>
      </div>
      <label className="consent-check"><input name="consent" type="checkbox" required defaultChecked={draftConsent} />
        <span>I confirm that participants will be informed and recording is permitted for this meeting.</span>
      </label>
      {error && <p className="meeting-error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={loading}><Icon name="video" />{loading ? 'Starting bot…' : 'Join meeting now'}</button>
    </form>
    <p className="ref-capacity">{capacity.active} of {capacity.maximum} meeting slots active</p>
  </>;
}

function Preview({ meeting, status, onOpen }: {
  meeting: Meeting;
  status: string;
  onOpen: MeetingsListProps['onOpen'];
}) {
  const { mom, id } = meeting;
  const topics = mom?.topics ?? [];
  const actions = mom?.actionItems ?? [];
  return <>
    <h2>{meeting.title || 'Microsoft Teams meeting'}</h2>
    <div className="ref-meeting-meta">
      <span><Icon name="clock" />{new Date(meeting.createdAt).toLocaleString()}</span>
      <span className={`meeting-status ${meeting.status}`}>{status}</span>
    </div>
    <div className="ref-meeting-preview-actions"><span>{meeting.participants?.length ?? 0} participants</span>
      <button className="primary" type="button" onClick={() => onOpen(id, 'overview')}><Icon name="file" />View meeting</button>
    </div>
    <div className="tabs">
      <button type="button" className="active" onClick={() => onOpen(id, 'mom')}>Summary</button>
      <button type="button" onClick={() => onOpen(id, 'mom')}>Action Items</button>
      <button type="button" onClick={() => onOpen(id, 'transcript')}>Transcript</button>
    </div>
    <h3><Icon name="bulb" />Key Discussion Points</h3>
    {topics.length ? <ol className="ref-discussion-points">{topics.slice(0, 4).map((topic, index) =>
      <li key={index}><b>{topic.title}</b><p>{topic.notes}</p></li>)}</ol>
      : <p className="ref-analysis-note">{mom?.summary || 'Open this meeting to see its transcript, recording and meeting minutes.'}</p>}
    <h3><Icon name="check" />Action Items</h3>
    {actions.length ? actions.slice(0, 4).map((action, index) =>
      <div key={index} className="ref-preview-action"><Icon name="check" /><span>{action.task}</span><small>{action.owner || 'Unassigned'}</small></div>)
      : <p className="ref-analysis-note">Action items appear after meeting minutes have been generated.</p>}
  </>;
}

export function MeetingsList(props: MeetingsListProps) {
  const { meetings, loadingList, error, statusText, isActive, onOpen, onNew, onRefresh } = props;
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const preview = props.preview ?? meetings[0];
  return <>
    <div className="ref-meetings-heading"><div><h1>Meeting Intelligence</h1><p>Capture. Understand. Act.</p></div>
      <button type="button" className="primary" onClick={onNew}><Icon name="plus" />New Meeting</button>
    </div>
    <div className="ref-meetings-layout">
      <section>
        <div className="ref-meeting-filters"><b>All Meetings</b><a href="#history">My conversations</a></div>
        <section className="panel ref-meeting-list">
          <label className="ref-search"><Icon name="search" />
            <input id="ref-meeting-search" placeholder="Search meetings..." aria-label="Search meetings"
              value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <div className="meeting-list">{meetings.length ? meetings.map(meeting => {
            const title = meeting.title || 'Microsoft Teams meeting';
            const status = statusText(meeting.status);
            const date = new Date(meeting.createdAt).toLocaleString();
            const badge = isActive(meeting.status) ? 'Live' : status;
            const visible = [title, status, date, badge].some(value => value.toLowerCase().includes(term));
            return visible && <button key={meeting.id} type="button" className="meeting-row" onClick={() => onOpen(meeting.id, 'overview')}>
              <span className="meeting-platform">T</span><span><b>{title}</b><small>{date} · {status}</small></span>
              <span className={`meeting-status ${meeting.status}`}><i />{badge}</span><Icon name="chevron" />
            </button>;
          }) : <div className="ref-empty"><span className="feature-icon"><Icon name="video" /></span>
            <h2>{loadingList ? 'Loading meetings…' : error ? 'Meetings unavailable' : 'No meetings yet'}</h2>
            <p>Recorded Teams meetings and their summaries will appear here.</p>
          </div>}</div>
          <button type="button" className="outline" onClick={onRefresh}><Icon name="history" />Refresh meetings</button>
        </section>
      </section>
      <section className="panel ref-meeting-preview"><div className="ref-meeting-cover" />
        {preview ? <><Preview meeting={preview} status={statusText(preview.status)} onOpen={onOpen} />
          {error && <p role="alert" className="meeting-error">{error}</p>}</> : <MeetingLaunch {...props} />}
      </section>
    </div>
  </>;
}
