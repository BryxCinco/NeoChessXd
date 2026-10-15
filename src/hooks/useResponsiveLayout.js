import { useState, useEffect } from 'react';

// Drives both the step-wizard menu AND lets tablets/iPads share the same
// stacked board+sidebar layout as phones instead of the desktop two-column
// layout, plus the mobile pinch/double-tap zoom lock.
export function useResponsiveLayout() {
  // Phones AND tablets/iPads (<=1024px) get the compact one-step-at-a-time
  // wizard instead of the long single-page config panel. Anything wider
  // (laptops/desktops) keeps the classic all-in-one layout.
  const [isCompactLayout, setIsCompactLayout] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth <= 1024 : false)
  );

  // ── COMPACT (PHONE / TABLET / iPad) LAYOUT DETECTION ──
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1024px)');
    const handleChange = (e) => setIsCompactLayout(e.matches);
    setIsCompactLayout(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', handleChange);
    else mql.addListener(handleChange); // Safari < 14 fallback
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handleChange);
      else mql.removeListener(handleChange);
    };
  }, []);

  // ── MOBILE PINCH-ZOOM LOCK ──
  // The viewport meta lives in index.html and double-tap zoom is handled by
  // `touch-action: manipulation` in App.css (a JS touchend blocker could
  // swallow fast taps on buttons). iOS Safari ignores both for pinch, so
  // pinch / gesture events are still blocked here.
  useEffect(() => {
    const blockPinch = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const blockGesture = (e) => {
      e.preventDefault();
    };

    document.addEventListener('touchmove', blockPinch, { passive: false });
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });

    return () => {
      document.removeEventListener('touchmove', blockPinch);
      document.removeEventListener('gesturestart', blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
    };
  }, []);

  return { isCompactLayout };
}

// Keeps the page from scrolling behind the countdown, promotion picker, or
// any popup (including the Game Over modal) on mobile.
export function useScrollLock(shouldLock) {
  useEffect(() => {
    document.body.style.overflow = shouldLock ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldLock]);
}