import { useEffect, useRef, type ReactNode } from 'react';

export function WorkspaceDialog({ children, labelledBy, onClose, pending = false, className }: {
  children: ReactNode; labelledBy: string; onClose: () => void; pending?: boolean; className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      clearTimeout(timer.current);
      if (element?.open) element.close();
    };
  }, []);

  function requestClose() {
    if (pending || closing.current) return;
    const element = dialog.current;
    const reduced = document.documentElement?.classList.contains('cc-reduced-motion');
    if (!element || reduced) { onClose(); return; }
    element.classList.add('cc-closing');
    const animName = typeof getComputedStyle === 'function' ? getComputedStyle(element).animationName : '';
    if (!animName || animName === 'none') {
      element.classList.remove('cc-closing');
      onClose();
      return;
    }
    closing.current = true;
    const finish = () => {
      if (!closing.current) return;
      closing.current = false;
      clearTimeout(timer.current);
      element.removeEventListener('animationend', finish);
      element.classList.remove('cc-closing');
      onClose();
    };
    element.addEventListener('animationend', finish, { once: true });
    timer.current = setTimeout(finish, 175);
  }

  return <dialog ref={dialog} aria-labelledby={labelledBy} className={className}
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>
    {children}
  </dialog>;
}
