import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const DRAG_THRESHOLD_PX = 4;

type DragHover = { targetId: string; side: 'left' | 'right' };

type Props = {
  id: string;
  label: string;
  editMode: boolean;
  onMove: (fromId: string, toHint: string) => void;
  children: ReactNode;
};

export function DraggableTopbarItem({ id, label, editMode, onMove, children }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragHover, setDragHover] = useState<DragHover | null>(null);
  // Refs carry the live drag state across handlers without forcing a re-bind
  // on every render, and they survive a render that overwrites a stale
  // closure during an in-flight drag.
  const startRef = useRef<{ x: number; y: number; pointerId: number; root: HTMLElement } | null>(null);
  const hoverRef = useRef<DragHover | null>(null);
  hoverRef.current = dragHover;

  const beginTracking = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return; // primary button / single touch only
    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      root: event.currentTarget,
    };
  }, []);

  // We listen on the wrapper for pointerdown, but we move the move/up/cancel
  // listeners to the document once a drag is in progress. This way the
  // pointer can leave the wrapper mid-drag without losing tracking, and
  // native clicks on the wrapper's children (buttons, selects) are not
  // stolen — setPointerCapture would suppress their click event because
  // pointerup would then fire on the wrapper instead of the original target.
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event: PointerEvent) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= DRAG_THRESHOLD_PX) return;

      // elementFromPoint ignores the element being captured, so the wrapper
      // itself is skipped automatically and we get the slot under the cursor.
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const slotEl = under?.closest<HTMLElement>('[data-topbar-slot-id]');
      if (slotEl && slotEl.dataset.topbarSlotId && slotEl.dataset.topbarSlotId !== id) {
        const rect = slotEl.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const side: 'left' | 'right' = event.clientX < midpoint ? 'left' : 'right';
        const next: DragHover = { targetId: slotEl.dataset.topbarSlotId, side };
        const prev = hoverRef.current;
        if (!prev || prev.targetId !== next.targetId || prev.side !== next.side) {
          setDragHover(next);
        }
      } else if (hoverRef.current) {
        setDragHover(null);
      }
    };

    const handleUp = (event: PointerEvent) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const hover = hoverRef.current;
      if (hover && hover.targetId !== id) {
        onMove(id, `${hover.targetId}:${hover.side}`);
      }
      startRef.current = null;
      setIsDragging(false);
      setDragHover(null);
    };

    const handleCancel = (event: PointerEvent) => {
      if (!startRef.current || startRef.current.pointerId !== event.pointerId) return;
      startRef.current = null;
      setIsDragging(false);
      setDragHover(null);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleCancel);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleCancel);
    };
  }, [isDragging, id, onMove]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      beginTracking(event);
    },
    [beginTracking],
  );

  // Once the user crosses the drag threshold on the same pointer that started
  // the press, promote the gesture to a real drag and attach the document
  // listeners. Doing this on the wrapper (rather than capturing immediately)
  // preserves click events on the inner buttons/selects for sub-threshold
  // presses.
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging) return; // document listener takes over once we promote
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        setIsDragging(true);
      }
    },
    [isDragging],
  );

  const handlePointerCancel = useCallback(() => {
    startRef.current = null;
    setIsDragging(false);
    setDragHover(null);
  }, []);

  if (!editMode) {
    return <>{children}</>;
  }

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    touchAction: 'none',
    outline: dragHover
      ? '2px solid #c9a25a'
      : '2px dashed rgba(201, 162, 90, 0.35)',
    outlineOffset: '2px',
    borderRadius: '6px',
    transition: 'outline-color 0.12s, opacity 0.12s',
    opacity: isDragging ? 0.4 : 1,
    background: dragHover ? 'rgba(201, 162, 90, 0.06)' : 'transparent',
  };

  return (
    <div
      data-topbar-slot-id={id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerCancel}
      title={`Тащи меня: ${label}`}
      style={wrapperStyle}
    >
      {dragHover?.side === 'left' && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: -4,
            width: 4,
            background: '#c9a25a',
            borderRadius: 2,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      )}
      {dragHover?.side === 'right' && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: -4,
            width: 4,
            background: '#c9a25a',
            borderRadius: 2,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: -10,
          right: -10,
          minWidth: 20,
          height: 20,
          padding: '0 4px',
          borderRadius: 10,
          background: '#c9a25a',
          color: '#0c0a08',
          fontSize: 11,
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
          lineHeight: 1,
          border: '2px solid #0c0a08',
          zIndex: 11,
          pointerEvents: 'none',
        }}
      >
        ⋮⋮
      </span>
    </div>
  );
}
