import { useRef, useState } from 'react';
import { Icon } from '../shared/Brand';

const corners = ['Bottom right', 'Bottom left', 'Top right', 'Top left'] as const;
type Corner = typeof corners[number];
const key = 'cloudcore.import-card-corner';

export function ImportTray({ title, summary, total, placed, busy, onExpand, onHide, onDismiss }: {
  title: string; summary: string; total: number; placed: number; busy: boolean;
  onExpand: () => void; onHide: () => void; onDismiss?: () => void;
}) {
  const [corner, setCorner] = useState<Corner>(() => {
    try { return corners.find(value => value === localStorage.getItem(key)) ?? corners[0]; }
    catch { return corners[0]; }
  });
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; width: number; height: number; startX: number; startY: number } | undefined>(undefined);
  const dragged = useRef(false);
  function dock(value: Corner) {
    setCorner(value);
    try { localStorage.setItem(key, value); } catch { /* Keep position for this session. */ }
  }
  return <aside ref={panel} className="knowledge-import-tray" aria-label="Knowledge import progress"
    data-corner={corner} style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
    <details className="import-tray-move">
      <summary aria-label="Move import status" title="Drag or move import status"
        onPointerDown={event => {
          if (!panel.current || event.button !== 0) return;
          const { left, top, width, height } = panel.current.getBoundingClientRect();
          dragged.current = false;
          drag.current = { id: event.pointerId, x: event.clientX - left, y: event.clientY - top, width, height,
            startX: event.clientX, startY: event.clientY };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (start?.id !== event.pointerId) return;
          if (!dragged.current && Math.hypot(event.clientX - start.startX, event.clientY - start.startY) < 5) return;
          dragged.current = true;
          setPosition({ x: Math.max(8, Math.min(event.clientX - start.x, innerWidth - start.width - 8)),
            y: Math.max(8, Math.min(event.clientY - start.y, innerHeight - start.height - 8)) });
        }}
        onPointerUp={event => {
          if (dragged.current) {
            event.preventDefault();
            const side = event.clientX < innerWidth / 2 ? 'left' : 'right';
            const edge = event.clientY < innerHeight / 2 ? 'Top' : 'Bottom';
            dock(`${edge} ${side}`);
          }
          drag.current = undefined;
          setPosition(undefined);
        }}
        onPointerCancel={() => { drag.current = undefined; setPosition(undefined); }}
        onClick={event => {
          if (event.detail && dragged.current) event.preventDefault();
          dragged.current = false;
        }}>
        <Icon name="more" />
      </summary>
      <div>{corners.map(value => <button type="button" key={value} aria-pressed={corner === value} onClick={event => {
        dock(value); event.currentTarget.closest('details')?.removeAttribute('open');
      }}>{value}</button>)}</div>
    </details>
    <button className="knowledge-import-tray-open" type="button" onClick={onExpand} aria-label="Expand import details">
      <Icon name={busy ? 'upload' : 'file'} /><span><strong>{title}</strong><small>{summary}</small></span><Icon name="chevron" />
    </button>
    <button className="knowledge-import-tray-dismiss" type="button" aria-label="Hide import status" title="Hide import status" onClick={onHide}>−</button>
    {onDismiss && <button className="knowledge-import-tray-dismiss" type="button" aria-label="Dismiss import status" onClick={onDismiss}><Icon name="close" /></button>}
    {busy && total > 0 && <progress aria-label="Files uploaded" max={total} value={Math.min(placed, total)} />}
  </aside>;
}
