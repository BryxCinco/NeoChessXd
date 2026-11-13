import { useState, useRef, useCallback, useEffect } from 'react';

export const TOAST_MS = 2600;

// One short message at a time ("PGN COPIED", "CPU DECLINED THE DRAW"...).
// A new message replaces the current one and restarts the timer.
export function useToast() {
  const [toast, setToast] = useState(null); // { id, text, tone }
  const timerRef = useRef(null);
  const idRef = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const notify = useCallback((text, tone = 'info') => {
    clearTimeout(timerRef.current);
    setToast({ id: ++idRef.current, text, tone });
    timerRef.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { toast, notify, dismiss };
}
