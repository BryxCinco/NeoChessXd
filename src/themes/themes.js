import { sceneFor } from './scenes.js';
import { setFxAccent } from '../effects/fxKit.js';

// ── THEMES ──
// A theme styles the whole game, not only the board:
//
//   boardTheme     { light, dark, border, highlight }  the squares and frame
//   background     { type: 'gradient' | 'image' | 'canvas', value }  the page
//   pageColor      flat colour under the backdrop (and while it loads)
//   panelColor     menus, modals, player bars
//   uiAccent       main accent: borders, titles, active buttons
//   uiAccent2      second accent: modal frames, links
//   particleColor  accent colour for the canvas effects (score pop, sparkles)
//   starOpacity    how much of the drifting starfield shows through
//   font           font family for the theme
//
// `light` / `dark` repeat the two square colours for older code.
// To add a theme: add an entry here (and, for a pixel-art backdrop, a scene
// in scenes.js). Settings, the board and the page pick it up from THEMES.
const PIXEL_FONT = "'Press Start 2P', monospace";

function theme(def) {
  return {
    font: PIXEL_FONT,
    starOpacity: 0,
    ...def,
    light: def.boardTheme.light,
    dark: def.boardTheme.dark,
  };
}

export const THEMES = {
  classic: theme({
    id: 'classic',
    name: 'CLASSIC',
    boardTheme: { light: '#e8cfa6', dark: '#2e2017', border: '#ffcc00', highlight: '#ffcc00' },
    background: { type: 'gradient', value: 'radial-gradient(ellipse at 50% 30%, #232a3d 0%, #181c26 60%, #10131b 100%)' },
    pageColor: '#181c26',
    panelColor: '#2a2d32',
    uiAccent: '#ffcc00',
    uiAccent2: '#00ffcc',
    particleColor: '#ffd83a',
    starOpacity: 0.55,
  }),
  gameboy: theme({
    id: 'gameboy',
    name: 'GAME BOY',
    boardTheme: { light: '#9bbc0f', dark: '#306230', border: '#0f380f', highlight: '#e0f8d0' },
    background: { type: 'image', value: sceneFor('gameboy') },
    pageColor: '#9bbc0f',
    panelColor: '#12300f',
    uiAccent: '#9bbc0f',
    uiAccent2: '#e0f8d0',
    particleColor: '#e0f8d0',
  }),
  nes: theme({
    id: 'nes',
    name: 'NES',
    boardTheme: { light: '#fcd8a8', dark: '#8c3008', border: '#fca044', highlight: '#ffffff' },
    background: { type: 'image', value: sceneFor('nes') },
    pageColor: '#5c94fc',
    panelColor: '#20263f',
    uiAccent: '#fca044',
    uiAccent2: '#a4e4fc',
    particleColor: '#fca044',
  }),
  amber: theme({
    id: 'amber',
    name: 'CRT AMBER',
    boardTheme: { light: '#ffb000', dark: '#4a2c00', border: '#ffb000', highlight: '#fff0c2' },
    background: { type: 'image', value: sceneFor('amber') },
    pageColor: '#0a0600',
    panelColor: '#1c1203',
    uiAccent: '#ffb000',
    uiAccent2: '#ffd98a',
    particleColor: '#ffb000',
    starOpacity: 0.12,
  }),
  cursed: theme({
    id: 'cursed',
    name: 'CURSED',
    boardTheme: { light: '#b3a594', dark: '#35141a', border: '#8a0a12', highlight: '#ff5a4d' },
    background: { type: 'image', value: sceneFor('cursed') },
    pageColor: '#120204',
    panelColor: '#241014',
    uiAccent: '#ff5a4d',
    uiAccent2: '#e8d8b0',
    particleColor: '#ff5a4d',
    starOpacity: 0.15,
  }),
  neon: theme({
    id: 'neon',
    name: 'NEON',
    boardTheme: { light: '#c9b3ff', dark: '#1d1247', border: '#ff4fd8', highlight: '#22e0ff' },
    background: { type: 'image', value: sceneFor('neon') },
    pageColor: '#0b0624',
    panelColor: '#1a1038',
    uiAccent: '#ff4fd8',
    uiAccent2: '#22e0ff',
    particleColor: '#22e0ff',
    starOpacity: 0.35,
  }),
};

export const DEFAULT_THEME = 'classic';
export const getTheme = (id) => THEMES[id] || THEMES[DEFAULT_THEME];

// CSS custom properties for a theme (consumed by src/styles/themes.css).
export function themeVariables(id) {
  const t = getTheme(id);
  return {
    '--page-bg': t.pageColor,
    '--app-bg': t.background.type === 'gradient' ? t.background.value : `url("${t.background.value}")`,
    '--panel-bg': t.panelColor,
    '--grid-bg': 'transparent',
    '--accent': t.uiAccent,
    '--accent-2': t.uiAccent2,
    '--board-border': t.boardTheme.border,
    '--board-highlight': t.boardTheme.highlight,
    '--particle': t.particleColor,
    '--stars-opacity': String(t.starOpacity),
    '--theme-font': t.font,
  };
}

// Puts a theme on the page: data-theme + variables on <html>, and the
// effects' accent colour. Safe to call before React renders (main.jsx does,
// so there is no flash of the default look).
export function applyTheme(id, root = typeof document !== 'undefined' ? document.documentElement : null) {
  const t = getTheme(id);
  if (root) {
    root.setAttribute('data-theme', t.id);
    for (const [name, value] of Object.entries(themeVariables(t.id))) root.style.setProperty(name, value);
  }
  setFxAccent(t.particleColor);
  return t;
}

// The theme saved by a previous visit (same storage as useSettings).
export function savedThemeId(key = 'neochess_settings') {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved && Object.hasOwn(THEMES, saved.boardTheme) ? saved.boardTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}
