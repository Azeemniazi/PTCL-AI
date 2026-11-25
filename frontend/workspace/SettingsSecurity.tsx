import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../shared/Brand';
import { SettingsError, SettingsField, SettingsHeading } from './settingsControls';
import { useWorkspaceRequest } from '../shared/useWorkspaceRequest';
import type { SettingsProps, SettingsUser } from './Settings';

type SecurityProps = Pick<SettingsProps, 'user' | 'request' | 'notify' | 'onSignOut'>;
type UserAction = { mode: 'reset' | 'delete'; target: SettingsUser };

function ChangePassword({ request, notify }: Pick<SecurityProps, 'request' | 'notify'>) {
  const action = useWorkspaceRequest();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get('currentPassword') ?? '');
    const newPassword = String(data.get('newPassword') ?? '');
    void action.run(async signal => {
      if (newPassword.length < 6) throw Error('New password must be at least 6 characters.');
      if (newPassword !== data.get('confirmPassword')) throw Error('New passwords do not match.');
      await request('/api/auth/change-password', { method: 'POST', signal, body: JSON.stringify({ currentPassword, newPassword }) });
      if (signal.aborted) return;
      form.reset();
      notify('Your password has been updated.', { title: 'Password Updated', text: 'Your account password was changed successfully.' });
    });
  }
  return <section className="panel ref-profile-panel">
    <SettingsHeading icon="shield" title="Change Your Password" description="Update your personal account password. Minimum 6 characters required." />
    <form id="settings-password-form" className="ref-settings-form" onSubmit={submit}>
      <SettingsError message={action.error} />
      <div className="ref-profile-fields">
        <SettingsField label="Current Password" name="currentPassword" type="password" autoComplete="current-password" required placeholder="Enter current password" />
        <SettingsField label="New Password" name="newPassword" type="password" autoComplete="new-password" minLength={6} required placeholder="At least 6 characters" />
        <SettingsField label="Confirm Password" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required placeholder="Re-enter new password" />
      </div><div className="ref-settings-actions"><button type="submit" className="primary" disabled={action.pending}><Icon name="check" /> Update Password</button></div>
    </form>
  </section>;
}

function UserDialog({ selected, request, onClose, onSaved }: Pick<SecurityProps, 'request'> & {
  selected: UserAction;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const action = useWorkspaceRequest();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  const reset = selected.mode === 'reset';
  const { id, username } = selected.target;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get('newPassword') ?? '');
    void action.run(async signal => {
      const url = `/api/admin/users/${encodeURIComponent(id)}`;
      if (reset) {
        if (newPassword.length < 6) throw Error('Password must be at least 6 characters.');
        await request(`${url}/reset-password`, { method: 'POST', signal, body: JSON.stringify({ newPassword }) });
      } else {
        await request(url, { method: 'DELETE', signal });
      }
      if (!signal.aborted) onSaved(reset ? `Password for '${username}' reset successfully.` : `User '${username}' deleted.`);
    });
  }
  return <dialog ref={dialog} aria-labelledby="settings-user-dialog-title" onCancel={event => { event.preventDefault(); if (!action.pending) onClose(); }}>
    <h2 id="settings-user-dialog-title">{reset ? `Reset Password for '${username}'` : `Delete user '${username}'?`}</h2>
    <p>{reset ? 'Enter a new password with at least 6 characters.' : `This permanently removes '${username}' and reassigns their meeting records.`}</p>
    <form onSubmit={submit} className="ref-settings-form">
      <SettingsError message={action.error} />
      {reset && <div className="ref-profile-fields"><SettingsField label="New Password" name="newPassword" type="password" autoComplete="new-password" minLength={6} required /></div>}
      <div className="dialog-actions">
        <button type="button" className="outline" onClick={onClose} disabled={action.pending}>Cancel</button>
        <button type="submit" className="primary" disabled={action.pending}>{reset ? 'Update Password' : 'Delete User'}</button>
      </div>
    </form>
  </dialog>;
}

function UserManagement({ user, request, notify }: Pick<SecurityProps, 'user' | 'request' | 'notify'>) {
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [selected, setSelected] = useState<UserAction>();
  const list = useWorkspaceRequest();
  const create = useWorkspaceRequest();
  const dev = user.role === 'dev';
  const { run: load } = list;

  function loadUsers(signal: AbortSignal) {
    return request<{ users: SettingsUser[] }>('/api/admin/users', { signal }).then(result => {
      if (!signal.aborted) setUsers((result.users ?? []).filter(item => dev || item.role === 'user' || item.role === 'member'));
    });
  }
  useEffect(() => { void load(signal => loadUsers(signal), true); }, [load, request, user.id, dev]);

  function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = String(data.get('username') ?? '').trim();
    const displayName = String(data.get('displayName') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const role = dev && data.get('role') === 'admin' ? 'admin' : 'user';
    const mustChangePassword = !dev || data.has('mustChangePassword');
    void create.run(async signal => {
      await request('/api/admin/users', { method: 'POST', signal, body: JSON.stringify({ username, displayName, password, role, mustChangePassword }) });
      if (signal.aborted) return;
      form.reset();
      notify(`User '${username}' created successfully.`, { title: 'User Created', text: `Created ${role} account '${username}'.` });
      await load(signal => loadUsers(signal), true);
    });
  }
  return <section className="panel ref-workspace-details" id="settings-users-panel">
    <SettingsHeading icon="users" title={`Workspace User Management (${users.length})`}
      description={dev ? 'Dev accounts can provision Admin or User accounts and manage credentials.' : 'Admins can provision User accounts with one-time passwords.'}>
      <button type="button" className="soft-button" disabled={list.pending} onClick={() => void load(async signal => {
        await loadUsers(signal);
        if (!signal.aborted) notify('Workspace user list refreshed.');
      })}><Icon name="history" /> Refresh Users</button>
    </SettingsHeading>
    <SettingsError message={list.error} />
    <form id="settings-create-user-form" className="ref-create-user-box" onSubmit={createUser}>
      <h3>Create New User Account</h3><SettingsError message={create.error} />
      <div className="ref-profile-fields">
        <SettingsField label="Username" name="username" pattern="[a-zA-Z0-9_.\\-]{3,30}" required placeholder="e.g. employee1" />
        <SettingsField label="Display Name" name="displayName" required placeholder="e.g. Ali Ahmed" />
        <SettingsField label="Initial Password" name="password" type="password" autoComplete="new-password" minLength={6} required placeholder="At least 6 characters" />
        {dev ? <label><span>Role</span><select name="role" className="ref-select"><option value="user">User (Standard)</option><option value="admin">Admin</option></select></label>
          : <SettingsField label="Role" name="role" value="user" readOnly />}
      </div>
      <div className="ref-settings-actions" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <input type="checkbox" name="mustChangePassword" defaultChecked disabled={!dev} /> Require password change on first login
        </label>
        <button type="submit" className="primary" disabled={create.pending}><Icon name="plus" /> Create Account</button>
      </div>
    </form>
    <div className="ref-table-wrap" style={{ marginTop: 16 }}><table>
      <thead><tr>{['Username', 'Display Name', 'Role', 'PW Status', 'Created', 'Actions'].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{users.length ? users.map(item => <tr key={item.id}>
        <td><b>{item.username}</b></td><td>{item.displayName}</td><td><span className={`role-badge ${item.role}`}>{item.role}</span></td>
        <td><span style={{ color: item.mustChangePassword ? '#a65d00' : '#047857' }}>{item.mustChangePassword ? 'Must change (OTP)' : 'Active'}</span></td>
        <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</td>
        <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="soft-button" aria-label={`Reset password for ${item.username}`} onClick={() => setSelected({ mode: 'reset', target: item })}>Reset PW</button>
          {item.role !== 'dev' && item.id !== user.id && <button type="button" className="icon-button danger" aria-label={`Delete ${item.username}`}
            onClick={() => setSelected({ mode: 'delete', target: item })}><Icon name="trash" /></button>}
        </div></td>
      </tr>) : <tr><td colSpan={6} style={{ textAlign: 'center', padding: 18 }}>{list.pending ? 'Loading workspace users…' : 'No workspace users to display.'}</td></tr>}</tbody>
    </table></div>
    {selected && <UserDialog selected={selected} request={request} onClose={() => setSelected(undefined)} onSaved={message => {
      setSelected(undefined);
      notify(message);
      void load(signal => loadUsers(signal), true);
    }} />}
  </section>;
}

export function SettingsSecurity(props: SecurityProps) {
  return <>
    <ChangePassword request={props.request} notify={props.notify} />
    <section className="panel ref-workspace-details">
      <SettingsHeading icon="lock" title="Session & Security Posture" description="Enterprise authentication and session controls active for your account.">
        <button type="button" className="outline danger-outline" onClick={props.onSignOut}><Icon name="logout" /> Sign Out</button>
      </SettingsHeading>
      <div className="ref-profile-fields">
        <SettingsField label="Auth Mode" value="Role-Based Access Control (RBAC)" readOnly />
        <SettingsField label="Lockout Policy" value="6 failed attempts / 15m window" readOnly />
        <SettingsField label="Session Cookie" value="HttpOnly · SameSite=Lax · 8h TTL" readOnly />
        <SettingsField label="Password Status" value={props.user.mustChangePassword ? 'Action Required (OTP)' : 'Verified & Active'} readOnly />
      </div>
    </section>
    {['dev', 'admin'].includes(props.user.role) && <UserManagement {...props} />}
  </>;
}
