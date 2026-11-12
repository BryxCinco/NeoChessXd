import { Chess } from 'chess.js';
import { TIME_PRESETS, parseTimeMode, timeModeLabel } from './timeControl';
import { COLOR_KEY, loadColorChoice, saveColorChoice, resolveColor, opposite } from './colorChoice';
import { botAcceptsDraw, DRAW_EVAL_MARGIN, DRAW_MIN_PLIES } from './drawOffer';
import { buildPgn, resultCode, playerNames, pgnDate, pgnFileName, copyText, downloadText } from './pgnExport';
import { mockLocalStorageFailure, restoreLocalStorage, playMoves } from '../test/helpers';

afterEach(() => {
  restoreLocalStorage();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('time controls', () => {
  it('offers the increment presets 3+2, 5+3, 10+0 and 15+10', () => {
    const ids = TIME_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['3+2', '5+3', '10', '15+10', 'none']));
    expect(TIME_PRESETS.find((p) => p.id === '10').label).toBe('10+0');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ['none', { timed: false, seconds: 0, increment: 0 }],
    [null, { timed: false, seconds: 0, increment: 0 }],
    ['5', { timed: true, seconds: 300, increment: 0 }],
    ['0.5', { timed: true, seconds: 30, increment: 0 }],
    ['3+2', { timed: true, seconds: 180, increment: 2 }],
    ['5+3', { timed: true, seconds: 300, increment: 3 }],
    ['15+10', { timed: true, seconds: 900, increment: 10 }],
    ['10+0', { timed: true, seconds: 600, increment: 0 }],
    ['garbage', { timed: false, seconds: 0, increment: 0 }],
    ['5+x', { timed: true, seconds: 300, increment: 0 }],
  ])('parses %s', (timeMode, expected) => {
    expect(parseTimeMode(timeMode)).toEqual(expected);
  });

  it('every preset parses to something playable', () => {
    for (const preset of TIME_PRESETS) {
      const parsed = parseTimeMode(preset.id);
      expect(parsed.timed).toBe(preset.id !== 'none');
    }
  });

  it('labels saves compactly', () => {
    expect(timeModeLabel('none')).toBe('INF');
    expect(timeModeLabel('5')).toBe('5M');
    expect(timeModeLabel('0.5')).toBe('0.5M');
    expect(timeModeLabel('3+2')).toBe('3+2');
  });
});

describe('colour choice', () => {
  it('defaults to RED and round-trips through localStorage', () => {
    expect(loadColorChoice()).toBe('w');
    saveColorChoice('random');
    expect(localStorage.getItem(COLOR_KEY)).toBe('random');
    expect(loadColorChoice()).toBe('random');
    saveColorChoice('b');
    expect(loadColorChoice()).toBe('b');
  });

  it('ignores a stored value it does not understand', () => {
    localStorage.setItem(COLOR_KEY, 'purple');
    expect(loadColorChoice()).toBe('w');
  });

  it('works without storage (private mode)', () => {
    mockLocalStorageFailure({ read: true });
    expect(loadColorChoice()).toBe('w');
    expect(() => saveColorChoice('b')).not.toThrow();
  });

  it('resolves a choice to an actual colour', () => {
    expect(resolveColor('w')).toBe('w');
    expect(resolveColor('b')).toBe('b');
    expect(resolveColor('nonsense')).toBe('w');
    expect(resolveColor('random', () => 0.49)).toBe('w');
    expect(resolveColor('random', () => 0.5)).toBe('b');
    expect(opposite('w')).toBe('b');
    expect(opposite('b')).toBe('w');
  });

  it('RANDOM really gives both colours', () => {
    const seen = new Set(Array.from({ length: 200 }, () => resolveColor('random')));
    expect([...seen].sort()).toEqual(['b', 'w']);
  });
});

describe('CPU draw acceptance', () => {
  it('accepts within half a pawn either way, once the opening is over', () => {
    expect(DRAW_EVAL_MARGIN).toBe(50);
    for (const cp of [0, 1, -1, 49, 50, -50]) expect(botAcceptsDraw(cp, DRAW_MIN_PLIES)).toBe(true);
  });

  it('declines when either side is ahead by more than half a pawn', () => {
    for (const cp of [51, -51, 100, -320, 900]) expect(botAcceptsDraw(cp, 60)).toBe(false);
  });

  it('declines a level position in the first 10 moves', () => {
    expect(botAcceptsDraw(0, 0)).toBe(false);
    expect(botAcceptsDraw(0, DRAW_MIN_PLIES - 1)).toBe(false);
    expect(botAcceptsDraw(0, DRAW_MIN_PLIES)).toBe(true);
  });
});

describe('PGN export', () => {
  const date = new Date(2026, 0, 5, 9, 7); // 5 Jan 2026, 09:07

  it('maps the outcome to a PGN result code', () => {
    expect(resultCode({ isGameOver: false, winner: null })).toBe('*');
    expect(resultCode({ isGameOver: true, winner: 'w' })).toBe('1-0');
    expect(resultCode({ isGameOver: true, winner: 'b' })).toBe('0-1');
    expect(resultCode({ isGameOver: true, winner: null })).toBe('1/2-1/2');
  });

  it('names the players for local and bot matches', () => {
    expect(playerNames({ gameMode: '1v1' })).toEqual({ white: 'Player 1 (Red)', black: 'Player 2 (Blue)' });
    expect(playerNames({ gameMode: 'bot', difficulty: 'hard' })).toEqual({
      white: 'Player (Red)',
      black: 'CPU (Hard Core) (Blue)',
    });
    expect(playerNames({ gameMode: 'bot', difficulty: 'easy', playerColor: 'b' })).toEqual({
      white: 'CPU (Easy) (Red)',
      black: 'Player (Blue)',
    });
    expect(playerNames({ gameMode: 'bot', difficulty: undefined }).black).toBe('CPU (Normal) (Blue)');
  });

  it('formats dates the PGN way and builds a file name', () => {
    expect(pgnDate(date)).toBe('2026.01.05');
    expect(pgnFileName(date)).toBe('neo-chess-dx-2026-01-05-0907.pgn');
  });

  it('writes the six required header tags and the moves, and reads back as the same game', () => {
    const game = playMoves(['e4', 'e5', 'Nf3', 'Nc6']);
    const pgn = buildPgn({ game, gameMode: '1v1', isGameOver: false, winner: null, date, site: 'neo-chess-xd.vercel.app' });

    for (const tag of [
      '[Event "NEO CHESS DX casual game"]',
      '[Site "neo-chess-xd.vercel.app"]',
      '[Date "2026.01.05"]',
      '[White "Player 1 (Red)"]',
      '[Black "Player 2 (Blue)"]',
      '[Result "*"]',
    ]) {
      expect(pgn).toContain(tag);
    }
    expect(pgn).toContain('1. e4 e5 2. Nf3 Nc6');

    const reloaded = new Chess();
    reloaded.loadPgn(pgn);
    expect(reloaded.fen()).toBe(game.fen());
    expect(game.pgn()).not.toContain('NEO CHESS DX'); // the live game is not modified
  });

  it('falls back to the page host for Site', () => {
    const pgn = buildPgn({ game: new Chess(), gameMode: '1v1', isGameOver: false, winner: null, date });
    expect(pgn).toContain(`[Site "${window.location.host}"]`);
  });

  it('copyText writes to the clipboard and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('1. e4 e5')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('1. e4 e5');
  });

  it('copyText reports failure when the clipboard is missing or refuses', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyText('x')).resolves.toBe(false);
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await expect(copyText('x')).resolves.toBe(false);
  });

  it('downloadText offers a .pgn file with the text in it', async () => {
    let blob;
    const createObjectURL = vi.fn((b) => {
      blob = b;
      return 'blob:test';
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    let clicked;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      clicked = { href: this.getAttribute('href'), download: this.download, attached: document.body.contains(this) };
    });

    expect(downloadText('1. e4 e5 *', 'game.pgn')).toBe(true);
    expect(clicked).toEqual({ href: 'blob:test', download: 'game.pgn', attached: true });
    expect(await blob.text()).toBe('1. e4 e5 *');
    expect(document.querySelector('a[download]')).toBeNull(); // cleaned up
  });

  it('downloadText reports failure instead of throwing', () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => {
        throw new Error('unsupported');
      },
    });
    expect(downloadText('x', 'game.pgn')).toBe(false);
  });
});
