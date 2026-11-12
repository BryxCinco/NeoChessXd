import { renderHook, act } from '@testing-library/react';
import { useMenuWizard } from './useMenuWizard';
import { useResponsiveLayout, useScrollLock } from './useResponsiveLayout';
import { useAudio, useBgmLoop } from './useAudio';
import { playRetroSound, startRetroBGM } from '../audioEngine';

vi.mock('../audioEngine', () => ({
  playRetroSound: vi.fn(),
  startRetroBGM: vi.fn(() => 123),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('useMenuWizard', () => {
  function setup(gameMode = null) {
    const chess = { gameMode, setGameMode: vi.fn(), setDifficulty: vi.fn(), setTimeMode: vi.fn() };
    const matches = { loadSavedMatchesFromStorage: vi.fn() };
    const audio = { play: vi.fn() };
    const view = renderHook(() => useMenuWizard({ chess, matches, audio }));
    return { hook: () => view.result.current, chess, matches, audio };
  }

  it('NEW GAME clears the old setup and goes to the mode step', () => {
    const { hook, chess } = setup();
    expect(hook().menuStep).toBe('start');
    expect(hook().wizardCurrentStepNumber).toBe(1);
    act(() => hook().chooseNewGame());
    expect(hook().menuStep).toBe('mode');
    expect(chess.setGameMode).toHaveBeenCalledWith(null);
    expect(chess.setDifficulty).toHaveBeenCalledWith(null);
    expect(chess.setTimeMode).toHaveBeenCalledWith(null);
  });

  it('LOAD GAME re-reads the saves and BACK returns to the start', () => {
    const { hook, matches } = setup();
    act(() => hook().chooseLoadGame());
    expect(hook().menuStep).toBe('load');
    expect(matches.loadSavedMatchesFromStorage).toHaveBeenCalled();
    act(() => hook().goToPrevMenuStep());
    expect(hook().menuStep).toBe('start');
  });

  it('a local match is 3 steps: start → mode → time', () => {
    const { hook } = setup('1v1');
    expect(hook().wizardTotalSteps).toBe(3);
    act(() => hook().setMenuStep('mode'));
    act(() => hook().goToNextMenuStep());
    expect(hook().menuStep).toBe('time');
    expect(hook().wizardCurrentStepNumber).toBe(3);
    act(() => hook().goToNextMenuStep()); // already the last step
    expect(hook().menuStep).toBe('time');
    act(() => hook().goToPrevMenuStep());
    expect(hook().menuStep).toBe('mode');
    act(() => hook().goToPrevMenuStep());
    expect(hook().menuStep).toBe('start');
  });

  it('a bot match adds two steps: start → mode → difficulty → color → time', () => {
    const { hook, audio } = setup('bot');
    expect(hook().wizardTotalSteps).toBe(5);
    act(() => hook().setMenuStep('mode'));
    act(() => hook().goToNextMenuStep());
    expect(hook().menuStep).toBe('difficulty');
    expect(hook().wizardCurrentStepNumber).toBe(3);
    act(() => hook().goToNextMenuStep());
    expect(hook().menuStep).toBe('color');
    expect(hook().wizardCurrentStepNumber).toBe(4);
    act(() => hook().goToNextMenuStep());
    expect(hook().menuStep).toBe('time');
    expect(hook().wizardCurrentStepNumber).toBe(5);
    act(() => hook().goToPrevMenuStep());
    expect(hook().menuStep).toBe('color');
    act(() => hook().goToPrevMenuStep());
    expect(hook().menuStep).toBe('difficulty');
    act(() => hook().goToPrevMenuStep());
    expect(hook().menuStep).toBe('mode');
    expect(audio.play).toHaveBeenCalledWith('click');
  });
});

describe('useResponsiveLayout', () => {
  function stubMatchMedia(matches, legacy = false) {
    const listeners = new Set();
    const mql = legacy
      ? { matches, addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) }
      : { matches, addEventListener: (_e, fn) => listeners.add(fn), removeEventListener: (_e, fn) => listeners.delete(fn) };
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    return listeners;
  }

  afterEach(() => vi.unstubAllGlobals());

  it.each([false, true])('follows the (max-width: 1024px) media query (legacy listener API: %s)', (legacy) => {
    const listeners = stubMatchMedia(true, legacy);
    const { result, unmount } = renderHook(() => useResponsiveLayout());
    expect(result.current.isCompactLayout).toBe(true);

    act(() => listeners.forEach((fn) => fn({ matches: false })));
    expect(result.current.isCompactLayout).toBe(false);

    unmount();
    expect(listeners.size).toBe(0);
  });

  it('blocks multi-touch pinch and iOS gesture events, but not one-finger scrolling', () => {
    stubMatchMedia(false);
    const { unmount } = renderHook(() => useResponsiveLayout());

    const pinch = new Event('touchmove', { cancelable: true });
    pinch.touches = [{}, {}];
    document.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);

    const scroll = new Event('touchmove', { cancelable: true });
    scroll.touches = [{}];
    document.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);

    const gesture = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(true);

    unmount();
    const after = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});

describe('useScrollLock', () => {
  it('locks page scrolling while active and restores it afterwards', () => {
    const { rerender, unmount } = renderHook(({ lock }) => useScrollLock(lock), { initialProps: { lock: true } });
    expect(document.body.style.overflow).toBe('hidden');
    rerender({ lock: false });
    expect(document.body.style.overflow).toBe('');
    rerender({ lock: true });
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('useAudio', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('plays sounds unless muted, and remembers the mute setting', () => {
    const first = renderHook(() => useAudio());
    expect(first.result.current.isMuted).toBe(false);
    act(() => first.result.current.play('click'));
    expect(playRetroSound).toHaveBeenCalledWith('click', first.result.current.audioCtxRef);

    act(() => first.result.current.toggleMute());
    expect(first.result.current.isMuted).toBe(true);
    act(() => first.result.current.play('click'));
    expect(playRetroSound).toHaveBeenCalledTimes(1); // muted: nothing new played
    first.unmount();

    const second = renderHook(() => useAudio()); // "reload the page"
    expect(second.result.current.isMuted).toBe(true);
    act(() => second.result.current.toggleMute());
    expect(second.result.current.isMuted).toBe(false);
    expect(localStorage.getItem('neochess_muted')).toBe('false');
  });

  it('creates the AudioContext on first interaction and resumes it when suspended', () => {
    const resume = vi.fn();
    const AudioContext = vi.fn(function FakeAudioContext() {
      this.state = 'suspended';
      this.resume = resume;
    });
    vi.stubGlobal('AudioContext', AudioContext);
    const { result } = renderHook(() => useAudio());

    act(() => result.current.triggerInteractiveAudioContext());
    act(() => result.current.triggerInteractiveAudioContext());
    expect(AudioContext).toHaveBeenCalledTimes(1); // reused, not recreated
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('does nothing harmful in a browser without Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    const { result } = renderHook(() => useAudio());
    expect(() => act(() => result.current.triggerInteractiveAudioContext())).not.toThrow();
    expect(result.current.audioCtxRef.current).toBeNull();
  });
});

describe('useBgmLoop', () => {
  it('plays menu music only on the menu and only while unmuted', () => {
    const clearRetroBGM = vi.fn();
    window.clearRetroBGM = clearRetroBGM;
    const triggerInteractiveAudioContext = vi.fn();
    const audioCtxRef = { current: null };
    const props = (gameStarted, isMuted) => ({ gameStarted, isMuted, audioCtxRef, triggerInteractiveAudioContext });

    const { rerender, unmount } = renderHook((p) => useBgmLoop(p), { initialProps: props(false, false) });
    expect(startRetroBGM).toHaveBeenCalledTimes(1);
    expect(triggerInteractiveAudioContext).toHaveBeenCalled();

    rerender(props(true, false)); // match started → music stops
    expect(clearRetroBGM).toHaveBeenCalled();
    expect(startRetroBGM).toHaveBeenCalledTimes(1);

    rerender(props(false, true)); // back on the menu but muted
    expect(startRetroBGM).toHaveBeenCalledTimes(1);

    rerender(props(false, false)); // unmuted → music again
    expect(startRetroBGM).toHaveBeenCalledTimes(2);

    unmount();
    delete window.clearRetroBGM;
  });
});
