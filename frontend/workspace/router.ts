import type { MarketingRoute } from '../public/Marketing';

const marketingRoutes = ['site-solutions', 'site-ai', 'site-industries', 'site-resources', 'site-about'] as const satisfies readonly MarketingRoute[];
type PublicPage = 'landing' | 'login' | MarketingRoute;

type MeetingDraft = { url?: string; consent?: boolean };
type RouterCallbacks = {
  getUser: () => { mustChangePassword?: boolean } | null;
  prepare: (meetingId: string | null) => void;
  renderPublic: (page: PublicPage) => void;
  renderWorkspace: (page: string, draft: MeetingDraft) => void;
  requirePasswordChange: () => void;
};

function isMarketingPage(page: string): page is MarketingRoute {
  return marketingRoutes.some(route => route === page);
}

function parseHash(hash: string) {
  const [page = 'landing', ...path] = (hash.slice(1).split('?')[0] || 'landing').split('/');
  let meetingId: string | null = null;
  if (page === 'meetings' && path.length) {
    try { meetingId = decodeURIComponent(path.join('/')) || null; }
    catch { /* An invalid detail link opens the meetings list. */ }
  }
  return { page, meetingId };
}

function captureFocus() {
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
  if (input instanceof HTMLInputElement && (input.type === 'file' || input.type === 'password')) return;
  if (!input.id && !input.name) return;
  const { id, name, value, selectionStart, selectionEnd } = input;
  return () => {
    const restored = id ? document.getElementById(id) : document.getElementsByName(name)[0];
    if (!(restored instanceof HTMLInputElement || restored instanceof HTMLTextAreaElement)) return;
    if (restored instanceof HTMLInputElement && (restored.type === 'file' || restored.type === 'password')) return;
    restored.value = value;
    restored.focus();
    if (selectionStart !== null && selectionEnd !== null && restored.selectionStart !== null) {
      restored.setSelectionRange(selectionStart, selectionEnd);
    }
  };
}

export function createHashRouter({ getUser, prepare, renderPublic, renderWorkspace, requirePasswordChange }: RouterCallbacks) {
  let navigation = 0;
  return ({ preserveScroll = false }: { preserveScroll?: boolean } = {}) => {
    const user = getUser();
    if (user?.mustChangePassword && document.querySelector('#dialog[open].uncloseable')) return;

    const { page, meetingId } = parseHash(location.hash);
    const publicPage = page === 'about' || page === 'landing' ? 'landing' : isMarketingPage(page) ? page : null;
    if (user && (page === 'login' || (publicPage && user.mustChangePassword))) {
      location.hash = 'home';
      return;
    }

    const version = ++navigation;
    const draft = {
      url: document.querySelector<HTMLInputElement>('#workspace-react-meetings input[name="meetingUrl"]')?.value,
      consent: document.querySelector<HTMLInputElement>('#workspace-react-meetings input[name="consent"]')?.checked,
    };
    const { scrollX, scrollY } = window;
    const messages = document.querySelector('.messages');
    const scrollTop = messages?.scrollTop;
    const nearBottom = !messages || !messages.scrollHeight || !messages.clientHeight ||
      messages.scrollHeight - messages.clientHeight - messages.scrollTop <= 60;
    const restoreFocus = captureFocus();
    prepare(meetingId);

    if (publicPage || !user) {
      renderPublic(publicPage ?? 'login');
      if (publicPage && !preserveScroll) window.scrollTo(0, 0);
      return;
    }

    renderWorkspace(page, draft);
    restoreFocus?.();
    if (preserveScroll) {
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0);
      raf(() => {
        if (version !== navigation) return;
        window.scrollTo(scrollX, scrollY);
        const box = document.querySelector('.messages');
        if (box && nearBottom) box.scrollTop = box.scrollHeight;
        else if (box && scrollTop !== undefined) box.scrollTop = scrollTop;
      });
    } else {
      window.scrollTo(0, 0);
    }
    if (user.mustChangePassword) requirePasswordChange();
  };
}
