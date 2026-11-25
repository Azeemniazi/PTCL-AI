import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { KnowledgeFolder } from '../../src/models';
import { Icon } from '../shared/Brand';
import { getFolderBreadcrumbs } from './knowledgeController';

export function KnowledgeTree({ folders, active, userId, onFolder, onDrop, dropTarget }: {
  folders: KnowledgeFolder[]; active?: KnowledgeFolder; userId: string;
  dropTarget?: string;
  onFolder: (id: string) => void; onDrop: (event: DragEvent, id: string) => void;
}) {
  const key = 'cloudcore.knowledge.tree.' + userId;
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')); } catch { return new Set(); }
  });
  const [focused, setFocused] = useState('');
  const tree = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', time: 0 });
  useEffect(() => {
    if (!active) return;
    const parents = getFolderBreadcrumbs(active, folders).slice(0, -1).map(folder => folder.id);
    setExpanded(previous => parents.every(id => previous.has(id)) ? previous : new Set([...previous, ...parents]));
  }, [active, folders]);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify([...expanded])); } catch { /* Private browsing may block storage. */ }
  }, [expanded, key]);

  const ids = new Set(folders.map(folder => folder.id));
  const children = new Map<string | null, KnowledgeFolder[]>();
  for (const folder of folders) {
    const parent = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    const peers = children.get(parent) ?? [];
    peers.push(folder);
    children.set(parent, peers);
  }
  for (const peers of children.values()) peers.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const visible: KnowledgeFolder[] = [];
  function collect(parent: string | null) {
    for (const folder of children.get(parent) ?? []) {
      visible.push(folder);
      if (expanded.has(folder.id)) collect(folder.id);
    }
  }
  collect(null);
  const selected = visible.find(folder => folder.id === active?.id);
  const tabStop = visible.some(folder => folder.id === focused) ? focused : selected?.id ?? visible[0]?.id;
  function toggle(id: string) {
    setExpanded(previous => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  function focus(id?: string | null) {
    if (!id) return;
    const target = Array.from(tree.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])
      .find(element => element.dataset.folder === id);
    target?.focus();
  }
  function keyboard(event: KeyboardEvent, folder: KnowledgeFolder) {
    const index = visible.indexOf(folder);
    const next = children.get(folder.id)?.[0];
    switch (event.key) {
      case 'ArrowDown': focus(visible[index + 1]?.id); break;
      case 'ArrowUp': focus(visible[index - 1]?.id); break;
      case 'Home': focus(visible[0]?.id); break;
      case 'End': focus(visible.at(-1)?.id); break;
      case 'ArrowRight':
        if (next && !expanded.has(folder.id)) toggle(folder.id);
        else focus(next?.id);
        break;
      case 'ArrowLeft':
        if (next && expanded.has(folder.id)) toggle(folder.id);
        else focus(folder.parentId);
        break;
      case 'Enter':
      case ' ': onFolder(folder.id); break;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const time = Date.now();
        const text = (time - typed.current.time < 650 ? typed.current.text : '') + event.key.toLocaleLowerCase();
        typed.current = { text, time };
        focus([...visible.slice(index + 1), ...visible.slice(0, index + 1)]
          .find(candidate => candidate.name.toLocaleLowerCase().startsWith(text))?.id);
      }
    }
    event.stopPropagation();
    event.preventDefault();
  }

  function render(parent: string | null, level: number) {
    return (children.get(parent) ?? []).map(folder => {
      const hasChildren = children.has(folder.id);
      const open = expanded.has(folder.id);
      return <div key={folder.id} role="treeitem" data-folder={folder.id} aria-label={folder.name}
        aria-level={level} aria-selected={active?.id === folder.id} aria-expanded={hasChildren ? open : undefined}
        tabIndex={tabStop === folder.id ? 0 : -1} onFocus={event => { if (event.target === event.currentTarget) setFocused(folder.id); }}
        onKeyDown={event => keyboard(event, folder)}>
        <div className="kh-tree-row" style={{ paddingInlineStart: 6 + (level - 1) * 14 }}
          onClick={() => { focus(folder.id); onFolder(folder.id); }} onDrop={event => onDrop(event, folder.id)}
          data-drop-folder={folder.id} data-drop-active={dropTarget === folder.id}>
          <span className="kh-tree-toggle" data-open={open} onClick={event => {
            if (!hasChildren) return;
            event.stopPropagation(); focus(folder.id); toggle(folder.id);
          }}>{hasChildren && <Icon name="chevron" />}</span>
          <Icon name="folder" /><span className="kh-tree-name" title={folder.name}>{folder.name}</span>
        </div>
        {hasChildren && open && <div role="group">{render(folder.id, level + 1)}</div>}
      </div>;
    });
  }
  return <div className="kh-tree" role="tree" aria-label="Knowledge folders" ref={tree}>{render(null, 1)}</div>;
}
