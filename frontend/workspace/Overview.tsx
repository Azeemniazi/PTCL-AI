import { useState } from 'react';
import { Icon, Mark } from '../shared/Brand';

interface Conversation {
  id: string;
  title: string;
  updated: number | string;
  messages: readonly unknown[];
}

export interface OverviewProps {
  chats: readonly Conversation[];
  name?: string;
  document?: { name: string; indexed: boolean };
  query: string;
  onQuery: (value: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const capabilities = [
  ['chat', 'Chat with CloudCore', 'Get answers, draft content, analyze information and more.', 'Research · Summarize · Plan', 'assistant'],
  ['video', 'Meeting Intelligence', 'Turn discussions into actionable insights.', 'Transcribe · Summarize · Act', 'meetings'],
  ['file', 'Document Insights', 'Understand and extract key information.', 'Compare · Extract · Analyze', 'documents'],
  ['image', 'Image Studio', 'Generate visuals, diagrams, and inspect visual media.', 'Generate · Style · Inspect', 'images'],
] as const;

export function Home({ chats, name, document, onOpen }: OverviewProps) {
  const date = new Date();
  const recent = chats.slice(0, 3);
  return <>
    <section className="ref-home-heading">
      <div><h1>Good morning, {(name || 'there').split(' ')[0]}</h1><p>Let’s make today productive.</p></div>
      <time>{date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Asia/Karachi' })}<br />
        {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' })}</time>
    </section>
    <section className="ref-home-hero">
      <span className="ref-kicker">CLOUDCORE AI WORKSPACE</span>
      <h2>Your AI Workspace<br /><span>for a more connected tomorrow.</span></h2>
      <p>One intelligent workspace. Four powerful capabilities.<br />Built for Pakistan. Designed for what’s next.</p>
      <a className="ref-lime-button" href="#assistant">Explore AI Workspace <Icon name="arrow" /></a>
    </section>
    <section className="home-cards ref-home-cards">
      {capabilities.map(([icon, title, description, tags, path], index) =>
        <a className={'ref-capability capability-' + index} href={'#' + path} key={path}>
          <span className="feature-icon"><Icon name={icon} /></span><h2>{title}</h2><p>{description}</p>
          <div><small>{tags}</small><span className="ref-round-arrow"><Icon name="arrow" /></span></div>
        </a>)}
    </section>
    <div className="ref-home-lists">
      <section className="panel">
        <div className="panel-heading"><Icon name="clock" /><h2>Recent Activity</h2><a href="#history">View all →</a></div>
        {recent.length ? recent.map(chat =>
          <button className="ref-activity-row" type="button" key={chat.id} onClick={() => onOpen(chat.id)}>
            <span className="mini-icon"><Icon name="chat" /></span>
            <span><b>{chat.title}</b><small>Conversation · {new Date(chat.updated).toLocaleDateString()}</small></span>
            <span>Continue →</span>
          </button>) : <div className="ref-empty-inline">Your recent conversations will appear here.
          <a href="#assistant">Start a conversation →</a></div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><Icon name="folder" /><h2>Continue where you left off</h2><a href="#documents">View all →</a></div>
        {document ? <a className="ref-activity-row" href="#documents">
          <span className="mini-icon"><Icon name="file" /></span>
          <span><b>{document.name}</b><small>Document · {document.indexed ? 'Indexed & ready' : 'Selected on this device'}</small></span>
          <span>Continue →</span>
        </a> : <div className="ref-empty-inline">Bring your documents and meetings into one workspace.
          <a href="#meetings">Open Meeting Intelligence →</a></div>}
      </section>
    </div>
  </>;
}

export function History({ chats, query, onQuery, onOpen, onDelete }: OverviewProps) {
  const [search, setSearch] = useState(query);
  const items = chats.filter(chat => chat.title.toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="section-heading">
      <div><div className="eyebrow">YOUR WORKSPACE</div><h1>Chat History</h1><p>Revisit your conversations and continue your work.</p></div>
      <div className="heading-brand"><Mark className="heading-mark" /><span><b>CloudCore AI</b><small>A product of PTCL Smart Cloud</small></span></div>
    </div>
    <section className="panel ref-history-panel">
      <label className="ref-search"><Icon name="search" /><input id="history-search" type="search"
        aria-label="Search conversations" placeholder="Search conversations..." value={search}
        onChange={event => { setSearch(event.target.value); onQuery(event.target.value); }} /></label>
      {items.length ? items.map(chat => <article className="ref-history-row" key={chat.id}>
        <span className="mini-icon"><Icon name="chat" /></span>
        <button type="button" onClick={() => onOpen(chat.id)}>
          <b>{chat.title}</b><small>{new Date(chat.updated).toLocaleString()} · {chat.messages.length} messages</small>
        </button>
        <button type="button" className="icon-button danger" aria-label="Delete conversation" onClick={() => onDelete(chat.id)}>
          <Icon name="trash" />
        </button>
      </article>) : <div className="ref-empty">
        <span className="feature-icon"><Icon name="chat" /></span>
        <h2>{search ? 'No matching conversations' : 'Your history starts here'}</h2>
        <p>{search ? 'Try another search.' : 'Conversations are saved on this device.'}</p>
        <a className="primary" href="#assistant">Start a conversation <Icon name="arrow" /></a>
      </div>}
    </section>
  </>;
}
