import { useState, useCallback, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { BoardImage, API_BASE_URL } from '../api';
import { TerminologyTags } from './TerminologyTags';
import { ConfirmDialog } from './ConfirmDialog';
import { Trash2, Palette } from 'lucide-react';
import clsx from 'clsx';

interface CanvasCardProps {
  image: BoardImage;
  scale: number;
  zIndex: number;
  onDragStart: (id: number) => void;
  onDrag: (id: number, x: number, y: number, width: number, height: number) => { snapX: number | null; snapY: number | null };
  onDragStop: (id: number, pos: { x: number; y: number; width: number; height: number }) => void;
  onResizeStart: (id: number) => void;
  onResize: (id: number, x: number, y: number, width: number, height: number) => void;
  onResizeStop: (id: number, pos: { x: number; y: number; width: number; height: number }) => void;
  onRemoveTag: (imageId: number, tagId: number) => void;
  onDelete: (imageId: number) => void;
  onExtractColors: (imageId: number) => void;
  onExpand: (imageId: number) => void;
}

export const CanvasCard = ({
  image,
  scale,
  zIndex,
  onDragStart,
  onDrag,
  onDragStop,
  onResizeStart,
  onResize,
  onResizeStop,
  onRemoveTag,
  onDelete,
  onExtractColors,
  onExpand,
}: CanvasCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isVideo = image.url.match(/\.(mp4|webm|mov|ogg)$/i) !== null;
  const mediaSrc = `${API_BASE_URL}${image.url}`;

  const cardWidth = image.width ?? 280;
  const cardHeight = image.height ? image.height : 'auto';
  const posX = image.x ?? 0;
  const posY = image.y ?? 0;

  // Track position during drag for snapping
  const dragPos = useRef({ x: posX, y: posY });

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  }, []);

  const handleExtractColors = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onExtractColors(image.id);
  }, [image.id, onExtractColors]);

  const heightNum = typeof cardHeight === 'number' ? cardHeight : 200;

  return (
    <>
      <Rnd
        position={{ x: posX, y: posY }}
        size={{ width: cardWidth, height: cardHeight as any }}
        scale={scale}
        minWidth={120}
        minHeight={80}
        enableResizing={{
          topLeft: true,
          topRight: true,
          bottomLeft: true,
          bottomRight: true,
          top: false,
          right: false,
          bottom: false,
          left: false,
        }}
        onDragStart={() => {
          dragPos.current = { x: posX, y: posY };
          onDragStart(image.id);
        }}
        onDrag={(_e, d) => {
          const snap = onDrag(image.id, d.x, d.y, cardWidth, heightNum);
          // Apply snap if found
          if (snap.snapX !== null) dragPos.current.x = snap.snapX;
          else dragPos.current.x = d.x;
          if (snap.snapY !== null) dragPos.current.y = snap.snapY;
          else dragPos.current.y = d.y;
        }}
        onDragStop={() => {
          const finalX = dragPos.current.x;
          const finalY = dragPos.current.y;
          onDragStop(image.id, {
            x: Math.round(finalX),
            y: Math.round(finalY),
            width: cardWidth,
            height: typeof cardHeight === 'number' ? cardHeight : 0,
          });
        }}
        onResizeStart={() => {
          onResizeStart(image.id);
        }}
        onResize={(_e, _direction, ref, _delta, position) => {
          const w = parseInt(ref.style.width, 10) || cardWidth;
          const h = parseInt(ref.style.height, 10) || heightNum;
          onResize(image.id, position.x, position.y, w, h);
        }}
        onResizeStop={(_e, _direction, ref, _delta, position) => {
          onResizeStop(image.id, {
            x: Math.round(position.x),
            y: Math.round(position.y),
            width: parseInt(ref.style.width, 10) || cardWidth,
            height: parseInt(ref.style.height, 10) || 0,
          });
        }}
        style={{ zIndex }}
        className="canvas-card-rnd"
      >
        <div
          className={clsx(
            "w-full h-full bg-white dark:bg-neutral-800 rounded-sm shadow-md hover:shadow-xl transition-shadow duration-200 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing group",
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Action buttons on hover */}
          <div className={clsx(
            "absolute top-1.5 right-1.5 flex gap-1 z-20 transition-opacity duration-150",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <button
              onClick={handleExtractColors}
              className="p-1.5 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
              title="Extract colors"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              title="Delete image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Image */}
          <div
            className="flex-1 min-h-0 overflow-hidden cursor-zoom-in"
            onDoubleClick={(e) => { e.stopPropagation(); onExpand(image.id); }}
          >
            {isVideo ? (
              <video
                src={mediaSrc}
                className="w-full h-full object-cover pointer-events-none"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={mediaSrc}
                alt="Moodboard item"
                className="w-full h-full object-cover pointer-events-none"
                loading="lazy"
                draggable={false}
              />
            )}
          </div>

          {/* Tags */}
          <div className="p-1.5 min-h-[28px] shrink-0">
            <TerminologyTags
              tags={image.tags || []}
              onRemove={(tagId) => onRemoveTag(image.id, tagId)}
              inline
            />
          </div>
        </div>
      </Rnd>

      {showDeleteDialog && (
        <ConfirmDialog
          title="Delete image"
          message="This will permanently delete this image and its tags. Are you sure?"
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => {
            setShowDeleteDialog(false);
            onDelete(image.id);
          }}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </>
  );
};
