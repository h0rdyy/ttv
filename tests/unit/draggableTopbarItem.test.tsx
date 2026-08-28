// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DraggableTopbarItem } from '../../src/features/campaign/DraggableTopbarItem';

afterEach(() => cleanup());

// Pointer events are not fully implemented in jsdom/happy-dom, so we use a
// small adapter that fires the sequence of pointer + mouse events a real
// browser would generate during a drag.
function pointer(target: Element, type: string, init: PointerEventInit) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as any;
  Object.assign(event, {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: 0,
    clientY: 0,
    ...init,
  });
  // Some events must also fire the corresponding mouse event so click
  // synthesis in jsdom works correctly.
  target.dispatchEvent(event);
  return event;
}

function moveEvent(x: number, y: number, target: EventTarget = document) {
  const ev = new Event('pointermove', { bubbles: true }) as any;
  Object.assign(ev, { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y });
  target.dispatchEvent(ev);
  return ev;
}

function upEvent(x: number, y: number, target: EventTarget = document) {
  const ev = new Event('pointerup', { bubbles: true }) as any;
  Object.assign(ev, { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y });
  target.dispatchEvent(ev);
  return ev;
}

function drag(src: Element, fromX: number, fromY: number, toX: number, toY: number) {
  // Press on the source wrapper
  act(() => {
    pointer(src, 'pointerdown', { clientX: fromX, clientY: fromY });
  });
  // Cross the 4px threshold on the wrapper (so the wrapper's onPointerMove
  // promotes the gesture to a real drag, which is what attaches the document
  // listeners via the useEffect).
  const step1X = fromX + 10;
  const step1Y = fromY;
  act(() => {
    moveEvent(step1X, step1Y, src);
  });
  // Subsequent moves go to document, where the promoted drag listener lives
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = step1X + (toX - step1X) * t;
    const y = step1Y + (toY - step1Y) * t;
    act(() => {
      moveEvent(x, y, document);
    });
  }
  // Release on document
  act(() => {
    upEvent(toX, toY, document);
  });
}

describe('DraggableTopbarItem (pointer-based drag)', () => {
  it('renders the children without a wrapper when editMode is false', () => {
    render(
      <DraggableTopbarItem id="brand" label="Бренд" editMode={false} onMove={() => {}}>
        <span data-testid="content">Бренд</span>
      </DraggableTopbarItem>,
    );
    expect(screen.getByTestId('content')).toBeTruthy();
    expect(document.querySelector('[data-topbar-slot-id]')).toBeNull();
  });

  it('wraps the children and exposes data-topbar-slot-id when editMode is true', () => {
    render(
      <DraggableTopbarItem id="brand" label="Бренд" editMode={true} onMove={() => {}}>
        <span data-testid="content">Бренд</span>
      </DraggableTopbarItem>,
    );
    const wrapper = document.querySelector('[data-topbar-slot-id="brand"]');
    expect(wrapper).toBeTruthy();
    expect(screen.getByTestId('content')).toBeTruthy();
  });

  it('fires onMove with fromId and target hint on drop', () => {
    const onMove = vi.fn();
    render(
      <>
        <DraggableTopbarItem id="workshop" label="Мастерская" editMode={true} onMove={onMove}>
          <span>WS</span>
        </DraggableTopbarItem>
        <DraggableTopbarItem id="scene-menu" label="Меню сцены" editMode={true} onMove={onMove}>
          <span>SM</span>
        </DraggableTopbarItem>
      </>,
    );

    const src = document.querySelector('[data-topbar-slot-id="workshop"]')!;
    const dst = document.querySelector('[data-topbar-slot-id="scene-menu"]')!;
    const sBox = { x: 0, y: 0, w: 100, h: 40 };
    const dBox = { x: 200, y: 0, w: 100, h: 40 };
    // Patch getBoundingClientRect for src and dst
    src.getBoundingClientRect = () =>
      ({ left: sBox.x, right: sBox.x + sBox.w, top: sBox.y, bottom: sBox.y + sBox.h, width: sBox.w, height: sBox.h, x: sBox.x, y: sBox.y, toJSON: () => ({}) } as DOMRect);
    dst.getBoundingClientRect = () =>
      ({ left: dBox.x, right: dBox.x + dBox.w, top: dBox.y, bottom: dBox.y + dBox.h, width: dBox.w, height: dBox.h, x: dBox.x, y: dBox.y, toJSON: () => ({}) } as DOMRect);
    // elementFromPoint returns the dst wrapper when querying dst centre
    document.elementFromPoint = ((x: number) => {
      if (x >= dBox.x && x <= dBox.x + dBox.w) return dst;
      return src;
    }) as any;

    // Source centre: (50, 20). Target centre: (250, 20). Drag from (50,20) -> (200,20) i.e. drop on the left half of dst
    drag(src, 50, 20, 200, 20);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]).toEqual(['workshop', 'scene-menu:left']);
  });

  it('does not fire onMove when the gesture is a clean click (no movement)', () => {
    const onMove = vi.fn();
    render(
      <DraggableTopbarItem id="workshop" label="WS" editMode={true} onMove={onMove}>
        <button>click me</button>
      </DraggableTopbarItem>,
    );
    const src = document.querySelector('[data-topbar-slot-id="workshop"]')!;
    const ev = new Event('pointerdown', { bubbles: true }) as any;
    Object.assign(ev, { pointerId: 1, isPrimary: true, clientX: 10, clientY: 10, button: 0 });
    src.dispatchEvent(ev);
    const up = new Event('pointerup', { bubbles: true }) as any;
    Object.assign(up, { pointerId: 1, isPrimary: true, clientX: 10, clientY: 10 });
    document.dispatchEvent(up);
    expect(onMove).not.toHaveBeenCalled();
  });
});
