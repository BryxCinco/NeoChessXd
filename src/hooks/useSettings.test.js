import { renderHook, act } from '@testing-library/react';
import { useSettings, sanitizeSettings, DEFAULT_SETTINGS, BOARD_THEMES, SETTINGS_KEY } from './useSettings';
import { useToast, TOAST_MS } from './useToast';
import { setAudioVolumes, getAudioVolumes, playRetroSound, startRetroBGM } from '../audioEngine';
import { mockLocalStorageFailure, restoreLocalStorage } from '../test/helpers';

const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY));
const root = () => document.documentElement;

afterEach(() => {
  restoreLocalStorage();
  setAudioVolumes({ sfx: 1, music: 1 });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useSettings', () => {
  it('starts from the defaults: full volume, everything on, classic board', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual({
      musicVolume: 100,
      sfxVolume: 100,
      animations: true,
      screenFx: true,
      boardTheme: 'classic',
    });
    expect(result.current.theme).toBe(BOARD_THEMES.classic);
    expect(root()).not.toHaveClass('no-animations');
    expect(root()).not.toHaveClass('no-screen-fx');
  });

  it('every change is saved to localStorage and survives a reload', () => {
    const first = renderHook(() => useSettings());
    act(() => first.result.current.updateSetting('musicVolume', 40));
    act(() => first.result.current.updateSetting('sfxVolume', 0));
    act(() => first.result.current.updateSetting('animations', false));
    act(() => first.result.current.updateSetting('screenFx', false));
    act(() => first.result.current.updateSetting('boardTheme', 'gameboy'));
    expect(stored()).toEqual({ musicVolume: 40, sfxVolume: 0, animations: false, screenFx: false, boardTheme: 'gameboy' });
    first.unmount();

    const second = renderHook(() => useSettings()); // "reload"
    expect(second.result.current.settings).toEqual(stored());
    expect(second.result.current.theme).toBe(BOARD_THEMES.gameboy);
  });

  it('the toggles switch classes on <html>, and flip back', () => {
    const { result, unmount } = renderHook(() => useSettings());
    act(() => result.current.updateSetting('animations', false));
    expect(root()).toHaveClass('no-animations');
    expect(root()).not.toHaveClass('no-screen-fx');

    act(() => result.current.updateSetting('screenFx', false));
    expect(root()).toHaveClass('no-animations', 'no-screen-fx');

    act(() => result.current.updateSetting('animations', true));
    expect(root()).not.toHaveClass('no-animations');
    expect(root()).toHaveClass('no-screen-fx');

    unmount();
    expect(root()).not.toHaveClass('no-screen-fx');
  });

  it('volume sliders drive the audio engine (0–100 → 0–1)', () => {
    const { result } = renderHook(() => useSettings());
    expect(getAudioVolumes()).toEqual({ sfx: 1, music: 1 });
    act(() => result.current.updateSetting('sfxVolume', 25));
    act(() => result.current.updateSetting('musicVolume', 0));
    expect(getAudioVolumes()).toEqual({ sfx: 0.25, music: 0 });
  });

  it('offers at least three retro palettes besides the default, each with two distinct colours', () => {
    expect(Object.keys(BOARD_THEMES)).toEqual(expect.arrayContaining(['gameboy', 'nes', 'amber']));
    for (const theme of Object.values(BOARD_THEMES)) {
      expect(theme.light).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.dark).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.light).not.toBe(theme.dark);
      expect(theme.name).toBeTruthy();
    }
  });

  it('changing the theme changes the board colours', () => {
    const { result } = renderHook(() => useSettings());
    const before = result.current.theme;
    act(() => result.current.updateSetting('boardTheme', 'amber'));
    expect(result.current.theme).toBe(BOARD_THEMES.amber);
    expect(result.current.theme.light).not.toBe(before.light);
  });

  it('rejects bad values instead of storing them', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.updateSetting('musicVolume', 250));
    expect(result.current.settings.musicVolume).toBe(100);
    act(() => result.current.updateSetting('sfxVolume', -5));
    expect(result.current.settings.sfxVolume).toBe(0);
    act(() => result.current.updateSetting('boardTheme', 'neon-pink'));
    expect(result.current.settings.boardTheme).toBe('classic');
    act(() => result.current.updateSetting('animations', 'yes'));
    expect(result.current.settings.animations).toBe(true);
    act(() => result.current.updateSetting('cheatMode', true));
    expect(result.current.settings).not.toHaveProperty('cheatMode');
  });

  it('RESET puts everything back', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.updateSetting('boardTheme', 'nes'));
    act(() => result.current.updateSetting('animations', false));
    act(() => result.current.resetSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(stored()).toEqual(DEFAULT_SETTINGS);
    expect(root()).not.toHaveClass('no-animations');
  });

  it('survives corrupt or partial saved settings', () => {
    localStorage.setItem(SETTINGS_KEY, '{broken');
    expect(renderHook(() => useSettings()).result.current.settings).toEqual(DEFAULT_SETTINGS);

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sfxVolume: 30, boardTheme: 'nope', extra: 1 }));
    expect(renderHook(() => useSettings()).result.current.settings).toEqual({ ...DEFAULT_SETTINGS, sfxVolume: 30 });
  });

  it('works when storage is blocked (settings apply for this visit only)', () => {
    mockLocalStorageFailure({ read: true });
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(() => act(() => result.current.updateSetting('boardTheme', 'nes'))).not.toThrow();
    expect(result.current.settings.boardTheme).toBe('nes');
  });

  it('sanitizeSettings handles junk input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('text')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ musicVolume: '55', sfxVolume: null, screenFx: false })).toEqual({
      ...DEFAULT_SETTINGS,
      musicVolume: 55,
      screenFx: false,
    });
    expect(sanitizeSettings({ musicVolume: 33.4 }).musicVolume).toBe(33);
  });
});

describe('audio volumes', () => {
  // Minimal stand-in for the Web Audio API (jsdom has none): records every
  // gain node, and anything else you ask of it is a harmless no-op.
  function fakeAudio() {
    const gains = [];
    const node = () =>
      new Proxy(function () {}, {
        get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : node()),
        set: () => true,
        apply: () => node(),
      });
    const ctx = {
      state: 'running',
      currentTime: 0,
      destination: { isDestination: true },
      createGain() {
        const gain = { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connected: null };
        gain.connect = (target) => {
          gain.connected = target;
        };
        gains.push(gain);
        return gain;
      },
      createOscillator: node,
      createBiquadFilter: node,
      createBufferSource: node,
      createBuffer: node,
      sampleRate: 44100,
    };
    vi.stubGlobal('AudioContext', function FakeAudioContext() {
      return ctx;
    });
    return { ctx, gains, ref: { current: ctx } };
  }

  it('clamps to 0–1 and keeps the value it was not asked to change', () => {
    setAudioVolumes({ sfx: 0.4 });
    expect(getAudioVolumes()).toEqual({ sfx: 0.4, music: 1 });
    setAudioVolumes({ sfx: 7, music: -2 });
    expect(getAudioVolumes()).toEqual({ sfx: 1, music: 0 });
    setAudioVolumes({ music: NaN });
    expect(getAudioVolumes().music).toBe(1);
    setAudioVolumes();
    expect(getAudioVolumes()).toEqual({ sfx: 1, music: 1 });
  });

  it('sound effects go through a master gain set to the SFX volume', () => {
    const { ctx, gains, ref } = fakeAudio();
    setAudioVolumes({ sfx: 0.3 });
    playRetroSound('click', ref);

    const master = gains[0];
    expect(master.gain.value).toBe(0.3);
    expect(master.connected).toBe(ctx.destination);
    // the sound's own gain feeds the master, not the speakers directly
    expect(gains[1].connected).toBe(master);
  });

  it('SFX volume 0 plays nothing at all', () => {
    const { gains, ref } = fakeAudio();
    setAudioVolumes({ sfx: 0 });
    playRetroSound('click', ref);
    expect(gains).toHaveLength(0);
  });

  it('menu music uses the music volume, and is silent at 0', () => {
    vi.useFakeTimers();
    const { gains, ref } = fakeAudio();
    setAudioVolumes({ music: 0.5 });
    const interval = startRetroBGM(ref);
    expect(gains[0].gain.value).toBe(0.5);
    expect(gains.length).toBeGreaterThan(1);

    gains.length = 0;
    setAudioVolumes({ music: 0 });
    vi.advanceTimersByTime(2000); // next bar
    expect(gains).toHaveLength(0);

    clearInterval(interval);
    window.clearRetroBGM();
  });
});

describe('useToast', () => {
  it('shows a message, then removes it by itself', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();

    act(() => result.current.notify('PGN COPIED', 'success'));
    expect(result.current.toast).toMatchObject({ text: 'PGN COPIED', tone: 'success' });

    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it('a new message replaces the old one and restarts the timer', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());
    act(() => result.current.notify('FIRST'));
    const firstId = result.current.toast.id;
    act(() => vi.advanceTimersByTime(TOAST_MS - 100));
    act(() => result.current.notify('SECOND'));
    expect(result.current.toast).toMatchObject({ text: 'SECOND', tone: 'info' });
    expect(result.current.toast.id).not.toBe(firstId);

    act(() => vi.advanceTimersByTime(TOAST_MS - 100)); // the first timer would have fired by now
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.toast).toBeNull();
  });

  it('can be dismissed early', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());
    act(() => result.current.notify('BYE'));
    act(() => result.current.dismiss());
    expect(result.current.toast).toBeNull();
    act(() => vi.advanceTimersByTime(TOAST_MS)); // no late timer surprises
    expect(result.current.toast).toBeNull();
  });
});
