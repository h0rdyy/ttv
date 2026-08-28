import { useState, type ReactNode } from 'react';

type Props = {
  id: string;
  label: string;
  editMode: boolean;
  onMove: (fromId: string, toId: string) => void;
  children: ReactNode;
};

export function DraggableTopbarItem({ id, label, editMode, onMove, children }: Props) {
  const [dragOver, setDragOver] = useState<'left' | 'right' | null>(null);

  if (!editMode) {
    return <>{children}</>;
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text/topbar-slot', id);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('text/topbar-slot')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    setDragOver(event.clientX < midpoint ? 'left' : 'right');
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const fromId = event.dataTransfer.getData('text/topbar-slot');
    setDragOver(null);
    if (!fromId || fromId === id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const side = event.clientX < midpoint ? 'left' : 'right';
    onMove(fromId, `${id}:${side}`);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={`Перетащи блок: ${label}`}
      style={{
        position: 'relative',
        cursor: 'grab',
        outline: dragOver ? '2px dashed #c9a25a' : '1px dashed rgba(201, 162, 90, 0.4)',
        outlineOffset: '2px',
        borderRadius: '6px',
        transition: 'outline-color 0.12s',
      }}
    >
      {dragOver === 'left' && (
        <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: -4, width: 3, background: '#c9a25a', borderRadius: 2 }} />
      )}
      {dragOver === 'right' && (
        <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, right: -4, width: 3, background: '#c9a25a', borderRadius: 2 }} />
      )}
      {children}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#c9a25a',
          color: '#0c0a08',
          fontSize: 10,
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
          lineHeight: 1,
          border: '1px solid #0c0a08',
        }}
      >
        ⋮⋮
      </span>
    </div>
  );
}
