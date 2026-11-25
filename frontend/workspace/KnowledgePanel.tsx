import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../shared/Brand';

export interface PanelControls {
  button: ReactNode;
}

export function KnowledgePanel({ label, className, children }: {
  label: string; className: string; children: (controls: PanelControls) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(() => window.matchMedia?.('(max-width: 760px)')?.matches ?? false);
  const panel = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const restoreToggle = useRef(false);
  useLayoutEffect(() => {
    const element = panel.current!;
    if (element.open) element.close();
    if (expanded) element.showModal();
    else element.setAttribute('open', '');
    if (restoreToggle.current) toggle.current?.focus();
  }, [expanded]);

  return <dialog ref={panel} className={'kh-inspector ' + className} data-expanded={expanded}
    role={expanded ? 'dialog' : 'complementary'} aria-label={label}
    onCancel={event => { event.preventDefault(); restoreToggle.current = true; setExpanded(false); }}>
    {children({ button: <button ref={toggle} type="button" className="kh-button"
      onClick={() => { restoreToggle.current = true; setExpanded(value => !value); }}
      aria-label={expanded ? 'Dock ' + label : 'Expand ' + label}>
      <Icon name={expanded ? 'grid' : 'expand'} /> {expanded ? 'Dock' : 'Expand'}</button> })}
  </dialog>;
}
