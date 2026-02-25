import { useCallback, useEffect, useState, useMemo } from 'react';
import { BoardImage } from '../api';
import { CanvasCard } from './CanvasCard';
import { AlignmentGuides } from './AlignmentGuides';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { useAlignmentGuides, Guide } from '../hooks/useAlignmentGuides';
import { ImagePlus } from 'lucide-react';

interface InfiniteCanvasProps {
  images: BoardImage[];
  zIndexMap: Record<number, number>;
  onBringToFront: (id: number) => void;
  onPositionChange: (id: number, pos: { x: number; y: number; width: number; height: number }) => void;
  onRemoveTag: (imageId: number, tagId: number) => void;
  onDelete: (imageId: number) => void;
  onExtractColors: (imageId: number) => void;
  onExpand: (imageId: number) => void;
  onUploadFile: (file: File, canvasX: number, canvasY: number) => void;
}

export const InfiniteCanvas = ({
  images,
  zIndexMap,
  onBringToFront,
  onPositionChange,
  onRemoveTag,
  onDelete,
  onExtractColors,
  onExpand,
  onUploadFile,
}: InfiniteCanvasProps) => {
  const { transform, containerRef, onMouseDown, onMouseMove, onMouseUp, screenToCanvas, resetView } = useCanvasTransform();
  const [activeGuides, setActiveGuides] = useState<Guide[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Build rects array for alignment calculations
  const imageRects = useMemo(() =>
    images.map(img => ({
      x: img.x ?? 0,
      y: img.y ?? 0,
      width: img.width ?? 280,
      height: img.height || 200, // estimate for auto-height cards
    })),
    [images]
  );

  const draggingIndex = draggingId !== null ? images.findIndex(img => img.id === draggingId) : -1;
  const { calcSnap, clearGuides } = useAlignmentGuides(imageRects, draggingIndex);

  const handleDragStart = useCallback((id: number) => {
    setDraggingId(id);
    onBringToFront(id);
  }, [onBringToFront]);

  const handleDrag = useCallback((_id: number, x: number, y: number, width: number, height: number) => {
    const result = calcSnap({ x, y, width, height });
    setActiveGuides(result.guides);
    return { snapX: result.snapX, snapY: result.snapY };
  }, [calcSnap]);

  const handleDragStop = useCallback((id: number, pos: { x: number; y: number; width: number; height: number }) => {
    setDraggingId(null);
    setActiveGuides([]);
    clearGuides();
    onPositionChange(id, pos);
  }, [onPositionChange, clearGuides]);

  const handleResizeStart = useCallback((id: number) => {
    setDraggingId(id);
  }, []);

  const handleResize = useCallback((_id: number, x: number, y: number, width: number, height: number) => {
    const result = calcSnap({ x, y, width, height });
    setActiveGuides(result.guides);
  }, [calcSnap]);

  const handleResizeStop = useCallback((id: number, pos: { x: number; y: number; width: number; height: number }) => {
    setDraggingId(null);
    setActiveGuides([]);
    clearGuides();
    onPositionChange(id, pos);
  }, [onPositionChange, clearGuides]);

  // Shared helper: get canvas coords for the visible center
  const getViewportCenter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const centerScreenX = rect.left + rect.width / 2;
    const centerScreenY = rect.top + rect.height / 2;
    const pos = screenToCanvas(centerScreenX, centerScreenY, rect);
    return { x: pos.x - 140, y: pos.y - 100 };
  }, [screenToCanvas]);

  const uploadAtScreenPoint = useCallback((file: File, screenX: number, screenY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pos = screenToCanvas(screenX, screenY, rect);
    onUploadFile(file, pos.x - 140, pos.y - 100);
  }, [screenToCanvas, onUploadFile]);

  // Paste: place at visible center of the canvas
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' || item.type.startsWith('image/') || item.type.startsWith('video/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const center = getViewportCenter();
            onUploadFile(file, center.x, center.y);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [getViewportCenter, onUploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file) uploadAtScreenPoint(file, e.clientX, e.clientY);
  }, [uploadAtScreenPoint]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const center = getViewportCenter();
      onUploadFile(file, center.x, center.y);
    }
    if (e.target) e.target.value = '';
  }, [getViewportCenter, onUploadFile]);

  const zoomPercent = Math.round(transform.scale * 100);

  return (
    <div
      ref={containerRef}
      className="canvas-dotgrid flex-1 relative overflow-hidden cursor-default select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Transform layer */}
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {images.map((img) => (
          <CanvasCard
            key={img.id}
            image={img}
            scale={transform.scale}
            zIndex={zIndexMap[img.id] || 1}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragStop={handleDragStop}
            onResizeStart={handleResizeStart}
            onResize={handleResize}
            onResizeStop={handleResizeStop}
            onRemoveTag={onRemoveTag}
            onDelete={onDelete}
            onExtractColors={onExtractColors}
            onExpand={onExpand}
          />
        ))}

        {/* Alignment guide lines */}
        <AlignmentGuides guides={activeGuides} />
      </div>

      {/* Empty state */}
      {images.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <ImagePlus className="w-12 h-12 text-neutral-500 dark:text-neutral-600 mb-3" strokeWidth={1} />
          <p className="text-sm text-neutral-500 dark:text-neutral-500 mb-1">
            Drop images here or paste from clipboard
          </p>
          <label className="text-sm text-neutral-400 dark:text-neutral-500 hover:text-neutral-200 cursor-pointer underline underline-offset-2 transition-colors pointer-events-auto">
            or browse files
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
            />
          </label>
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={resetView}
          className="px-2 py-1 text-[10px] font-mono bg-black/40 text-white/70 hover:text-white rounded-sm backdrop-blur-sm transition-colors"
          title="Reset zoom"
        >
          {zoomPercent}%
        </button>
      </div>
    </div>
  );
};
