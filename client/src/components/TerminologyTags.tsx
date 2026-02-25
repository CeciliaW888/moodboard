import { useState } from 'react';
import { TerminologyTag, api } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, X, Check } from 'lucide-react';

interface TerminologyTagsProps {
  tags: TerminologyTag[];
  onRemove: (id: number) => void;
  /** Render inline (below image) instead of absolute positioned */
  inline?: boolean;
  /** Start in expanded state */
  expanded?: boolean;
}

export const TerminologyTags = ({ tags, onRemove, inline = false, expanded: startExpanded = false }: TerminologyTagsProps) => {
  const [isExpanded, setIsExpanded] = useState(startExpanded);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  if (!tags || tags.length === 0) return null;

  const handleCopy = (term: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(term);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRemove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteTerm(id);
      onRemove(id);
    } catch {
      // Handle error gracefully
    }
  };

  // Toggle on tap for touch devices
  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  if (inline) {
    return (
      <div
        className="flex flex-wrap gap-1"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <AnimatePresence>
          {(isExpanded ? tags : tags.slice(0, 1)).map((tag, i) => (
            <motion.div
              key={tag.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.03, duration: 0.15 }}
              className="group/tag flex items-center bg-neutral-100/80 dark:bg-neutral-700/60 rounded-sm px-2 py-0.5 cursor-default transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-600"
            >
              <span className="text-[10px] font-semibold text-neutral-900 dark:text-stone-300 mr-1">{tag.term}</span>
              <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover/tag:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleCopy(tag.term, tag.id, e)}
                  className="p-0.5 hover:text-neutral-900 dark:hover:text-stone-200 text-neutral-400"
                  aria-label={`Copy "${tag.term}"`}
                >
                  {copiedId === tag.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  onClick={(e) => handleRemove(tag.id, e)}
                  className="p-0.5 hover:text-red-500 text-neutral-400"
                  aria-label={`Remove "${tag.term}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!isExpanded && tags.length > 1 && (
          <button
            onClick={handleToggle}
            className="text-[10px] font-semibold text-neutral-400 dark:text-stone-500 hover:text-neutral-700 dark:hover:text-stone-300 px-1.5 py-0.5 rounded-sm transition-colors"
            aria-label={`Show ${tags.length - 1} more tags`}
          >
            +{tags.length - 1}
          </button>
        )}
        {isExpanded && tags.length > 1 && (
          <button
            onClick={handleToggle}
            className="text-[10px] font-semibold text-neutral-400 dark:text-stone-500 hover:text-neutral-700 dark:hover:text-stone-300 px-1.5 py-0.5 rounded-sm transition-colors"
            aria-label="Show fewer tags"
          >
            show less
          </button>
        )}
      </div>
    );
  }

  // Legacy absolute-positioned mode (keeping for backward compatibility if needed)
  return (
    <div
      className="absolute top-2 right-2 flex flex-col items-end gap-1.5 z-10 max-w-[90%]"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={(e) => {
        e.stopPropagation();
        handleToggle();
      }}
    >
      <AnimatePresence>
        {isExpanded ? (
          tags.map((tag, i) => (
            <motion.div
              key={tag.id}
              initial={{ opacity: 0, x: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="group flex items-center bg-white/95 dark:bg-neutral-800/95 shadow-sm border border-neutral-200 dark:border-neutral-700 rounded-sm px-3 py-1 cursor-pointer transition-all hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              <span className="text-[11px] font-semibold text-neutral-900 dark:text-stone-300 mr-2">{tag.term}</span>
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleCopy(tag.term, tag.id, e)}
                  className="p-0.5 hover:text-neutral-900 dark:hover:text-stone-300 text-neutral-400"
                  aria-label={`Copy "${tag.term}"`}
                >
                  {copiedId === tag.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <div className="w-px h-3 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
                <button
                  onClick={(e) => handleRemove(tag.id, e)}
                  className="p-0.5 hover:text-red-500 text-neutral-400"
                  aria-label={`Remove "${tag.term}"`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center bg-white/95 dark:bg-neutral-800/95 shadow-sm border border-neutral-200 dark:border-neutral-700 rounded-sm px-3 py-1 cursor-pointer hover:shadow-md transition-shadow"
          >
            <span className="text-[11px] font-semibold text-neutral-900 dark:text-stone-300 truncate max-w-[100px]">{tags[0].term}</span>
            {tags.length > 1 && (
              <span className="ml-[3px] text-[10px] font-semibold text-neutral-400 dark:text-stone-500">
                +{tags.length - 1}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
