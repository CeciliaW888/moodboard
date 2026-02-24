import { useState } from 'react';
import { TerminologyTag, api } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, X, Check } from 'lucide-react';


export const TerminologyTags = ({ tags, onRemove }: { tags: TerminologyTag[], onRemove: (id: number) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
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

  return (
    <div 
      className="absolute top-2 right-2 flex flex-col items-end gap-1.5 z-10 max-w-[90%]"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
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
              className="group flex items-center bg-white/95 dark:bg-neutral-800/95 shadow-sm border border-stone-100 dark:border-neutral-700 rounded-full px-3 py-1 cursor-pointer transition-all hover:bg-stone-50 dark:hover:bg-neutral-700"
            >
              <span className="text-[11px] font-medium text-stone-700 dark:text-stone-300 mr-2">{tag.term}</span>
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleCopy(tag.term, tag.id, e)}
                  className="p-0.5 hover:text-stone-600 dark:hover:text-stone-300 text-stone-400"
                >
                  {copiedId === tag.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <div className="w-px h-3 bg-stone-200 dark:bg-neutral-700 mx-0.5" />
                <button 
                  onClick={(e) => handleRemove(tag.id, e)}
                  className="p-0.5 hover:text-red-500 text-stone-400"
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
            className="flex items-center bg-white/95 dark:bg-neutral-800/95 shadow-sm border border-stone-100 dark:border-neutral-700 rounded-full px-3 py-1 cursor-pointer hover:shadow-md transition-shadow"
          >
            <span className="text-[11px] font-medium text-stone-700 dark:text-stone-300 truncate max-w-[100px]">{tags[0].term}</span>
            {tags.length > 1 && (
              <span className="ml-[3px] text-[10px] font-semibold text-stone-400 dark:text-stone-500">
                +{tags.length - 1}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
