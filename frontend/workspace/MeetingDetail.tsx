import { useState } from 'react';
import type { Meeting, Participant, TranscriptSegment } from '../../src/models';
import { Icon } from '../shared/Brand';
import { MeetingChat, type MeetingMessage } from './MeetingChat';
import { useFollowScroll } from '../shared/useFollowScroll';
import { MeetingMom, type MomActions } from './MeetingMom';

const tabs = [
  ['overview', 'Overview'], ['mom', 'MOM'], ['transcript', 'Transcript'],
  ['snapshots', 'Snapshots'], ['chat', 'AI Assistant Q&A'], ['audio', 'Audio'],
] as const;
export type MeetingTab = typeof tabs[number][0];

export interface MeetingDetailProps {
  meeting?: Meeting | null;
  tab: MeetingTab;
  error: string;
  status: string;
  active: boolean;
  chat: MeetingMessage[];
  chatBusy: boolean;
  momActions: MomActions;
  formatTime: (ms: number) => string;
  onTab: (tab: MeetingTab) => void;
  onStop: () => void;
  onDelete: () => void;
  onCapture: () => Promise<void>;
  onChat: (text: string) => void;
}

function Live({ children }: { children: string }) {
  return <span className="live-pill"><span className="pulse-dot" /> {children}</span>;
}

function Transcript({ entries, query, onQuery, formatTime, active }: {
  entries: TranscriptSegment[];
  query: string;
  onQuery: (value: string) => void;
  formatTime: MeetingDetailProps['formatTime'];
  active: boolean;
}) {
  const scroll = useFollowScroll();
  const term = query.trim().toLowerCase();
  const filtered = term ? entries.filter(entry => entry.text?.toLowerCase().includes(term) || entry.speakerName?.toLowerCase().includes(term)) : entries;
  return <section className="panel transcript-panel">
    <div className="transcript-toolbar"><div className="transcript-search"><Icon name="search" />
      <input id="transcript-filter" type="search" placeholder="Search transcript or speaker..." value={query}
        aria-label="Search transcript" onChange={event => onQuery(event.target.value)} />
    </div><div className="transcript-meta-strip">{active && <Live>Live Transcribing</Live>}
      <span>{filtered.length} of {entries.length} segments</span></div></div>
    <div className="transcript-list" {...scroll}>
      {filtered.length ? filtered.map((entry, index) => <article key={entry.id ?? index}>
        <time>{formatTime(entry.startMs)}</time><div><span className="speaker-tag"><Icon name="user" />{entry.speakerName || 'Participant'}</span>
          <p>{entry.text}</p></div>
      </article>) : <div className="meeting-empty"><span><Icon name="chat" /></span>
        <h3>{term ? 'No matching transcript segments' : 'Transcript not available yet'}</h3>
        <p>{term ? 'Try searching with different terms.' : 'Live segments appear here while the bot is recording.'}</p>
      </div>}
    </div>
  </section>;
}

function Snapshots({ meeting, active, formatTime, onCapture }: {
  meeting: Meeting;
  active: boolean;
  formatTime: MeetingDetailProps['formatTime'];
  onCapture: MeetingDetailProps['onCapture'];
}) {
  const [imageVersion, setImageVersion] = useState(Date.now);
  const [imageFailed, setImageFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const base = `/api/meetings/${encodeURIComponent(meeting.id)}`;
  const snapshots = meeting.snapshots ?? [];
  return <section className="panel snapshot-section">
    <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div><h2 style={{ fontSize: 18, margin: 0 }}>Meeting Screens &amp; Snapshots</h2>
        <p style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12 }}>Live display from Teams bot and periodic screen captures.</p></div>
      {active && <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="primary" disabled={capturing} onClick={async () => {
          setCapturing(true);
          try { await onCapture(); } finally { setCapturing(false); }
        }}><Icon name={capturing ? 'spark' : 'image'} /> {capturing ? 'Capturing…' : 'Capture Snapshot'}</button>
        <button type="button" className="outline" onClick={() => { setImageFailed(false); setImageVersion(Date.now()); }}>
          <Icon name="history" /> Refresh Live Screen</button>
      </div>}
    </div>
    {active && !imageFailed && <div className="live-bot-frame">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Live>Live Bot View (Teams Display)</Live><small style={{ color: 'var(--muted)', fontSize: 11 }}>Vexa Screen Stream · Display :99.0</small>
      </div>
      <div className="live-screen-wrap"><img id="live-bot-screen-img" src={`${base}/live-screenshot?t=${imageVersion}`}
        alt="Live bot screen view" onError={() => setImageFailed(true)} /></div>
    </div>}
    <div className="snapshot-grid">{snapshots.length ? snapshots.map(snapshot => <figure className="snapshot-card" key={snapshot.id}>
      <img src={`${base}/snapshots/${encodeURIComponent(snapshot.id)}`} alt={`Screen snapshot at ${formatTime(snapshot.capturedAtMs)}`} />
      <figcaption><span><Icon name="image" /> Shared Screen</span><time style={{ marginLeft: 'auto' }}>{formatTime(snapshot.capturedAtMs)}</time></figcaption>
    </figure>) : !active && <div className="meeting-empty"><span><Icon name="image" /></span><h3>No snapshots captured yet</h3>
      <p>Screenshots taken during the session will appear here.</p></div>}</div>
  </section>;
}

function Audio({ meeting, active }: { meeting: Meeting; active: boolean }) {
  const url = `/api/meetings/${encodeURIComponent(meeting.id)}/audio`;
  return <section className="panel audio-panel"><span className="feature-icon"><Icon name="signal" /></span>
    <h2>Meeting Audio Recording</h2><p>Private encrypted recording stored securely. Accessible only to authorized CloudCore workspace members.</p>
    {active && <div className="audio-recording-notice"><Live>Live Audio Recording In Progress</Live>
      <p>Teams bot is streaming and capturing 48kHz audio directly from the call. Full playback and export download are unlocked as soon as the meeting ends.</p></div>}
    {meeting.recordingObjectKey ? <div className="audio-player-wrap"><audio controls preload="metadata" src={url} />
      <div className="audio-meta"><span><Icon name="signal" /> WebM Opus · 48kHz Stereo</span>
        <a className="outline audio-download-btn" href={url} download={`${meeting.title || 'meeting'}-audio.webm`}><Icon name="download" /> Download Audio</a></div>
    </div> : !active && <div className="meeting-empty"><span><Icon name="signal" /></span><h3>Audio not available</h3>
      <p>Audio recording is only saved for meetings with recording enabled.</p></div>}
  </section>;
}

function Overview({ meeting, status, active, formatTime, onTab }: {
  meeting: Meeting;
} & Pick<MeetingDetailProps, 'status' | 'active' | 'formatTime' | 'onTab'>) {
  const participants: (Participant & { speakerId?: string })[] = meeting.participants ?? [];
  const recent = (meeting.transcript ?? []).slice(-3);
  const metrics = [
    ['clock', 'Status', status], ['users', 'Participants', participants.length],
    ['chat', 'Transcript segments', meeting.transcript?.length ?? 0], ['image', 'Snapshots', meeting.snapshots?.length ?? 0],
  ] as const;
  return <div className="meeting-overview">
    <section className="panel overview-metrics">{metrics.map(([icon, label, value]) => <div key={label}>
      <span><Icon name={icon} /></span><small>{label}</small><b>{value}</b></div>)}</section>
    {recent.length > 0 && <section className="panel live-preview-strip" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{active ? <Live>Real-time Speech</Live> : <Icon name="spark" />}
          <h3 style={{ fontSize: 14, margin: 0 }}>Recent Discussion</h3></div>
        <button type="button" className="outline small" onClick={() => onTab('chat')}><Icon name="spark" /> Ask AI about this</button>
      </div>
      <div className="recent-segments">{recent.map((entry, index) => <div className="recent-seg" key={entry.id ?? index}>
        <time>{formatTime(entry.startMs)}</time><strong>{entry.speakerName || 'Speaker'}:</strong><span>{entry.text}</span></div>)}</div>
    </section>}
    <section className="panel participant-panel"><div className="panel-heading"><Icon name="users" /><h2>Meeting Participants</h2></div>
      {participants.length ? participants.map(participant => <div className="participant-row" key={participant.id}>
        <span>{(participant.displayName || 'U').charAt(0).toUpperCase()}</span><div><b>{participant.displayName || 'Participant'}</b>
          {participant.speakerId && <small style={{ display: 'block', color: '#75867e' }}>ID: {participant.speakerId}</small>}</div>
        <span className={`p-status ${participant.leftAt ? 'left' : 'active'}`}>{!participant.leftAt && <i />}{participant.leftAt ? 'Left' : 'In meeting'}</span>
      </div>) : <div className="meeting-empty">Participant details appear after the bot is admitted.</div>}
    </section>
    <section className="panel privacy-panel"><h2><Icon name="shield" /> Recording &amp; Privacy Controls</h2>
      <p>Audio and transcript expire on {new Date(meeting.expiresAt).toLocaleDateString()}. The Teams link is removed within 24 hours of completion.</p>
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button type="button" className="outline small" onClick={() => onTab('transcript')}><Icon name="chat" /> Full Transcript</button>
        <button type="button" className="outline small" onClick={() => onTab('chat')}><Icon name="spark" /> Ask AI Assistant</button>
      </div>
    </section>
  </div>;
}

export function MeetingDetail(props: MeetingDetailProps) {
  const { meeting, tab, status, active, error, chat, onTab } = props;
  const [query, setQuery] = useState('');
  if (!meeting) return <>
    <h1>{error ? 'Meeting unavailable' : 'Loading meeting…'}</h1>
    <section className="panel meeting-loading" role={error ? 'alert' : 'status'}>{error || 'Retrieving the latest meeting status.'}</section>
  </>;
  const counts = { transcript: meeting.transcript?.length ?? 0, snapshots: meeting.snapshots?.length ?? 0, chat: chat.length };
  return <>
    <div className="breadcrumb"><a href="#meetings">Meetings AI</a><Icon name="chevron" /><span>{meeting.title}</span></div>
    <section className="meeting-detail-head panel"><div>
      <span className={`meeting-status ${meeting.status}`}><i />{status}</span><h1>{meeting.title}</h1>
      <p>{new Date(meeting.createdAt).toLocaleString()} · Bot: {meeting.botName || 'PTCL AI NOTETAKER'}</p>
    </div><div className="meeting-head-actions">
      {active && meeting.status !== 'processing' && <button type="button" className="outline" onClick={props.onStop}>Stop bot</button>}
      <button type="button" className="icon-button danger" aria-label="Delete meeting" onClick={props.onDelete}><Icon name="trash" /></button>
    </div></section>
    {meeting.failureMessage && <div className="meeting-alert"><b>{status}</b><span>{meeting.failureMessage}</span></div>}
    {error && <p className="meeting-error" role="alert">{error}</p>}
    <div className="meeting-tabs" aria-label="Meeting detail sections" role="group">{tabs.map(([id, label]) =>
      <button key={id} type="button" className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => onTab(id)}>
        {label}<small>{id in counts ? counts[id as keyof typeof counts] : ''}</small></button>)}</div>
    {tab === 'overview' && <Overview {...props} meeting={meeting} />}
    {tab === 'mom' && <MeetingMom meeting={meeting} actions={props.momActions} />}
    {tab === 'transcript' && <Transcript entries={meeting.transcript ?? []} query={query} onQuery={setQuery} formatTime={props.formatTime} active={active} />}
    {tab === 'snapshots' && <Snapshots meeting={meeting} active={active} formatTime={props.formatTime} onCapture={props.onCapture} />}
    {tab === 'chat' && <MeetingChat messages={chat} busy={props.chatBusy} onSend={props.onChat} />}
    {tab === 'audio' && <Audio meeting={meeting} active={active} />}
  </>;
}
