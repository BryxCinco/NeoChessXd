import { render, screen, renderHook, act, within } from '@testing-library/react';
import { THEMES, DEFAULT_THEME, getTheme, themeVariables, applyTheme, savedThemeId } from './themes.js';
import { sceneFor } from './scenes.js';
import { useSettings, BOARD_THEMES, SETTINGS_KEY, DEFAULT_SETTINGS } from '../hooks/useSettings';
import { useThemeTransition, THEME_FADE_OUT_MS, THEME_FADE_IN_MS } from '../hooks/useThemeTransition';
import { usePixelAnimation } from '../usePixelAnimation';
import { SettingsModal } from '../components/SettingsModal';
import { fxPalette } from '../effects/fxKit.js';
import { cleanupAllEffects } from '../effects/index.js';
import { readFileSync } from 'node:fs';

// (Vitest does not process CSS imports, so the stylesheets are read as text.)
const appCss = readFileSync('src/App.css', 'utf8');
const featuresCss = readFileSync('src/styles/features.css', 'utf8');
const themesCss = readFileSync('src/styles/themes.css', 'utf8');

const IDS = Object.keys(THEMES);
const root = () => document.documentElement;
const cssVar = (name) => root().style.getPropertyValue(name);
const HEX = /^#[0-9a-f]{6}$/i;

afterEach(() => {
  applyTheme(DEFAULT_THEME);
  cleanupAllEffects();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('themes: data', () => {
  it('has the four board themes plus Cursed and Neon', () => {
    expect(IDS).toEqual(['classic', 'gameboy', 'nes', 'amber', 'cursed', 'neon']);
    expect(DEFAULT_THEME).toBe('classic');
    expect(BOARD_THEMES).toBe(THEMES); // the settings use the same list
  });

  it.each(IDS)('%s defines the board, backdrop, accents, particle colour and font', (id) => {
    const theme = THEMES[id];
    expect(theme.id).toBe(id);
    expect(theme.name).toBeTruthy();
    for (const key of ['light', 'dark', 'border', 'highlight']) expect(theme.boardTheme[key]).toMatch(HEX);
    expect(theme.boardTheme.light).not.toBe(theme.boardTheme.dark);
    expect(['image', 'gradient', 'canvas']).toContain(theme.background.type);
    expect(theme.background.value).toBeTruthy();
    for (const key of ['pageColor', 'panelColor', 'uiAccent', 'uiAccent2', 'particleColor']) expect(theme[key]).toMatch(HEX);
    expect(theme.font).toContain('Press Start 2P');
    expect(theme.starOpacity).toBeGreaterThanOrEqual(0);
    expect(theme.starOpacity).toBeLessThanOrEqual(1);
    // older code reads the square colours directly
    expect(theme.light).toBe(theme.boardTheme.light);
    expect(theme.dark).toBe(theme.boardTheme.dark);
  });

  it('Classic keeps its look; every other theme has a pixel-art scene', () => {
    expect(THEMES.classic.background.type).toBe('gradient');
    expect(THEMES.classic.boardTheme).toMatchObject({ light: '#e8cfa6', dark: '#2e2017' });
    expect(THEMES.classic.uiAccent).toBe('#ffcc00');
    expect(sceneFor('classic')).toBeNull();
    for (const id of IDS.filter((x) => x !== 'classic')) {
      expect(THEMES[id].background.type).toBe('image');
      expect(THEMES[id].background.value).toBe(sceneFor(id));
    }
  });

  it('scenes are self-contained SVG images, built once', () => {
    for (const id of ['gameboy', 'nes', 'amber', 'cursed', 'neon']) {
      const uri = sceneFor(id);
      expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
      const svg = decodeURIComponent(uri.slice('data:image/svg+xml,'.length));
      expect(svg).toContain("viewBox='0 0 160 90'");
      expect(svg).toContain("shape-rendering='crispEdges'"); // hard pixel edges
      expect(svg.match(/<rect/g).length).toBeGreaterThan(100);
      expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/); // nothing downloaded
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(uri.length).toBeLessThan(120000);
      expect(sceneFor(id)).toBe(uri);
    }
    expect(new Set(['gameboy', 'nes', 'amber', 'cursed', 'neon'].map(sceneFor)).size).toBe(5);
  });

  it('each scene uses its theme\'s palette', () => {
    const svg = (id) => decodeURIComponent(sceneFor(id));
    for (const green of ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']) expect(svg('gameboy')).toContain(green);
    expect(svg('nes')).toContain('#5c94fc'); // sky
    expect(svg('nes')).toContain('#c84c0c'); // bricks
    expect(svg('amber')).toContain('#ffb000');
    expect(svg('amber')).toContain('#0a0600');
    expect(svg('cursed')).toContain('#8a0a12'); // blood
    expect(svg('neon')).toContain('#ff4fd8'); // grid
  });

  it('getTheme falls back to Classic', () => {
    expect(getTheme('neon')).toBe(THEMES.neon);
    expect(getTheme('nope')).toBe(THEMES.classic);
    expect(getTheme()).toBe(THEMES.classic);
  });
});

describe('themes: one switch changes every themed element', () => {
  const VARS = ['--page-bg', '--app-bg', '--panel-bg', '--accent', '--accent-2', '--board-border', '--particle'];

  it.each(IDS)('%s: applyTheme writes data-theme and all variables on <html>', (id) => {
    const theme = applyTheme(id);
    expect(theme).toBe(THEMES[id]);
    expect(root()).toHaveAttribute('data-theme', id);
    expect(cssVar('--page-bg')).toBe(theme.pageColor);
    expect(cssVar('--panel-bg')).toBe(theme.panelColor);
    expect(cssVar('--accent')).toBe(theme.uiAccent);
    expect(cssVar('--accent-2')).toBe(theme.uiAccent2);
    expect(cssVar('--board-border')).toBe(theme.boardTheme.border);
    expect(cssVar('--board-highlight')).toBe(theme.boardTheme.highlight);
    expect(cssVar('--particle')).toBe(theme.particleColor);
    expect(cssVar('--stars-opacity')).toBe(String(theme.starOpacity));
    expect(cssVar('--theme-font')).toContain('Press Start 2P');
    expect(cssVar('--app-bg')).toContain(theme.background.type === 'image' ? 'data:image/svg+xml' : 'gradient');
    expect(fxPalette.accent).toBe(theme.particleColor); // effects follow the theme
  });

  it('page colour, backdrop, panels and accent are different in every theme', () => {
    for (const name of ['--page-bg', '--app-bg', '--panel-bg', '--accent']) {
      const values = IDS.map((id) => themeVariables(id)[name]);
      expect(new Set(values).size, name).toBe(IDS.length);
    }
    for (const id of IDS) expect(Object.keys(themeVariables(id))).toEqual(expect.arrayContaining(VARS));
  });

  it('switching back and forth leaves no stale values', () => {
    applyTheme('cursed');
    applyTheme('gameboy');
    expect(root()).toHaveAttribute('data-theme', 'gameboy');
    for (const [name, value] of Object.entries(themeVariables('gameboy'))) expect(cssVar(name)).toBe(value);
    applyTheme('not-a-theme');
    expect(root()).toHaveAttribute('data-theme', 'classic');
  });

  it('the stylesheets use the variables instead of fixed accent colours', () => {
    for (const css of [appCss, featuresCss]) {
      expect(css).not.toMatch(/#ffcc00/i);
      expect(css).not.toMatch(/#00ffcc/i);
      expect(css).toContain('var(--accent)');
    }
    expect(appCss).toContain('var(--accent-2)');
    expect(appCss).toContain('var(--panel-bg');
    expect(appCss).toContain('var(--page-bg');
    for (const used of ['var(--app-bg)', 'var(--stars-opacity)', 'var(--theme-font)', 'var(--grid-bg)']) expect(themesCss).toContain(used);
    // defaults for every variable, so the page is styled even before JS runs
    for (const name of Object.keys(themeVariables('classic'))) expect(themesCss).toContain(`${name}:`);
  });
});

describe('themes: settings, persistence, no flash', () => {
  it('useSettings applies the theme to the page as soon as it renders', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ boardTheme: 'neon' }));
    const { result } = renderHook(() => useSettings());
    expect(root()).toHaveAttribute('data-theme', 'neon');
    expect(cssVar('--accent')).toBe(THEMES.neon.uiAccent);
    expect(result.current.theme).toBe(THEMES.neon);

    act(() => result.current.updateSetting('boardTheme', 'cursed'));
    expect(root()).toHaveAttribute('data-theme', 'cursed');
    expect(cssVar('--panel-bg')).toBe(THEMES.cursed.panelColor);
    expect(result.current.theme.boardTheme.dark).toBe(THEMES.cursed.boardTheme.dark);
  });

  it.each(IDS)('%s survives a reload', (id) => {
    const first = renderHook(() => useSettings());
    act(() => first.result.current.updateSetting('boardTheme', id));
    first.unmount();
    applyTheme('classic'); // a fresh page starts from the defaults...
    expect(savedThemeId()).toBe(id); // ...main.jsx reads the saved id
    renderHook(() => useSettings());
    expect(root()).toHaveAttribute('data-theme', id);
  });

  it('no flash of the default look: the saved theme can be applied before React renders', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, boardTheme: 'amber' }));
    applyTheme(savedThemeId()); // exactly what main.jsx does first
    expect(root()).toHaveAttribute('data-theme', 'amber');
    expect(cssVar('--page-bg')).toBe('#0a0600');
  });

  it('savedThemeId copes with missing, corrupt or unknown saves', () => {
    expect(savedThemeId()).toBe('classic');
    localStorage.setItem(SETTINGS_KEY, '{oops');
    expect(savedThemeId()).toBe('classic');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ boardTheme: 'vaporwave' }));
    expect(savedThemeId()).toBe('classic');
    localStorage.setItem(SETTINGS_KEY, 'null');
    expect(savedThemeId()).toBe('classic');
  });

  it('RESET returns the page to Classic', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.updateSetting('boardTheme', 'nes'));
    act(() => result.current.resetSettings());
    expect(root()).toHaveAttribute('data-theme', 'classic');
    expect(cssVar('--accent')).toBe('#ffcc00');
  });

  it('SETTINGS lists all six themes', () => {
    render(<SettingsModal settings={{ ...DEFAULT_SETTINGS, boardTheme: 'cursed' }} onChange={() => {}} onReset={() => {}} onClose={() => {}} />);
    const options = within(screen.getByRole('radiogroup', { name: 'BOARD THEME' })).getAllByRole('radio');
    expect(options.map((o) => o.textContent)).toEqual(['CLASSIC', 'GAME BOY', 'NES', 'CRT AMBER', 'CURSED', 'NEON']);
    expect(options[4]).toBeChecked();
  });
});

describe('theme transition', () => {
  beforeEach(() => vi.useFakeTimers());

  it('fades out for 200 ms, switches while dark, fades in for 300 ms', () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useThemeTransition(apply, true));
    expect(result.current.phase).toBeNull();
    expect([THEME_FADE_OUT_MS, THEME_FADE_IN_MS]).toEqual([200, 300]);

    act(() => result.current.changeTheme('neon'));
    expect(result.current.phase).toBe('out');
    expect(apply).not.toHaveBeenCalled(); // old theme still showing under the fade

    act(() => vi.advanceTimersByTime(199));
    expect(apply).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(apply).toHaveBeenCalledWith('neon'); // switched at full black
    expect(result.current.phase).toBe('in');

    act(() => vi.advanceTimersByTime(299));
    expect(result.current.phase).toBe('in');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.phase).toBeNull();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('with animations off the theme changes at once, no overlay', () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useThemeTransition(apply, false));
    act(() => result.current.changeTheme('nes'));
    expect(apply).toHaveBeenCalledWith('nes');
    expect(result.current.phase).toBeNull();
  });

  it('a second pick during the fade wins; nothing flickers back', () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useThemeTransition(apply, true));
    act(() => result.current.changeTheme('nes'));
    act(() => vi.advanceTimersByTime(120));
    act(() => result.current.changeTheme('amber'));
    act(() => vi.advanceTimersByTime(1000));
    expect(apply.mock.calls).toEqual([['amber']]);
    expect(result.current.phase).toBeNull();
  });

  it('unmounting mid-fade cancels the pending switch', () => {
    const apply = vi.fn();
    const { result, unmount } = renderHook(() => useThemeTransition(apply, true));
    act(() => result.current.changeTheme('neon'));
    unmount();
    vi.advanceTimersByTime(1000);
    expect(apply).not.toHaveBeenCalled();
  });

  it('the overlay styles exist: fade keyframes and the glitch bars', () => {
    expect(themesCss).toContain('.theme-fade.is-out');
    expect(themesCss).toContain('.theme-fade.is-in');
    expect(themesCss).toMatch(/themeFadeOut[^}]*200ms|200ms[^;]*themeFadeOut/);
    expect(themesCss).toMatch(/themeFadeIn[^}]*300ms|300ms[^;]*themeFadeIn/);
    expect(themesCss).toContain('@keyframes themeGlitch');
  });
});

describe('effects stay inside the board', () => {
  it('drawing is clipped to the 8x8 board, not the padded frame', () => {
    vi.useFakeTimers();
    const calls = [];
    const ctx = new Proxy(function () {}, {
      get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : (...args) => (calls.push([key, ...args]), ctx)),
      set: () => true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx);

    const frame = document.createElement('div');
    const canvas = document.createElement('canvas');
    const board = document.createElement('main');
    board.className = 'board-container-pixel';
    const square = document.createElement('div');
    square.setAttribute('data-square', 'd1');
    board.appendChild(square);
    frame.append(canvas, board);
    document.body.appendChild(frame);
    canvas.getBoundingClientRect = () => ({ left: 100, top: 50, width: 504, height: 504 }); // frame incl. 12px padding
    board.getBoundingClientRect = () => ({ left: 112, top: 62, width: 480, height: 480, right: 592, bottom: 542 });
    square.getBoundingClientRect = () => ({ left: 292, top: 482, width: 60, height: 60 }); // bottom rank

    const { result, unmount } = renderHook(() => usePixelAnimation({ captureEffect: 'soulExtraction' }));
    result.current.canvasRef.current = canvas;
    act(() => {
      result.current.triggerElimination('d1', 'wQ', 'q', 'b', () => {});
    });
    act(() => vi.advanceTimersByTime(100));

    const names = calls.map((c) => c[0]);
    const rect = calls.find((c) => c[0] === 'rect');
    expect(rect.slice(1)).toEqual([12, 12, 480, 480]);
    expect(names.indexOf('save')).toBeLessThan(names.indexOf('clip'));
    expect(names.indexOf('clip')).toBeLessThan(names.indexOf('drawImage')); // clip first, then the effect
    expect(names).toContain('restore');
    expect(names.filter((n) => n === 'save').length).toBe(names.filter((n) => n === 'restore').length);

    unmount();
    frame.remove();
  });
});
