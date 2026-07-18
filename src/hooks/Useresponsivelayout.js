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

  // ── MOBILE ZOOM LOCK ──
  useEffect(() => {
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );

    const blockPinch = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const blockGesture = (e) => {
      e.preventDefault();
    };

    let lastTouchEnd = 0;
    const blockDoubleTapZoom = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchmove', blockPinch, { passive: false });
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('touchend', blockDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener('touchmove', blockPinch);
      document.removeEventListener('gesturestart', blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
      document.removeEventListener('touchend', blockDoubleTapZoom);
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