import type { WorkspaceUser } from './types';

export interface SignedInUser extends WorkspaceUser {
  displayName: string;
  mustChangePassword?: boolean;
}

interface SessionResponse {
  user: SignedInUser | null;
  capacity?: { active: number; maximum: number };
}

interface SessionCallbacks {
  onRestored: (session: SessionResponse) => void;
  onExpired: () => void;
  onSignedOut: (confirmed: boolean) => void;
}

export function createSessionClient(callbacks: SessionCallbacks) {
  let revision = 0;
  let signingOut = false;

  function expire() {
    if (signingOut) return;
    revision++;
    callbacks.onExpired();
  }

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const startedAt = revision;
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    headers.set('x-requested-with', 'CloudCoreAI');
    const response = await fetch(path, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    options.signal?.throwIfAborted();
    if (startedAt !== revision) throw new DOMException('The workspace session changed.', 'AbortError');
    if (response.status === 401) {
      expire();
      throw new Error('Authentication required.');
    }
    if (!response.ok) throw new Error(payload?.error?.message || `Request failed (${response.status}).`);
    return payload as T;
  }

  return {
    request,
    expire,
    acceptSignIn() { revision++; },
    async restore() {
      try {
        const startedAt = revision;
        const session = await request<SessionResponse>('/api/me');
        if (startedAt === revision) callbacks.onRestored(session);
      } catch {
        // The initial public or sign-in screen remains usable if restoration fails.
      }
    },
    async signOut() {
      if (signingOut) return;
      signingOut = true;
      const startedAt = ++revision;
      let confirmed = false;
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST', headers: { 'x-requested-with': 'CloudCoreAI' },
        });
        confirmed = response.ok;
      } catch {
        // Clear the local session even when the server is unreachable.
      } finally {
        signingOut = false;
        if (startedAt === revision) {
          revision++;
          callbacks.onSignedOut(confirmed);
        }
      }
    },
  };
}
