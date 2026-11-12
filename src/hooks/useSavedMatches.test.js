import { renderHook, act } from '@testing-library/react';
import { useSavedMatches, STORAGE_KEY, MAX_SAVE_SLOTS } from './useSavedMatches';
import { restoreGame } from './useChessGame';
import { playMoves, mockLocalStorageFailure, restoreLocalStorage } from '../test/helpers';

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY));

// Mounts the hook around a stand-in for the object useChessGame returns.
function setup(chessOverrides = {}) {
  const game = playMoves(['e4', 'e5', 'Nf3']);
  const chess = {
    game,
    gameMode: 'bot',
    difficulty: 'hard',
    timeMode: '5',
    gameStatus: 'BLUE TURN',
    whiteTime: 281.5,
    blackTime: 300,
    timeoutLoser: null,
    loadMatchState: vi.fn(),
    ...chessOverrides,
  };
  const audio = { play: vi.fn(), triggerInteractiveAudioContext: vi.fn() };
  const setActiveModal = vi.fn();
  const view = renderHook(() => useSavedMatches({ chess, audio, setActiveModal }));
  const hook = () => view.result.current;
  // Saves once and returns what saveGame() returned. Each save gets its own
  // moment in time, like real saves do (slot ids are time-based).
  const save = (options) => {
    let ok;
    act(() => {
      vi.advanceTimersByTime(1000);
      ok = hook().saveGame(options);
    });
    return ok;
  };
  return { hook, chess, audio, setActiveModal, save, game };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T10:00:00'));
});

afterEach(() => {
  restoreLocalStorage();
  vi.useRealTimers();
});

describe('saving', () => {
  it('saves the game, returns true and writes it to localStorage', () => {
    const { hook, save, setActiveModal, audio, game } = setup();

    expect(save()).toBe(true);

    expect(hook().savedMatches).toHaveLength(1);
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({
      pgn: game.pgn(),
      fen: game.fen(),
      gameMode: 'bot',
      difficulty: 'hard',
      timeMode: '5',
      gameStatus: 'BLUE TURN',
      whiteTime: 281.5,
      blackTime: 300,
      timeoutLoser: null,
    });
    expect(stored()[0].id).toMatch(/^match_\d+$/);
    expect(setActiveModal).toHaveBeenLastCalledWith('save_success');
    expect(audio.play).toHaveBeenCalledWith('save');
  });

  it('puts the newest save first', () => {
    const { hook, save } = setup();
    save();
    const firstId = hook().savedMatches[0].id;
    save();
    expect(hook().savedMatches).toHaveLength(2);
    expect(hook().savedMatches[1].id).toBe(firstId);
  });

  it('fails gracefully when localStorage throws: returns false and shows the failure modal', () => {
    const { hook, save, setActiveModal, audio } = setup();
    mockLocalStorageFailure();

    let result;
    expect(() => {
      result = save();
    }).not.toThrow();

    expect(result).toBe(false);
    expect(hook().savedMatches).toEqual([]); // nothing pretends to be saved
    expect(setActiveModal).toHaveBeenLastCalledWith('save_failed');
    expect(audio.play).not.toHaveBeenCalledWith('save');
  });
});

describe(`the ${MAX_SAVE_SLOTS}-slot cap`, () => {
  it('accepts 10 saves, then asks before overwriting instead of silently replacing one', () => {
    const { hook, save, setActiveModal } = setup();

    for (let i = 0; i < MAX_SAVE_SLOTS; i++) expect(save()).toBe(true);
    expect(hook().savedMatches).toHaveLength(10);
    const before = stored();

    // 11th save: blocked, prompt shown, nothing changed.
    expect(save()).toBe(false);
    expect(setActiveModal).toHaveBeenLastCalledWith('confirm_overwrite');
    expect(hook().savedMatches).toHaveLength(10);
    expect(stored()).toEqual(before);
  });

  it('after confirming, replaces only the oldest slot and stays at 10', () => {
    const { hook, save, setActiveModal } = setup();
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) save();
    const idsBefore = hook().savedMatches.map((m) => m.id);
    const oldestId = idsBefore.at(-1);
    save(); // opens the prompt

    let ok;
    act(() => {
      vi.advanceTimersByTime(1000);
      ok = hook().confirmOverwriteOldest();
    });

    expect(ok).toBe(true);
    const idsAfter = hook().savedMatches.map((m) => m.id);
    expect(idsAfter).toHaveLength(10);
    expect(idsAfter).not.toContain(oldestId);
    expect(idsAfter.slice(1)).toEqual(idsBefore.slice(0, 9)); // the other nine are untouched
    expect(stored().map((m) => m.id)).toEqual(idsAfter);
    expect(setActiveModal).toHaveBeenLastCalledWith('save_success');
  });

  it('trims an oversized list left over from an older version down to the cap', () => {
    const legacy = Array.from({ length: 14 }, (_, i) => ({ id: `match_${i}`, date: 'old', fen: 'x' }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const { hook, save } = setup();
    expect(hook().savedMatches).toHaveLength(14);

    expect(save({ overwriteOldest: true })).toBe(true);
    expect(hook().savedMatches).toHaveLength(10);
  });
});

describe('deleting', () => {
  it('removes only the chosen slot, after confirmation', () => {
    const { hook, save, setActiveModal } = setup();
    save();
    save();
    save();
    const [newest, middle, oldest] = hook().savedMatches.map((m) => m.id);
    const event = { stopPropagation: vi.fn() };

    act(() => hook().triggerDeletePrompt(middle, event));
    expect(event.stopPropagation).toHaveBeenCalled(); // must not also load the slot
    expect(setActiveModal).toHaveBeenLastCalledWith('confirm_delete');
    expect(hook().savedMatches).toHaveLength(3); // not deleted until confirmed

    act(() => hook().confirmDeleteSlot());
    expect(hook().savedMatches.map((m) => m.id)).toEqual([newest, oldest]);
    expect(stored().map((m) => m.id)).toEqual([newest, oldest]);
    expect(setActiveModal).toHaveBeenLastCalledWith(null);
  });

  it('confirming with nothing selected deletes nothing', () => {
    const { hook, save } = setup();
    save();
    act(() => hook().confirmDeleteSlot());
    expect(hook().savedMatches).toHaveLength(1);
  });
});

describe('loading', () => {
  it('asks first, then loads the slot with its PGN and metadata', () => {
    const { hook, save, chess, setActiveModal, game } = setup();
    save();
    const slot = hook().savedMatches[0];

    act(() => hook().requestLoadMatch(slot));
    expect(hook().pendingLoadMatch).toBe(slot);
    expect(setActiveModal).toHaveBeenLastCalledWith('confirm_load');
    expect(chess.loadMatchState).not.toHaveBeenCalled();

    let ok;
    act(() => {
      ok = hook().confirmLoadMatch();
    });
    expect(ok).toBe(true);
    expect(hook().pendingLoadMatch).toBeNull();

    const loaded = chess.loadMatchState.mock.calls[0][0];
    expect(loaded).toMatchObject({ gameMode: 'bot', difficulty: 'hard', timeMode: '5', whiteTime: 281.5, blackTime: 300 });
    // The stored PGN really rebuilds the game, move list included.
    expect(restoreGame(loaded).history()).toEqual(['e4', 'e5', 'Nf3']);
    expect(restoreGame(loaded).fen()).toBe(game.fen());
  });

  it('survives a round trip through localStorage (reload the page, then load)', () => {
    const first = setup();
    first.save();

    const second = setup(); // new mount reads the list back from storage
    expect(second.hook().savedMatches).toHaveLength(1);
    expect(restoreGame(second.hook().savedMatches[0]).history()).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('shows the load-failed modal when the slot cannot be read', () => {
    const { hook, setActiveModal } = setup({
      loadMatchState: vi.fn(() => {
        throw new Error('Invalid FEN');
      }),
    });

    let ok;
    act(() => {
      ok = hook().resumeMatch({ id: 'match_1', fen: 'garbage' });
    });
    expect(ok).toBe(false);
    expect(setActiveModal).toHaveBeenLastCalledWith('load_failed');
  });

  it('confirming with no slot pending just closes the modal', () => {
    const { hook, chess, setActiveModal } = setup();
    let ok;
    act(() => {
      ok = hook().confirmLoadMatch();
    });
    expect(ok).toBe(false);
    expect(chess.loadMatchState).not.toHaveBeenCalled();
    expect(setActiveModal).toHaveBeenLastCalledWith(null);
  });

  it('re-reads the list from storage on request', () => {
    const { hook } = setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'match_9', date: 'x', fen: 'y' }]));
    act(() => hook().loadSavedMatchesFromStorage());
    expect(hook().savedMatches.map((m) => m.id)).toEqual(['match_9']);
  });
});

describe('storage that is blocked or corrupt (private mode)', () => {
  it('mounting, re-reading, saving and deleting never throw when every storage call throws', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'match_1', date: 'x', fen: 'y' }]));
    mockLocalStorageFailure({ read: true });

    let view;
    expect(() => {
      view = setup();
    }).not.toThrow();
    expect(view.hook().savedMatches).toEqual([]);

    expect(() => act(() => view.hook().loadSavedMatchesFromStorage())).not.toThrow();
    expect(view.save()).toBe(false);
    expect(() => {
      act(() => view.hook().triggerDeletePrompt('match_1'));
      act(() => view.hook().confirmDeleteSlot());
    }).not.toThrow();
  });

  it('deleting still updates the list on screen when the write fails', () => {
    const { hook, save } = setup();
    save();
    save();
    const [keep, remove] = hook().savedMatches.map((m) => m.id);
    mockLocalStorageFailure();

    act(() => hook().triggerDeletePrompt(remove));
    act(() => hook().confirmDeleteSlot());
    expect(hook().savedMatches.map((m) => m.id)).toEqual([keep]);
  });

  it.each([
    ['broken JSON', '{oops'],
    ['not a list', '{"id":"match_1"}'],
    ['null', 'null'],
  ])('treats %s in storage as "no saves"', (_name, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    const { hook } = setup();
    expect(hook().savedMatches).toEqual([]);
  });
});
