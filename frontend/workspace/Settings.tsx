import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from 'react';
import { Icon } from '../shared/Brand';
import { PipSettings } from './Pip';
import type { ApiClient, WorkspaceUser } from '../shared/types';
import { SettingsError, SettingsField, SettingsHeading } from './settingsControls';
import { useWorkspaceRequest } from '../shared/useWorkspaceRequest';
import { SettingsSecurity } from './SettingsSecurity';

export interface SettingsUser extends WorkspaceUser {
  username?: string;
  displayName?: string;
  email?: string;
  mustChangePassword?: boolean;
  createdAt?: string;
}

const tabs = [['account', 'user', 'Account'], ['preferences', 'sliders', 'Preferences'],
  ['security', 'shield', 'Security'], ['integrations', 'link', 'Integrations']] as const;
type SettingsTab = typeof tabs[number][0];
type Preferences = { motionMode: 'auto' | 'on' | 'off'; notifications: 'on' | 'off'; responseStyle: 'concise' | 'balanced' | 'detailed'; autoRag: 'on' | 'off' };
type Capacity = { active: number; maximum: number };
type Health = { connected: boolean; model?: string; services?: { chatModel?: string; visionModel?: string; botName?: string } };

export interface SettingsProps {
  user: SettingsUser;
  tab: SettingsTab;
  scrollToUsers: boolean;
  prefs: Preferences;
  document?: { name: string; indexed: boolean };
  capacity: Capacity;
  conversationCount: number;
  messageCount: number;
  request: ApiClient;
  notify: (message: string, notification?: { title: string; text: string }) => void;
  onProfile: (user: SettingsUser) => void;
  onCapacity: (capacity: Capacity) => void;
  onTab: (tab: SettingsTab, scrollToUsers?: boolean) => void;
  onPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  onSignOut: () => void;
  onExport: () => void;
  onClear: () => void;
}

function Account({ user, capacity, request, notify, onProfile, onTab, onSignOut }: SettingsProps) {
  const action = useWorkspaceRequest();
  const name = user.displayName || 'CloudCore user';
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const displayName = String(data.get('displayName') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    void action.run(async signal => {
      if (displayName.length < 2) throw Error('Display name must be at least 2 characters.');
      const result = await request<{ user?: SettingsUser }>('/api/me/profile', { method: 'PATCH', signal, body: JSON.stringify({ displayName, email }) });
      if (signal.aborted) return;
      if (result.user) onProfile(result.user);
      notify('Profile changes saved.', { title: 'Profile Updated', text: 'Your display name and profile settings were saved.' });
    });
  }
  return <>
    <section className="panel ref-profile-panel">
      <SettingsHeading icon="settings" title="Profile" description="Your personal information and role in the CloudCore AI workspace.">
        <button type="button" className="outline danger-outline" onClick={onSignOut}><Icon name="logout" /> Sign Out</button>
      </SettingsHeading>
      <div className="ref-profile-identity"><span className="avatar">{name.charAt(0)}</span><div><h2>{name}</h2>
        <p>PTCL Smart Cloud · <span className={`role-badge ${user.role}`}>{user.role}</span></p></div></div>
      <form id="settings-profile-form" onSubmit={submit}>
        <SettingsError message={action.error} />
        <div className="ref-profile-fields">
          <SettingsField label="Name" name="displayName" required minLength={2} maxLength={50} defaultValue={user.displayName || ''} />
          <SettingsField label="Username" readOnly value={user.username || 'Not provided'} />
          <SettingsField label="Email" name="email" type="email" maxLength={100} defaultValue={user.email || ''} placeholder="name@ptcl.net.pk" />
          <SettingsField label="Role" readOnly value={user.role} />
          <SettingsField label="Workspace" readOnly value="CloudCore AI" />
          <SettingsField label="Time Zone" readOnly value="Asia/Karachi (PKT)" />
        </div>
        <div className="ref-settings-actions"><button type="submit" className="primary" disabled={action.pending}><Icon name="check" /> Save Profile Changes</button></div>
      </form>
    </section>
    <section className="panel ref-workspace-details">
      <SettingsHeading icon="building" title="Workspace Details" description="Information about your PTCL Smart Cloud workspace and meeting capacity." />
      <div className="ref-profile-fields">
        <SettingsField label="Workspace Name" value="CloudCore AI Workspace" readOnly />
        <SettingsField label="Meeting Capacity" value={`${capacity.active || 0} active / ${capacity.maximum} concurrent meetings`} readOnly />
        <SettingsField label="Account" value={user.username || name} readOnly />
        <SettingsField label="Access" value={user.role} readOnly />
      </div><div className="ref-settings-actions">
        <button type="button" className="outline" onClick={() => onTab('security')}><Icon name="shield" /> Security &amp; Password</button>
        {['dev', 'admin'].includes(user.role) && <button type="button" className="outline" onClick={() => onTab('security', true)}>
          <Icon name="users" /> Manage workspace users</button>}
      </div>
    </section>
  </>;
}

function PreferenceGroup<K extends keyof Preferences>({ name, title, description, value, options, onSelect }: {
  name: K; title: string; description: string; value: Preferences[K];
  options: ReadonlyArray<readonly [Preferences[K], string]>; onSelect: SettingsProps['onPreference'];
}) {
  return <div className="ref-pref-row"><div><b>{title}</b><p>{description}</p></div>
    <div className="ref-toggle-group" role="group" aria-label={title}>{options.map(([option, label]) => <button key={option}
      type="button" className={value === option ? 'active' : ''} aria-pressed={value === option} onClick={() => onSelect(name, option)}>{label}</button>)}</div>
  </div>;
}

function PreferencesPanel({ prefs, onPreference, onExport, onClear, conversationCount, messageCount, document }: SettingsProps) {
  return <>
    <section className="panel ref-profile-panel">
      <SettingsHeading icon="sliders" title="Appearance & Motion" description="Control visual effects and notifications on this device." />
      <div className="ref-pref-list">
        <PreferenceGroup name="motionMode" title="Background Motion Animations" description="Control the looping ambient video in the sidebar and AI Assistant."
          value={prefs.motionMode} options={[["auto", "System Default"], ["on", "Always On"], ["off", "Off (Static)"]]} onSelect={onPreference} />
        <PreferenceGroup name="notifications" title="Workspace Toast Alerts" description="Show status alerts when documents finish indexing or tasks complete."
          value={prefs.notifications} options={[["on", "Enabled"], ["off", "Muted"]]} onSelect={onPreference} />
        <PipSettings />
      </div>
    </section>
    <section className="panel ref-workspace-details">
      <SettingsHeading icon="spark" title="AI Assistant Defaults" description="Customize response formatting and document grounding." />
      <div className="ref-pref-list">
        <PreferenceGroup name="responseStyle" title="Default Response Style" description="Choose the level of detail for AI Assistant replies."
          value={prefs.responseStyle} options={[["concise", "Concise"], ["balanced", "Balanced"], ["detailed", "Executive Detail"]]} onSelect={onPreference} />
        <PreferenceGroup name="autoRag" title="Automatic Document Grounding (RAG)" description="Automatically include relevant excerpts from your attached document in chat."
          value={prefs.autoRag} options={[["on", "Automatic"], ["off", "Manual Only"]]} onSelect={onPreference} />
      </div>
    </section>
    <section className="panel ref-workspace-details">
      <SettingsHeading icon="history" title="Local Data & Conversation Storage"
        description={`${conversationCount} conversation${conversationCount === 1 ? '' : 's'} (${messageCount} messages) saved on this device · ${document ? `Active document: ${document.name}` : 'No active document attached'}.`} />
      <div className="ref-settings-actions">
        <button type="button" className="outline" onClick={onExport}><Icon name="download" /> Export Chat History (.json)</button>
        <button type="button" className="outline danger-outline" onClick={onClear}><Icon name="trash" /> Clear All Local Conversations</button>
      </div>
    </section>
  </>;
}

function Integrations({ request, capacity, document, onCapacity, notify }: SettingsProps) {
  const [health, setHealth] = useState<Health>();
  const action = useWorkspaceRequest();
  const { run } = action;
  const refresh = async (signal: AbortSignal, feedback = false) => {
    const [service, identity] = await Promise.allSettled([
      request<Health>('/api/ai/health', { signal }), request<{ capacity?: Capacity }>('/api/me', { signal }),
    ]);
    if (signal.aborted) return;
    if (identity.status === 'fulfilled' && identity.value.capacity) onCapacity(identity.value.capacity);
    if (service.status === 'rejected') { setHealth(undefined); throw service.reason; }
    setHealth(service.value);
    if (identity.status === 'rejected') throw identity.reason;
    if (feedback) notify('Workspace service statuses refreshed.');
  };
  useEffect(() => { void run(signal => refresh(signal)); }, [request, run]);
  const cards: Array<{ icon: ComponentProps<typeof Icon>['name']; status: string; online?: boolean; title: string; description: string; detail: string; route: string; link: string }> = [
    { icon: 'chat', status: health?.connected ? 'Connected' : action.pending ? 'Checking…' : 'Offline', online: health?.connected,
      title: 'Conversational AI & MOM Engine', description: 'Primary reasoning and structured meeting-minutes model for PTCL Smart Cloud.',
      detail: `Model: ${health?.services?.chatModel || health?.model || '—'}`, route: 'assistant', link: 'Open AI Assistant' },
    { icon: 'video', status: `${capacity.active || 0} / ${capacity.maximum} Active`, online: true, title: 'Microsoft Teams Intelligence',
      description: 'Meeting bot, Whisper transcription, speaker attribution, and minutes.', detail: `Bot Identity: ${health?.services?.botName || 'PTCL AI NOTETAKER'}`,
      route: 'meetings', link: 'Open Meetings AI' },
    { icon: 'file', status: document ? (document.indexed ? 'Document Indexed' : 'Document Selected') : 'Ready', online: true,
      title: 'Enterprise Document RAG', description: 'Text extraction and semantic chunking for uploaded files.',
      detail: document ? `Active file: ${document.name}` : 'Formats: PDF, DOCX, PPTX, XLSX, CSV, TXT', route: 'documents', link: 'Open Document Insights' },
    { icon: 'image', status: 'Ready', online: true, title: 'Vision AI & Optical Character Recognition',
      description: 'Visual inspection for infrastructure, diagrams, satellite imagery, and text extraction.',
      detail: `Model: ${health?.services?.visionModel || 'Qwen2.5-VL-7B-Instruct'}`, route: 'images', link: 'Open Image Studio' },
  ];
  return <section className="panel ref-profile-panel">
    <SettingsHeading icon="link" title="Connected Workspace Services" description="Status of CloudCore AI engines and the Microsoft Teams meeting bot.">
      <button type="button" className="soft-button" disabled={action.pending} onClick={() => void run(signal => refresh(signal, true))}><Icon name="history" /> Refresh Status</button>
    </SettingsHeading>
    <SettingsError message={action.error} />
    <div className="ref-integration-grid">{cards.map(card => <article className="ref-status-card" key={card.route}>
      <div className="ref-status-top"><span className="mini-icon"><Icon name={card.icon} /></span>
        <span className={`ref-status-badge ${card.online ? 'online' : 'offline'}`}>{card.status}</span></div>
      <h3>{card.title}</h3><p>{card.description}</p><small>{card.detail}</small>
      <div className="ref-status-actions"><a className="outline" href={`#${card.route}`}>{card.link} <Icon name="arrow" /></a></div>
    </article>)}</div>
  </section>;
}

export function Settings(props: SettingsProps) {
  const { tab, onTab, user, scrollToUsers } = props;
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab === 'security' && scrollToUsers) content.current?.querySelector('#settings-users-panel')?.scrollIntoView?.({ behavior: 'smooth' });
  }, [tab, scrollToUsers]);
  return <>
    <div className="ref-page-heading"><h1>Settings</h1><p>Manage your account, preferences, security, and workspace integrations.</p></div>
    <nav className="ref-settings-tabs" role="tablist" aria-label="Settings sections">{tabs.map(([id, icon, label], index) => <button
      type="button" key={id} id={`settings-tab-${id}`} role="tab" aria-controls="settings-tab-content" aria-selected={tab === id}
      tabIndex={tab === id ? 0 : -1} className={tab === id ? 'active' : ''} onClick={() => onTab(id)} onKeyDown={event => {
        const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1)
          : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length]
          : event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : undefined;
        if (!target) return;
        event.preventDefault();
        event.currentTarget.ownerDocument.getElementById(`settings-tab-${target[0]}`)?.focus();
        onTab(target[0]);
      }}><Icon name={icon} />{id === 'security' && ['dev', 'admin'].includes(user.role) ? 'Security & Users' : label}</button>)}</nav>
    <div ref={content} id="settings-tab-content" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
      {tab === 'account' && <Account {...props} />}
      {tab === 'preferences' && <PreferencesPanel {...props} />}
      {tab === 'security' && <SettingsSecurity {...props} />}
      {tab === 'integrations' && <Integrations {...props} />}
    </div>
  </>;
}
