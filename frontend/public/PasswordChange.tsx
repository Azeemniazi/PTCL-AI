import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../shared/Brand';

const fields = [
  ['currentPassword', 'Current Temporary Password', 'Enter current temporary password'],
  ['newPassword', 'New Password', 'Minimum 6 characters'],
  ['confirmPassword', 'Confirm New Password', 'Re-enter new password'],
] as const;

export function PasswordChange({ onChanged }: { onChanged: () => void }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const inFlight = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => inFlight.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const values = new FormData(event.currentTarget);
    const currentPassword = String(values.get('currentPassword') ?? '');
    const newPassword = String(values.get('newPassword') ?? '');
    const confirmation = String(values.get('confirmPassword') ?? '');
    if (newPassword.length < 6) return setError('New password must be at least 6 characters.');
    if (newPassword !== confirmation) return setError('New password and confirmation do not match.');
    if (newPassword === currentPassword) return setError('New password must be different from current password.');

    const controller = new AbortController();
    inFlight.current = controller;
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-requested-with': 'CloudCoreAI' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(payload.error?.message || 'Failed to update password.');
      }
      if (!controller.signal.aborted) onChanged();
    } catch (problem) {
      if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Failed to update password.');
    } finally {
      inFlight.current = undefined;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return <div className="must-change-password-box">
    <span className="feature-icon"><Icon name="shield" /></span>
    <h2>Password Change Required</h2>
    <p style={{ fontSize: 13, color: '#5a7366', margin: '8px 0 16px' }}>Your account was initialized with a temporary password. Set a new password to use CloudCore AI.</p>
    <form id="must-change-password-form" className="login-form" onSubmit={submit}>
      {error && <div id="must-change-err" className="login-alert" role="alert">{error}</div>}
      {fields.map(([name, label, placeholder]) => <label className="login-label" key={name}>
        <span>{label}</span><div className="input-with-icon"><Icon name="shield" />
          <input name={name} type="password" required placeholder={placeholder}
            autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
            minLength={name === 'currentPassword' ? undefined : 6} />
        </div>
      </label>)}
      <button type="submit" className="primary login-submit" id="must-change-btn" disabled={pending}>
        {pending ? 'Updating...' : <><Icon name="check" /> Set Password &amp; Continue</>}
      </button>
    </form>
  </div>;
}
