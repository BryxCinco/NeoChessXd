import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { usePixelAnimation } from '../usePixelAnimation';

export function useChessGame({ audio, setActiveModal }) {
  const boardWrapperRef = useRef(null);
  const boardInnerRef = useRef(null);
  const timerRef = useRef(null);
  const { canvasRef, triggerCaptureAnimation } = usePixelAnimation();

  const [gameMode, setGameMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [timeMode, setTimeMode] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);

  const [game, setGame] = useState(() => new Chess());
  const [gameStatus, setGameStatus] = useState('PLAYER 1 TURN');

  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);

  const [hiddenSquare, setHiddenSquare] = useState(null);
  const [isAnimatingMove, setIsAnimatingMove] = useState(false);

  const [boardWidth, setBoardWidth] = useState(400);

  const [kingCheckedAlert, setKingCheckedAlert] = useState(false);

  const [pendingPromotion, setPendingPromotion] = useState(null);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // ── MOVE NOTATION / SCORESHEET ENGINE ──
  // Parallel arrays: moveHistory stores SAN strings per move pair,
  // moveNumbers tracks the move numbers for display.
  const [moveHistory, setMoveHistory] = useState([]);
  const moveHistoryRef = useRef([]);

  const [lastMove, setLastMove] = useState(null);

  // ── LOAD ACTIVE SESSION FROM LOCAL STORAGE ON MOUNT ──
  useEffect(() => {
    const currentSession = localStorage.getItem('neochess_active_session');
    if (currentSession) {
      try {
        const session = JSON.parse(currentSession);
        const loadedGame = new Chess(session.fen);
        setGame(loadedGame);
        setGameMode(session.gameMode);
        setDifficulty(session.difficulty);
        setTimeMode(session.timeMode);
        setGameStatus(session.gameStatus);
        setWhiteTime(session.whiteTime);
        setBlackTime(session.blackTime);
        setKingCheckedAlert(loadedGame.inCheck());
        setGameStarted(session.gameStarted);
        if (session.moveHistory) {
          setMoveHistory(session.moveHistory);
          moveHistoryRef.current = session.moveHistory;
        }
        if (session.lastMove) setLastMove(session.lastMove);
      } catch (e) {
        console.error('Failed to restore active session:', e);
      }
    }
  }, []);

  // ── AUTO-SAVE ACTIVE STATE CHANGES ──
  useEffect(() => {
    if (gameStarted) {
      const sessionData = {
        fen: game.fen(),
        gameMode,
        difficulty,
        timeMode,
        gameStatus,
        whiteTime,
        blackTime,
        gameStarted,
        moveHistory,
        lastMove,
      };
      localStorage.setItem('neochess_active_session', JSON.stringify(sessionData));
    }
  }, [game, gameMode, difficulty, timeMode, gameStatus, whiteTime, blackTime, gameStarted, moveHistory, lastMove]);

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

  // ── TIMER COUNTDOWN ENGINE ──
  useEffect(() => {
    if (!gameStarted || timeMode === 'none' || isAnimatingMove || pendingPromotion) return;

    if (game.isGameOver()) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (game.turn() === 'w') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGameStatus('GAME OVER - BLUE WINS!');
            setActiveModal('game_over');
            audio.play('success');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGameStatus('GAME OVER - RED WINS!');
            setActiveModal('game_over');
            audio.play('success');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game, gameStarted, timeMode, isAnimatingMove, pendingPromotion]);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function updateStatus(currentGame) {
    if (currentGame.inCheck() && !currentGame.isCheckmate()) {
      setKingCheckedAlert(true);
      audio.play('check_alert');
    } else {
      setKingCheckedAlert(false);
    }

    if (currentGame.isCheckmate()) {
      const winnerLabel =
        currentGame.turn() === 'w' ? `BLUE (P2${gameMode === 'bot' ? ' / CPU' : ''})` : 'RED (P1 / YOU)';
      setGameStatus(`WINNER: ${winnerLabel}`);
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveModal('game_over');
      audio.play('success');
    } else if (currentGame.isDraw()) {
      setGameStatus('GAME DRAWN');
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveModal('game_over');
    } else {
      setGameStatus(`${currentGame.turn() === 'w' ? 'RED' : 'BLUE'} TURN`);
    }
  }

  function isUnderpromotionValid(pieceType, turnColor) {
    const board = game.board();
    let existingPiecesCount = 0;

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const p = board[i][j];
        if (p && p.type === pieceType && p.color === turnColor) {
          existingPiecesCount++;
        }
      }
    }

    if (pieceType === 'q') return existingPiecesCount < 1;
    if (pieceType === 'r') return existingPiecesCount < 2;
    if (pieceType === 'b') return existingPiecesCount < 2;
    if (pieceType === 'n') return existingPiecesCount < 2;

    return true;
  }

  function handlePromotionSelection(chosenPiece) {
    if (!pendingPromotion) return;

    const { from, to } = pendingPromotion;
    const currentTurn = game.turn();

    const isValid = isUnderpromotionValid(chosenPiece, currentTurn);
    const finalPromotePiece = isValid ? chosenPiece : 'q';

    const moveData = { from, to, promotion: finalPromotePiece };

    setPendingPromotion(null);
    executeMoveResolution(moveData);
  }

  function findKingSquareForColor(boardMatrix, color) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const tile = boardMatrix[r][c];
        if (tile && tile.type === 'k' && tile.color === color) {
          return files[c] + ranks[r];
        }
      }
    }
    return null;
  }

  // ── NOTATION HELPER: Build SAN from a move object ──
  function getSanFromMove(moveObj, baseGame) {
    const temp = new Chess(baseGame.fen());
    const result = temp.move(moveObj);
    return result ? result.san : null;
  }

  function resolveAndAnimateMove(move, baseFen) {
    setHistory((prev) => [...prev, baseFen]);
    setFuture([]);

    const snapshot = new Chess(baseFen);
    const targetPiece = snapshot.get(move.to);
    const nextStateTest = new Chess(baseFen);
    nextStateTest.move(move);
    const deliversCheckmate = nextStateTest.isCheckmate();

    // Generate SAN notation BEFORE applying animation
    const sanMove = getSanFromMove(move, snapshot);
    const turnBefore = snapshot.turn();

    let settled = false;
    const settleOnce = () => {
      if (settled) return;
      settled = true;
      setGame((prev) => {
        const next = new Chess(prev.fen());
        try {
          next.move(move);
          updateStatus(next);
          return next;
        } catch (err) {
          return prev;
        }
      });
      setHiddenSquare(null);
      setIsAnimatingMove(false);

      // ── APPEND NOTATION TO SCORESHEET ──
      if (sanMove) {
        setMoveHistory((prev) => {
          const newHistory = [...prev];
          if (turnBefore === 'w') {
            // White's move: start a new move pair
            newHistory.push({ number: Math.floor(newHistory.length) + 1, white: sanMove, black: null });
          } else {
            // Black's move: complete the last pair
            if (newHistory.length > 0) {
              newHistory[newHistory.length - 1] = {
                ...newHistory[newHistory.length - 1],
                black: sanMove,
              };
            } else {
              // Edge case: black moves first (shouldn't happen in standard chess)
              newHistory.push({ number: 1, white: null, black: sanMove });
            }
          }
          moveHistoryRef.current = newHistory;
          return newHistory;
        });
        setLastMove(sanMove);
      }
    };

    if (deliversCheckmate) {
      const losingKingSquare = findKingSquareForColor(nextStateTest.board(), nextStateTest.turn());

      if (losingKingSquare) {
        setIsAnimatingMove(true);
        setHiddenSquare(losingKingSquare);
        triggerCaptureAnimation(losingKingSquare, settleOnce, 'cage');
        audio.play('sandworm');
        setTimeout(settleOnce, 1200);
        return true;
      }
    }

    if (targetPiece) {
      setIsAnimatingMove(true);
      setHiddenSquare(move.to);
      const effect = triggerCaptureAnimation(move.to, settleOnce);
      if (effect) audio.play(effect);
      setTimeout(settleOnce, 1200);
      return true;
    }

    const result = snapshot.move(move);
    if (result) {
      audio.play('click');
      setGame(snapshot);
      updateStatus(snapshot);
      // Append notation for non-capture moves
      if (sanMove) {
        setMoveHistory((prev) => {
          const newHistory = [...prev];
          if (turnBefore === 'w') {
            newHistory.push({ number: Math.floor(newHistory.length) + 1, white: sanMove, black: null });
          } else {
            if (newHistory.length > 0) {
              newHistory[newHistory.length - 1] = {
                ...newHistory[newHistory.length - 1],
                black: sanMove,
              };
            } else {
              newHistory.push({ number: 1, white: null, black: sanMove });
            }
          }
          moveHistoryRef.current = newHistory;
          return newHistory;
        });
        setLastMove(sanMove);
      }
      return true;
    }

    return false;
  }

  function executeMoveResolution(move) {
    try {
      resolveAndAnimateMove(move, game.fen());
    } catch (e) {
      console.error(e);
    }
  }

  function makeAMove(move) {
    if (isAnimatingMove) return false;

    try {
      const currentGame = new Chess(game.fen());
      const moves = currentGame.moves({ verbose: true });
      const isLegal = moves.some((m) => m.from === move.from && m.to === move.to);
      if (!isLegal) return false;

      const pieceOnSquare = currentGame.get(move.from);
      if (pieceOnSquare && pieceOnSquare.type === 'p') {
        const isWhitePromotion = pieceOnSquare.color === 'w' && move.to[1] === '8';
        const isBlackPromotion = pieceOnSquare.color === 'b' && move.to[1] === '1';

        if (isWhitePromotion || isBlackPromotion) {
          if (!move.promotion) {
            setPendingPromotion({ from: move.from, to: move.to });
            return true;
          }
        }
      }

      return resolveAndAnimateMove(move, game.fen());
    } catch (error) {
      return false;
    }
  }

  function makeBotMove() {
    if (isAnimatingMove || game.isGameOver() || pendingPromotion) return;

    const possibleMoves = game.moves({ verbose: true });
    if (possibleMoves.length === 0) return;

    let selectedMove;

    if (difficulty === 'easy') {
      const randomIndex = Math.floor(Math.random() * possibleMoves.length);
      selectedMove = possibleMoves[randomIndex];
    } else if (difficulty === 'medium') {
      const captures = possibleMoves.filter((m) => m.captured);
      if (captures.length > 0) {
        selectedMove = captures[Math.floor(Math.random() * captures.length)];
      } else {
        selectedMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      }
    } else if (difficulty === 'hard') {
      const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      let bestMove = possibleMoves[0];
      let highestValue = -1;

      possibleMoves.forEach((m) => {
        let value = 0;
        if (m.captured) value += pieceValues[m.captured] * 10;
        if (m.san.includes('+')) value += 2;

        if (value > highestValue) {
          highestValue = value;
          bestMove = m;
        }
      });
      selectedMove = bestMove;
    }

    if (selectedMove) {
      makeAMove({
        from: selectedMove.from,
        to: selectedMove.to,
        promotion: 'q',
      });
    }
  }

  useEffect(() => {
    if (
      gameStarted &&
      gameMode === 'bot' &&
      game.turn() === 'b' &&
      !game.isGameOver() &&
      !isAnimatingMove &&
      !pendingPromotion
    ) {
      const aiTimeout = setTimeout(() => {
        if (game.turn() === 'b' && !game.isGameOver()) {
          makeBotMove();
        }
      }, 700);
      return () => clearTimeout(aiTimeout);
    }
  }, [game, gameMode, gameStarted, isAnimatingMove, pendingPromotion]);

  function onDrop(sourceSquare, targetSquare) {
    if (
      game.isGameOver() ||
      (gameMode === 'bot' && game.turn() === 'b') ||
      !gameStarted ||
      isAnimatingMove ||
      pendingPromotion
    ) {
      return false;
    }

    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
    });

    return !!move;
  }

  function isBotTurnFen(fen) {
    return gameMode === 'bot' && new Chess(fen).turn() === 'b';
  }

  function restoreToFen(fen, newHistory, newFuture) {
    if (timerRef.current) clearInterval(timerRef.current);
    const restored = new Chess(fen);
    setHistory(newHistory);
    setFuture(newFuture);
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setGame(restored);
    updateStatus(restored);
    if (!restored.isGameOver()) {
      setActiveModal(null);
    }
    audio.play('click');

    // ── RECONSTRUCT NOTATION FROM FEN HISTORY ──
    // When restoring via undo/redo, we need to rebuild the move history
    // up to this point. We do this by replaying all moves from start.
    const allFens = [...newHistory, fen];
    const reconstructedMoves = [];
    let tempGame = new Chess();
    
    for (let i = 1; i < allFens.length; i++) {
      const prevFen = allFens[i - 1];
      const currFen = allFens[i];
      const prev = new Chess(prevFen);
      const curr = new Chess(currFen);
      
      // Find the move that transforms prevFen to currFen
      const possibleMoves = prev.moves({ verbose: true });
      for (const m of possibleMoves) {
        const test = new Chess(prevFen);
        test.move(m);
        if (test.fen() === currFen) {
          const san = m.san;
          if (m.color === 'w') {
            reconstructedMoves.push({ number: Math.floor(reconstructedMoves.length) + 1, white: san, black: null });
          } else {
            if (reconstructedMoves.length > 0) {
              reconstructedMoves[reconstructedMoves.length - 1] = {
                ...reconstructedMoves[reconstructedMoves.length - 1],
                black: san,
              };
            }
          }
          break;
        }
      }
    }
    
    setMoveHistory(reconstructedMoves);
    moveHistoryRef.current = reconstructedMoves;
    setLastMove(reconstructedMoves.length > 0 
      ? (reconstructedMoves[reconstructedMoves.length - 1].black || reconstructedMoves[reconstructedMoves.length - 1].white)
      : null
    );
  }

  function undoMove() {
    if (history.length === 0 || isAnimatingMove || pendingPromotion || isStarting) return;

    const pastStack = [...history];
    const futureStack = [...future];
    futureStack.push(game.fen());

    let target = pastStack.pop();
    while (pastStack.length > 0 && isBotTurnFen(target)) {
      futureStack.push(target);
      target = pastStack.pop();
    }

    restoreToFen(target, pastStack, futureStack);
  }

  function redoMove() {
    if (future.length === 0 || isAnimatingMove || pendingPromotion || isStarting) return;

    const pastStack = [...history];
    const futureStack = [...future];
    pastStack.push(game.fen());

    let target = futureStack.pop();
    while (futureStack.length > 0 && isBotTurnFen(target)) {
      pastStack.push(target);
      target = futureStack.pop();
    }

    restoreToFen(target, pastStack, futureStack);
  }

  const canUndo = history.length > 0 && !isAnimatingMove && !pendingPromotion && !isStarting;
  const canRedo = future.length > 0 && !isAnimatingMove && !pendingPromotion && !isStarting;

  function runProceduralCountdown(onDone) {
    setIsStarting(true);
    setCountdownValue(3);

    const tick3 = setTimeout(() => setCountdownValue(2), 1000);
    const tick2 = setTimeout(() => setCountdownValue(1), 2000);
    const tick1 = setTimeout(() => {
      const newGame = new Chess();
      setGame(newGame);
      setGameStatus('RED TURN');
      setKingCheckedAlert(false);
      setHiddenSquare(null);
      setIsAnimatingMove(false);
      setPendingPromotion(null);
      setHistory([]);
      setFuture([]);
      setMoveHistory([]);
      moveHistoryRef.current = [];
      setLastMove(null);

      if (timeMode !== 'none') {
        const seconds = parseFloat(timeMode) * 60;
        setWhiteTime(seconds);
        setBlackTime(seconds);
      }

      setIsStarting(false);
      onDone && onDone();
    }, 3000);

    return () => {
      clearTimeout(tick3);
      clearTimeout(tick2);
      clearTimeout(tick1);
    };
  }

  function restartMatch() {
    audio.triggerInteractiveAudioContext();
    audio.play('success');

    if (timerRef.current) clearInterval(timerRef.current);
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
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem('neochess_active_session');
    setGameMode(null);
    setDifficulty(null);
    setTimeMode(null);
    setGameStarted(false);
    setGame(new Chess());
    setGameStatus('RED TURN');
    setKingCheckedAlert(false);
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setHistory([]);
    setFuture([]);
    setMoveHistory([]);
    moveHistoryRef.current = [];
    setLastMove(null);
  }

  function loadMatchState(match) {
    const loadedGame = new Chess(match.fen);
    setGame(loadedGame);
    setGameMode(match.gameMode);
    setDifficulty(match.difficulty);
    setTimeMode(match.timeMode);
    setGameStatus(match.gameStatus);
    setWhiteTime(match.whiteTime);
    setBlackTime(match.blackTime);
    setKingCheckedAlert(loadedGame.inCheck());
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    setHistory([]);
    setFuture([]);
    setMoveHistory([]);
    moveHistoryRef.current = [];
    setLastMove(null);
    setGameStarted(true);
  }

  const customSquareStyles = useMemo(() => {
    if (!hiddenSquare) return {};
    return { [hiddenSquare]: { opacity: 0, visibility: 'hidden' } };
  }, [hiddenSquare]);

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
    onDrop,
    handlePromotionSelection,
    startGame,
    restartMatch,
    quitMatch,
    loadMatchState,
    formatTime,
  };
}