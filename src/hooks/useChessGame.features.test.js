import { useState } from 'react';
import { renderHook, act, fireEvent } from '@testing-library/react';
import { Chess } from 'chess.js';
import { useChessGame, HINT_LIMITS } from './useChessGame';
import { requestBotMove } from '../bot/requestBotMove';
import { evaluatePosition } from '../bot/engine';
import { COLOR_KEY } from '../game/colorChoice';

// The CPU's moves, the engine's evaluation and the canvas effects are all
// scripted, so these tests are instant and say exactly what they depend on.
vi.mock('../bot/requestBotMove', () => ({ requestBotMove: vi.fn() }));
vi.mock('../bot/engine', async (importOriginal) => ({
  ...(await importOriginal()),
  evaluatePosition: vi.fn(() => 0),
}));
const fx = vi.hoisted(() => ({
  triggerElimination: vi.fn((_square, _victim, _piece, _color, onComplete) => {
    onComplete();
    return 'thunder';
  }),
  triggerCaptureAnimation: vi.fn(),
  triggerEffect: vi.fn(),
  clearAnimations: vi.fn(),
}));
vi.mock('../usePixelAnimation', () => ({
  usePixelAnimation: () => ({ canvasRef: { current: null }, ...fx }),
}));

const SESSION_KEY = 'neochess_active_session';
const START_FEN = new Chess().fen();
const audio = { play: vi.fn(), triggerInteractiveAudioContext: vi.fn() };
const notify = vi.fn();

function useHarness(options) {
  const [activeModal, setActiveModal] = useState(null);
  const chess = useChessGame({ audio, activeModal, setActiveModal, notify, ...options });
  return { chess, activeModal };
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

function setup(loaded = save(), options = {}) {
  const view = renderHook(() => useHarness(options));
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

// Lets a resolved promise (a scripted CPU move / hint) reach the hook.
const flush = () => act(async () => {});
// Runs the CPU's "thinking" delay (fake timers must be on).
const botReplies = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });

// The same pseudo-random legal game every time.
function longGame(plies) {
  const game = new Chess();
  for (let n = 0; n < plies; n++) {
    const moves = game.moves();
    game.move(moves[(n * 7 + 3) % moves.length]);
  }
  return game;
}

const FOOLS_MATE = [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']];

// Starts a bot match from the menu, through the 3-2-1 countdown.
function startBotMatch(view, { difficulty = 'easy', timeMode = 'none' } = {}) {
  act(() => {
    view.chess().setGameMode('bot');
    view.chess().setDifficulty(difficulty);
    view.chess().setTimeMode(timeMode);
  });
  act(() => view.chess().startGame());
  act(() => vi.advanceTimersByTime(3500));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  requestBotMove.mockResolvedValue(null);
  evaluatePosition.mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─────────────────────────────── 5.1 ───────────────────────────────
describe('5.1 choosing a side against the CPU', () => {
  it('defaults to RED: board the normal way up, the human moves first', () => {
    vi.useFakeTimers();
    const view = setup(null);
    expect(view.chess().colorChoice).toBe('w');
    startBotMatch(view);

    expect(view.chess().playerColor).toBe('w');
    expect(view.chess().botColor).toBe('b');
    expect(view.chess().boardOrientation).toBe('white');
    expect(requestBotMove).not.toHaveBeenCalled(); // the CPU waits for RED
    expect(view.chess().isDraggablePiece({ piece: 'wP' })).toBe(true);
  });

  it('PLAY AS BLUE: the board flips, the CPU takes RED and makes the first move', async () => {
    vi.useFakeTimers();
    requestBotMove.mockResolvedValueOnce({ from: 'e2', to: 'e4' });
    const view = setup(null);
    act(() => view.chess().setColorChoice('b'));
    startBotMatch(view);

    expect(view.chess().playerColor).toBe('b');
    expect(view.chess().botColor).toBe('w');
    expect(view.chess().boardOrientation).toBe('black');
    expect(view.chess().botThinking).toBe(true);
    expect(view.drop('e7', 'e5')).toBe(false); // not your turn yet

    await botReplies();
    expect(view.chess().game.history()).toEqual(['e4']);
    expect(view.chess().isDraggablePiece({ piece: 'bP' })).toBe(true);
    expect(view.chess().isDraggablePiece({ piece: 'wP' })).toBe(false); // the CPU's army

    expect(view.drop('e7', 'e5')).toBe(true);
    expect(view.chess().game.history()).toEqual(['e4', 'e5']);
  });

  it('the choice is remembered in localStorage under its own key', () => {
    const first = setup(null);
    act(() => first.chess().setColorChoice('b'));
    expect(localStorage.getItem(COLOR_KEY)).toBe('b');
    first.unmount();

    const second = setup(null);
    expect(second.chess().colorChoice).toBe('b');
  });

  it.each([
    [0.1, 'w', 'white'],
    [0.9, 'b', 'black'],
  ])('RANDOM flips a coin (roll %s → %s)', (roll, color, orientation) => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(roll);
    const view = setup(null);
    act(() => view.chess().setColorChoice('random'));
    startBotMatch(view);
    expect(view.chess().playerColor).toBe(color);
    expect(view.chess().boardOrientation).toBe(orientation);
  });

  it('RANDOM is rolled again for a rematch', () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const view = setup(null);
    act(() => view.chess().setColorChoice('random'));
    startBotMatch(view);
    expect(view.chess().playerColor).toBe('w');

    random.mockReturnValue(0.9);
    act(() => view.chess().restartMatch());
    act(() => vi.advanceTimersByTime(3500));
    expect(view.chess().playerColor).toBe('b');
    expect(view.chess().game.fen()).toBe(START_FEN);
  });

  it('a local 1v1 match ignores the choice: no flipping, both sides playable', () => {
    vi.useFakeTimers();
    const view = setup(null);
    act(() => {
      view.chess().setColorChoice('b');
      view.chess().setGameMode('1v1');
      view.chess().setTimeMode('none');
    });
    act(() => view.chess().startGame());
    act(() => vi.advanceTimersByTime(3500));
    expect(view.chess().playerColor).toBe('w');
    expect(view.chess().botColor).toBeNull();
    expect(view.chess().boardOrientation).toBe('white');
  });

  it('the side is saved with the match; older saves (no side) mean RED', () => {
    const asBlue = setup(save({ gameMode: 'bot', difficulty: 'easy', playerColor: 'b', pgn: '1. e4', fen: undefined }));
    expect(asBlue.chess().playerColor).toBe('b');
    expect(asBlue.chess().boardOrientation).toBe('black');
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)).playerColor).toBe('b');
    expect(asBlue.chess().buildSaveData().playerColor).toBe('b');
    asBlue.unmount();

    localStorage.clear();
    const legacy = setup(save({ gameMode: 'bot', difficulty: 'easy' }));
    expect(legacy.chess().playerColor).toBe('w');
  });

  it('as BLUE, undo needs a move of your own: the CPU opening move alone cannot be undone', async () => {
    vi.useFakeTimers();
    requestBotMove.mockResolvedValueOnce({ from: 'e2', to: 'e4' }).mockResolvedValueOnce({ from: 'g1', to: 'f3' });
    const view = setup(null);
    act(() => view.chess().setColorChoice('b'));
    startBotMatch(view);
    await botReplies();
    expect(view.chess().game.history()).toEqual(['e4']);
    expect(view.chess().canUndo).toBe(false);

    view.drop('e7', 'e5');
    await botReplies();
    expect(view.chess().game.history()).toEqual(['e4', 'e5', 'Nf3']);
    expect(view.chess().canUndo).toBe(true);

    act(() => view.chess().undoMove()); // takes back Nf3 AND your e5
    expect(view.chess().game.history()).toEqual(['e4']);
    expect(view.chess().game.turn()).toBe('b'); // your move again
  });

  it('labels follow the side: as BLUE you are "BLUE (P2 / YOU)" and the CPU is RED', () => {
    const view = setup(save({ gameMode: 'bot', difficulty: 'easy', playerColor: 'b', pgn: '1. e4', fen: undefined }));
    act(() => view.chess().resign());
    expect(view.chess().gameStatus).toBe('RESIGNED - WINNER: RED (P1 / CPU)');
  });
});

// ─────────────────────────────── 5.2 ───────────────────────────────
describe('5.2 resigning', () => {
  it('1v1: the side to move resigns, the opponent wins, and it is logged', () => {
    const view = setup();
    view.play(['e2', 'e4']); // BLUE to move
    let ok;
    act(() => {
      ok = view.chess().resign();
    });

    expect(ok).toBe(true);
    expect(view.chess().isGameOver).toBe(true);
    expect(view.chess().showGameOver).toBe(true);
    expect(view.chess().winner).toBe('w');
    expect(view.chess().manualEnd).toEqual({ type: 'resign', loser: 'b' });
    expect(view.chess().gameStatus).toBe('RESIGNED - WINNER: RED (P1)');
    expect(view.chess().matchNotes).toEqual([{ ply: 1, text: 'BLUE RESIGNED' }]);
    expect(view.modal()).toBeNull();
  });

  it('vs CPU: it is always the human who resigns, even on the CPU turn', () => {
    const view = setup(save({ gameMode: 'bot', difficulty: 'easy', pgn: '1. e4', fen: undefined })); // CPU (BLUE) to move
    act(() => view.chess().resign());
    expect(view.chess().manualEnd).toEqual({ type: 'resign', loser: 'w' });
    expect(view.chess().winner).toBe('b');
    expect(view.chess().gameStatus).toBe('RESIGNED - WINNER: BLUE (P2 / CPU)');
    expect(view.chess().matchNotes[0].text).toBe('RED RESIGNED');
  });

  it('a resigned game is over for good: no moves, no undo, no second resignation', () => {
    const view = setup();
    view.play(['e2', 'e4']);
    act(() => view.chess().resign());

    expect(view.drop('e7', 'e5')).toBe(false);
    expect(view.chess().canUndo).toBe(false);
    expect(view.chess().canEndManually).toBe(false);
    let again;
    act(() => {
      again = view.chess().resign();
    });
    expect(again).toBe(false);
    expect(view.chess().matchNotes).toHaveLength(1);
  });

  it('survives a refresh: still over, with the result and the log', () => {
    const first = setup();
    first.play(['e2', 'e4']);
    act(() => first.chess().resign());
    first.unmount();

    const second = setup(null);
    expect(second.chess().isGameOver).toBe(true);
    expect(second.chess().winner).toBe('w');
    expect(second.chess().gameStatus).toBe('RESIGNED - WINNER: RED (P1)');
    expect(second.chess().matchNotes).toEqual([{ ply: 1, text: 'BLUE RESIGNED' }]);
    expect(second.chess().kingCheckedAlert).toBe(false);
  });

  it('a rematch clears the result and the log', () => {
    vi.useFakeTimers();
    const view = setup();
    act(() => view.chess().resign());
    act(() => view.chess().restartMatch());
    act(() => vi.advanceTimersByTime(3500));
    expect(view.chess().isGameOver).toBe(false);
    expect(view.chess().manualEnd).toBeNull();
    expect(view.chess().matchNotes).toEqual([]);
  });
});

describe('5.2 offering a draw', () => {
  // 20 moves played, RED (the human) to move.
  const botGame = () => {
    const game = longGame(20);
    return save({ gameMode: 'bot', difficulty: 'easy', pgn: game.pgn(), fen: game.fen() });
  };

  it.each([0, 30, -50, 50])('vs CPU: accepted when the evaluation is within half a pawn (%i cp)', (evalCp) => {
    evaluatePosition.mockReturnValue(evalCp);
    const view = setup(botGame());
    let answer;
    act(() => {
      answer = view.chess().offerDraw();
    });

    expect(answer).toBe('accepted');
    expect(evaluatePosition).toHaveBeenCalledWith(view.chess().game.fen());
    expect(view.chess().isGameOver).toBe(true);
    expect(view.chess().winner).toBeNull();
    expect(view.chess().manualEnd).toEqual({ type: 'draw' });
    expect(view.chess().gameStatus).toBe('DRAW - BY AGREEMENT');
    expect(view.chess().matchNotes.at(-1)).toEqual({ ply: 20, text: 'DRAW AGREED' });
    expect(notify).toHaveBeenCalledWith('CPU ACCEPTED THE DRAW', 'success');
  });

  it.each([51, -51, 300, -900])('vs CPU: declined with a toast when one side is ahead (%i cp)', (evalCp) => {
    evaluatePosition.mockReturnValue(evalCp);
    const view = setup(botGame());
    let answer;
    act(() => {
      answer = view.chess().offerDraw();
    });

    expect(answer).toBe('declined');
    expect(view.chess().isGameOver).toBe(false);
    expect(view.chess().manualEnd).toBeNull();
    expect(notify).toHaveBeenCalledWith('CPU DECLINED THE DRAW', 'alert');
    expect(view.chess().matchNotes).toEqual([{ ply: 20, text: 'RED OFFERED A DRAW - DECLINED' }]);
    expect(view.modal()).toBeNull(); // back to the game
  });

  it('vs CPU: never accepted in the opening, however level the position', () => {
    evaluatePosition.mockReturnValue(0);
    const view = setup(save({ gameMode: 'bot', difficulty: 'easy' }));
    let answer;
    act(() => {
      answer = view.chess().offerDraw();
    });
    expect(answer).toBe('declined');
    expect(view.chess().isGameOver).toBe(false);
  });

  it('1v1: the other player is asked; declining continues the game and is logged', () => {
    const view = setup();
    view.play(['e2', 'e4']); // BLUE to move, so BLUE is the one offering
    let answer;
    act(() => {
      answer = view.chess().offerDraw();
    });
    expect(answer).toBe('pending');
    expect(view.chess().pendingDrawOffer).toBe('b');
    expect(view.modal()).toBe('draw_offer');
    expect(view.chess().isGameOver).toBe(false);

    act(() => view.chess().respondToDraw(false));
    expect(view.chess().pendingDrawOffer).toBeNull();
    expect(view.modal()).toBeNull();
    expect(view.chess().isGameOver).toBe(false);
    expect(view.chess().matchNotes).toEqual([{ ply: 1, text: 'BLUE OFFERED A DRAW - DECLINED' }]);
    expect(notify).toHaveBeenCalledWith('DRAW OFFER DECLINED', 'alert');
    expect(view.drop('e7', 'e5')).toBe(true);
  });

  it('1v1: accepting ends the game as a draw', () => {
    const view = setup();
    act(() => view.chess().offerDraw());
    act(() => view.chess().respondToDraw(true));
    expect(view.chess().isGameOver).toBe(true);
    expect(view.chess().winner).toBeNull();
    expect(view.chess().gameStatus).toBe('DRAW - BY AGREEMENT');
    expect(view.chess().pendingDrawOffer).toBeNull();
    expect(view.modal()).toBeNull();
  });

  it('answering when nothing was offered, or offering after the game ended, does nothing', () => {
    const view = setup();
    act(() => view.chess().respondToDraw(true));
    expect(view.chess().isGameOver).toBe(false);

    act(() => view.chess().resign());
    let answer;
    act(() => {
      answer = view.chess().offerDraw();
    });
    expect(answer).toBeNull();
  });
});

// ─────────────────────────────── 5.3 ───────────────────────────────
describe('5.3 post-game review', () => {
  function finishedGame() {
    vi.useFakeTimers();
    const view = setup();
    view.play(...FOOLS_MATE);
    act(() => vi.advanceTimersByTime(2000)); // CHECKMATE banner done
    vi.useRealTimers();
    return view;
  }
  const fenAfter = (plies) => {
    const game = new Chess();
    FOOLS_MATE.slice(0, plies).forEach(([from, to]) => game.move({ from, to }));
    return game.fen();
  };

  it('game over shows the bar, not a modal, and the final position stays on the board', () => {
    const view = finishedGame();
    expect(view.chess().showGameOver).toBe(true);
    expect(view.modal()).toBeNull();
    expect(view.chess().isReviewing).toBe(false);
    expect(view.chess().displayPosition).toBe(fenAfter(4));
    expect(view.chess().totalPlies).toBe(4);
  });

  it('VIEW BOARD starts at the final position; stepping walks back and forward', () => {
    const view = finishedGame();
    act(() => view.chess().startReview());
    expect(view.chess().isReviewing).toBe(true);
    expect(view.chess().reviewPly).toBe(4);
    expect(view.chess().displayPosition).toBe(fenAfter(4));

    act(() => view.chess().stepReview(-1));
    expect(view.chess().reviewPly).toBe(3);
    expect(view.chess().displayPosition).toBe(fenAfter(3));
    // the move that led here (3. g4) is the one highlighted
    expect(Object.keys(view.chess().customSquareStyles).sort()).toEqual(['g2', 'g4']);

    act(() => view.chess().stepReview(-1));
    act(() => view.chess().stepReview(-1));
    act(() => view.chess().stepReview(-1));
    expect(view.chess().reviewPly).toBe(0);
    expect(view.chess().displayPosition).toBe(START_FEN);
    expect(view.chess().customSquareStyles).toEqual({});

    act(() => view.chess().stepReview(-1)); // can't go before the start
    expect(view.chess().reviewPly).toBe(0);
    act(() => view.chess().stepReview(1));
    expect(view.chess().displayPosition).toBe(fenAfter(1));
  });

  it('jumping to a move (what clicking the scoresheet does) shows the position after it', () => {
    const view = finishedGame();
    act(() => view.chess().jumpToPly(2)); // after 1... e5 — also enters review
    expect(view.chess().isReviewing).toBe(true);
    expect(view.chess().displayPosition).toBe(fenAfter(2));

    act(() => view.chess().jumpToPly(99)); // clamped to the last move
    expect(view.chess().reviewPly).toBe(4);
    act(() => view.chess().jumpToPly(-5));
    expect(view.chess().reviewPly).toBe(0);
    act(() => view.chess().jumpToPly(NaN));
    expect(view.chess().reviewPly).toBe(0);
  });

  it('arrow keys step, Home / End jump to the ends, Escape leaves the review', () => {
    const view = finishedGame();
    act(() => view.chess().startReview());
    const press = (key) => act(() => void fireEvent.keyDown(window, { key }));

    press('ArrowLeft');
    expect(view.chess().reviewPly).toBe(3);
    press('ArrowLeft');
    expect(view.chess().reviewPly).toBe(2);
    press('ArrowRight');
    expect(view.chess().reviewPly).toBe(3);
    press('Home');
    expect(view.chess().reviewPly).toBe(0);
    press('End');
    expect(view.chess().reviewPly).toBe(4);
    press('a'); // other keys are ignored
    expect(view.chess().reviewPly).toBe(4);

    press('Escape');
    expect(view.chess().isReviewing).toBe(false);
    expect(view.chess().displayPosition).toBe(fenAfter(4));
    press('ArrowLeft'); // keys only work during a review
    expect(view.chess().isReviewing).toBe(false);
  });

  it('highlights the checked king of the position being reviewed', () => {
    const view = finishedGame();
    act(() => view.chess().startReview());
    expect(view.chess().customSquareStyles).toHaveProperty('e1'); // mated king, in check
    act(() => view.chess().stepReview(-1));
    expect(view.chess().customSquareStyles).not.toHaveProperty('e1');
  });

  it('the board is look-only during a review', () => {
    const view = finishedGame();
    act(() => view.chess().jumpToPly(0));
    expect(view.chess().isDraggablePiece({ piece: 'wP' })).toBe(false);
    expect(view.drop('e2', 'e4')).toBe(false);
    expect(view.chess().game.history()).toHaveLength(4); // the real game is untouched
  });

  it('a game still in progress cannot be reviewed', () => {
    const view = setup();
    view.play(['e2', 'e4'], ['e7', 'e5']);
    act(() => view.chess().startReview());
    act(() => view.chess().jumpToPly(1));
    expect(view.chess().isReviewing).toBe(false);
  });

  it('undoing out of a finished game, or a rematch, leaves the review', () => {
    vi.useFakeTimers();
    const view = setup();
    view.play(...FOOLS_MATE);
    act(() => vi.advanceTimersByTime(2000));
    act(() => view.chess().jumpToPly(1));
    act(() => view.chess().undoMove());
    expect(view.chess().isReviewing).toBe(false);
    expect(view.chess().isGameOver).toBe(false);

    view.drop('d8', 'h4');
    act(() => vi.advanceTimersByTime(2000));
    act(() => view.chess().startReview());
    act(() => view.chess().restartMatch());
    act(() => vi.advanceTimersByTime(3500));
    expect(view.chess().isReviewing).toBe(false);
    expect(view.chess().showGameOver).toBe(false);
  });

  it('a resigned game can be reviewed too', () => {
    const view = setup();
    view.play(['e2', 'e4'], ['e7', 'e5']);
    act(() => view.chess().resign());
    act(() => view.chess().startReview());
    expect(view.chess().reviewPly).toBe(2);
    act(() => view.chess().stepReview(-2));
    expect(view.chess().displayPosition).toBe(START_FEN);
  });
});

// ─────────────────────────────── 5.4 ───────────────────────────────
describe('5.4 hints', () => {
  const botSave = (difficulty, extra = {}) => save({ gameMode: 'bot', difficulty, ...extra });

  it('limits: EASY 3, NORMAL 1, TOUGH / HARD 0, and none in a local match', () => {
    expect(HINT_LIMITS).toEqual({ easy: 3, medium: 1 });
    expect(setup(botSave('easy')).chess().hintsLeft).toBe(3);
    expect(setup(botSave('medium')).chess().hintsLeft).toBe(1);
    for (const difficulty of ['tough', 'hard']) {
      const { chess } = setup(botSave(difficulty));
      expect(chess().hintLimit).toBe(0);
      expect(chess().canHint).toBe(false);
    }
    expect(setup(save()).chess().hintLimit).toBe(0);
  });

  it('asks the engine at full strength, highlights both squares and uses up one hint', async () => {
    requestBotMove.mockResolvedValue({ from: 'g1', to: 'f3' });
    const view = setup(botSave('easy'));
    expect(view.chess().canHint).toBe(true);

    act(() => view.chess().requestHint());
    expect(view.chess().hintLoading).toBe(true);
    expect(view.chess().hintsLeft).toBe(3); // not counted until it is shown
    await flush();

    expect(requestBotMove).toHaveBeenCalledWith(START_FEN, 'hard', expect.any(String), { useBook: false });
    expect(view.chess().hintLoading).toBe(false);
    expect(view.chess().hint).toEqual({ from: 'g1', to: 'f3' });
    expect(view.chess().hintsLeft).toBe(2);
    const styles = view.chess().customSquareStyles;
    expect(Object.keys(styles).sort()).toEqual(['f3', 'g1']);
    expect(styles.g1.animation).toMatch(/hintPulse/); // pulsing outline
    expect(styles.f3.boxShadow).toBeDefined();
  });

  it('a hint that is showing cannot be requested again, and goes away once you move', async () => {
    requestBotMove.mockResolvedValueOnce({ from: 'g1', to: 'f3' });
    const view = setup(botSave('easy'));
    act(() => view.chess().requestHint());
    await flush();
    expect(view.chess().canHint).toBe(false);
    act(() => view.chess().requestHint());
    expect(requestBotMove).toHaveBeenCalledTimes(1);

    view.drop('e2', 'e4');
    expect(view.chess().hint).toBeNull();
    expect(view.chess().hintsLeft).toBe(2);
  });

  it('enforces the limit: the last hint works, the next request is refused', async () => {
    requestBotMove.mockResolvedValue({ from: 'g1', to: 'f3' });
    const view = setup(botSave('easy', { hintsUsed: 2 }));
    expect(view.chess().hintsLeft).toBe(1);

    act(() => view.chess().requestHint());
    await flush();
    expect(view.chess().hintsLeft).toBe(0);
    expect(view.chess().canHint).toBe(false);

    // A match that has already used all three: the request is refused outright.
    const spent = setup(botSave('easy', { hintsUsed: 3 }));
    expect(spent.chess().hintsLeft).toBe(0);
    expect(spent.chess().canHint).toBe(false);
    requestBotMove.mockClear();
    act(() => spent.chess().requestHint());
    await flush();
    expect(requestBotMove).not.toHaveBeenCalled();
    expect(spent.chess().hint).toBeNull();
  });

  it('NORMAL gets exactly one', async () => {
    requestBotMove.mockResolvedValue({ from: 'd2', to: 'd4' });
    const view = setup(botSave('medium'));
    act(() => view.chess().requestHint());
    await flush();
    expect(view.chess().hint).toEqual({ from: 'd2', to: 'd4' });
    expect(view.chess().hintsLeft).toBe(0);
  });

  it('a hint for a position you already left is dropped and not counted', async () => {
    let answer;
    requestBotMove.mockReturnValueOnce(new Promise((resolve) => {
      answer = resolve;
    }));
    const view = setup(botSave('easy'));
    act(() => view.chess().requestHint());
    view.drop('e2', 'e4'); // moved before the hint arrived

    await act(async () => answer({ from: 'g1', to: 'f3' }));
    expect(view.chess().hint).toBeNull();
    expect(view.chess().hintsLeft).toBe(3);
    expect(view.chess().hintLoading).toBe(false);
  });

  it('hints used are saved with the match and reset by a rematch', async () => {
    requestBotMove.mockResolvedValueOnce({ from: 'g1', to: 'f3' });
    const first = setup(botSave('easy'));
    act(() => first.chess().requestHint());
    await flush();
    expect(first.chess().buildSaveData().hintsUsed).toBe(1);
    first.unmount();

    const second = setup(null); // refresh
    expect(second.chess().hintsLeft).toBe(2);

    vi.useFakeTimers();
    act(() => second.chess().restartMatch());
    act(() => vi.advanceTimersByTime(3500));
    expect(second.chess().hintsLeft).toBe(3);
  });

  it('no hints once the game is over, and a hint on screen is cleared', async () => {
    requestBotMove.mockResolvedValueOnce({ from: 'g1', to: 'f3' });
    const view = setup(botSave('easy'));
    act(() => view.chess().requestHint());
    await flush();
    expect(view.chess().customSquareStyles).toHaveProperty('g1');

    act(() => view.chess().resign());
    expect(view.chess().canHint).toBe(false);
    expect(view.chess().customSquareStyles).toEqual({});
  });
});

// ─────────────────────────────── 5.5 ───────────────────────────────
describe('5.5 clock increment', () => {
  it('3+2: the mover gets 2 seconds back after each move', () => {
    vi.useFakeTimers();
    const view = setup(save({ timeMode: '3+2', whiteTime: 180, blackTime: 180 }));

    act(() => vi.advanceTimersByTime(5000));
    expect(view.chess().whiteTime).toBeCloseTo(175, 0);

    view.drop('e2', 'e4');
    expect(view.chess().whiteTime).toBeCloseTo(177, 0); // 175 + 2
    expect(view.chess().blackTime).toBe(180); // untouched

    act(() => vi.advanceTimersByTime(1000));
    view.drop('e7', 'e5');
    expect(view.chess().blackTime).toBeCloseTo(181, 0); // 179 + 2
    expect(view.chess().whiteTime).toBeCloseTo(177, 0);
  });

  it('a quick move can leave you with more time than you started with', () => {
    vi.useFakeTimers();
    const view = setup(save({ timeMode: '15+10', whiteTime: 900, blackTime: 900 }));
    view.drop('e2', 'e4');
    expect(view.chess().whiteTime).toBeCloseTo(910, 0);
  });

  it('plain time controls add nothing', () => {
    vi.useFakeTimers();
    const view = setup(save({ timeMode: '5', whiteTime: 300, blackTime: 300 }));
    act(() => vi.advanceTimersByTime(2000));
    view.drop('e2', 'e4');
    expect(view.chess().whiteTime).toBeCloseTo(298, 0);
  });

  it('the CPU gets its increment as well', async () => {
    vi.useFakeTimers();
    requestBotMove.mockResolvedValueOnce({ from: 'e7', to: 'e5' });
    const view = setup(save({ gameMode: 'bot', difficulty: 'easy', timeMode: '5+3', whiteTime: 300, blackTime: 300 }));
    view.drop('e2', 'e4');
    await botReplies(); // the CPU "thinks" for 0.6 s
    expect(view.chess().game.history()).toEqual(['e4', 'e5']);
    expect(view.chess().blackTime).toBeGreaterThan(302); // ~300 - 0.6 + 3
    expect(view.chess().blackTime).toBeLessThan(303);
  });

  it.each([
    ['3+2', 180],
    ['5+3', 300],
    ['15+10', 900],
    ['10', 600],
    ['0.5', 30],
  ])('starting a %s game puts %i seconds on both clocks', (timeMode, seconds) => {
    vi.useFakeTimers();
    const view = setup(null);
    act(() => {
      view.chess().setGameMode('1v1');
      view.chess().setTimeMode(timeMode);
    });
    act(() => view.chess().startGame());
    act(() => vi.advanceTimersByTime(3400));
    expect(view.chess().whiteTime).toBe(seconds);
    expect(view.chess().blackTime).toBe(seconds);
  });

  it('time-outs still work with an increment', () => {
    vi.useFakeTimers();
    const view = setup(save({ fen: '7k/r7/8/8/8/8/8/3QK3 w - - 0 1', timeMode: '3+2', whiteTime: 0.5, blackTime: 60 }));
    act(() => vi.advanceTimersByTime(1000));
    expect(view.chess().gameStatus).toBe('TIME OUT - WINNER: BLUE (P2)');
    expect(view.chess().winner).toBe('b');
  });
});

// ─────────────────────────────── 5.6 ───────────────────────────────
describe('5.6 exporting the PGN', () => {
  it('includes the header tags, the moves and the result of a finished game', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30));
    const view = setup();
    view.play(...FOOLS_MATE);
    const pgn = view.chess().exportPgn();

    expect(pgn).toContain('[Event "CHESS FANTASY casual game"]');
    expect(pgn).toMatch(/\[Site ".+"\]/);
    expect(pgn).toContain('[Date "2026.11.12"]');
    expect(pgn).toContain('[White "Player 1 (Red)"]');
    expect(pgn).toContain('[Black "Player 2 (Blue)"]');
    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn).toMatch(/1\. f3 e5 2\. g4 Qh4# 0-1\s*$/);
  });

  it('an unfinished game is exported with result "*"', () => {
    const view = setup();
    view.play(['e2', 'e4']);
    expect(view.chess().exportPgn()).toContain('[Result "*"]');
  });

  it('records resignations and agreed draws, which the moves alone cannot show', () => {
    const resigned = setup();
    resigned.play(['e2', 'e4']);
    act(() => resigned.chess().resign()); // BLUE resigns
    expect(resigned.chess().exportPgn()).toContain('[Result "1-0"]');

    const drawn = setup();
    act(() => drawn.chess().offerDraw());
    act(() => drawn.chess().respondToDraw(true));
    expect(drawn.chess().exportPgn()).toContain('[Result "1/2-1/2"]');
  });

  it('names the CPU and its level on the side it played', () => {
    const view = setup(save({ gameMode: 'bot', difficulty: 'tough', playerColor: 'b', pgn: '1. e4', fen: undefined }));
    const pgn = view.chess().exportPgn();
    expect(pgn).toContain('[White "CPU (Tough) (Red)"]');
    expect(pgn).toContain('[Black "Player (Blue)"]');
  });

  it('exporting does not add header tags to the live game', () => {
    const view = setup();
    view.play(['e2', 'e4']);
    const before = view.chess().game.pgn();
    expect(view.chess().exportPgn()).toContain('CHESS FANTASY');
    expect(view.chess().game.pgn()).toBe(before);
    expect(before).not.toContain('CHESS FANTASY');
  });
});

// ─────────────────────────────── 5.8 ───────────────────────────────
describe('5.8 the animations setting', () => {
  const capture = [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']];

  it('ON: a capture plays its elimination effect', () => {
    const view = setup(save(), { animations: true });
    view.play(...capture);
    expect(fx.triggerElimination).toHaveBeenCalledTimes(1);
    expect(fx.triggerElimination.mock.calls[0].slice(0, 4)).toEqual(['d5', 'bP', 'p', 'w']);
    expect(view.chess().game.history()).toEqual(['e4', 'd5', 'exd5']);
  });

  it('OFF: the capture lands at once with no effect', () => {
    const view = setup(save(), { animations: false });
    view.play(...capture);
    expect(fx.triggerElimination).not.toHaveBeenCalled();
    expect(view.chess().isAnimatingMove).toBe(false);
    expect(view.chess().game.history()).toEqual(['e4', 'd5', 'exd5']);
  });

  it('OFF: checkmate skips the cage effect but still ends the game', () => {
    vi.useFakeTimers();
    const view = setup(save(), { animations: false });
    view.play(...FOOLS_MATE);
    act(() => vi.advanceTimersByTime(2000));
    expect(fx.triggerCaptureAnimation).not.toHaveBeenCalled();
    expect(view.chess().showGameOver).toBe(true);
  });

  it('ON: checkmate drops the cage on the mated king', () => {
    vi.useFakeTimers();
    const view = setup(save(), { animations: true });
    view.play(...FOOLS_MATE);
    act(() => vi.advanceTimersByTime(2000));
    expect(fx.triggerCaptureAnimation).toHaveBeenCalledWith('e1', null, 'cage');
  });
});

// ─────────────────────────────── 6.6 ───────────────────────────────
describe('6.6 effects wiring', () => {
  const capture = [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']];
  const PROMOTION_FEN = '8/P6k/8/8/8/8/8/K7 w - - 0 1';

  it('tells the effect which square the capturing piece came from', () => {
    const view = setup(save(), { animations: true });
    view.play(...capture);
    const extra = fx.triggerElimination.mock.calls[0][5];
    expect(extra.from).toBe('e4');
    expect(typeof extra.onEffect).toBe('function');
  });

  it('an effect that draws the capturing piece itself hides both pieces until the move lands', () => {
    let land;
    fx.triggerElimination.mockImplementationOnce((_square, _victim, _piece, _color, onComplete, extra) => {
      land = onComplete;
      extra.onEffect({ hidesAttacker: true });
      return 'thud';
    });
    const view = setup(save(), { animations: true });
    view.play(...capture);

    const during = view.chess().displayPosition;
    expect(typeof during).toBe('object');
    expect(during).not.toHaveProperty('d5'); // the victim
    expect(during).not.toHaveProperty('e4'); // the attacker
    expect(during.e1).toBe('wK');
    expect(audio.play).toHaveBeenCalledWith('thud');

    act(() => land());
    expect(view.chess().displayPosition).toBe(view.chess().game.fen());
    expect(view.chess().game.get('d5')).toMatchObject({ type: 'p', color: 'w' });
  });

  it('an ordinary effect hides only the captured piece', () => {
    fx.triggerElimination.mockImplementationOnce((_square, _victim, _piece, _color, _onComplete, extra) => {
      extra.onEffect({ hidesAttacker: false });
      return 'sizzle';
    });
    const view = setup(save(), { animations: true });
    view.play(...capture);
    const during = view.chess().displayPosition;
    expect(during).not.toHaveProperty('d5');
    expect(during.e4).toBe('wP');
  });

  it('a promotion plays the promotion effect on the new piece', () => {
    const view = setup(save({ fen: PROMOTION_FEN }), { animations: true });
    view.drop('a7', 'a8');
    act(() => view.chess().handlePromotionSelection('q'));
    expect(view.chess().game.get('a8')).toMatchObject({ type: 'q', color: 'w' });
    expect(fx.triggerEffect).toHaveBeenCalledWith('promotion', 'a8');
  });

  it('with animations off a promotion has no effect', () => {
    const view = setup(save({ fen: PROMOTION_FEN }), { animations: false });
    view.drop('a7', 'a8');
    act(() => view.chess().handlePromotionSelection('q'));
    expect(view.chess().game.get('a8')).toMatchObject({ type: 'q' });
    expect(fx.triggerEffect).not.toHaveBeenCalled();
  });

  it('an ordinary move plays no effect', () => {
    const view = setup(save(), { animations: true });
    view.play(['e2', 'e4']);
    expect(fx.triggerEffect).not.toHaveBeenCalled();
    expect(fx.triggerElimination).not.toHaveBeenCalled();
  });
});
