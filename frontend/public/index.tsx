import { createRoot, type Root } from 'react-dom/client';
import { useEffect } from 'react';
import { Landing } from './Landing';
import { Login } from './Login';
import type { SignedInUser } from '../shared/session';
import { Marketing, type MarketingRoute } from './Marketing';
import { PasswordChange } from './PasswordChange';

type PublicRoute = 'landing' | 'login' | MarketingRoute;

let root: Root | undefined;
let host: HTMLElement | undefined;
let passwordRoot: Root | undefined;

function PublicPage({ page, signedIn, onSignedIn, onRendered }: {
  page: PublicRoute;
  signedIn: boolean;
  onSignedIn: (user: SignedInUser) => void;
  onRendered?: () => void;
}) {
  useEffect(() => { onRendered?.(); }, [page, onRendered]);
  if (page === 'landing') return <Landing signedIn={signedIn} />;
  if (page === 'login') return <Login onSignedIn={onSignedIn} />;
  return <Marketing page={page} signedIn={signedIn} />;
}

export const publicPages = {
  unmountPasswordChange() {
    passwordRoot?.unmount();
    passwordRoot = undefined;
  },
  mountPasswordChange(container: HTMLElement, onChanged: () => void) {
    this.unmountPasswordChange();
    passwordRoot = createRoot(container);
    passwordRoot.render(<PasswordChange onChanged={onChanged} />);
  },
  unmount() {
    root?.unmount();
    root = undefined;
    host = undefined;
  },
  mount(container: HTMLElement, page: PublicRoute, signedIn: boolean, onSignedIn: (user: SignedInUser) => void, onRendered?: () => void) {
    if (host !== container) {
      this.unmount();
      host = container;
      root = createRoot(container);
    }
    root?.render(<PublicPage page={page} signedIn={signedIn} onSignedIn={onSignedIn} onRendered={onRendered} />);
  },
};
