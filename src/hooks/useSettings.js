import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { setAudioVolumes } from '../audioEngine';
import { PIECE_SKINS, DEFAULT_PIECE_SKIN, setActivePieceSkin } from '../pieceSkins.js';
import { hasEffect, getEffect } from '../effects/index.js';
import { THEMES, applyTheme } from '../themes/themes.js';

export const SETTINGS_KEY = 'neochess_settings';
// The piece skin has its own key, so it can be read (or reset) on its own.
export const PIECE_SKIN_KEY = 'neochess_piece_skin';

// The themes (board colours, page backdrop, accents...) live in
// src/themes/themes.js. `light` / `dark` are the two square colours.
export const BOARD_THEMES = THEMES;

export const DEFAULT_SETTINGS = {
  musicVolume: 100, // 0–100
  sfxVolume: 100, // 0–100
  animations: true, // capture effects, board slides, idle bobbing
  screenFx: true, // scanlines, starfield, screen flash
  boardTheme: 'classic',
  pieceSkin: DEFAULT_PIECE_SKIN, // see src/pieceSkins.js
  effectsEnabled: true, // master switch for every canvas effect
  captureEffect: 'random', // 'random', or the id of one capture effect
  effectIntensity: 100, // 0–100: share of particles drawn
  disabledEffects: [], // ids of effects switched off one by one
};

const clampVolume = (v) => Math.min(100, Math.max(0, Math.round(Number(v))));

// Keeps only known keys with valid values, so a stale or hand-edited
// localStorage entry can never put the app in a broken state.
export function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS, disabledEffects: [] };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of ['musicVolume', 'sfxVolume', 'effectIntensity']) {
    if (Number.isFinite(Number(raw[key])) && raw[key] !== null && raw[key] !== '') out[key] = clampVolume(raw[key]);
  }
  for (const key of ['animations', 'screenFx', 'effectsEnabled']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  if (Object.hasOwn(BOARD_THEMES, raw.boardTheme)) out.boardTheme = raw.boardTheme;
  if (Object.hasOwn(PIECE_SKINS, raw.pieceSkin)) out.pieceSkin = raw.pieceSkin;
  const chosen = getEffect(raw.captureEffect);
  if (chosen && chosen.trigger === 'capture') out.captureEffect = chosen.id;
  out.disabledEffects = Array.isArray(raw.disabledEffects) ? [...new Set(raw.disabledEffects.filter((id) => typeof id === 'string' && hasEffect(id)))] : [];
  return out;
}

function loadSettings() {
  let saved = null;
  let pieceSkin;
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch {
    // corrupt or blocked: fall back to the defaults
  }
  try {
    pieceSkin = localStorage.getItem(PIECE_SKIN_KEY);
  } catch {
    // blocked storage
  }
  return sanitizeSettings({ ...(saved && typeof saved === 'object' ? saved : {}), pieceSkin });
}

// Player preferences, saved to localStorage on every change and applied to
// the page: volumes go to the audio engine, the two toggles become classes
// on <html> (see "SETTINGS" in App.css).
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    try {
      const { pieceSkin, ...rest } = settings;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
      localStorage.setItem(PIECE_SKIN_KEY, pieceSkin);
    } catch {
      // blocked storage: settings still apply until the tab closes
    }
  }, [settings]);

  useEffect(() => {
    setAudioVolumes({ sfx: settings.sfxVolume / 100, music: settings.musicVolume / 100 });
  }, [settings.sfxVolume, settings.musicVolume]);

  // the whole page follows the board theme: backdrop, panels, accents.
  // A layout effect, so the new look is in place before the browser paints.
  useLayoutEffect(() => {
    applyTheme(settings.boardTheme);
  }, [settings.boardTheme]);

  // the canvas capture effects draw the captured piece in the same skin
  useEffect(() => {
    setActivePieceSkin(settings.pieceSkin);
  }, [settings.pieceSkin]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('no-animations', !settings.animations);
    root.classList.toggle('no-screen-fx', !settings.screenFx);
    return () => root.classList.remove('no-animations', 'no-screen-fx');
  }, [settings.animations, settings.screenFx]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => sanitizeSettings({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => setSettings({ ...DEFAULT_SETTINGS, disabledEffects: [] }), []);

  // Switches one effect on or off.
  const toggleEffect = useCallback((id, on) => {
    setSettings((prev) => {
      const rest = prev.disabledEffects.filter((x) => x !== id);
      return sanitizeSettings({ ...prev, disabledEffects: on ? rest : [...rest, id] });
    });
  }, []);

  return { settings, updateSetting, toggleEffect, resetSettings, theme: BOARD_THEMES[settings.boardTheme] };
}
