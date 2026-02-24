
import { Rnd } from 'react-rnd';

export const ResizableNotesArea = ({ 
  height, 
  onHeightChange 
}: { 
  height: number, 
  onHeightChange: (h: number) => void 
}) => {
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
        className="border-t border-amber-200 dark:border-neutral-800 bg-amber-50/80 dark:bg-neutral-900 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] p-6 !transform-none !top-auto !bottom-0 !left-0 !right-0 absolute"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1.5 bg-amber-200 dark:bg-neutral-700 rounded-full cursor-ns-resize hover:bg-amber-400 transition-colors" />
        <h3 className="text-sm font-medium text-stone-500 flex items-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Notes & Terminology Summary
        </h3>
        <p className="text-sm text-stone-400 italic">Press Ctrl+V to paste a screenshot into the current week...</p>
      </Rnd>
    </div>
  );
};
