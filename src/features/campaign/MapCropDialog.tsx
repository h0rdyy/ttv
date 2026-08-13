'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Crop = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

type Props = {
  file: File;
  maxBytes: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
  onError: (message: string) => void;
};

const MIN_CROP = 0.05;
const MAX_OUTPUT_EDGE = 8192;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export function MapCropDialog({ file, maxBytes, onCancel, onConfirm, onError }: Props) {
  const [url, setUrl] = useState('');
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, width: 1, height: 1 });
  const [processing, setProcessing] = useState(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; mode: DragMode; start: Point; crop: Crop } | null>(null);

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const outputSize = useMemo(() => ({
    width: Math.max(1, Math.round(naturalSize.width * crop.width)),
    height: Math.max(1, Math.round(naturalSize.height * crop.height)),
  }), [crop, naturalSize]);

  const beginDrag = (event: React.PointerEvent, mode: DragMode) => {
    if (processing) return;
    event.preventDefault();
    event.stopPropagation();
    surfaceRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, mode, start: { x: event.clientX, y: event.clientY }, crop };
  };

  const moveDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !surface) return;
    const bounds = surface.getBoundingClientRect();
    const dx = (event.clientX - drag.start.x) / bounds.width;
    const dy = (event.clientY - drag.start.y) / bounds.height;
    const initial = drag.crop;

    if (drag.mode === 'move') {
      setCrop({ ...initial, x: clamp(initial.x + dx, 0, 1 - initial.width), y: clamp(initial.y + dy, 0, 1 - initial.height) });
      return;
    }

    const left = drag.mode.includes('w') ? clamp(initial.x + dx, 0, initial.x + initial.width - MIN_CROP) : initial.x;
    const right = drag.mode.includes('e') ? clamp(initial.x + initial.width + dx, initial.x + MIN_CROP, 1) : initial.x + initial.width;
    const top = drag.mode.includes('n') ? clamp(initial.y + dy, 0, initial.y + initial.height - MIN_CROP) : initial.y;
    const bottom = drag.mode.includes('s') ? clamp(initial.y + initial.height + dy, initial.y + MIN_CROP, 1) : initial.y + initial.height;
    setCrop({ x: left, y: top, width: right - left, height: bottom - top });
  };

  const endDrag = (event: React.PointerEvent) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (surfaceRef.current?.hasPointerCapture(event.pointerId)) surfaceRef.current.releasePointerCapture(event.pointerId);
  };

  const setAspect = (ratio: number | null) => {
    if (!ratio || !naturalSize.width || !naturalSize.height) {
      setCrop({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
      return;
    }
    const normalizedRatio = ratio / (naturalSize.width / naturalSize.height);
    let width = 0.9;
    let height = width / normalizedRatio;
    if (height > 0.9) {
      height = 0.9;
      width = height * normalizedRatio;
    }
    setCrop({ x: (1 - width) / 2, y: (1 - height) / 2, width, height });
  };

  const applyCrop = async () => {
    if (!url || !naturalSize.width || processing) return;
    setProcessing(true);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const sourceX = Math.round(crop.x * image.naturalWidth);
      const sourceY = Math.round(crop.y * image.naturalHeight);
      const sourceWidth = Math.max(1, Math.round(crop.width * image.naturalWidth));
      const sourceHeight = Math.max(1, Math.round(crop.height * image.naturalHeight));
      const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas unavailable');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

      const preferredType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      let blob = await canvasBlob(canvas, preferredType, 0.94);
      let outputType = preferredType;
      if (blob && blob.size > maxBytes) {
        blob = await canvasBlob(canvas, 'image/webp', 0.88);
        outputType = 'image/webp';
      }
      if (blob && blob.size > maxBytes) blob = await canvasBlob(canvas, 'image/webp', 0.72);
      if (!blob || blob.size > maxBytes) {
        onError('После обрезки карта всё ещё больше 6 МБ. Выберите меньшую область.');
        setProcessing(false);
        return;
      }
      const extension = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'map';
      onConfirm(new File([blob], `${baseName}-cropped.${extension}`, { type: outputType, lastModified: Date.now() }));
    } catch {
      onError('Не удалось обрезать изображение. Попробуйте другой файл.');
      setProcessing(false);
    }
  };

  return (
    <div className="map-crop-backdrop" role="dialog" aria-modal="true" aria-label="Обрезка карты">
      <section className="map-crop-dialog">
        <header><div><span className="eyebrow">ПОДГОТОВКА КАРТЫ</span><h2>Обрезать перед загрузкой</h2></div><button className="close-button" disabled={processing} onClick={onCancel}>×</button></header>
        <div className="map-crop-toolbar">
          <span>Рамку можно двигать и растягивать за углы</span>
          <div><button className="button" onClick={() => setCrop({ x: 0, y: 0, width: 1, height: 1 })}>Вся карта</button><button className="button" onClick={() => setAspect(16 / 9)}>16:9</button><button className="button" onClick={() => setAspect(4 / 3)}>4:3</button><button className="button" onClick={() => setAspect(1)}>1:1</button><button className="button" onClick={() => setAspect(null)}>Свободно</button></div>
        </div>
        <div className="map-crop-workspace">
          {url && (
            <div
              ref={surfaceRef}
              className="map-crop-surface"
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <img src={url} alt="Предпросмотр карты" draggable={false} onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
              <div className="crop-shade top" style={{ height: `${crop.y * 100}%` }} />
              <div className="crop-shade bottom" style={{ top: `${(crop.y + crop.height) * 100}%` }} />
              <div className="crop-shade left" style={{ top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.height * 100}%` }} />
              <div className="crop-shade right" style={{ top: `${crop.y * 100}%`, left: `${(crop.x + crop.width) * 100}%`, height: `${crop.height * 100}%` }} />
              <div className="map-crop-selection" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} onPointerDown={(event) => beginDrag(event, 'move')}>
                {(['nw', 'ne', 'sw', 'se'] as DragMode[]).map((handle) => <button type="button" aria-label={`Изменить рамку ${handle}`} key={handle} className={`crop-handle ${handle}`} onPointerDown={(event) => beginDrag(event, handle)} />)}
              </div>
            </div>
          )}
        </div>
        <footer>
          <div><strong>{outputSize.width.toLocaleString('ru-RU')} × {outputSize.height.toLocaleString('ru-RU')} px</strong><small>Исходник: {naturalSize.width.toLocaleString('ru-RU')} × {naturalSize.height.toLocaleString('ru-RU')} px</small></div>
          <button className="button" disabled={processing} onClick={() => onConfirm(file)}>Загрузить без обрезки</button>
          <button className="button primary" disabled={processing || !naturalSize.width} onClick={() => void applyCrop()}>{processing ? 'Подготовка…' : 'Обрезать и загрузить'}</button>
        </footer>
      </section>
    </div>
  );
}
