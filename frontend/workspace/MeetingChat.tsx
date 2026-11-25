import { Icon } from '../shared/Brand';
import { useFollowScroll } from '../shared/useFollowScroll';
import { Markdown } from '../shared/Markdown';

export interface MeetingMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const suggestions = [
  'What is he saying right now?', 'Who is speaking in this meeting?',
  'Summarize discussion so far', 'Any key decisions or action items mentioned?',
];

export function MeetingChat({ messages, busy, onSend }: {
  messages: MeetingMessage[];
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const scroll = useFollowScroll();
  return <section className="panel meeting-chat-panel">
    <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="feature-icon" style={{ width: 40, height: 40, borderRadius: 12, background: '#e8f7ee', color: 'var(--green)', display: 'grid', placeItems: 'center' }}><Icon name="spark" /></span>
        <div><h2 style={{ fontSize: 18, margin: 0 }}>Meeting AI Assistant</h2>
          <p style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12 }}>Real-time Q&amp;A powered by local Qwen3 &amp; Whisper transcription</p>
        </div>
      </div>
      <span className="live-pill" style={{ marginTop: 4 }}><span className="pulse-dot" /> Qwen MOM / Q&amp;A Active</span>
    </div>
    <div className="quick-queries">{suggestions.map(question => <button type="button" className="quick-query-btn"
      key={question} disabled={busy} onClick={() => onSend(question)}><Icon name="spark" /> {question}</button>)}</div>
    <div className="meeting-chat-messages" aria-live="polite" {...scroll}>
      {messages.length ? messages.map(({ role, content, streaming }, index) => <div key={index} className={`meeting-chat-bubble ${role}`}>
        <span className="chat-role">{role === 'user' ? 'You' : 'CloudCore Meeting AI'}</span>
        <div className="chat-text">
          {streaming && !content ? <span className="live-pill"><span className="pulse-dot" /> Analyzing meeting transcript...</span>
            : <Markdown text={content} />}
          {streaming && <span className="typing-cursor" />}
        </div>
      </div>) : <div className="meeting-chat-empty"><span className="icon"><Icon name="chat" /></span>
        <h3>Ask questions about this meeting</h3><p>Ask a question about what was said, who spoke, or the key points.</p>
      </div>}
    </div>
    <form id="meeting-chat-form" className="meeting-chat-composer" onSubmit={event => {
      event.preventDefault();
      const form = event.currentTarget;
      const prompt = String(new FormData(form).get('chatPrompt') ?? '').trim();
      if (!prompt || busy) return;
      form.reset();
      onSend(prompt);
    }}>
      <input name="chatPrompt" aria-label="Ask about this meeting" placeholder="Ask what is being said, who spoke, or request a summary..."
        autoComplete="off" required disabled={busy} />
      <button type="submit" className="primary" disabled={busy}><Icon name="arrow" /> Ask</button>
    </form>
  </section>;
}
