import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { Chess } from 'chess.js';
import { useChessGame, restoreGame, previousPosition } from './useChessGame';
import { requestBotMove } from '../bot/requestBotMove';
import { playMoves } from '../test/helpers';

// The CPU's reply is scripted so bot-mode tests are instant and predictable.
vi.mock('../bot/requestBotMove', () => ({ requestBotMove: vi.fn() }));

const SESSION_KEY = 'neochess_active_session';
const START_FEN = new Chess().fen();

const audio = { play: vi.fn(), triggerInteractiveAudioContext: vi.fn() };

// useChessGame expects its owner (App) to hold the modal state.
function useHarness() {
  const [activeModal, setActiveModal] = useState(null);
  const chess = useChessGame({ audio, activeModal, setActiveModal });
  return { chess, activeModal, setActiveModal };
}

const save = (extra = {}) => ({
  fen: START_FEN,
  gameMode: '1v1',
  difficulty: null,
  timeMode: 'none',
  gameStatus: 'RED TURN',
  whiteTime: 600,
  blackTime: 600,
  timeoutLoser: null,
  ...extra,
});

// Mounts the hook and (unless told not to) loads a game onto the board.
function setup(loaded = save()) {
  const view = renderHook(() => useHarness());
  if (loaded) act(() => view.result.current.chess.loadMatchState(loaded));
  const chess = () => view.result.current.chess;
  const drop = (from, to) => {
    let ok;
    act(() => {
      ok = chess().onDrop(from, to);
    });
    return ok;
  };
  const play = (...moves) => moves.forEach(([from, to]) => drop(from, to));
  return { ...view, chess, drop, play, modal: () => view.result.current.activeModal };
}

// A long, deterministic game: the same pseudo-random legal move every time.
function longGame(plies) {
  const game = new Chess();
  for (let n = 0; n < plies; n++) {
    const moves = game.moves();
    game.move(moves[(n * 7 + 3) % moves.length]);
  }
  return game;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('moves', () => {
  it('plays a legal move and rejects an illegal one', () => {
    const { chess, drop } = setup();
    expect(drop('e2', 'e5')).toBe(false);
    expect(chess().game.history()).toEqual([]);

    expect(drop('e2', 'e4')).toBe(true);
    expect(chess().game.history()).toEqual(['e4']);
    expect(chess().gameStatus).toBe('BLUE TURN');
    expect(chess().moveHistory).toEqual([{ number: 1, white: 'e4', black: null }]);
    expect(chess().lastMove).toBe('e4');
  });

  it('supports tap-to-move: tap a piece, then a highlighted square', () => {
    const { chess } = setup();
    act(() => chess().onSquareClick('g1'));
    // legal targets of the knight are highlighted
    expect(Object.keys(chess().customSquareStyles)).toEqual(expect.arrayContaining(['g1', 'f3', 'h3']));

    act(() => chess().onSquareClick('f3'));
    expect(chess().game.history()).toEqual(['Nf3']);
    // last move is highlighted, selection is gone
    expect(Object.keys(chess().customSquareStyles).sort()).toEqual(['f3', 'g1']);
  });

  it('tapping an empty square or the same piece again clears the selection', () => {
    const { chess } = setup();
    act(() => chess().onSquareClick('e2'));
    expect(chess().customSquareStyles).toHaveProperty('e2');
    act(() => chess().onSquareClick('e2'));
    expect(chess().customSquareStyles).toEqual({});
    act(() => chess().onPieceDragBegin('wP', 'd2'));
    expect(chess().customSquareStyles).toHaveProperty('d4');
    act(() => chess().onSquareClick('a5'));
    expect(chess().customSquareStyles).toEqual({});
  });

  it('only lets the side to move drag its pieces', () => {
    const { chess, drop } = setup();
    expect(chess().isDraggablePiece({ piece: 'wP' })).toBe(true);
    expect(chess().isDraggablePiece({ piece: 'bP' })).toBe(false);
    drop('e2', 'e4');
    expect(chess().isDraggablePiece({ piece: 'bP' })).toBe(true);
  });

  it('tracks captured pieces and the material lead', () => {
    const { chess, play } = setup();
    play(['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5'], ['d8', 'd5']);
    expect(chess().captured.w).toEqual(['p']); // RED took a pawn
    expect(chess().captured.b).toEqual(['p']); // BLUE took one back
    expect(chess().captured.material).toBe(0);
  });

  it('works out captures from the board when a save has no move list', () => {
    // Black is missing its queen and a rook; white is missing a knight.
    const { chess } = setup(save({ fen: '1nb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQk - 0 1' }));
    expect(chess().captured.w).toEqual(['q', 'r']);
    expect(chess().captured.b).toEqual(['n']);
    expect(chess().captured.material).toBe(11);
  });

  it('highlights the king that is in check', () => {
    const { chess, play } = setup();
    play(['e2', 'e4'], ['f7', 'f6'], ['d1', 'h5']);
    expect(chess().kingCheckedAlert).toBe(true);
    expect(chess().customSquareStyles).toHaveProperty('e8');
    expect(audio.play).toHaveBeenCalledWith('check_alert');
  });
});

describe('promotion', () => {
  const PROMO_FEN = '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1';

  it.each([
    ['q', 'Queen'],
    ['r', 'Rook'],
    ['b', 'Bishop'],
    ['n', 'Knight'],
  ])('promotes to %s (%s)', (piece) => {
    const { chess, drop } = setup(save({ fen: PROMO_FEN }));

    // Dropping the pawn first asks which piece — the move is not played yet.
    expect(drop('e7', 'e8')).toBe(false);
    expect(chess().pendingPromotion).toEqual({ from: 'e7', to: 'e8', color: 'w' });
    expect(chess().game.get('e7')).toMatchObject({ type: 'p' });

    act(() => chess().handlePromotionSelection(piece));
    expect(chess().pendingPromotion).toBeNull();
    expect(chess().game.get('e8')).toMatchObject({ type: piece, color: 'w' });
    expect(chess().game.get('e7')).toBeFalsy();
  });

  it('cancelling the picker leaves the pawn where it was', () => {
    const { chess, drop } = setup(save({ fen: PROMO_FEN }));
    drop('e7', 'e8');
    act(() => chess().cancelPromotion());
    expect(chess().pendingPromotion).toBeNull();
    expect(chess().game.fen()).toBe(PROMO_FEN);
    // choosing a piece with no promotion pending does nothing
    act(() => chess().handlePromotionSelection('q'));
    expect(chess().game.fen()).toBe(PROMO_FEN);
  });
});

describe('en passant', () => {
  it('captures the pawn that is NOT on the destination square', () => {
    const { chess, play, drop } = setup();
    play(['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5']);

    expect(drop('e5', 'd6')).toBe(true);
    expect(chess().game.history().at(-1)).toBe('exd6');
    expect(chess().game.get('d6')).toMatchObject({ type: 'p', color: 'w' });
    expect(chess().game.get('d5')).toBeFalsy(); // the captured pawn is gone
    expect(chess().captured.w).toEqual(['p']);
  });
});

describe('undo / redo', () => {
  it('undo after loading a PGN goes all the way back: 240 moves, 240 undos', async () => {
    const played = longGame(240);
    expect(played.history()).toHaveLength(240);

    const { chess } = setup(save({ pgn: played.pgn(), fen: played.fen() }));
    expect(chess().moveHistory).toHaveLength(120);
    expect(chess().canUndo).toBe(true);

    let undos = 0;
    while (chess().canUndo) {
      act(() => chess().undoMove());
      undos++;
      if (undos > 240) break;
      // This is a long loop: let the test runner breathe now and then.
      if (undos % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(undos).toBe(240);
    expect(chess().game.fen()).toBe(START_FEN);
    expect(chess().game.history()).toEqual([]);
    expect(chess().moveHistory).toEqual([]);
  }, 120000);

  it('undo with nothing to undo does nothing', () => {
    const { chess } = setup();
    expect(chess().canUndo).toBe(false);
    act(() => chess().undoMove());
    expect(chess().game.fen()).toBe(START_FEN);
  });

  it('a save without a move list (old FEN-only save) cannot be undone', () => {
    const { chess } = setup(save({ fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' }));
    expect(chess().canUndo).toBe(false);
  });

  it('redo works within a session, and a new move clears it', () => {
    const { chess, play, drop } = setup();
    play(['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']);

    act(() => chess().undoMove());
    act(() => chess().undoMove());
    expect(chess().game.history()).toEqual(['e4']);
    expect(chess().canRedo).toBe(true);

    act(() => chess().redoMove());
    expect(chess().game.history()).toEqual(['e4', 'e5']);
    act(() => chess().redoMove());
    expect(chess().game.history()).toEqual(['e4', 'e5', 'Nf3']);
    expect(chess().canRedo).toBe(false);
    act(() => chess().redoMove()); // nothing left: no-op
    expect(chess().game.history()).toEqual(['e4', 'e5', 'Nf3']);

    // Playing a different move after an undo throws the redo line away.
    act(() => chess().undoMove());
    drop('b1', 'c3');
    expect(chess().canRedo).toBe(false);
    expect(chess().game.history()).toEqual(['e4', 'e5', 'Nc3']);
  });

  it('undo after a page refresh works (the moves come back with the session)', () => {
    const first = setup();
    first.play(['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']);
    first.unmount(); // "close the tab"

    const second = setup(null); // fresh mount restores the auto-saved session
    expect(second.chess().gameStarted).toBe(true);
    expect(second.chess().game.history()).toEqual(['e4', 'e5', 'Nf3']);
    expect(second.chess().canUndo).toBe(true);

    act(() => second.chess().undoMove());
    expect(second.chess().game.history()).toEqual(['e4', 'e5']);
    act(() => second.chess().undoMove());
    act(() => second.chess().undoMove());
    expect(second.chess().game.fen()).toBe(START_FEN);
    expect(second.chess().canUndo).toBe(false);
  });

  it('redo is empty after a refresh (intentional: only undone moves of this session can be redone)', () => {
    const first = setup();
    first.play(['e2', 'e4'], ['e7', 'e5']);
    act(() => first.chess().undoMove());
    expect(first.chess().canRedo).toBe(true); // redo available before the refresh
    first.unmount();

    const second = setup(null);
    expect(second.chess().game.history()).toEqual(['e4']); // the undone position was saved
    expect(second.chess().canRedo).toBe(false); // ...but the redo line was not
    act(() => second.chess().redoMove());
    expect(second.chess().game.history()).toEqual(['e4']);
    expect(second.chess().canUndo).toBe(true); // undo still works
  });

  it('undoing a finished game reopens it', () => {
    const { chess, play, modal } = setup();
    vi.useFakeTimers();
    play(['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']);
    expect(chess().isGameOver).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(chess().showGameOver).toBe(true);

    act(() => chess().undoMove());
    expect(chess().isGameOver).toBe(false);
    expect(chess().showGameOver).toBe(false);
    expect(modal()).toBeNull();
    expect(chess().gameStatus).toBe('BLUE TURN');
  });
});

describe('game end detection', () => {
  it('checkmate: announces the winner, then shows the game-over bar (never a modal)', () => {
    const { chess, play, modal } = setup();
    vi.useFakeTimers();
    play(['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']);

    expect(chess().gameStatus).toBe('WINNER: BLUE (P2)');
    expect(chess().isGameOver).toBe(true);
    expect(chess().checkmateFx).toBe(true);
    expect(chess().showGameOver).toBe(false); // the CHECKMATE banner plays first

    act(() => vi.advanceTimersByTime(2000));
    expect(chess().checkmateFx).toBe(false);
    expect(chess().showGameOver).toBe(true);
    expect(chess().winner).toBe('b');
    expect(modal()).toBeNull(); // the board is never covered
  });

  it('threefold repetition is a draw', () => {
    const { chess, play } = setup();
    const shuffle = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    play(...shuffle);
    expect(chess().isGameOver).toBe(false);
    play(...shuffle); // starting position on the board for the 3rd time

    expect(chess().isGameOver).toBe(true);
    expect(chess().gameStatus).toBe('DRAW - 3-FOLD REPETITION');
    expect(chess().showGameOver).toBe(true);
  });

  it('the 50-move rule is a draw', () => {
    // 99 half-moves without a capture or pawn move; one more makes 100.
    const { chess, drop } = setup(save({ fen: '8/8/4k3/8/8/4K3/8/7R w - - 99 80' }));
    expect(chess().isGameOver).toBe(false);

    drop('h1', 'h2');
    expect(chess().isGameOver).toBe(true);
    expect(chess().gameStatus).toBe('DRAW - 50-MOVE RULE');
    expect(chess().showGameOver).toBe(true);
  });

  it('stalemate is a draw', () => {
    const { chess, drop } = setup(save({ fen: '7k/8/5K2/6Q1/8/8/8/8 w - - 0 1' }));
    drop('g5', 'g6');
    expect(chess().gameStatus).toBe('DRAW - STALEMATE');
  });

  it('bare kings (no mating material) is a draw', () => {
    const { chess, drop } = setup(save({ fen: '7k/8/8/8/8/8/p7/K7 w - - 0 1' }));
    drop('a1', 'a2');
    expect(chess().gameStatus).toBe('DRAW - NO MATING MATERIAL');
  });

  it('no moves are accepted once the game is over', () => {
    const { chess, play, drop } = setup();
    const shuffle = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    play(...shuffle, ...shuffle);
    expect(drop('e2', 'e4')).toBe(false);
    expect(chess().game.history()).toHaveLength(8);
  });
});

describe('clock', () => {
  it('counts down only the side to move', () => {
    vi.useFakeTimers();
    const { chess, drop } = setup(save({ timeMode: '5', whiteTime: 300, blackTime: 300 }));

    act(() => vi.advanceTimersByTime(2000));
    expect(chess().whiteTime).toBeCloseTo(298, 0);
    expect(chess().blackTime).toBe(300);

    drop('e2', 'e4');
    act(() => vi.advanceTimersByTime(3000));
    expect(chess().whiteTime).toBeCloseTo(298, 0);
    expect(chess().blackTime).toBeCloseTo(297, 0);
  });

  it('does not run without a time limit', () => {
    vi.useFakeTimers();
    const { chess } = setup();
    act(() => vi.advanceTimersByTime(5000));
    expect(chess().whiteTime).toBe(600);
  });

  it.each([
    ['a lone king', '7k/8/8/8/8/8/8/3QK3 w - - 0 1'],
    ['king + bishop', '5b1k/8/8/8/8/8/8/3QK3 w - - 0 1'],
    ['king + knight', '6nk/8/8/8/8/8/8/3QK3 w - - 0 1'],
  ])('running out of time against %s is a DRAW, not a loss', (_name, fen) => {
    vi.useFakeTimers();
    const { chess } = setup(save({ fen, timeMode: '1', whiteTime: 0.5, blackTime: 60 }));

    act(() => vi.advanceTimersByTime(1000));
    expect(chess().whiteTime).toBe(0);
    expect(chess().timeoutLoser).toBe('w');
    expect(chess().isGameOver).toBe(true);
    expect(chess().gameStatus).toBe('DRAW - TIME OUT (NO MATING MATERIAL)');
    expect(chess().showGameOver).toBe(true);
  });

  it('running out of time against real mating material is a loss', () => {
    vi.useFakeTimers();
    const { chess } = setup(save({ fen: '7k/r7/8/8/8/8/8/3QK3 w - - 0 1', timeMode: '1', whiteTime: 0.5, blackTime: 60 }));

    act(() => vi.advanceTimersByTime(1000));
    expect(chess().gameStatus).toBe('TIME OUT - WINNER: BLUE (P2)');
    expect(chess().showGameOver).toBe(true);
    expect(chess().canUndo).toBe(false); // a time-out can't be undone
  });

  it('formats clock text as MM:SS, rounding partial seconds up', () => {
    const { chess } = setup();
    expect(chess().formatTime(600)).toBe('10:00');
    expect(chess().formatTime(59.2)).toBe('01:00');
    expect(chess().formatTime(9)).toBe('00:09');
    expect(chess().formatTime(-3)).toBe('00:00');
  });
});

describe('starting, restarting and quitting', () => {
  it('START needs a mode and a time limit, then counts 3-2-1-GO', () => {
    vi.useFakeTimers();
    const { chess } = setup(null);

    act(() => chess().startGame());
    expect(chess().isStarting).toBe(false); // nothing chosen yet

    act(() => {
      chess().setGameMode('1v1');
      chess().setTimeMode('5');
    });
    act(() => chess().startGame());
    expect(chess().isStarting).toBe(true);
    expect(chess().countdownValue).toBe(3);
    act(() => chess().startGame()); // double tap is ignored

    act(() => vi.advanceTimersByTime(950));
    expect(chess().countdownValue).toBe(2);
    act(() => vi.advanceTimersByTime(900));
    expect(chess().countdownValue).toBe(1);
    act(() => vi.advanceTimersByTime(900));
    expect(chess().countdownValue).toBe('GO!');
    act(() => vi.advanceTimersByTime(800));

    expect(chess().isStarting).toBe(false);
    expect(chess().gameStarted).toBe(true);
    expect(chess().whiteTime).toBe(300);
    expect(chess().blackTime).toBe(300);
  });

  it('a bot match also needs a difficulty', () => {
    const { chess } = setup(null);
    act(() => {
      chess().setGameMode('bot');
      chess().setTimeMode('none');
    });
    act(() => chess().startGame());
    expect(chess().isStarting).toBe(false);
  });

  it('RESTART resets the board after the countdown', () => {
    vi.useFakeTimers();
    const { chess, play, modal } = setup();
    play(['e2', 'e4'], ['e7', 'e5']);

    act(() => chess().restartMatch());
    expect(modal()).toBeNull();
    act(() => vi.advanceTimersByTime(4000));

    expect(chess().game.fen()).toBe(START_FEN);
    expect(chess().gameStatus).toBe('RED TURN');
    expect(chess().canUndo).toBe(false);
    expect(chess().gameStarted).toBe(true);
  });

  it('QUIT goes back to the menu and forgets the auto-saved session', () => {
    const { chess, play } = setup();
    play(['e2', 'e4']);
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();

    act(() => chess().quitMatch());
    expect(chess().gameStarted).toBe(false);
    expect(chess().gameMode).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('session auto-save', () => {
  it('saves after every move, with the PGN', () => {
    const { play } = setup();
    play(['e2', 'e4'], ['e7', 'e5']);
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    expect(session).toMatchObject({ gameMode: '1v1', gameStarted: true, gameStatus: 'RED TURN' });
    expect(restoreGame(session).history()).toEqual(['e4', 'e5']);
  });

  it('a corrupt session does not crash the app', () => {
    localStorage.setItem(SESSION_KEY, '{not json');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { chess } = setup(null);
    expect(chess().gameStarted).toBe(false);
    logged.mockRestore();
  });

  it('a finished game is restored with the game-over bar showing', () => {
    const mated = playMoves(['f3', 'e5', 'g4', 'Qh4#']);
    const { chess } = setup(save({ pgn: mated.pgn(), fen: mated.fen(), gameStatus: 'WINNER: BLUE (P2)' }));
    expect(chess().isGameOver).toBe(true);
    expect(chess().showGameOver).toBe(true);
  });
});

describe('bot match', () => {
  const botSave = (extra = {}) => save({ gameMode: 'bot', difficulty: 'easy', ...extra });

  it('the CPU replies after the player moves, and gets the PGN', async () => {
    vi.useFakeTimers();
    requestBotMove.mockResolvedValue({ from: 'e7', to: 'e5' });
    const { chess, drop } = setup(botSave());

    drop('e2', 'e4');
    expect(chess().botThinking).toBe(true);
    expect(chess().isDraggablePiece({ piece: 'bP' })).toBe(false); // can't move the CPU's pieces
    expect(drop('d7', 'd5')).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(requestBotMove).toHaveBeenCalledWith(expect.any(String), 'easy', expect.stringContaining('e4'));
    expect(chess().game.history()).toEqual(['e4', 'e5']);
    expect(chess().botThinking).toBe(false);
    expect(chess().gameStatus).toBe('RED TURN');
  });

  it('undo steps back past the CPU reply, redo forward past it', async () => {
    vi.useFakeTimers();
    requestBotMove.mockResolvedValue({ from: 'e7', to: 'e5' });
    const { chess, drop } = setup(botSave());
    drop('e2', 'e4');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(chess().game.history()).toEqual(['e4', 'e5']);

    act(() => chess().undoMove());
    expect(chess().game.history()).toEqual([]); // both plies undone: player to move

    act(() => chess().redoMove());
    expect(chess().game.history()).toEqual(['e4', 'e5']);
  });

  it('names the sides YOU / CPU when the game ends', () => {
    vi.useFakeTimers();
    const { chess } = setup(botSave({ fen: '7k/r7/8/8/8/8/8/3QK3 w - - 0 1', timeMode: '1', whiteTime: 0.5, blackTime: 60 }));
    act(() => vi.advanceTimersByTime(1000));
    expect(chess().gameStatus).toBe('TIME OUT - WINNER: BLUE (P2 / CPU)');
  });
});

describe('restoreGame / previousPosition', () => {
  it('restores from the PGN when there is one, else from the FEN', () => {
    const game = playMoves(['e4', 'e5', 'Nf3']);
    expect(restoreGame({ pgn: game.pgn(), fen: game.fen() }).history()).toEqual(['e4', 'e5', 'Nf3']);
    expect(restoreGame({ fen: game.fen() }).fen()).toBe(game.fen());
    expect(restoreGame({ fen: game.fen() }).history()).toEqual([]);
    // unreadable PGN falls back to the FEN
    expect(restoreGame({ pgn: '1. Zz9 ??', fen: game.fen() }).fen()).toBe(game.fen());
  });

  it('previousPosition returns a new game one move back and leaves the original alone', () => {
    const game = playMoves(['e4', 'e5']);
    const back = previousPosition(game);
    expect(back.history()).toEqual(['e4']);
    expect(game.history()).toEqual(['e4', 'e5']);
    expect(previousPosition(new Chess())).toBeNull();
  });
});
