import { useState, type CSSProperties, type ReactNode } from 'react';

type Props = {
  id: string;
  label: string;
  editMode: boolean;
  onMove: (fromId: string, toId: string) => void;
  children: ReactNode;
};

export function DraggableTopbarItem({ id, label, editMode, onMove, children }: Props) {
  const [dragOver, setDragOver] = useState<'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!editMode) {
    return <>{children}</>;
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    // Both custom type and text/plain (Firefox fallback)
    event.dataTransfer.setData('text/topbar-slot', id);
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
    // Use a transparent drag image so the default ghost is hidden
    if (event.dataTransfer.setDragImage) {
      const img = new Image();
      img.src =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="transparent"/></svg>';
      try {
        event.dataTransfer.setDragImage(img, 0, 0);
      } catch {
        // ignore
      }
    }
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOver(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types);
    if (!types.includes('text/topbar-slot') && !types.includes('text/plain')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (isDragging) return; // skip if we're the dragged element
    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    setDragOver(event.clientX < midpoint ? 'left' : 'right');
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    setDragOver(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const fromId =
      event.dataTransfer.getData('text/topbar-slot') ||
      event.dataTransfer.getData('text/plain');
    setDragOver(null);
    setIsDragging(false);
    if (!fromId || fromId === id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const side = event.clientX < midpoint ? 'left' : 'right';
    onMove(fromId, `${id}:${side}`);
  };

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    touchAction: 'none',
    outline: dragOver
      ? '2px solid #c9a25a'
      : '2px dashed rgba(201, 162, 90, 0.35)',
    outlineOffset: '2px',
    borderRadius: '6px',
    transition: 'outline-color 0.12s, opacity 0.12s',
    opacity: isDragging ? 0.4 : 1,
    background: dragOver ? 'rgba(201, 162, 90, 0.06)' : 'transparent',
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={`Тащи меня: ${label}`}
      style={wrapperStyle}
    >
      {dragOver === 'left' && (
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
      {dragOver === 'right' && (
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
