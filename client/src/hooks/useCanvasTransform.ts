import { useState, useCallback, useRef, useEffect } from 'react';

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.0;
const ZOOM_SENSITIVITY = 0.002;

export function useCanvasTransform() {
  const [transform, setTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Attach wheel listener with { passive: false } so preventDefault() actually works.
  // React's onWheel is passive by default, which silently ignores preventDefault().
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Trackpads send ctrlKey=true for pinch gestures
      const isPinch = e.ctrlKey;
      const sensitivity = isPinch ? ZOOM_SENSITIVITY * 2 : ZOOM_SENSITIVITY;
      const delta = -e.deltaY * sensitivity;

      setTransform(prev => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * (1 + delta)));
        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const scaleRatio = newScale / prev.scale;
        const newX = cursorX - (cursorX - prev.x) * scaleRatio;
        const newY = cursorY - (cursorY - prev.y) * scaleRatio;

        return { x: newX, y: newY, scale: newScale };
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const screenToCanvas = useCallback((screenX: number, screenY: number, containerRect: DOMRect) => {
    return {
      x: (screenX - containerRect.left - transform.x) / transform.scale,
      y: (screenY - containerRect.top - transform.y) / transform.scale,
    };
  }, [transform]);

  return {
    transform,
    isPanning,
    containerRef,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    resetView,
    screenToCanvas,
  };
}
