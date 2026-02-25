import { useCallback, useState, useRef } from 'react';

export interface Guide {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
  start: number;    // extent start
  end: number;      // extent end
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SNAP_THRESHOLD = 6;

// Get the 5 key edges/centers of a rectangle
function getEdges(r: Rect) {
  return {
    left: r.x,
    right: r.x + r.width,
    centerX: r.x + r.width / 2,
    top: r.y,
    bottom: r.y + r.height,
    centerY: r.y + r.height / 2,
  };
}

export function useAlignmentGuides(allRects: Rect[], excludeIndex: number) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const activeRef = useRef(false);

  const calcSnap = useCallback(
    (draggingRect: Rect): { snapX: number | null; snapY: number | null; guides: Guide[] } => {
      const others = allRects.filter((_, i) => i !== excludeIndex);
      if (others.length === 0) return { snapX: null, snapY: null, guides: [] };

      const drag = getEdges(draggingRect);
      const newGuides: Guide[] = [];
      let snapX: number | null = null;
      let snapY: number | null = null;
      let bestDx = SNAP_THRESHOLD + 1;
      let bestDy = SNAP_THRESHOLD + 1;

      for (const other of others) {
        const o = getEdges(other);

        // Vertical alignment checks (x-axis snapping)
        const vChecks: [number, number][] = [
          [drag.left, o.left],
          [drag.left, o.right],
          [drag.left, o.centerX],
          [drag.right, o.left],
          [drag.right, o.right],
          [drag.right, o.centerX],
          [drag.centerX, o.centerX],
          [drag.centerX, o.left],
          [drag.centerX, o.right],
        ];

        for (const [dragVal, otherVal] of vChecks) {
          const d = Math.abs(dragVal - otherVal);
          if (d < SNAP_THRESHOLD && d < bestDx) {
            bestDx = d;
            snapX = draggingRect.x + (otherVal - dragVal);
            const minY = Math.min(drag.top, o.top);
            const maxY = Math.max(drag.bottom, o.bottom);
            // Replace all vertical guides with this best match
            const filtered = newGuides.filter(g => g.type !== 'vertical');
            filtered.push({ type: 'vertical', position: otherVal, start: minY, end: maxY });
            newGuides.length = 0;
            newGuides.push(...filtered, ...newGuides.filter(g => g.type === 'horizontal'));
          }
        }

        // Horizontal alignment checks (y-axis snapping)
        const hChecks: [number, number][] = [
          [drag.top, o.top],
          [drag.top, o.bottom],
          [drag.top, o.centerY],
          [drag.bottom, o.top],
          [drag.bottom, o.bottom],
          [drag.bottom, o.centerY],
          [drag.centerY, o.centerY],
          [drag.centerY, o.top],
          [drag.centerY, o.bottom],
        ];

        for (const [dragVal, otherVal] of hChecks) {
          const d = Math.abs(dragVal - otherVal);
          if (d < SNAP_THRESHOLD && d < bestDy) {
            bestDy = d;
            snapY = draggingRect.y + (otherVal - dragVal);
            const minX = Math.min(drag.left, o.left);
            const maxX = Math.max(drag.right, o.right);
            const filtered = newGuides.filter(g => g.type !== 'horizontal');
            filtered.push({ type: 'horizontal', position: otherVal, start: minX, end: maxX });
            newGuides.length = 0;
            newGuides.push(...newGuides.filter(g => g.type === 'vertical'), ...filtered);
          }
        }
      }

      // Rebuild guides cleanly
      const finalGuides: Guide[] = [];
      if (snapX !== null) {
        const drag2 = getEdges({ ...draggingRect, x: snapX });
        for (const other of others) {
          const o = getEdges(other);
          const vVals = [o.left, o.right, o.centerX];
          for (const v of vVals) {
            if (Math.abs(drag2.left - v) < 1 || Math.abs(drag2.right - v) < 1 || Math.abs(drag2.centerX - v) < 1) {
              finalGuides.push({
                type: 'vertical',
                position: v,
                start: Math.min(drag2.top, o.top),
                end: Math.max(drag2.bottom, o.bottom),
              });
            }
          }
        }
      }
      if (snapY !== null) {
        const drag2 = getEdges({ ...draggingRect, y: snapY });
        for (const other of others) {
          const o = getEdges(other);
          const hVals = [o.top, o.bottom, o.centerY];
          for (const v of hVals) {
            if (Math.abs(drag2.top - v) < 1 || Math.abs(drag2.bottom - v) < 1 || Math.abs(drag2.centerY - v) < 1) {
              finalGuides.push({
                type: 'horizontal',
                position: v,
                start: Math.min(drag2.left, o.left),
                end: Math.max(drag2.right, o.right),
              });
            }
          }
        }
      }

      return { snapX, snapY, guides: finalGuides };
    },
    [allRects, excludeIndex]
  );

  const showGuides = useCallback((g: Guide[]) => {
    activeRef.current = true;
    setGuides(g);
  }, []);

  const clearGuides = useCallback(() => {
    activeRef.current = false;
    setGuides([]);
  }, []);

  return { guides, calcSnap, showGuides, clearGuides };
}
