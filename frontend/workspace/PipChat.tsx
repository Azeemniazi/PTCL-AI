import { useEffect, useRef, useState } from 'react';
import { Icon } from '../shared/Brand';
import { Markdown } from '../shared/Markdown';
import { useFollowScroll } from '../shared/useFollowScroll';
import { Citations, type AssistantMessage } from './Assistant';
import { PipFace } from './Pip';

export interface PipChatProps {
  messages: AssistantMessage[];
  draft: string;
  attachments: {name:string; status?:string}[];
  context: { label: string; intro: string; waiting?: string; suggestions?: string[] };
  action?: { label: string; href: string };
  busy?: boolean;
  onDraft: (value: string) => void;
  onSend: (value: string) => void;
  expand?: { label: string; open: () => void };
  onClose: () => void;
}

export function PipChat({ messages, draft, attachments, context, action, busy, onDraft, onSend, expand, onClose }: PipChatProps) {
  const panel = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [mobile] = useState(() => window.matchMedia?.('(max-width: 760px)')?.matches ?? false);
  const scroll = useFollowScroll();
  const activeReply = messages.find(message => message.streaming);
  const thinking = Boolean(activeReply) || busy;
  const latest = messages.at(-1);
  const avatar = activeReply ? (activeReply.content ? 'talking' : 'thinking')
    : latest?.role === 'assistant' ? (latest.content.startsWith('AI chat error:') ? 'concerned' : 'answered') : 'welcome';
  useEffect(() => {
    const element = panel.current;
    if (mobile) element?.showModal();
    else element?.setAttribute('open', '');
    input.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && element?.contains(document.activeElement) && !mobile) {
        event.stopPropagation();
        close.current();
      }
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      if (element?.open) element.close();
    };
  }, [mobile]);

  return <dialog ref={panel} className="pip-chat" aria-labelledby="pip-chat-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header>
      <span className="pip-chat-avatar" data-state={avatar}><PipFace /></span>
      <div><h2 id="pip-chat-title">Pip</h2><p>{context.label}</p></div>
      {expand && <button type="button" className="pip-chat-icon" aria-label={expand.label} title={expand.label} onClick={expand.open}><Icon name="expand" /></button>}
      <button type="button" className="pip-chat-icon" aria-label="Close Pip chat" onClick={onClose}><Icon name="close" /></button>
    </header>
    <div className="pip-chat-thread" {...scroll}>
      {!messages.length && <div className="pip-chat-welcome"><strong>Hi, I’m Pip.</strong><p>{context.intro}</p>
        {!!context.suggestions?.length && <div className="pip-chat-suggestions">
          {context.suggestions.map(prompt => <button key={prompt} type="button" disabled={thinking} onClick={() => onSend(prompt)}>{prompt}</button>)}
        </div>}
      </div>}
      {messages.map((message,index) => <article key={index} data-role={message.role} className="pip-chat-message">
        <span className="pip-chat-speaker">{message.role === 'user' ? 'You' : 'Pip'}</span>
        {message.image && <img className="pip-chat-attachment-image" src={message.image} alt={message.imageName || 'Attached image'} />}
        <div className="chat-text">{message.role === 'assistant' ? <Markdown text={message.content} /> : message.content}
          {message.streaming && (message.content
            ? <span className="typing-cursor" aria-label="Pip is replying" />
            : <span className="assistant-reply-status" role="status">{context.waiting ?? 'Pip is thinking…'}</span>)}</div>
        {Boolean(message.citations?.length) && <Citations citations={message.citations ?? []} />}
      </article>)}
      {action && <a className="pip-chat-action" href={action.href} onClick={onClose}>{action.label} <Icon name="arrow" /></a>}
    </div>
    <form onSubmit={event => {
      event.preventDefault();
      if (draft.trim() && !thinking) onSend(draft);
    }}>
      {attachments.length > 0 && <div className="pip-chat-attachments" aria-label="Attachments in this conversation">
        {attachments.map((attachment,index) => <span key={index} title={attachment.name}><Icon name="paperclip" /> {attachment.name}
          {attachment.status ? ' · ' + attachment.status : ''}</span>)}
        {expand && <button type="button" onClick={expand.open}>Manage in Assistant</button>}
      </div>}
      <div className="pip-chat-composer"><textarea ref={input} aria-label="Message Pip" rows={2} value={draft}
        onChange={event => onDraft(event.currentTarget.value)} placeholder="Ask Pip anything…"
        onKeyDown={event => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (draft.trim() && !thinking) onSend(draft);
        }} />
        <button type="submit" aria-label="Send to Pip" disabled={!draft.trim() || thinking}><Icon name="arrow" /></button></div>
    </form>
  </dialog>;
}
