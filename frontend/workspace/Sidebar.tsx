import { Brand, Icon } from '../shared/Brand';

const links = [
  ['home', 'home', 'Home'],
  ['assistant', 'chat', 'AI Assistant'],
  ['meetings', 'video', 'Meeting Intelligence'],
  ['documents', 'folder', 'Knowledge Hub'],
  ['images', 'image', 'Image Studio'],
] as const;

export interface SidebarProps {
  page: string;
  displayName?: string;
  role?: string;
  onProfile: () => void;
  compact?: boolean;
  onToggleCompact?: () => void;
}

export function Sidebar({ page, displayName, role, onProfile, compact, onToggleCompact }: SidebarProps) {
  const name = displayName || 'CloudCore user';
  const activePage = page === 'knowledge' ? 'documents' : page;
  const navigation = [
    ...links,
    ['settings', 'settings', 'Settings'] as const,
    ['history', 'history', 'Chat History'] as const,
  ];

  return <>
    <div className="workspace-brand-row"><Brand />
      {onToggleCompact && <button type="button" className="workspace-rail-toggle" onClick={onToggleCompact}
        aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} title={compact ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="menu" /></button>}
    </div>
    <nav aria-label="Product navigation">
      {navigation.map(([id, icon, label]) => <a key={id} href={`#${id}`}
        className={[id === 'history' && 'ref-history-link', activePage === id && 'selected'].filter(Boolean).join(' ')}
        aria-current={activePage === id ? 'page' : undefined} aria-label={label} title={label}>
        <Icon name={icon} /><span>{label}</span>
      </a>)}
    </nav>
    <div className="ref-sidebar-bottom">
      <button className="ref-sidebar-user" type="button" onClick={onProfile} aria-label={'Profile for ' + name}>
        <span className="avatar">{name.charAt(0)}</span>
        <span><b>{name}</b><small>{role || 'Workspace member'}</small></span><span>⌄</span>
      </button>
    </div>
  </>;
}
