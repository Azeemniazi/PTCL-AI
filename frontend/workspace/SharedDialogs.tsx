import { useState, type ReactNode } from 'react';
import { Icon } from '../shared/Brand';
import { WorkspaceDialog } from '../shared/WorkspaceDialog';

export interface Notification {
  id: string; title: string; text: string; time: string; href: string; unread: boolean;
}

export type SharedDialogProps = { onClose: () => void } & (
  { kind: 'notifications'; entries: Notification[]; onClear: () => void; error?: string }
  | { kind: 'profile'; name: string; role: string; username?: string; email?: string; onSettings: () => void; onSignOut: () => Promise<void> }
  | { kind: 'image'; url: string; description: string; onUsePrompt?: () => void }
  | { kind: 'confirm'; title: string; message: string; label: string; onConfirm: () => void }
);

function Shell({ children, onClose, pending }: { children: ReactNode; onClose: () => void; pending?: boolean }) {
  return <WorkspaceDialog labelledBy="workspace-dialog-title" onClose={onClose} pending={pending}>
    <button type="button" className="dialog-close icon-button" onClick={onClose} aria-label="Close" disabled={pending}><Icon name="close" /></button>
    {children}
  </WorkspaceDialog>;
}

function Profile(props: Extract<SharedDialogProps, { kind: 'profile' }>) {
  const [pending, setPending] = useState(false);
  const { name, role, username, email, onClose, onSettings, onSignOut } = props;
  return <Shell onClose={onClose} pending={pending}>
    <div className="workspace-profile-dialog">
      <span className="avatar" aria-hidden="true">{name.charAt(0)}</span>
      <h2 id="workspace-dialog-title">{name}</h2>
      {(username || email) && <p>{[username, email].filter(Boolean).join(' · ')}</p>}
      <span className={`role-badge ${role}`}>{role}</span>
      <div className="dialog-actions">
        <button type="button" className="primary" onClick={onSettings} disabled={pending}><Icon name="settings" /> Settings</button>
        <button type="button" className="outline danger" disabled={pending} onClick={async () => {
          setPending(true);
          try { await onSignOut(); } finally { setPending(false); }
        }}><Icon name="logout" /> {pending ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </div>
  </Shell>;
}

function ImagePreview({ url, description, onClose, onUsePrompt }: Extract<SharedDialogProps, { kind: 'image' }>) {
  const [zoom, setZoom] = useState(false);
  return <Shell onClose={onClose}>
    <div className="workspace-image-dialog">
      <h2 id="workspace-dialog-title">Visual Inspection Lightbox</h2>
      {description && <p>{description}</p>}
      <div className="workspace-image-frame"><img src={url} alt={description || 'Image preview'} style={{ transform: zoom ? 'scale(2)' : undefined }} /></div>
      <div className="dialog-actions">
        <button type="button" className="outline small" aria-pressed={!zoom} onClick={() => setZoom(false)}>100%</button>
        <button type="button" className="outline small" aria-pressed={zoom} onClick={() => setZoom(true)}>200% Zoom</button>
        {onUsePrompt && <button type="button" className="soft-button small" onClick={onUsePrompt}><Icon name="spark" /> Use This Prompt</button>}
        <a className="primary" href={url} download="asset.png"><Icon name="download" /> Download</a>
      </div>
    </div>
  </Shell>;
}

export function SharedDialogs(props: SharedDialogProps) {
  if (props.kind === 'profile') return <Profile {...props} />;
  if (props.kind === 'image') return <ImagePreview {...props} />;
  if (props.kind === 'confirm') return <Shell onClose={props.onClose}>
    <h2 id="workspace-dialog-title">{props.title}</h2><p>{props.message}</p><div className="dialog-actions">
      <button type="button" className="outline" onClick={props.onClose}>Cancel</button>
      <button type="button" className="primary" onClick={props.onConfirm}>{props.label}</button>
    </div>
  </Shell>;
  return <Shell onClose={props.onClose}>
    <div className="notifications-modal"><div className="workspace-notifications-heading">
      <h2 id="workspace-dialog-title">Notifications</h2>
      {props.entries.length > 0 && <button type="button" className="outline small" onClick={props.onClear}>Clear all</button>}
    </div>{props.error && <p role="alert">{props.error}</p>}{props.entries.length ? <div className="notifications-list">{props.entries.map(entry => <div className="notification-item" key={entry.id} data-unread={entry.unread}>
      <span className="mini-icon"><Icon name="bell" /></span><div><b>{entry.title}</b><p>{entry.text}</p><small>
        {new Date(entry.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
        <a className="workspace-notification-link" href={entry.href} onClick={props.onClose}>Open <span className="kh-sr-only">{entry.title}</span><Icon name="arrow" /></a></div>
    </div>)}</div> : <p className="workspace-notifications-empty">You’re all caught up. No new notifications.</p>}</div>
  </Shell>;
}
