import { useState, type FormEvent } from 'react';
import { Icon } from '../shared/Brand';

export interface HeaderProps {
  unread: boolean;
  showNewChat: boolean;
  onToggleMenu: () => boolean;
  onSearch: (query: string) => void;
  onNotifications: () => void;
  onNewChat: () => void;
  onImportStatus?: () => void;
}

export function Header({ unread, showNewChat, onToggleMenu, onSearch, onNotifications, onNewChat, onImportStatus }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const query = String(new FormData(form).get('query') ?? '').trim();
    if (!query) return;
    form.reset();
    onSearch(query);
  }

  return <>
    <button type="button" className="mobile-menu icon-button" aria-label="Toggle navigation"
      aria-controls="workspace-sidebar" aria-expanded={menuOpen} onClick={() => setMenuOpen(onToggleMenu())}>
      <Icon name="menu" />
    </button>
    <form className="global-search" id="search-form" onSubmit={search}>
      <Icon name="search" />
      <input name="query" aria-label="Search products, guides, solutions"
        placeholder="Search across your workspace, documents, meetings, images..." />
    </form>
    {onImportStatus && <button type="button" className="workspace-import-status icon-button" aria-label="Import status" onClick={onImportStatus}>
      <Icon name="upload" /><span>Import status</span></button>}
    <button type="button" className={`icon-button notification ${unread ? 'has-unread' : ''}`}
      aria-label="Notifications" onClick={onNotifications}>
      <Icon name="bell" />{unread && <i />}
    </button>
    {showNewChat && <button type="button" className="ref-glass-button ref-new-chat" onClick={onNewChat}>
      <Icon name="spark" /> New Chat
    </button>}
  </>;
}
