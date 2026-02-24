import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BoardImage, API_BASE_URL } from '../api';
import { TerminologyTags } from './TerminologyTags';
import { Trash2, X } from 'lucide-react';
import clsx from 'clsx';

interface ImageCardProps {
  image: BoardImage;
  onRemoveTag: (imageId: number, tagId: number) => void;
  onDelete: (imageId: number) => void;
}

export const ImageCard = ({ image, onRemoveTag, onDelete }: ImageCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Check if media is a video
  const isVideo = image.url.match(/\.(mp4|webm|mov|ogg)$/i) !== null;
  const mediaSrc = `${API_BASE_URL}${image.url}`;

  // Randomize a small rotation for the polaroid effect
  const rotation = (image.id % 5) - 2; // -2 to 2 degrees

  // Colorful translucent tapes
  const tapeColors = ['bg-rose-400/80', 'bg-amber-400/80', 'bg-indigo-400/80', 'bg-emerald-400/80'];
  const tapeColor = tapeColors[image.id % tapeColors.length];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2500);
      return;
    }
    setConfirmDelete(false);
    onDelete(image.id);
  };

  const closeModal = useCallback(() => setIsExpanded(false), []);

  // Focus trap and Escape key handler for modal
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      // Basic focus trap: keep focus within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Move focus into modal
    const closeBtn = modalRef.current?.querySelector<HTMLElement>('button');
    closeBtn?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, closeModal]);

  return (
    <>
      <motion.div
        layoutId={`img-container-${image.id}`}
        initial={{ opacity: 0, y: 10, rotate: rotation - 5 }}
        animate={{ opacity: 1, y: 0, rotate: rotation }}
        whileHover={{ scale: 1.02, rotate: 0, zIndex: 10 }}
        onClick={() => setIsExpanded(true)}
        className={clsx(
          "relative bg-white dark:bg-neutral-800 p-1.5 shadow-sm hover:shadow-md rounded-[2px] cursor-zoom-in group transition-all duration-300",
        )}
      >
        {/* Colorful Tape */}
        <div className={clsx("absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 backdrop-blur-[2px] shadow-sm rotate-2 z-10 mix-blend-multiply dark:mix-blend-screen", tapeColor)} />

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className={clsx(
            "absolute -top-2 -right-2 p-1.5 rounded-full opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all z-20",
            confirmDelete
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-red-100 text-red-600 hover:bg-red-200"
          )}
          aria-label={confirmDelete ? "Click again to confirm deletion" : "Delete image"}
          title={confirmDelete ? "Click again to confirm" : "Delete image"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Image */}
        {isVideo ? (
          <motion.video
            layoutId={`img-${image.id}`}
            src={mediaSrc}
            className="w-full h-auto object-cover rounded-[1px] max-h-48 pointer-events-none"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <motion.img
            layoutId={`img-${image.id}`}
            src={mediaSrc}
            alt="Moodboard item"
            className="w-full h-auto object-cover rounded-[1px] max-h-48 pointer-events-none"
            loading="lazy"
          />
        )}

        {/* Tags below image in the polaroid bottom area */}
        <div className="pt-1.5 pb-1 px-0.5 min-h-[28px]">
          <TerminologyTags
            tags={image.tags || []}
            onRemove={(tagId) => onRemoveTag(image.id, tagId)}
            inline
          />
        </div>
      </motion.div>

      {/* Fullscreen Overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-md p-4 md:p-12 cursor-zoom-out"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image view"
        >
          <motion.div
            ref={modalRef}
            layoutId={`img-container-${image.id}`}
            className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center p-4 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 bg-stone-100/50 dark:bg-neutral-800/50 backdrop-blur-sm p-2 rounded-full hover:bg-stone-200 dark:hover:bg-neutral-700 transition-colors z-10"
              onClick={closeModal}
              aria-label="Close expanded view"
            >
              <X className="w-5 h-5 text-stone-600 dark:text-stone-300" />
            </button>

            <div className="flex-1 flex items-center justify-center w-full min-h-0">
              {isVideo ? (
                <motion.video
                  layoutId={`img-${image.id}`}
                  src={mediaSrc}
                  className="max-w-full max-h-full object-contain drop-shadow-lg"
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                />
              ) : (
                <motion.img
                  layoutId={`img-${image.id}`}
                  src={mediaSrc}
                  alt="Expanded view"
                  className="max-w-full max-h-full object-contain drop-shadow-lg"
                />
              )}
            </div>

            {/* Tags at bottom of modal */}
            <div className="w-full pt-3 pb-1 flex flex-wrap gap-1.5 justify-center">
              <TerminologyTags
                tags={image.tags || []}
                onRemove={(tagId) => onRemoveTag(image.id, tagId)}
                inline
                expanded
              />
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};
