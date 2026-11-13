import { useState, useRef, useCallback, useEffect } from 'react';

export const THEME_FADE_OUT_MS = 200;
export const THEME_FADE_IN_MS = 300;

// Animated theme switch: the screen fades to black (with a short glitch),
// the theme changes while nothing is visible, then the new look fades in.
//   phase: null | 'out' | 'in'   (drives the .theme-fade overlay)
// With `animated` false the theme simply changes at once.
export function useThemeTransition(applyTheme, animated = true) {
  const [phase, setPhase] = useState(null);
  const timersRef = useRef([]);
  const applyRef = useRef(applyTheme);
  applyRef.current = applyTheme;

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  useEffect(() => clearTimers, []);

  const changeTheme = useCallback(
    (id) => {
      clearTimers();
      if (!animated) {
        setPhase(null);
        applyRef.current(id);
        return;
      }
      setPhase('out');
      timersRef.current.push(
        setTimeout(() => {
          applyRef.current(id);
          setPhase('in');
          timersRef.current.push(setTimeout(() => setPhase(null), THEME_FADE_IN_MS));
        }, THEME_FADE_OUT_MS)
      );
    },
    [animated]
  );

  return { phase, changeTheme };
}
