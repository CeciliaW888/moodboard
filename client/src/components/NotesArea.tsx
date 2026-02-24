import { useCallback } from 'react';
import { Rnd } from 'react-rnd';

interface NotesAreaProps {
  height: number;
  onHeightChange: (h: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

export const ResizableNotesArea = ({
  height,
  onHeightChange,
  notes,
  onNotesChange,
}: NotesAreaProps) => {
  const handleNotesInput = useCallback((value: string) => {
    onNotesChange(value);
  }, [onNotesChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Allow arrow keys on the drag handle to resize
    if (e.target === e.currentTarget) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onHeightChange(Math.min(height + 20, 600));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onHeightChange(Math.max(height - 20, 80));
      }
    }
  }, [height, onHeightChange]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex" style={{ height }}>
      <Rnd
        size={{ width: '100%', height }}
        position={{ x: 0, y: 0 }}
        disableDragging
        enableResizing={{ top: true, right: false, bottom: false, left: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
        onResizeStop={(_e, _dir, ref) => {
          onHeightChange(parseInt(ref.style.height, 10));
        }}
        minHeight={80}
        maxHeight={600}
        className="border-t border-amber-200 dark:border-neutral-800 bg-amber-50/80 dark:bg-neutral-900 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] p-6 !transform-none !top-auto !bottom-0 !left-0 !right-0 absolute"
      >
        {/* Accessible drag handle */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize notes area. Use arrow keys to adjust height."
          aria-valuenow={height}
          aria-valuemin={80}
          aria-valuemax={600}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1.5 bg-amber-200 dark:bg-neutral-700 rounded-full cursor-ns-resize hover:bg-amber-400 dark:hover:bg-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
        />
        <h3 className="text-sm font-medium text-stone-600 dark:text-stone-400 flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Notes & Terminology Summary
        </h3>
        <textarea
          value={notes}
          onChange={(e) => handleNotesInput(e.target.value)}
          placeholder="Add notes for this week... Design ideas, references, terminology, etc."
          className="w-full h-[calc(100%-48px)] bg-transparent text-sm text-stone-700 dark:text-stone-300 placeholder:text-stone-400 dark:placeholder:text-stone-600 resize-none focus:outline-none leading-relaxed"
        />
      </Rnd>
    </div>
  );
};
