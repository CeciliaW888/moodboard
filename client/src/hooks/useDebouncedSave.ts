import { useRef, useCallback } from 'react';

export function useDebouncedSave<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return { debouncedFn, flush };
}
