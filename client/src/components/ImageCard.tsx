import { useState } from 'react';
import { motion } from 'framer-motion';
import { BoardImage } from '../api';
import { TerminologyTags } from './TerminologyTags';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';

export const ImageCard = ({ 
  image, 
  onRemoveTag,
  onDelete
}: { 
  image: BoardImage, 
  onRemoveTag: (imageId: number, tagId: number) => void,
  onDelete: (imageId: number) => void
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if media is a video
  const isVideo = image.url.match(/\.(mp4|webm|mov|ogg)$/i) !== null;


  // Randomize a small rotation for the polaroid effect
  const rotation = (image.id % 5) - 2; // -2 to 2 degrees

  // Colorful translucent tapes
  const tapeColors = ['bg-rose-400/80', 'bg-amber-400/80', 'bg-indigo-400/80', 'bg-emerald-400/80'];
  const tapeColor = tapeColors[image.id % tapeColors.length];

  return (
    <>
      <motion.div
        layoutId={`img-container-${image.id}`}
        initial={{ opacity: 0, y: 10, rotate: rotation - 5 }}
        animate={{ opacity: 1, y: 0, rotate: rotation }}
        whileHover={{ scale: 1.02, rotate: 0, zIndex: 10 }}
        onClick={() => setIsExpanded(true)}
        className={clsx(
          "relative bg-white dark:bg-neutral-800 p-1.5 pb-8 shadow-sm hover:shadow-md rounded-[2px] cursor-zoom-in group transition-all duration-300",
        )}
      >
        {/* Colorful Tape */}
        <div className={clsx("absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 backdrop-blur-[2px] shadow-sm rotate-2 z-10 mix-blend-multiply dark:mix-blend-screen", tapeColor)} />

        {/* Delete Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(image.id);
          }}
          className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all z-20 hover:bg-red-200"
          title="Delete image"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <TerminologyTags 
          tags={image.tags || []} 
          onRemove={(tagId) => onRemoveTag(image.id, tagId)} 
        />
        
        {isVideo ? (
          <motion.video
            layoutId={`img-${image.id}`}
            src={`http://localhost:8000${image.url}`} 
            className="w-full h-auto object-cover rounded-[1px] max-h-48 pointer-events-none"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <motion.img 
            layoutId={`img-${image.id}`}
            src={`http://localhost:8000${image.url}`} 
            alt="Moodboard Item" 
            className="w-full h-auto object-cover rounded-[1px] max-h-48 pointer-events-none"
          />
        )}
      </motion.div>

      {/* Fullscreen Overlay */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-md p-4 md:p-12 cursor-zoom-out"
          onClick={() => setIsExpanded(false)}
        >
          <motion.div
            layoutId={`img-container-${image.id}`}
            className="relative max-w-5xl w-full h-full flex items-center justify-center p-4 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inner
          >
            <button 
              className="absolute top-4 right-4 bg-stone-100/50 backdrop-blur-sm p-2 rounded-full hover:bg-stone-200 transition-colors z-10"
              onClick={() => setIsExpanded(false)}
            >
              ✕
            </button>
            <TerminologyTags 
              tags={image.tags || []} 
              onRemove={(tagId) => onRemoveTag(image.id, tagId)} 
            />
            {isVideo ? (
              <motion.video
                layoutId={`img-${image.id}`}
                src={`http://localhost:8000${image.url}`} 
                className="max-w-full max-h-full object-contain drop-shadow-lg"
                autoPlay
                loop
                muted
                playsInline
                controls // Allow controls when expanded
              />
            ) : (
              <motion.img 
                layoutId={`img-${image.id}`}
                src={`http://localhost:8000${image.url}`} 
                alt="Expanded view" 
                className="max-w-full max-h-full object-contain drop-shadow-lg"
              />
            )}
          </motion.div>
        </div>
      )}
    </>
  );
};
