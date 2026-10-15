import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { usePixelAnimation } from '../usePixelAnimation';
import { requestBotMove } from '../bot/requestBotMove';

const SESSION_KEY = 'neochess_active_session';
// The CPU always waits at least this long, so an instant reply on EASY
// doesn't feel like the board glitched.
const BOT_MIN_THINK_MS = 450;
const CAPTURE_SAFETY_MS = 1200;
// Let the cage land and the CHECKMATE banner play before the modal covers it.
const CHECKMATE_MODAL_DELAY_MS = 1600;

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };

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
  hidden: { opacity: 0, visibility: 'hidden' },
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

export function useChessGame({ audio, activeModal, setActiveModal }) {
  const boardWrapperRef = useRef(null);
  const boardInnerRef = useRef(null);
  const countdownTimersRef = useRef([]);
  // Bumped on every board reset / undo so a capture animation that finishes
  // afterwards can't apply its stale move to the new board.
  const moveTokenRef = useRef(0);
  const { canvasRef, triggerCaptureAnimation, clearAnimations } = usePixelAnimation();

  const [gameMode, setGameMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [timeMode, setTimeMode] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);

  const [game, setGame] = useState(() => new Chess());
  const [gameStatus, setGameStatus] = useState('RED TURN');
  // 'w' | 'b' when that side's clock hit zero — the board position alone
  // doesn't know the game ended on time.
  const [timeoutLoser, setTimeoutLoser] = useState(null);
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
  // True for the moment between checkmate and the GAME OVER modal
  // (drives the CHECKMATE! banner + board shake).
  const [checkmateFx, setCheckmateFx] = useState(false);

  // Undo / redo stacks of earlier / later game states. Every Chess instance
  // is treated as immutable (moves always go onto a clone), so they can be
  // stored and restored directly.
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const isGameOver = !!timeoutLoser || game.isGameOver();

  // ── MOVE NOTATION / SCORESHEET ──
  // Derived straight from the game's own move list, so it is always in sync
  // after moves, undo, redo and loading.
  const verboseHistory = useMemo(() => game.history({ verbose: true }), [game]);

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

  function sideLabel(color) {
    if (color === 'w') return gameMode === 'bot' ? 'RED (P1 / YOU)' : 'RED (P1)';
    return gameMode === 'bot' ? 'BLUE (P2 / CPU)' : 'BLUE (P2)';
  }

  // Loads a save slot / session into the live game state.
  function loadMatchState(save) {
    const loadedGame = restoreGame(save);
    moveTokenRef.current++;
    clearAnimations();
    setCheckmateFx(false);
    setGame(loadedGame);
    setGameMode(save.gameMode);
    setDifficulty(save.difficulty);
    setTimeMode(save.timeMode);
    setGameStatus(save.gameStatus);
    setWhiteTime(save.whiteTime);
    setBlackTime(save.blackTime);
    setTimeoutLoser(save.timeoutLoser || null);
    setKingCheckedAlert(loadedGame.inCheck() && !loadedGame.isGameOver());
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setHistory([]);
    setFuture([]);
    setActiveModal(save.timeoutLoser || loadedGame.isGameOver() ? 'game_over' : null);
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
  buildSessionRef.current = gameStarted
    ? () => ({
        pgn: game.pgn(),
        fen: game.fen(),
        gameMode,
        difficulty,
        timeMode,
        gameStatus,
        whiteTime,
        blackTime,
        timeoutLoser,
        gameStarted,
      })
    : null;

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
  }, [game, gameStarted, gameStatus, timeoutLoser, persistSession]);

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
        canvasRef.current.width = newWidth;
        canvasRef.current.height = newHeight;
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
  const clockRunning = gameStarted && timeMode !== 'none' && !isGameOver
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
    if (!gameStarted || timeMode === 'none' || isGameOver) return;
    const loser = whiteTime <= 0 ? 'w' : blackTime <= 0 ? 'b' : null;
    if (!loser) return;

    const winner = loser === 'w' ? 'b' : 'w';
    setTimeoutLoser(loser);
    setKingCheckedAlert(false);
    setGameStatus(
      hasMatingMaterial(game, winner)
        ? `TIME OUT - WINNER: ${sideLabel(winner)}`
        : 'DRAW - TIME OUT (NO MATING MATERIAL)'
    );
    setActiveModal('game_over');
    audio.play('success');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check when a clock changes
  }, [whiteTime, blackTime]);

  function updateStatus(currentGame) {
    if (currentGame.isCheckmate()) {
      // The side to move is the one that got mated, so the OTHER side won.
      const winner = currentGame.turn() === 'w' ? 'b' : 'w';
      setKingCheckedAlert(false);
      setGameStatus(`WINNER: ${sideLabel(winner)}`);
      setCheckmateFx(true);
      audio.play('success');
      const token = moveTokenRef.current;
      setTimeout(() => {
        if (token !== moveTokenRef.current) return;
        setCheckmateFx(false);
        setActiveModal('game_over');
      }, CHECKMATE_MODAL_DELAY_MS);
    } else if (currentGame.isDraw()) {
      setKingCheckedAlert(false);
      setGameStatus(`DRAW - ${drawReason(currentGame)}`);
      setActiveModal('game_over');
    } else {
      const inCheck = currentGame.inCheck();
      setKingCheckedAlert(inCheck);
      if (inCheck) audio.play('check_alert');
      setGameStatus(`${currentGame.turn() === 'w' ? 'RED' : 'BLUE'} TURN`);
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

    const base = game;
    const token = moveTokenRef.current;
    let settled = false;
    const commit = () => {
      if (settled || token !== moveTokenRef.current) return;
      settled = true;
      setHistory((prev) => [...prev, base]);
      setFuture([]);
      setGame(next);
      updateStatus(next);
      setHiddenSquare(null);
      setIsAnimatingMove(false);
    };

    // Captured piece vanishes into a pixel effect, then the move lands.
    const animateCapture = (square) => {
      setIsAnimatingMove(true);
      setHiddenSquare(square);
      const effect = triggerCaptureAnimation(square, commit);
      if (effect) audio.play(effect);
      setTimeout(commit, CAPTURE_SAFETY_MS);
    };

    // Checkmate: show the mating move first, then drop the cage on the king.
    if (next.isCheckmate()) {
      audio.play(played.captured ? 'thunder' : 'click');
      commit();
      const losingKingSquare = findKingSquare(next, next.turn());
      if (losingKingSquare) {
        setTimeout(() => {
          if (token !== moveTokenRef.current) return;
          triggerCaptureAnimation(losingKingSquare, null, 'cage');
          audio.play('cage');
        }, 120);
      }
      return true;
    }

    if (played.captured) {
      // En passant removes a pawn that is NOT on the destination square.
      const capturedSquare = played.flags.includes('e') ? played.to[0] + played.from[1] : played.to;
      animateCapture(capturedSquare);
      return true;
    }

    audio.play('click');
    commit();
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
  useEffect(() => {
    const botToMove = gameStarted && gameMode === 'bot' && game.turn() === 'b' && !isGameOver
      && !isStarting && !activeModal && !pendingPromotion && !isAnimatingMove;
    if (!botToMove) return;

    let cancelled = false;
    setBotThinking(true);
    Promise.all([
      requestBotMove(game.fen(), difficulty),
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
  }, [game, gameMode, difficulty, gameStarted, isGameOver, isStarting, activeModal, pendingPromotion, isAnimatingMove]);

  const playerCanMove = gameStarted && !isGameOver && !isAnimatingMove && !pendingPromotion
    && !activeModal && !isStarting && !checkmateFx && !(gameMode === 'bot' && game.turn() === 'b');

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

  // Any new position (move, undo, load...) drops the current selection.
  useEffect(() => {
    setSelectedSquare(null);
  }, [game]);

  // Stable identities for the memoized board (see GameBoardScreen).
  const handlersRef = useRef(null);
  handlersRef.current = { onDrop, onSquareClick, onPieceDragBegin };
  const stableOnDrop = useCallback((from, to) => handlersRef.current.onDrop(from, to), []);
  const stableOnSquareClick = useCallback((sq) => handlersRef.current.onSquareClick(sq), []);
  const stableOnPieceDragBegin = useCallback((p, sq) => handlersRef.current.onPieceDragBegin(p, sq), []);
  const isDraggablePiece = useCallback(
    ({ piece }) => piece[0] === sideToMove && (gameMode !== 'bot' || sideToMove === 'w'),
    [sideToMove, gameMode]
  );

  // ── UNDO / REDO ──
  // In a bot match, steps back/forward past the CPU's reply so it's the
  // player's turn again.
  function restoreSnapshot(target, newHistory, newFuture) {
    moveTokenRef.current++;
    clearAnimations();
    setCheckmateFx(false);
    setHistory(newHistory);
    setFuture(newFuture);
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setGame(target);
    updateStatus(target);
    if (!target.isGameOver()) setActiveModal(null);
    audio.play('click');
  }

  const isBotTurn = (g) => gameMode === 'bot' && g.turn() === 'b';

  function undoMove() {
    if (!canUndo) return;
    const pastStack = [...history];
    const futureStack = [...future, game];
    let target = pastStack.pop();
    while (pastStack.length > 0 && isBotTurn(target)) {
      futureStack.push(target);
      target = pastStack.pop();
    }
    restoreSnapshot(target, pastStack, futureStack);
  }

  function redoMove() {
    if (!canRedo) return;
    const pastStack = [...history, game];
    const futureStack = [...future];
    let target = futureStack.pop();
    while (futureStack.length > 0 && isBotTurn(target)) {
      pastStack.push(target);
      target = futureStack.pop();
    }
    restoreSnapshot(target, pastStack, futureStack);
  }

  // A time-out can't be undone (the clock would be stuck at 0:00).
  const canUndo = history.length > 0 && !isAnimatingMove && !pendingPromotion && !isStarting && !timeoutLoser;
  const canRedo = future.length > 0 && !isAnimatingMove && !pendingPromotion && !isStarting && !timeoutLoser;

  // ── BOARD RESET + 3-2-1 COUNTDOWN (shared by START and REPLAY) ──
  function resetBoard() {
    moveTokenRef.current++;
    clearAnimations();
    setCheckmateFx(false);
    setSelectedSquare(null);
    setGame(new Chess());
    setGameStatus('RED TURN');
    setTimeoutLoser(null);
    setKingCheckedAlert(false);
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setHistory([]);
    setFuture([]);
    if (timeMode && timeMode !== 'none') {
      const seconds = parseFloat(timeMode) * 60;
      setWhiteTime(seconds);
      setBlackTime(seconds);
    }
  }

  function runProceduralCountdown(onDone) {
    if (isStarting) return; // ignore double taps on START / REPLAY
    countdownTimersRef.current.forEach(clearTimeout);
    setIsStarting(true);
    setCountdownValue(3);
    countdownTimersRef.current = [
      setTimeout(() => setCountdownValue(2), 1000),
      setTimeout(() => setCountdownValue(1), 2000),
      setTimeout(() => {
        resetBoard();
        setIsStarting(false);
        if (onDone) onDone();
      }, 3000),
    ];
  }

  function restartMatch() {
    audio.triggerInteractiveAudioContext();
    audio.play('success');
    setActiveModal(null);
    runProceduralCountdown();
  }

  function startGame() {
    if (!gameMode || (gameMode === 'bot' && !difficulty) || !timeMode) return;
    audio.triggerInteractiveAudioContext();
    audio.play('success');
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

  const lastMoveSquares = verboseHistory.length ? verboseHistory[verboseHistory.length - 1] : null;
  const checkedKingSquare = game.inCheck() ? findKingSquare(game, game.turn()) : null;

  const customSquareStyles = useMemo(() => {
    const styles = {};
    const add = (sq, fx) => {
      styles[sq] = { ...styles[sq], ...fx };
    };
    if (lastMoveSquares) {
      add(lastMoveSquares.from, SQUARE_FX.lastMove);
      add(lastMoveSquares.to, SQUARE_FX.lastMove);
    }
    if (checkedKingSquare) add(checkedKingSquare, SQUARE_FX.check);
    if (selectedSquare) add(selectedSquare, SQUARE_FX.selected);
    for (const m of legalTargets) add(m.to, m.captured ? SQUARE_FX.captureRing : SQUARE_FX.moveDot);
    if (hiddenSquare) add(hiddenSquare, SQUARE_FX.hidden);
    return styles;
  }, [lastMoveSquares, checkedKingSquare, selectedSquare, legalTargets, hiddenSquare]);

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
    gameStarted,
    isStarting,
    countdownValue,
    game,
    gameStatus,
    isGameOver,
    timeoutLoser,
    botThinking,
    whiteTime,
    blackTime,
    kingCheckedAlert,
    setKingCheckedAlert,
    isAnimatingMove,
    pendingPromotion,
    boardWidth,
    customSquareStyles,
    moveHistory,
    lastMove,
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
    startGame,
    restartMatch,
    quitMatch,
    loadMatchState,
    formatTime,
  };
}
