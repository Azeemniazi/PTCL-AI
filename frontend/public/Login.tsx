import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Brand, Icon, Mark } from '../shared/Brand';
import type { SignedInUser } from '../shared/session';

export function Login({ onSignedIn }: { onSignedIn: (user: SignedInUser) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const data = new FormData(event.currentTarget);
    const controller = new AbortController();
    request.current = controller;
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-requested-with': 'CloudCoreAI' },
        body: JSON.stringify({
          username: String(data.get('username') ?? '').trim(),
          password: String(data.get('password') ?? ''),
        }),
      });
      const result = await response.json().catch(() => ({})) as { user?: SignedInUser; error?: { message?: string } };
      if (!response.ok || !result.user) throw new Error(result.error?.message || 'Invalid username or password.');
      if (!controller.signal.aborted) onSignedIn(result.user);
    } catch (problem) {
      if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Sign-in failed.');
    } finally {
      request.current = undefined;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return <div className="login-page">
    <div className="hero-backdrop" />
    <header className="login-header"><Brand /><a className="outline small" href="#landing"><Icon name="arrow" /> Back to Website</a></header>
    <main className="login-main"><div className="login-card panel">
      <div className="login-brand"><Mark className="login-mark" /><h2>Sign in to <b>CloudCore AI</b></h2><p>PTCL Smart Cloud Enterprise Workspace</p></div>
      <form id="login-form" className="login-form" onSubmit={submit}>
        {error && <div id="login-error" className="login-alert" role="alert">{error}</div>}
        <label className="login-label"><span>Username</span><div className="input-with-icon">
          <Icon name="user" /><input name="username" type="text" autoComplete="username" required placeholder="Enter your username" autoFocus />
        </div></label>
        <label className="login-label"><span>Password</span><div className="input-with-icon">
          <Icon name="shield" /><input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" />
        </div></label>
        <button type="submit" className="primary login-submit" id="login-submit-btn" disabled={pending}>
          {pending ? 'Signing in...' : <><Icon name="lock" /> Sign In</>}
        </button>
      </form>
      <div className="login-footnote"><small>Protected by PTCL Smart Cloud enterprise authentication.</small></div>
    </div></main>
    <footer className="page-footer"><span>Technology that moves Pakistan forward.</span><i /><span><Mark className="footer-mark" /> A product of PTCL Smart Cloud</span></footer>
  </div>;
}
