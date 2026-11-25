import { useEffect, useRef } from 'react';
import { Icon, Mark } from '../shared/Brand';
import { useFollowScroll } from '../shared/useFollowScroll';
import type { ChatCitation } from '../shared/chatStream';
import { Markdown } from '../shared/Markdown';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  imageName?: string;
  imageSize?: number;
  streaming?: boolean;
  citations?: ChatCitation[];
}

export interface AssistantProps {
  messages: AssistantMessage[];
  name?: string;
  draft: string;
  document?: { name: string; status: string };
  image?: { name: string; url: string };
  formatBytes: (bytes: number) => string;
  onDraft: (value: string) => void;
  onSend: (value: string) => void;
  onNew: () => void;
  onAttachDocument: () => void;
  onAttachImage: () => void;
  onRemoveDocument: () => void;
  onRemoveImage: () => void;
  onSummarizeDocument: () => void;
  onAnalyzeImage: () => void;
  onPreviewImage: (url: string, name: string) => void;
}

function Composer({ draft, document, image, onDraft, onSend, onAttachDocument, onAttachImage, onRemoveDocument, onRemoveImage }: AssistantProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== draft) inputRef.current.value = draft;
  }, [draft]);
  const attached = Boolean(document || image);
  const placeholder = document ? `Ask anything about "${document.name}" (or press Send to summarize)...`
    : image ? `Ask about "${image.name}" (or press Send to analyze)...` : 'Ask CloudCore AI anything or search Knowledge Base...';
  return <form className={`composer ${attached ? 'has-attachments' : ''}`} id="assistant-composer" onSubmit={event => {
    event.preventDefault();
    const form = event.currentTarget;
    const prompt = String(new FormData(form).get('prompt') ?? '').trim();
    if (!prompt && !attached) return;
    if (inputRef.current) inputRef.current.value = '';
    onDraft('');
    onSend(prompt);
  }}><div>
    {attached && <div className="composer-attachments">
      {document && <span className="attachment-chip"><Icon name="file" /><b>{document.name}</b><small>{document.status}</small>
        <button type="button" className="chip-remove" aria-label="Remove attached document" onClick={onRemoveDocument}>×</button></span>}
      {image && <span className="attachment-chip attachment-chip-image"><img src={image.url} className="composer-chip-thumb" alt="Preview" />
        <b>{image.name}</b><small>Ready for Vision AI</small>
        <button type="button" className="chip-remove" aria-label="Remove attached image" onClick={onRemoveImage}>×</button></span>}
    </div>}
    <input ref={inputRef} name="prompt" aria-label="Message CloudCore AI" placeholder={placeholder} autoComplete="off" required={!attached}
      defaultValue={draft} onChange={event => onDraft(event.target.value)} />
    <button type="button" className="icon-button" title="Attach PDF, Word, Excel or text file" aria-label="Attach a document" onClick={onAttachDocument}><Icon name="paperclip" /></button>
    <button type="button" className="icon-button" title="Attach image for analysis" aria-label="Upload an image" onClick={onAttachImage}><Icon name="image" /></button>
  </div><button type="submit" className="send" aria-label="Send message"><Icon name="arrow" /></button></form>;
}

export function Citations({ citations }: { citations: ChatCitation[] }) {
  return <details className="chat-citations-details" open>
    <summary className="chat-citations-summary"><Icon name="folder" /><span>Source documents ({citations.length})</span></summary>
    <div className="chat-citations-list">{citations.map((citation, index) => <a key={`${citation.documentId}-${index}`} className="citation-chip"
      target="_blank" rel="noopener" href={citation.documentId === 'chat-upload' ? '/api/chat/document' : `/api/knowledge/documents/${encodeURIComponent(citation.documentId)}/view`}
      title={citation.preview || ''}><span className="citation-num">{citation.sourceId || index + 1}</span><span className="citation-name">{citation.filename}</span></a>)}</div>
  </details>;
}

export function Assistant(props: AssistantProps) {
  const { messages, name, formatBytes, onNew, onSend, onSummarizeDocument, onAnalyzeImage, onPreviewImage } = props;
  const scroll = useFollowScroll();
  if (messages.length) return <section className="ref-conversation">
    <div className="ref-conversation-heading"><h1>AI Assistant</h1><button type="button" className="outline" onClick={onNew}><Icon name="plus" /> New Chat</button></div>
    <div className="messages" {...scroll}>{messages.map((message, index) => {
      const user = message.role === 'user';
      const imageName = message.imageName || 'Attached image';
      const image = message.image;
      return <article key={index} className={`message ${user ? 'user' : 'assistant'}${index >= messages.length - 2 ? ' cc-msg-enter' : ''}`}>
        <span className="message-avatar">{user ? (name || 'U').charAt(0) : <Mark />}</span>
        <div className="chat-text" id={message.streaming ? 'active-assistant-stream-bubble' : undefined}>
          {image && <button type="button" className="chat-msg-image-wrap assistant-image-preview" title="Click to view full image"
            onClick={() => onPreviewImage(image, imageName)}>
            <img src={image} alt={imageName} className="chat-msg-image" loading="lazy" />
            <span className="chat-msg-image-footer"><span className="chat-msg-image-name"><Icon name="image" /> {imageName}</span>
              {Boolean(message.imageSize) && <small className="chat-msg-image-size">{formatBytes(message.imageSize ?? 0)}</small>}</span>
          </button>}
          {user ? message.content : <><Markdown text={message.content} />
            {Boolean(message.citations?.length) && <Citations citations={message.citations ?? []} />}</>}
          {message.streaming && (message.content
            ? <span className="typing-cursor" aria-label="Generating reply" />
            : <span className="assistant-reply-status" role="status">Waiting for CloudCore AI…</span>)}
        </div>
      </article>;
    })}</div>
    <Composer {...props} />
  </section>;

  const cards = [
    ['file', 'Summarize', 'this document', 'Attach a PDF, Word or text file right here in chat.', onSummarizeDocument],
    ['video', 'Draft a meeting', 'summary', 'Turn discussions into clear, actionable notes.', () => onSend('Help me draft a structured executive meeting summary with key discussion points, decisions, and action items.')],
    ['chart', 'Compare', 'strategies', 'Analyze options and find the best path forward.', () => onSend('Compare cloud migration strategies and hybrid infrastructure options for an enterprise.')],
    ['image', 'Analyze', 'this image', 'Attach an image right here in chat for Vision AI.', onAnalyzeImage],
  ] as const;
  return <>
    <section className="ref-assistant-stage"><div className="ref-assistant-options">{cards.map(([icon, first, second, description, run], index) =>
      <button type="button" className={`ref-assistant-option option-${index}`} key={icon} onClick={run}>
        <span className="ref-dark-icon"><Icon name={icon} /></span><h2>{first}<br />{' '}{second}</h2><p>{description}</p>
        <i className="ref-round-arrow"><Icon name="arrow" /></i>
      </button>)}</div>
      <div className="ref-assistant-name"><h1>CloudCore AI</h1><p>Your intelligent partner at PTCL Smart Cloud.</p></div>
    </section>
    <div className="ref-assistant-composer"><Composer {...props} /></div>
    <nav className="ref-assistant-shortcuts" aria-label="Assistant tools">
      <button type="button" onClick={props.onAttachDocument}><Icon name="file" />Attach Document</button>
      <button type="button" onClick={props.onAttachImage}><Icon name="image" />Attach Image</button>
      <a href="#meetings"><Icon name="video" />Meeting Intelligence</a><a href="#history"><Icon name="history" />Chat History</a>
    </nav>
  </>;
}
