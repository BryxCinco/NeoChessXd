import { useState, useEffect, useCallback } from 'react';
import { setAudioVolumes } from '../audioEngine';

export const SETTINGS_KEY = 'neochess_settings';

// Board colour palettes. `light` / `dark` are the two square colours.
export const BOARD_THEMES = {
  classic: { name: 'CLASSIC', light: '#e8cfa6', dark: '#2e2017' },
  gameboy: { name: 'GAME BOY', light: '#9bbc0f', dark: '#306230' },
  nes: { name: 'NES', light: '#fcd8a8', dark: '#8c3008' },
  amber: { name: 'CRT AMBER', light: '#ffb000', dark: '#4a2c00' },
};

export const DEFAULT_SETTINGS = {
  musicVolume: 100, // 0–100
  sfxVolume: 100, // 0–100
  animations: true, // capture effects, board slides, idle bobbing
  screenFx: true, // scanlines, starfield, screen flash
  boardTheme: 'classic',
};

const clampVolume = (v) => Math.min(100, Math.max(0, Math.round(Number(v))));

// Keeps only known keys with valid values, so a stale or hand-edited
// localStorage entry can never put the app in a broken state.
export function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of ['musicVolume', 'sfxVolume']) {
    if (Number.isFinite(Number(raw[key])) && raw[key] !== null && raw[key] !== '') out[key] = clampVolume(raw[key]);
  }
  for (const key of ['animations', 'screenFx']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  if (Object.hasOwn(BOARD_THEMES, raw.boardTheme)) out.boardTheme = raw.boardTheme;
  return out;
}

function loadSettings() {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Player preferences, saved to localStorage on every change and applied to
// the page: volumes go to the audio engine, the two toggles become classes
// on <html> (see "SETTINGS" in App.css).
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // blocked storage: settings still apply until the tab closes
    }
  }, [settings]);

  useEffect(() => {
    setAudioVolumes({ sfx: settings.sfxVolume / 100, music: settings.musicVolume / 100 });
  }, [settings.sfxVolume, settings.musicVolume]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('no-animations', !settings.animations);
    root.classList.toggle('no-screen-fx', !settings.screenFx);
    return () => root.classList.remove('no-animations', 'no-screen-fx');
  }, [settings.animations, settings.screenFx]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => sanitizeSettings({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => setSettings({ ...DEFAULT_SETTINGS }), []);

  return { settings, updateSetting, resetSettings, theme: BOARD_THEMES[settings.boardTheme] };
}
