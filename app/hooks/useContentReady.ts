import { useState, useEffect, useRef } from "react";

/**
 * Returns `true` after `delay` ms once `open` becomes true.
 * Resets to `false` immediately when `open` becomes false.
 */
export function useContentReady(open: boolean, delay = 350): boolean {
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open) {
      timerRef.current = setTimeout(() => setReady(true), delay);
    } else {
      clearTimeout(timerRef.current);
      setReady(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [open, delay]);

  return ready;
}
