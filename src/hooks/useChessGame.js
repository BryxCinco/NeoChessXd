import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { usePixelAnimation } from '../usePixelAnimation';
import { requestBotMove } from '../bot/requestBotMove';
import { evaluatePosition } from '../bot/engine';
import { parseTimeMode } from '../game/timeControl';
import { loadColorChoice, saveColorChoice, resolveColor, opposite } from '../game/colorChoice';
import { botAcceptsDraw } from '../game/drawOffer';
import { buildPgn } from '../game/pgnExport';

const SESSION_KEY = 'neochess_active_session';
// The CPU always waits at least this long, so an instant reply on EASY
// doesn't feel like the board glitched.
const BOT_MIN_THINK_MS = 450;
// Longest elimination effect is ~1.6 s; this only fires if one never finishes.
const CAPTURE_SAFETY_MS = 2300;
// Let the cage land and the CHECKMATE banner play before the game-over bar shows.
const CHECKMATE_MODAL_DELAY_MS = 1600;
// Hints per game against the CPU. TOUGH and HARD CORE get none.
export const HINT_LIMITS = { easy: 3, medium: 1 };

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const COLOR_NAME = { w: 'RED', b: 'BLUE' };

// Square overlays, kept chunky/pixel-styled (hard edges, no blur).
const SQUARE_FX = {
  lastMove: { boxShadow: 'inset 0 0 0 4px rgba(255, 216, 58, 0.85)' },
  selected: { backgroundImage: 'linear-gradient(rgba(63, 224, 255, 0.45), rgba(63, 224, 255, 0.45))' },
  moveDot: {
    backgroundImage: 'linear-gradient(rgba(18, 10, 26, 0.45), rgba(18, 10, 26, 0.45))',
    backgroundSize: '26% 26%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    cursor: 'pointer',
  },
  captureRing: { boxShadow: 'inset 0 0 0 5px rgba(232, 40, 43, 0.8)', cursor: 'pointer' },
  check: { backgroundImage: 'linear-gradient(rgba(232, 40, 43, 0.6), rgba(232, 40, 43, 0.6))' },
  // Pulsing outline on the hint's from / to squares (keyframes in App.css).
  hint: { boxShadow: 'inset 0 0 0 5px rgba(51, 216, 115, 0.95)', animation: 'hintPulse 0.9s steps(2, start) infinite' },
};

// Copies a game WITH its move history (a FEN-only copy would forget earlier
// positions, so threefold repetition and the scoresheet would break).
function cloneGame(g) {
  const copy = new Chess();
  copy.loadPgn(g.pgn());
  return copy;
}

// Rebuilds a game from a save slot / session. New saves carry the PGN;
// older ones only had a FEN.
export function restoreGame(save) {
  if (save.pgn) {
    try {
      const g = new Chess();
      g.loadPgn(save.pgn);
      return g;
    } catch {
      // fall back to the FEN below
    }
  }
  return new Chess(save.fen);
}

// The position one move earlier, as a NEW game (the original is untouched),
// or null at the start of the game. Undo is derived from the game's own
// move list like this — instead of from a separate stack of snapshots — so
// it keeps working after a save is loaded or the page is refreshed: the
// moves come back with the PGN. (An old FEN-only save has no moves.)
export function previousPosition(g) {
  if (g.history().length === 0) return null;
  const previous = cloneGame(g);
  previous.undo();
  return previous;
}

function findKingSquare(g, color) {
  for (const row of g.board()) {
    for (const p of row) {
      if (p && p.type === 'k' && p.color === color) return p.square;
    }
  }
  return null;
}

// Whether `color` could still deliver mate at all — a lone king or king +
// one minor piece can't, so running out of time against it is a draw.
function hasMatingMaterial(g, color) {
  let minors = 0;
  for (const row of g.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      if (p.type === 'n' || p.type === 'b') minors++;
      else return true;
    }
  }
  return minors >= 2;
}

function drawReason(g) {
  if (g.isStalemate()) return 'STALEMATE';
  if (g.isInsufficientMaterial()) return 'NO MATING MATERIAL';
  if (g.isThreefoldRepetition()) return '3-FOLD REPETITION';
  return '50-MOVE RULE';
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// `animations: false` (settings) skips the capture effects and the
// checkmate cage. `notify(text, tone)` shows a toast. `effects` are the
// player's effect settings (see usePixelAnimation).
export function useChessGame({ audio, activeModal, setActiveModal, animations = true, notify = () => {}, effects }) {
  const boardWrapperRef = useRef(null);
  const boardInnerRef = useRef(null);
  const countdownTimersRef = useRef([]);
  // Bumped on every board reset / undo so a capture animation that finishes
  // afterwards can't apply its stale move to the new board.
  const moveTokenRef = useRef(0);
  const { canvasRef, triggerCaptureAnimation, triggerElimination, triggerEffect, clearAnimations } = usePixelAnimation(effects);

  const [gameMode, setGameMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [timeMode, setTimeMode] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  // Bot matches: the side the human asked for ('w' | 'b' | 'random',
  // remembered between visits) and the side they actually got this match.
  const [colorChoice, setColorChoiceState] = useState(loadColorChoice);
  const [playerColor, setPlayerColor] = useState('w');

  const [isStarting, setIsStarting] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);

  const [game, setGame] = useState(() => new Chess());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [gameStatus, setGameStatus] = useState('RED TURN');
  // 'w' | 'b' when that side's clock hit zero — the board position alone
  // doesn't know the game ended on time.
  const [timeoutLoser, setTimeoutLoser] = useState(null);
  // Games ended by the players rather than on the board:
  // { type: 'resign', loser: 'w' | 'b' } or { type: 'draw' } (agreed).
  const [manualEnd, setManualEnd] = useState(null);
  // Things worth recording that aren't moves (resignation, draw offers),
  // shown under the scoresheet: [{ ply, text }].
  const [matchNotes, setMatchNotes] = useState([]);
  // 1v1 only: the colour that offered a draw and is waiting for an answer.
  const [pendingDrawOffer, setPendingDrawOffer] = useState(null);
  const [botThinking, setBotThinking] = useState(false);

  // Remaining clock time in (fractional) seconds.
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);

  const [hiddenSquare, setHiddenSquare] = useState(null);
  const [isAnimatingMove, setIsAnimatingMove] = useState(false);

  const [boardWidth, setBoardWidth] = useState(400);

  const [kingCheckedAlert, setKingCheckedAlert] = useState(false);

  const [pendingPromotion, setPendingPromotion] = useState(null);
  // Tap-to-move: the square of the piece the player has picked up.
  const [selectedSquare, setSelectedSquare] = useState(null);
  // True for the moment between checkmate and the game-over bar
  // (drives the CHECKMATE! banner + board shake).
  const [checkmateFx, setCheckmateFx] = useState(false);

  // Hints (bot matches on EASY / NORMAL): the suggested move, how many
  // were used this game, and whether one is being worked out right now.
  const [hint, setHint] = useState(null); // { from, to }
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintLoading, setHintLoading] = useState(false);

  // Post-game review: which position is on the board (number of moves
  // played, 0 = start), or null when showing the live game.
  const [reviewPly, setReviewPly] = useState(null);

  // Redo stack: the later game states that were undone. (Undo needs no
  // stack of its own — see previousPosition.) Every Chess instance is
  // treated as immutable (moves always go onto a clone), so they can be
  // stored and restored directly.
  const [future, setFuture] = useState([]);

  const time = useMemo(() => parseTimeMode(timeMode), [timeMode]);
  const botColor = gameMode === 'bot' ? opposite(playerColor) : null;
  const isGameOver = !!timeoutLoser || !!manualEnd || game.isGameOver();

  // 'w' | 'b' for a decisive game, null for a draw or a game in progress.
  const winner = useMemo(() => {
    if (manualEnd) return manualEnd.type === 'resign' ? opposite(manualEnd.loser) : null;
    if (timeoutLoser) return hasMatingMaterial(game, opposite(timeoutLoser)) ? opposite(timeoutLoser) : null;
    return game.isCheckmate() ? opposite(game.turn()) : null;
  }, [game, manualEnd, timeoutLoser]);

  // ── MOVE NOTATION / SCORESHEET ──
  // Derived straight from the game's own move list, so it is always in sync
  // after moves, undo, redo and loading.
  const verboseHistory = useMemo(() => game.history({ verbose: true }), [game]);
  const totalPlies = verboseHistory.length;

  const moveHistory = useMemo(() => {
    const moves = verboseHistory;
    const rows = [];
    for (const m of moves) {
      if (m.color === 'w' || rows.length === 0) {
        rows.push({ number: rows.length + 1, white: m.color === 'w' ? m.san : null, black: m.color === 'b' ? m.san : null });
      } else {
        rows[rows.length - 1].black = m.san;
      }
    }
    return rows;
  }, [verboseHistory]);

  // ── CAPTURED PIECES ──
  // captured.w = black pieces RED has taken, captured.b = red pieces BLUE has
  // taken. Read from the move list (exact, even with promotions); games
  // loaded from an old FEN-only save have no move list, so those fall back
  // to comparing the board against a full starting army.
  const captured = useMemo(() => {
    const result = { w: [], b: [] };
    if (verboseHistory.length > 0) {
      for (const m of verboseHistory) if (m.captured) result[m.color].push(m.captured);
    } else {
      const left = { w: { ...START_COUNT }, b: { ...START_COUNT } };
      for (const row of game.board()) for (const p of row) if (p && p.type !== 'k') left[p.color][p.type]--;
      for (const color of ['w', 'b']) {
        const taker = color === 'w' ? 'b' : 'w';
        for (const [type, n] of Object.entries(left[color])) for (let i = 0; i < n; i++) result[taker].push(type);
      }
    }
    const byValue = (a, b) => PIECE_VALUE[b] - PIECE_VALUE[a];
    result.w.sort(byValue);
    result.b.sort(byValue);
    let material = 0; // > 0 means RED is ahead
    for (const row of game.board()) for (const p of row) if (p) material += (p.color === 'w' ? 1 : -1) * PIECE_VALUE[p.type];
    return { ...result, material };
  }, [game, verboseHistory]);
  const lastMove = useMemo(() => {
    const last = moveHistory[moveHistory.length - 1];
    return last ? last.black || last.white : null;
  }, [moveHistory]);

  // "RED (P1 / YOU)", "BLUE (P2 / CPU)", "RED (P1)" ...
  function sideLabel(color) {
    const base = color === 'w' ? 'RED (P1' : 'BLUE (P2';
    if (gameMode !== 'bot') return `${base})`;
    return `${base} / ${color === playerColor ? 'YOU' : 'CPU'})`;
  }

  function addNote(text) {
    setMatchNotes((prev) => [...prev, { ply: totalPlies, text }]);
  }

  // Everything a save slot / the auto-saved session needs to restore a match.
  function buildSaveData() {
    return {
      pgn: game.pgn(),
      fen: game.fen(),
      gameMode,
      difficulty,
      timeMode,
      gameStatus,
      whiteTime,
      blackTime,
      timeoutLoser,
      playerColor,
      manualEnd,
      matchNotes,
      hintsUsed,
    };
  }

  // Loads a save slot / session into the live game state.
  function loadMatchState(save) {
    const loadedGame = restoreGame(save);
    const ended = !!save.timeoutLoser || !!save.manualEnd || loadedGame.isGameOver();
    moveTokenRef.current++;
    clearAnimations();
    setCheckmateFx(false);
    setGame(loadedGame);
    setGameMode(save.gameMode);
    setDifficulty(save.difficulty);
    setTimeMode(save.timeMode);
    setPlayerColor(save.playerColor === 'b' ? 'b' : 'w'); // older saves: the player was always RED
    setGameStatus(save.gameStatus);
    setWhiteTime(save.whiteTime);
    setBlackTime(save.blackTime);
    setTimeoutLoser(save.timeoutLoser || null);
    setManualEnd(save.manualEnd || null);
    setMatchNotes(Array.isArray(save.matchNotes) ? save.matchNotes : []);
    setHintsUsed(Number.isFinite(save.hintsUsed) ? save.hintsUsed : 0);
    setHint(null);
    setHintLoading(false);
    setReviewPly(null);
    setPendingDrawOffer(null);
    setKingCheckedAlert(loadedGame.inCheck() && !ended);
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    // (Undo needs no reset: it reads the moves that came back with the PGN.)
    setFuture([]);
    setActiveModal(null);
    setGameStarted(true);
  }

  // ── RESTORE ACTIVE SESSION ON MOUNT ──
  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (session && session.gameStarted) loadMatchState(session);
    } catch (e) {
      console.error('Failed to restore active session:', e);
    }
    return () => countdownTimersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore
  }, []);

  // ── AUTO-SAVE ACTIVE SESSION ──
  // Building the PGN replays the whole game, so it's NOT done on every
  // clock tick: we save after each move, every few seconds, and when the
  // tab is hidden / closed.
  const buildSessionRef = useRef(null);
  buildSessionRef.current = gameStarted ? () => ({ ...buildSaveData(), gameStarted }) : null;

  const persistSession = useCallback(() => {
    if (!buildSessionRef.current) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(buildSessionRef.current()));
    } catch {
      // storage full / blocked (private mode) — the game still plays fine
    }
  }, []);

  useEffect(() => {
    if (gameStarted) persistSession();
  }, [game, gameStarted, gameStatus, timeoutLoser, manualEnd, matchNotes, hintsUsed, persistSession]);

  useEffect(() => {
    if (!gameStarted) return;
    const id = setInterval(persistSession, 3000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') persistSession();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', persistSession);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', persistSession);
    };
  }, [gameStarted, persistSession]);

  // Handle dynamic canvas resizing
  useEffect(() => {
    if (!gameStarted || !canvasRef.current || !boardWrapperRef.current) return;

    let debounceTimer = null;
    let lastWidth = -1;
    let lastHeight = -1;

    const applyResize = () => {
      if (!canvasRef.current || !boardWrapperRef.current) return;

      const frameRect = boardWrapperRef.current.getBoundingClientRect();
      const newWidth = Math.round(frameRect.width);
      const newHeight = Math.round(frameRect.height);

      if (newWidth !== lastWidth || newHeight !== lastHeight) {
        lastWidth = newWidth;
        lastHeight = newHeight;
        // device-pixel backing store (capped at 2x) so effects stay crisp
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvasRef.current.width = Math.round(newWidth * dpr);
        canvasRef.current.height = Math.round(newHeight * dpr);
      }

      if (boardInnerRef.current) {
        const innerRect = boardInnerRef.current.getBoundingClientRect();
        const cappedWidth = Math.round(innerRect.width);
        if (cappedWidth > 0) {
          setBoardWidth(cappedWidth);
        }
      }
    };

    const resizeCanvas = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyResize, 100);
    };

    applyResize();
    const rafId = requestAnimationFrame(applyResize);

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resizeCanvas);
      observer.observe(boardWrapperRef.current);
      if (boardInnerRef.current) observer.observe(boardInnerRef.current);
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('orientationchange', resizeCanvas);
    };
  }, [gameStarted, canvasRef]);

  // ── CHESS CLOCK ──
  // Pauses while any menu/modal, the countdown, a promotion pick or a
  // capture animation is on screen. Elapsed time is measured with
  // Date.now(), so moving quickly can't skip the partial second a plain
  // 1-second setInterval would drop.
  const clockRunning = gameStarted && time.timed && !isGameOver
    && !isStarting && !activeModal && !pendingPromotion && !isAnimatingMove;
  const sideToMove = game.turn();

  useEffect(() => {
    if (!clockRunning) return;
    const setTime = sideToMove === 'w' ? setWhiteTime : setBlackTime;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const elapsed = (now - last) / 1000;
      last = now;
      setTime((t) => Math.max(0, t - elapsed));
    };
    const id = setInterval(tick, 250);
    return () => {
      clearInterval(id);
      tick(); // bank the time since the last tick
    };
  }, [clockRunning, sideToMove, game]);

  // ── TIME-OUT DETECTION ──
  useEffect(() => {
    if (!gameStarted || !time.timed || isGameOver) return;
    const loser = whiteTime <= 0 ? 'w' : blackTime <= 0 ? 'b' : null;
    if (!loser) return;

    const timeWinner = opposite(loser);
    setTimeoutLoser(loser);
    setKingCheckedAlert(false);
    setGameStatus(
      hasMatingMaterial(game, timeWinner)
        ? `TIME OUT - WINNER: ${sideLabel(timeWinner)}`
        : 'DRAW - TIME OUT (NO MATING MATERIAL)'
    );
    audio.play('success');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check when a clock changes
  }, [whiteTime, blackTime]);

  function updateStatus(currentGame) {
    if (currentGame.isCheckmate()) {
      // The side to move is the one that got mated, so the OTHER side won.
      setKingCheckedAlert(false);
      setGameStatus(`WINNER: ${sideLabel(opposite(currentGame.turn()))}`);
      setCheckmateFx(true);
      audio.play('success');
      const token = moveTokenRef.current;
      setTimeout(() => {
        if (token !== moveTokenRef.current) return;
        setCheckmateFx(false);
      }, CHECKMATE_MODAL_DELAY_MS);
    } else if (currentGame.isDraw()) {
      setKingCheckedAlert(false);
      setGameStatus(`DRAW - ${drawReason(currentGame)}`);
    } else {
      const inCheck = currentGame.inCheck();
      setKingCheckedAlert(inCheck);
      if (inCheck) audio.play('check_alert');
      setGameStatus(`${COLOR_NAME[currentGame.turn()]} TURN`);
    }
  }

  // ── Shared move resolver (player drops, promotions AND the CPU) ──
  // Captures play a pixel effect first and only commit the move when it
  // finishes (a safety-net timeout guarantees the move still lands if the
  // animation callback never fires). Checkmates commit at once and then
  // drop the cage on the mated king.
  function resolveAndAnimateMove(move) {
    let next;
    let played;
    try {
      next = cloneGame(game);
      played = next.move(move);
    } catch {
      return false;
    }
    if (!played) return false;

    const token = moveTokenRef.current;
    let settled = false;
    const commit = () => {
      if (settled || token !== moveTokenRef.current) return;
      settled = true;
      setFuture([]);
      setGame(next);
      // Increment: the mover gets time back for completing the move.
      if (time.timed && time.increment > 0) {
        (played.color === 'w' ? setWhiteTime : setBlackTime)((t) => t + time.increment);
      }
      updateStatus(next);
      setHiddenSquare(null);
      setIsAnimatingMove(false);
    };

    // The captured piece is lifted off the board and destroyed on the
    // canvas (style depends on the capturing piece), then the move lands.
    const animateCapture = (square) => {
      setIsAnimatingMove(true);
      setHiddenSquare(square);
      const victimCode = (played.color === 'w' ? 'b' : 'w') + played.captured.toUpperCase();
      const sound = triggerElimination(square, victimCode, played.piece, played.color, commit, {
        from: played.from,
        // some effects draw the capturing piece themselves (it drops onto
        // its victim), so the real one is lifted off the board as well
        onEffect: (effect) => effect.hidesAttacker && setHiddenSquare([square, played.from]),
      });
      if (sound) audio.play(sound);
      setTimeout(commit, CAPTURE_SAFETY_MS);
    };

    // Checkmate: show the mating move first, then drop the cage on the king.
    if (next.isCheckmate()) {
      audio.play(played.captured ? 'thunder' : 'click');
      commit();
      const losingKingSquare = findKingSquare(next, next.turn());
      if (losingKingSquare && animations) {
        setTimeout(() => {
          if (token !== moveTokenRef.current) return;
          triggerCaptureAnimation(losingKingSquare, null, 'cage');
          audio.play('cage');
        }, 120);
      }
      return true;
    }

    if (played.captured && animations) {
      // En passant removes a pawn that is NOT on the destination square.
      const capturedSquare = played.flags.includes('e') ? played.to[0] + played.from[1] : played.to;
      animateCapture(capturedSquare);
      return true;
    }

    audio.play('click');
    commit();
    if (played.promotion && animations && triggerEffect) triggerEffect('promotion', played.to);
    return true;
  }

  function makeAMove(move) {
    if (isAnimatingMove) return false;

    const legal = game.moves({ verbose: true }).find((m) => m.from === move.from && m.to === move.to);
    if (!legal) return false;

    // Promotion move without a chosen piece → ask the player first.
    // (Returns false so a dragged pawn snaps back to its square while the
    // picker is open, instead of sitting on the last rank unpromoted.)
    if (legal.promotion && !move.promotion) {
      setPendingPromotion({ from: move.from, to: move.to, color: legal.color });
      return false;
    }

    return resolveAndAnimateMove(move);
  }

  function handlePromotionSelection(chosenPiece) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    resolveAndAnimateMove({ from, to, promotion: chosenPiece });
  }

  function cancelPromotion() {
    setPendingPromotion(null);
  }

  // ── CPU OPPONENT ──
  // The search runs in a Web Worker (see src/bot), so the UI stays smooth
  // even while HARD is thinking. Pausing, undoing or restarting cancels it.
  // The CPU plays whichever colour the human didn't take — so when the
  // human is BLUE, the CPU makes the first move of the game.
  useEffect(() => {
    const botToMove = gameStarted && gameMode === 'bot' && game.turn() === botColor && !isGameOver
      && !isStarting && !activeModal && !pendingPromotion && !isAnimatingMove;
    if (!botToMove) return;

    let cancelled = false;
    setBotThinking(true);
    Promise.all([
      requestBotMove(game.fen(), difficulty, game.pgn()),
      new Promise((resolve) => setTimeout(resolve, BOT_MIN_THINK_MS)),
    ]).then(([move]) => {
      if (cancelled) return;
      setBotThinking(false);
      if (move) makeAMove(move);
    });

    return () => {
      cancelled = true;
      setBotThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- makeAMove reads the same `game` listed here
  }, [game, gameMode, botColor, difficulty, gameStarted, isGameOver, isStarting, activeModal, pendingPromotion, isAnimatingMove]);

  const isReviewing = reviewPly !== null;
  const playerCanMove = gameStarted && !isGameOver && !isAnimatingMove && !pendingPromotion
    && !activeModal && !isStarting && !checkmateFx && !isReviewing
    && !(gameMode === 'bot' && game.turn() === botColor);

  function onDrop(sourceSquare, targetSquare) {
    setSelectedSquare(null);
    if (!playerCanMove) return false;
    return makeAMove({ from: sourceSquare, to: targetSquare });
  }

  // Tap a piece to pick it up, tap a highlighted square to move there.
  const legalTargets = useMemo(
    () => (selectedSquare ? game.moves({ square: selectedSquare, verbose: true }) : []),
    [game, selectedSquare]
  );

  function onSquareClick(square) {
    if (!playerCanMove) return;
    if (selectedSquare && legalTargets.some((m) => m.to === square)) {
      setSelectedSquare(null);
      makeAMove({ from: selectedSquare, to: square });
      return;
    }
    const piece = game.get(square);
    if (piece && piece.color === game.turn() && square !== selectedSquare) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }

  function onPieceDragBegin(_piece, sourceSquare) {
    if (playerCanMove) setSelectedSquare(sourceSquare);
  }

  // Any new position (move, undo, load...) drops the current selection
  // and the hint that was drawn for the old position.
  useEffect(() => {
    setSelectedSquare(null);
    setHint(null);
  }, [game]);

  // ── UNDO / REDO ──
  // In a bot match, steps back/forward past the CPU's reply so it's the
  // player's turn again.
  function restoreSnapshot(target, newFuture) {
    moveTokenRef.current++;
    clearAnimations();
    setCheckmateFx(false);
    setFuture(newFuture);
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setReviewPly(null);
    setGame(target);
    updateStatus(target);
    setActiveModal(null);
    audio.play('click');
  }

  const isBotTurn = (g) => gameMode === 'bot' && g.turn() === botColor;

  function undoMove() {
    if (!canUndo) return;
    const futureStack = [...future, game];
    let target = previousPosition(game);
    while (isBotTurn(target)) {
      const earlier = previousPosition(target);
      if (!earlier) break;
      futureStack.push(target);
      target = earlier;
    }
    restoreSnapshot(target, futureStack);
  }

  function redoMove() {
    if (!canRedo) return;
    const futureStack = [...future];
    let target = futureStack.pop();
    while (futureStack.length > 0 && isBotTurn(target)) target = futureStack.pop();
    restoreSnapshot(target, futureStack);
  }

  // A time-out, resignation or agreed draw can't be undone. Against the
  // CPU there must be a move of YOURS to take back (as BLUE, the CPU's
  // opening move alone is not undoable).
  const busy = isAnimatingMove || !!pendingPromotion || isStarting || !!timeoutLoser || !!manualEnd;
  const canUndo = !busy && totalPlies > 0
    && (gameMode !== 'bot' || verboseHistory.some((m) => m.color === playerColor));
  const canRedo = !busy && future.length > 0;

  // ── RESIGN / DRAW ──
  function endManually(end, status, note) {
    moveTokenRef.current++;
    clearAnimations();
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setPendingDrawOffer(null);
    setKingCheckedAlert(false);
    setManualEnd(end);
    setGameStatus(status);
    addNote(note);
    setActiveModal(null);
    audio.play('success');
  }

  const canEndManually = gameStarted && !isGameOver && !isStarting && !isAnimatingMove && !pendingPromotion;

  // Against the CPU the human resigns; in a local match, the side to move.
  function resign() {
    if (!canEndManually) return false;
    const loser = gameMode === 'bot' ? playerColor : game.turn();
    endManually(
      { type: 'resign', loser },
      `RESIGNED - WINNER: ${sideLabel(opposite(loser))}`,
      `${COLOR_NAME[loser]} RESIGNED`
    );
    return true;
  }

  // Returns 'accepted' | 'declined' (CPU answers at once), 'pending' (the
  // other human is being asked) or null when a draw can't be offered now.
  function offerDraw() {
    if (!canEndManually) return null;
    if (gameMode === 'bot') {
      if (botAcceptsDraw(evaluatePosition(game.fen()), totalPlies)) {
        endManually({ type: 'draw' }, 'DRAW - BY AGREEMENT', 'DRAW AGREED');
        notify('CPU ACCEPTED THE DRAW', 'success');
        return 'accepted';
      }
      addNote(`${COLOR_NAME[playerColor]} OFFERED A DRAW - DECLINED`);
      setActiveModal(null);
      notify('CPU DECLINED THE DRAW', 'alert');
      return 'declined';
    }
    setPendingDrawOffer(game.turn());
    setActiveModal('draw_offer');
    return 'pending';
  }

  // 1v1: the other player's answer to a pending offer.
  function respondToDraw(accept) {
    if (!pendingDrawOffer) return;
    if (accept) {
      endManually({ type: 'draw' }, 'DRAW - BY AGREEMENT', 'DRAW AGREED');
      return;
    }
    addNote(`${COLOR_NAME[pendingDrawOffer]} OFFERED A DRAW - DECLINED`);
    setPendingDrawOffer(null);
    setActiveModal(null);
    notify('DRAW OFFER DECLINED', 'alert');
  }

  // ── HINTS ──
  const hintLimit = gameMode === 'bot' ? HINT_LIMITS[difficulty] || 0 : 0;
  const hintsLeft = Math.max(0, hintLimit - hintsUsed);
  const canHint = playerCanMove && hintsLeft > 0 && !hintLoading && !hint;

  // Asks the engine (at full strength, search only) for the best move in
  // this position and highlights it. A hint only counts once it is shown.
  function requestHint() {
    if (!canHint) return;
    const forGame = game;
    setHintLoading(true);
    requestBotMove(game.fen(), 'hard', game.pgn(), { useBook: false }).then((move) => {
      setHintLoading(false);
      if (!move || gameRef.current !== forGame) return; // the position changed meanwhile
      setHint({ from: move.from, to: move.to });
      setHintsUsed((n) => n + 1);
      audio.play('click');
    });
  }

  // ── POST-GAME REVIEW ──
  // Once the game is over the board can step through every position.
  function jumpToPly(ply) {
    if (!isGameOver || Number.isNaN(ply)) return;
    setReviewPly(clamp(Math.round(ply), 0, totalPlies));
  }

  function startReview() {
    jumpToPly(totalPlies);
  }

  function stepReview(delta) {
    if (!isReviewing) return;
    setReviewPly((p) => clamp((p ?? totalPlies) + delta, 0, totalPlies));
  }

  function exitReview() {
    setReviewPly(null);
  }

  const reviewFen = !isReviewing
    ? null
    : reviewPly === 0
      ? (verboseHistory[0] ? verboseHistory[0].before : game.fen())
      : verboseHistory[reviewPly - 1].after;
  const reviewGame = useMemo(() => (reviewFen ? new Chess(reviewFen) : null), [reviewFen]);

  // Stable identities for the memoized board (see GameBoardScreen).
  const handlersRef = useRef(null);
  handlersRef.current = { onDrop, onSquareClick, onPieceDragBegin, stepReview, jumpToPly, exitReview };
  const stableOnDrop = useCallback((from, to) => handlersRef.current.onDrop(from, to), []);
  const stableOnSquareClick = useCallback((sq) => handlersRef.current.onSquareClick(sq), []);
  const stableOnPieceDragBegin = useCallback((p, sq) => handlersRef.current.onPieceDragBegin(p, sq), []);
  const stableJumpToPly = useCallback((ply) => handlersRef.current.jumpToPly(ply), []);
  const isDraggablePiece = useCallback(
    ({ piece }) => !isReviewing && piece[0] === sideToMove && (gameMode !== 'bot' || sideToMove === playerColor),
    [sideToMove, gameMode, playerColor, isReviewing]
  );

  // ← / → step through the review, Home / End jump to the ends, Esc leaves.
  useEffect(() => {
    if (!isReviewing || activeModal) return;
    const onKey = (e) => {
      const h = handlersRef.current;
      if (e.key === 'ArrowLeft') h.stepReview(-1);
      else if (e.key === 'ArrowRight') h.stepReview(1);
      else if (e.key === 'Home') h.jumpToPly(0);
      else if (e.key === 'End') h.jumpToPly(Infinity);
      else if (e.key === 'Escape') h.exitReview();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isReviewing, activeModal]);

  // ── BOARD RESET + 3-2-1 COUNTDOWN (shared by START and REPLAY) ──
  function resetBoard() {
    moveTokenRef.current++;
    clearAnimations();
    setCheckmateFx(false);
    setSelectedSquare(null);
    setGame(new Chess());
    setGameStatus('RED TURN');
    setTimeoutLoser(null);
    setManualEnd(null);
    setMatchNotes([]);
    setPendingDrawOffer(null);
    setHint(null);
    setHintsUsed(0);
    setHintLoading(false);
    setReviewPly(null);
    setKingCheckedAlert(false);
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setFuture([]);
    if (time.timed) {
      setWhiteTime(time.seconds);
      setBlackTime(time.seconds);
    }
  }

  function runProceduralCountdown(onDone) {
    if (isStarting) return; // ignore double taps on START / REPLAY
    countdownTimersRef.current.forEach(clearTimeout);
    setIsStarting(true);
    setCountdownValue(3);
    countdownTimersRef.current = [
      setTimeout(() => setCountdownValue(2), 900),
      setTimeout(() => setCountdownValue(1), 1800),
      setTimeout(() => setCountdownValue('GO!'), 2700),
      setTimeout(() => {
        resetBoard();
        setIsStarting(false);
        if (onDone) onDone();
      }, 3400),
    ];
  }

  function setColorChoice(choice) {
    setColorChoiceState(choice);
    saveColorChoice(choice);
  }

  // Decides who is who for the match about to start. RANDOM is re-rolled
  // on every new match and rematch.
  function assignColors() {
    setPlayerColor(gameMode === 'bot' ? resolveColor(colorChoice) : 'w');
  }

  function restartMatch() {
    if (isStarting) return;
    audio.triggerInteractiveAudioContext();
    audio.play('success');
    setActiveModal(null);
    assignColors();
    runProceduralCountdown();
  }

  function startGame() {
    if (isStarting) return;
    if (!gameMode || (gameMode === 'bot' && !difficulty) || !timeMode) return;
    audio.triggerInteractiveAudioContext();
    audio.play('success');
    assignColors();
    runProceduralCountdown(() => setGameStarted(true));
  }

  function quitMatch() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore blocked storage
    }
    resetBoard();
    setGameMode(null);
    setDifficulty(null);
    setTimeMode(null);
    setGameStarted(false);
  }

  // Full PGN text of the current game, with header tags, for copy / download.
  function exportPgn() {
    return buildPgn({ game, gameMode, difficulty, playerColor, isGameOver, winner });
  }

  const shownMove = isReviewing
    ? (reviewPly > 0 ? verboseHistory[reviewPly - 1] : null)
    : (totalPlies ? verboseHistory[totalPlies - 1] : null);
  const shownGame = reviewGame || game;
  const checkedKingSquare = shownGame.inCheck() ? findKingSquare(shownGame, shownGame.turn()) : null;

  const customSquareStyles = useMemo(() => {
    const styles = {};
    const add = (sq, fx) => {
      styles[sq] = { ...styles[sq], ...fx };
    };
    if (shownMove) {
      add(shownMove.from, SQUARE_FX.lastMove);
      add(shownMove.to, SQUARE_FX.lastMove);
    }
    if (checkedKingSquare) add(checkedKingSquare, SQUARE_FX.check);
    if (selectedSquare) add(selectedSquare, SQUARE_FX.selected);
    for (const m of legalTargets) add(m.to, m.captured ? SQUARE_FX.captureRing : SQUARE_FX.moveDot);
    // A hint is advice for the move about to be played: gone once the game ends.
    if (hint && !isGameOver) {
      add(hint.from, SQUARE_FX.hint);
      add(hint.to, SQUARE_FX.hint);
    }
    return styles;
  }, [shownMove, checkedKingSquare, selectedSquare, legalTargets, hint, isGameOver]);

  // Board position shown to react-chessboard: the real FEN, except that a
  // piece being eliminated is lifted off (its sprite lives on the canvas),
  // and during a review it is the position being looked at.
  const displayPosition = useMemo(() => {
    if (reviewFen) return reviewFen;
    if (!hiddenSquare) return game.fen();
    const hidden = [].concat(hiddenSquare); // one square, or several
    const position = {};
    for (const row of game.board()) {
      for (const p of row) if (p && !hidden.includes(p.square)) position[p.square] = p.color + p.type.toUpperCase();
    }
    return position;
  }, [game, hiddenSquare, reviewFen]);

  return {
    boardWrapperRef,
    boardInnerRef,
    canvasRef,
    gameMode,
    setGameMode,
    difficulty,
    setDifficulty,
    timeMode,
    setTimeMode,
    colorChoice,
    setColorChoice,
    playerColor,
    botColor,
    boardOrientation: gameMode === 'bot' && playerColor === 'b' ? 'black' : 'white',
    gameStarted,
    isStarting,
    countdownValue,
    game,
    gameStatus,
    isGameOver,
    winner,
    // The game-over bar waits for the checkmate banner to finish.
    showGameOver: gameStarted && isGameOver && !checkmateFx && !isStarting,
    timeoutLoser,
    manualEnd,
    matchNotes,
    pendingDrawOffer,
    botThinking,
    whiteTime,
    blackTime,
    kingCheckedAlert,
    setKingCheckedAlert,
    isAnimatingMove,
    pendingPromotion,
    boardWidth,
    customSquareStyles,
    displayPosition,
    moveHistory,
    lastMove,
    totalPlies,
    canUndo,
    canRedo,
    undoMove,
    redoMove,
    onDrop: stableOnDrop,
    onSquareClick: stableOnSquareClick,
    onPieceDragBegin: stableOnPieceDragBegin,
    isDraggablePiece,
    captured,
    checkmateFx,
    handlePromotionSelection,
    cancelPromotion,
    canEndManually,
    resign,
    offerDraw,
    respondToDraw,
    hint,
    hintLimit,
    hintsUsed,
    hintsLeft,
    hintLoading,
    canHint,
    requestHint,
    isReviewing,
    reviewPly,
    startReview,
    stepReview,
    jumpToPly: stableJumpToPly,
    exitReview,
    exportPgn,
    buildSaveData,
    startGame,
    restartMatch,
    quitMatch,
    loadMatchState,
    formatTime,
  };
}
