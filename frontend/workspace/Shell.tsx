import { useEffect, type ChangeEvent } from 'react';
import { Icon } from '../shared/Brand';
import { Pip, pipActivity } from './Pip';

export interface ShellProps {
  route: string;
  hasMessages: boolean;
  hasMeetingSelection: boolean;
  onDocumentSelected: (file: File) => void;
  onImageSelected: (file: File) => void;
  onCloseDialog: (dialog: HTMLDialogElement) => void;
  onOpenPipChat?: (trigger: HTMLButtonElement) => void;
}

const pages = ['home', 'assistant', 'meetings', 'documents', 'knowledge', 'images', 'history', 'settings'] as const;
type Page = typeof pages[number];

function isPage(route: string): route is Page {
  return pages.some(page => page === route);
}

function PageHost({ page, hasMeetingSelection }: { page: Page; hasMeetingSelection: boolean }) {
  switch (page) {
    case 'home':
    case 'history':
      return <div id="workspace-react-page" data-workspace-page={page} />;
    case 'assistant':
      return <div id="workspace-react-assistant" />;
    case 'meetings':
      return <div id={hasMeetingSelection ? 'workspace-react-meeting-detail' : 'workspace-react-meetings'} />;
    case 'documents':
    case 'knowledge':
      return <div id="workspace-react-knowledge" />;
    case 'images':
      return <div id="premium-studio" className="image-studio" />;
    case 'settings':
      return <div id="workspace-react-settings" />;
  }
}

function selectFile(event: ChangeEvent<HTMLInputElement>, onSelect: (file: File) => void) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  input.value = '';
  if (file) onSelect(file);
}

export function Shell({ route, hasMessages, hasMeetingSelection, onDocumentSelected, onImageSelected, onCloseDialog, onOpenPipChat }: ShellProps) {
  const page = isPage(route) ? route : 'home';
  const emptyAssistant = page === 'assistant' && !hasMessages;
  useEffect(() => {
    if (page === 'meetings' || page === 'assistant') pipActivity(page);
    if (page === 'images') pipActivity('studio');
  }, [page]);

  useEffect(() => {
    if (page !== 'assistant') return;
    function pasteImage(event: ClipboardEvent) {
      // Hash changes are visible before the router commits the next shell.
      if (location.hash.slice(1).split('/')[0] !== 'assistant') return;
      for (const item of Array.from(event.clipboardData?.items ?? [])) {
        if (!item.type.startsWith('image/')) continue;
        const image = item.getAsFile();
        if (!image) continue;
        event.preventDefault();
        onImageSelected(image);
        return;
      }
    }
    window.addEventListener('paste', pasteImage);
    return () => window.removeEventListener('paste', pasteImage);
  }, [page, onImageSelected]);

  return <>
    <div className={`workspace ref-workspace ${page}-workspace${emptyAssistant ? ' ref-assistant-empty' : ''}`}>
      <aside className="sidebar ref-sidebar" id="workspace-sidebar">
        <div className="ref-sidebar-inner" id="workspace-react-sidebar" data-page={page} />
      </aside>
      <div className="workspace-body">
        <header className="workspace-header" id="workspace-react-header" data-page={page} />
        <main className="workspace-main"><PageHost page={page} hasMeetingSelection={hasMeetingSelection} /></main>
      </div>
      <Pip onOpenChat={onOpenPipChat} />
      <div id="workspace-pip-chat" />
    </div>
    <input hidden type="file" id="document-input" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json"
      onChange={event => selectFile(event, onDocumentSelected)} />
    <input hidden type="file" id="image-input" accept="image/png,image/jpeg,image/webp"
      onChange={event => selectFile(event, onImageSelected)} />
    <dialog id="dialog" onClick={event => {
      const dialog = event.currentTarget;
      if (dialog.classList.contains('uncloseable')) return;
      const target = event.target;
      if (target === dialog || (target instanceof Element && target.closest('.dialog-close'))) onCloseDialog(dialog);
    }}>
      <button type="button" className="dialog-close icon-button" aria-label="Close"><Icon name="close" /></button>
      <div id="dialog-content" />
    </dialog>
    <div id="workspace-shared-dialog" />
  </>;
}
