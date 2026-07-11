import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { usePixelAnimation } from './usePixelAnimation';
import { playRetroSound, startRetroBGM } from './audioEngine';
import { pixelPieces } from './pixelPieces';
import './App.css';

const BOARD_STYLE = {
  border: '6px solid #ffcc00',
  boxShadow: '0 0 0 6px #000, 0 15px 0 rgba(0,0,0,0.4)',
};
const DARK_SQUARE_STYLE = { backgroundColor: '#2e2017' };
const LIGHT_SQUARE_STYLE = { backgroundColor: '#e8cfa6' };

function App() {
  const { canvasRef, triggerCaptureAnimation } = usePixelAnimation();
  const boardWrapperRef = useRef(null);
  const boardInnerRef = useRef(null); // measures .board-container-pixel directly — the element that actually carries the max-width cap
  const audioCtxRef = useRef(null);
  const bgmIntervalRef = useRef(null);
  const timerRef = useRef(null);

  const [gameMode, setGameMode] = useState(null); 
  const [difficulty, setDifficulty] = useState(null); 
  const [timeMode, setTimeMode] = useState(null); 
  const [gameStarted, setGameStarted] = useState(false);

  // ── MOBILE / TABLET STEP WIZARD (SELECT MODE → DIFFICULTY → TIME) ──
  // 'mode'  = step 1, pick AI (bot) or LOCAL (1v1)
  // 'difficulty' = step 2, ONLY when gameMode === 'bot'
  // 'time'  = final step, pick the time limit, then PUSH START
  const [menuStep, setMenuStep] = useState('mode');
  // Phones AND tablets/iPads (<=1024px) get the compact one-step-at-a-time
  // wizard instead of the long single-page config panel. Anything wider
  // (laptops/desktops) keeps the classic all-in-one layout.
  const [isCompactLayout, setIsCompactLayout] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth <= 1024 : false
  );

  // ── PROCEDURAL START COUNTDOWN ENGINE ──
  const [isStarting, setIsStarting] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);

  const [game, setGame] = useState(() => new Chess());
  const [gameStatus, setGameStatus] = useState("PLAYER 1 TURN");

  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);

  const [savedMatches, setSavedMatches] = useState([]);

  const [hiddenSquare, setHiddenSquare] = useState(null);
  const [isAnimatingMove, setIsAnimatingMove] = useState(false);

  // 📍 STEP 1: Dito nilagay ang state para sa board width
  const [boardWidth, setBoardWidth] = useState(400);

  // ── MODAL ENGINE & GAME NOTIFICATIONS ──
  const [activeModal, setActiveModal] = useState(null); 
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [kingCheckedAlert, setKingCheckedAlert] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // ── PAWN PROMOTION ENGINE ──
  const [pendingPromotion, setPendingPromotion] = useState(null);

  // ── SCROLL LOCK WHILE A MODAL / LOADING SCREEN IS OPEN ──
  // Keeps the page from scrolling behind the countdown, promotion picker,
  // or any popup (including the Game Over modal) on mobile.
  useEffect(() => {
    const shouldLock = isStarting || !!activeModal || !!pendingPromotion;
    document.body.style.overflow = shouldLock ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isStarting, activeModal, pendingPromotion]);

  // ── MOBILE ZOOM LOCK ──
  useEffect(() => {
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );

    const blockPinch = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const blockGesture = (e) => {
      e.preventDefault();
    };

    let lastTouchEnd = 0;
    const blockDoubleTapZoom = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchmove', blockPinch, { passive: false });
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('touchend', blockDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener('touchmove', blockPinch);
      document.removeEventListener('gesturestart', blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
      document.removeEventListener('touchend', blockDoubleTapZoom);
    };
  }, []);

  // ── COMPACT (PHONE / TABLET / iPad) LAYOUT DETECTION ──
  // Drives both the step-wizard menu AND lets tablets/iPads share the
  // same stacked board+sidebar layout as phones instead of the desktop
  // two-column layout.
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1024px)');
    const handleChange = (e) => setIsCompactLayout(e.matches);
    setIsCompactLayout(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', handleChange);
    else mql.addListener(handleChange); // Safari < 14 fallback
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handleChange);
      else mql.removeListener(handleChange);
    };
  }, []);

  // ── LOAD STATE FROM LOCAL STORAGE ON MOUNT ──
  useEffect(() => {
    const matches = localStorage.getItem('neochess_8bit_matches');
    if (matches) {
      try {
        setSavedMatches(JSON.parse(matches));
      } catch (e) {
        setSavedMatches([]);
      }
    }

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
      } catch (e) {
        console.error("Failed to restore active session:", e);
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
        gameStarted
      };
      localStorage.setItem('neochess_active_session', JSON.stringify(sessionData));
    }
  }, [game, gameMode, difficulty, timeMode, gameStatus, whiteTime, blackTime, gameStarted]);

  // ── 8-BIT PROCEDURAL CHIP-TUNE BGM LOOP ENGINE ──
  useEffect(() => {
    if (!gameStarted && !isMuted) {
      triggerInteractiveAudioContext(); 
      if (!bgmIntervalRef.current) {
        bgmIntervalRef.current = startRetroBGM(audioCtxRef);
      }
    } else {
      stopRetroBGM();
    }

    return () => stopRetroBGM();
  }, [gameStarted, isMuted]);

  function stopRetroBGM() {
    if (bgmIntervalRef.current) {
      clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
    if (window.clearRetroBGM) {
      window.clearRetroBGM();
    }
  }

  function triggerInteractiveAudioContext() {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }

  // Handle dynamic canvas resizing dynamically for precise mobile touches
  useEffect(() => {
    if (!gameStarted || !canvasRef.current || !boardWrapperRef.current) return;

    let debounceTimer = null;
    let lastWidth = -1;
    let lastHeight = -1;

    const applyResize = () => {
      if (!canvasRef.current || !boardWrapperRef.current) return;

      // Canvas overlay still tracks the full padded frame (so capture
      // animations cover the whole board area).
      const frameRect = boardWrapperRef.current.getBoundingClientRect();
      const newWidth = Math.round(frameRect.width);
      const newHeight = Math.round(frameRect.height);

      if (newWidth !== lastWidth || newHeight !== lastHeight) {
        lastWidth = newWidth;
        lastHeight = newHeight;
        canvasRef.current.width = newWidth;
        canvasRef.current.height = newHeight;
      }

      // 📍 boardWidth must come from the INNER board container
      // (.board-container-pixel), not the outer padded frame — the inner
      // element is the one CSS actually caps with max-width. Measuring the
      // outer frame instead let boardWidth exceed the intended cap on some
      // screen sizes, which made react-chessboard render wider than its
      // container and visually spill over onto the sidebar.
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

    // Run immediately, and again next frame (layout may not be fully
    // settled yet right when we switch from the menu into the game screen).
    applyResize();
    const rafId = requestAnimationFrame(applyResize);

    // ResizeObserver catches ANY size change of the board container itself
    // (orientation change, sidebar reflow, font load, etc.) — not just
    // window resize events. This is what keeps the board correctly fit on
    // both desktop and mobile, including cases a plain resize listener
    // would miss.
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

  function loadSavedMatchesFromStorage() {
    const matches = localStorage.getItem('neochess_8bit_matches');
    if (matches) {
      try {
        setSavedMatches(JSON.parse(matches));
      } catch (e) {
        setSavedMatches([]);
      }
    }
  }

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
            setGameStatus("GAME OVER - BLUE WINS!");
            setActiveModal('game_over');
            playRetroSound('success', audioCtxRef);
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGameStatus("GAME OVER - RED WINS!");
            setActiveModal('game_over');
            playRetroSound('success', audioCtxRef);
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

  // Bot implementation trigger delay hook
  useEffect(() => {
    if (gameStarted && gameMode === 'bot' && game.turn() === 'b' && !game.isGameOver() && !isAnimatingMove && !pendingPromotion) {
      const aiTimeout = setTimeout(() => {
        if (game.turn() === 'b' && !game.isGameOver()) {
          makeBotMove();
        }
      }, 700); 
      return () => clearTimeout(aiTimeout);
    }
  }, [game, gameMode, gameStarted, isAnimatingMove, pendingPromotion]);

  // ── REPLAY: same settings, fresh board, reusing the loading countdown ──
  function restartMatch() {
    triggerInteractiveAudioContext();
    playRetroSound('success', audioCtxRef);

    if (timerRef.current) clearInterval(timerRef.current);
    setActiveModal(null);
    setIsStarting(true);
    setCountdownValue(3);

    const tick3 = setTimeout(() => setCountdownValue(2), 1000);
    const tick2 = setTimeout(() => setCountdownValue(1), 2000);
    const tick1 = setTimeout(() => {
      const newGame = new Chess();
      setGame(newGame);
      setGameStatus("RED TURN");
      setKingCheckedAlert(false);
      setHiddenSquare(null);
      setIsAnimatingMove(false);
      setPendingPromotion(null);

      if (timeMode !== 'none') {
        const seconds = parseFloat(timeMode) * 60;
        setWhiteTime(seconds);
        setBlackTime(seconds);
      }

      setIsStarting(false);
    }, 3000);

    return () => {
      clearTimeout(tick3);
      clearTimeout(tick2);
      clearTimeout(tick1);
    };
  }

  function startGame() {
    if (!gameMode || (gameMode === 'bot' && !difficulty) || !timeMode) return;
    triggerInteractiveAudioContext();
    playRetroSound('success', audioCtxRef);

    setIsStarting(true);
    setCountdownValue(3);

    const tick3 = setTimeout(() => setCountdownValue(2), 1000);
    const tick2 = setTimeout(() => setCountdownValue(1), 2000);
    const tick1 = setTimeout(() => {
      const newGame = new Chess();
      setGame(newGame);
      setGameStatus("RED TURN");
      setKingCheckedAlert(false);
      setHiddenSquare(null);
      setIsAnimatingMove(false);
      setPendingPromotion(null);

      if (timeMode !== 'none') {
        const seconds = parseFloat(timeMode) * 60;
        setWhiteTime(seconds);
        setBlackTime(seconds);
      }

      setIsStarting(false);
      setGameStarted(true);
    }, 3000);

    return () => {
      clearTimeout(tick3);
      clearTimeout(tick2);
      clearTimeout(tick1);
    };
  }

  function saveGame() {
    const formattedDate = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const newMatchSave = {
      id: 'match_' + Date.now(),
      date: formattedDate,
      fen: game.fen(),
      gameMode,
      difficulty,
      timeMode,
      gameStatus,
      whiteTime,
      blackTime
    };

    const updatedMatches = [newMatchSave, ...savedMatches];
    setSavedMatches(updatedMatches);
    localStorage.setItem('neochess_8bit_matches', JSON.stringify(updatedMatches));
    
    playRetroSound('save', audioCtxRef);
    setActiveModal('save_success');
  }

  function resumeMatch(match) {
    try {
      triggerInteractiveAudioContext();
      playRetroSound('success', audioCtxRef);
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
      setGameStarted(true);
    } catch (error) {
      alert("FAIL TO READ SAVED BLOCK.");
    }
  }

  function triggerDeletePrompt(id, e) {
    e.stopPropagation();
    triggerInteractiveAudioContext();
    playRetroSound('click', audioCtxRef);
    setPendingDeleteId(id);
    setActiveModal('confirm_delete');
  }

  function confirmDeleteSlot() {
    if (pendingDeleteId) {
      const updated = savedMatches.filter(m => m.id !== pendingDeleteId);
      setSavedMatches(updated);
      localStorage.setItem('neochess_8bit_matches', JSON.stringify(updated));
      playRetroSound('click', audioCtxRef);
    }
    setActiveModal(null);
    setPendingDeleteId(null);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function updateStatus(currentGame) {
    if (currentGame.inCheck() && !currentGame.isCheckmate()) {
      setKingCheckedAlert(true);
      playRetroSound('check_alert', audioCtxRef);
    } else {
      setKingCheckedAlert(false);
    }

    if (currentGame.isCheckmate()) {
      setGameStatus(`WINNER: ${currentGame.turn() === 'w' ? 'BLUE (CPU/P2)' : 'RED (YOU)'}`);
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveModal('game_over');
      playRetroSound('success', audioCtxRef);
    } else if (currentGame.isDraw()) {
      setGameStatus("GAME DRAWN");
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

  function executeMoveResolution(move) {
    try {
      const currentGame = new Chess(game.fen());
      const targetPiece = currentGame.get(move.to);
      const nextStateTest = new Chess(game.fen());
      nextStateTest.move(move);
      const targetsCheckmate = nextStateTest.isCheckmate();

      if (targetsCheckmate) {
        let losingKingSquare = null;
        const boardMatrix = nextStateTest.board();
        
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const tile = boardMatrix[r][c];
            if (tile && tile.type === 'k' && tile.color === nextStateTest.turn()) {
              const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
              const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
              losingKingSquare = files[c] + ranks[r];
              break;
            }
          }
          if (losingKingSquare) break;
        }

        if (losingKingSquare) {
          setIsAnimatingMove(true);
          setHiddenSquare(losingKingSquare);
          triggerCaptureAnimation(losingKingSquare, () => {
            setGame((prev) => {
              const next = new Chess(prev.fen());
              try {
                next.move(move);
                updateStatus(next);
                return next;
              } catch { return prev; }
            });
            setHiddenSquare(null);
            setIsAnimatingMove(false);
          }, 'cage');
          playRetroSound('sandworm', audioCtxRef);
          return;
        }
      }

      if (targetPiece) {
        setIsAnimatingMove(true);
        setHiddenSquare(move.to);
        const effect = triggerCaptureAnimation(move.to, () => {
          setGame((prev) => {
            const next = new Chess(prev.fen());
            try {
              next.move(move);
              updateStatus(next);
              return next;
            } catch (e) { return prev; }
          });
          setHiddenSquare(null);
          setIsAnimatingMove(false);
        }, 'pixel'); 
        if (effect) playRetroSound(effect, audioCtxRef);
      } else {
        const res = currentGame.move(move);
        if (res) {
          playRetroSound('click', audioCtxRef);
          setGame(currentGame);
          updateStatus(currentGame);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  function makeAMove(move) {
    if (isAnimatingMove) return false;

    try {
      const currentGame = new Chess(game.fen());
      const moves = currentGame.moves({ verbose: true });
      const isLegal = moves.some(m => m.from === move.from && m.to === move.to);
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

      const targetPiece = currentGame.get(move.to);
      const nextStateTest = new Chess(game.fen());
      nextStateTest.move(move);
      const targetsCheckmate = nextStateTest.isCheckmate();

      if (targetsCheckmate) {
        let losingKingSquare = null;
        const currentBoardMatrix = nextStateTest.board();
        
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const currentTilePiece = currentBoardMatrix[row][col];
            if (currentTilePiece && currentTilePiece.type === 'k' && currentTilePiece.color === nextStateTest.turn()) {
              const fileCoordinates = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
              const rankCoordinates = ['8', '7', '6', '5', '4', '3', '2', '1'];
              losingKingSquare = fileCoordinates[col] + rankCoordinates[row];
              break;
            }
          }
          if (losingKingSquare) break;
        }

        if (losingKingSquare) {
          setIsAnimatingMove(true);
          setHiddenSquare(losingKingSquare);

          triggerCaptureAnimation(losingKingSquare, () => {
            setGame((prevGame) => {
              const nextGame = new Chess(prevGame.fen());
              try {
                nextGame.move(move);
                updateStatus(nextGame);
                return nextGame;
              } catch (err) {
                return prevGame;
              }
            });
            setHiddenSquare(null);
            setIsAnimatingMove(false);
          }, 'cage');

          playRetroSound('sandworm', audioCtxRef); 
          return true;
        }
      }

      if (targetPiece) {
        setIsAnimatingMove(true);
        setHiddenSquare(move.to);

        const effectType = triggerCaptureAnimation(move.to, () => {
          setGame((prevGame) => {
            const nextGame = new Chess(prevGame.fen());
            try {
              nextGame.move(move);
              updateStatus(nextGame);
              return nextGame;
            } catch (err) {
              console.error("Delayed animation move error bypassed:", err);
              return prevGame;
            }
          });
          setHiddenSquare(null);
          setIsAnimatingMove(false);
        });

        if (effectType) {
          playRetroSound(effectType, audioCtxRef);
        }
        return true;
      } else {
        const result = currentGame.move(move);
        if (result) {
          playRetroSound('click', audioCtxRef);
          setGame(currentGame);
          updateStatus(currentGame);
          return true;
        }
      }
    } catch (error) {
      return false;
    }
    return false;
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
      const captures = possibleMoves.filter(m => m.captured);
      if (captures.length > 0) {
        selectedMove = captures[Math.floor(Math.random() * captures.length)];
      } else {
        selectedMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      }
    } else if (difficulty === 'hard') {
      const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      let bestMove = possibleMoves[0];
      let highestValue = -1;

      possibleMoves.forEach(m => {
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
        promotion: 'q'
      });
    }
  }

  function onDrop(sourceSquare, targetSquare) {
    if (game.isGameOver() || (gameMode === 'bot' && game.turn() === 'b') || !gameStarted || isAnimatingMove || pendingPromotion) {
      return false;
    }

    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
    });

    return !!move;
  }

  // ── WIZARD STEP NAVIGATION (compact layout only) ──
  function goToNextMenuStep() {
    playRetroSound('click', audioCtxRef);
    if (menuStep === 'mode') {
      setMenuStep(gameMode === 'bot' ? 'difficulty' : 'time');
    } else if (menuStep === 'difficulty') {
      setMenuStep('time');
    }
  }

  function goToPrevMenuStep() {
    playRetroSound('click', audioCtxRef);
    if (menuStep === 'time') {
      setMenuStep(gameMode === 'bot' ? 'difficulty' : 'mode');
    } else if (menuStep === 'difficulty') {
      setMenuStep('mode');
    }
  }

  function executeQuitToMenu() {
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem('neochess_active_session'); 
    setGameMode(null);
    setDifficulty(null);
    setTimeMode(null);
    setMenuStep('mode');
    setGameStarted(false);
    setGame(new Chess());
    setGameStatus("RED TURN");
    setKingCheckedAlert(false);
    setHiddenSquare(null);
    setIsAnimatingMove(false);
    setPendingPromotion(null);
    loadSavedMatchesFromStorage();
    setActiveModal(null);
    playRetroSound('click', audioCtxRef);
  }

  const customSquareStyles = useMemo(() => {
    if (!hiddenSquare) return {};
    return { [hiddenSquare]: { opacity: 0, visibility: 'hidden' } };
  }, [hiddenSquare]);

  // ── SHARED MENU FRAGMENTS ──
  // Built once per render and reused by BOTH the desktop all-in-one panel
  // and the compact (phone/tablet) step wizard, so the two layouts can
  // never drift out of sync with each other.
  const audioToggleButton = (
    <button className={`audio-toggle-btn ${isMuted ? 'is-muted' : ''}`} onClick={() => { setIsMuted(!isMuted); triggerInteractiveAudioContext(); }}>
      <span className="led-dot" />AUDIO: {isMuted ? 'OFF' : 'ON'}
    </button>
  );

  const modeSelectionSection = (
    <div className="menu-section">
      <h3><span className="menu-section-num">01</span> SELECT MODE</h3>
      <div className="btn-group-pixel mode-grid">
        <button className={`mode-btn-pvp ${gameMode === '1v1' ? 'active' : ''}`} onClick={() => { playRetroSound('click', audioCtxRef); setGameMode('1v1'); }}>
          <span className="btn-tag">PVP</span>1 VS 1 LOCAL
        </button>
        <button className={`mode-btn-cpu ${gameMode === 'bot' ? 'active' : ''}`} onClick={() => { playRetroSound('click', audioCtxRef); setGameMode('bot'); }}>
          <span className="btn-tag">CPU</span>BOT MATCH
        </button>
      </div>
    </div>
  );

  const difficultySelectionSection = (
    <div className="menu-section">
      <h3><span className="menu-section-num">02</span> DIFFICULTY</h3>
      <div className="btn-group-pixel diff-grid">
        <button className={`diff-easy ${difficulty === 'easy' ? 'active' : ''}`} onClick={() => { playRetroSound('click', audioCtxRef); setDifficulty('easy'); }}>EASY</button>
        <button className={`diff-medium ${difficulty === 'medium' ? 'active' : ''}`} onClick={() => { playRetroSound('click', audioCtxRef); setDifficulty('medium'); }}>NORMAL</button>
        <button className={`diff-hard ${difficulty === 'hard' ? 'active' : ''}`} onClick={() => { playRetroSound('click', audioCtxRef); setDifficulty('hard'); }}>HARD CORE</button>
      </div>
    </div>
  );

  const timeSelectionSection = (
    <div className="menu-section">
      <h3><span className="menu-section-num">{gameMode === 'bot' ? '03' : '02'}</span> TIME LIMIT</h3>
      <div className="btn-group-pixel time-grid">
        <button className={timeMode === 'none' ? 'active' : ''} onClick={() => { playRetroSound('click', audioCtxRef); setTimeMode('none'); }}>NO LIMIT</button>
        <button className={timeMode === '0.5' ? 'active' : ''} onClick={() => { playRetroSound('click', audioCtxRef); setTimeMode('0.5'); }}>00:30</button>
        <button className={timeMode === '1' ? 'active' : ''} onClick={() => { playRetroSound('click', audioCtxRef); setTimeMode('1'); }}>01:00</button>
        <button className={timeMode === '5' ? 'active' : ''} onClick={() => { playRetroSound('click', audioCtxRef); setTimeMode('5'); }}>05:00</button>
        <button className={timeMode === '10' ? 'active' : ''} onClick={() => { playRetroSound('click', audioCtxRef); setTimeMode('10'); }}>10:00</button>
        <button className={timeMode === '30' ? 'active' : ''} onClick={() => { playRetroSound('click', audioCtxRef); setTimeMode('30'); }}>30:00</button>
      </div>
    </div>
  );

  const savedMatchesPanel = (
    <div className="save-manager-container bento-pixel">
      <h2 className="section-pixel-title">[SAVED MATCHES DATA]</h2>
      <div className="matches-log-list">
        {savedMatches.length === 0 ? (
          <div className="no-saves-banner">-- NO CURRENT DATA FOUND --</div>
        ) : (
          savedMatches.map((match) => (
            <div key={match.id} className="save-data-card" onClick={() => resumeMatch(match)}>
              <div className="card-top">
                <span className="save-mode-badge">
                  {match.gameMode === 'bot' ? `CPU (${match.difficulty.toUpperCase()})` : '1VS1'}
                </span>
                <span className="save-time-badge">TIME: {match.timeMode === 'none' ? 'INF' : `${match.timeMode}M`}</span>
              </div>
              <div className="card-mid">
                <div className="card-date">DATE: {match.date}</div>
                <div className="card-status">{match.gameStatus}</div>
              </div>
              <div className="card-bottom-actions">
                <button className="load-slot-btn">LOAD SLOT</button>
                <button className="delete-slot-btn" onClick={(e) => triggerDeletePrompt(match.id, e)}>CLR</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Wizard progress dots: 2 steps for LOCAL (mode → time), 3 for BOT (mode → difficulty → time)
  const wizardTotalSteps = gameMode === 'bot' ? 3 : 2;
  const wizardCurrentStepNumber =
    menuStep === 'mode' ? 1 : menuStep === 'difficulty' ? 2 : wizardTotalSteps;

  return (
    <div className={`app-container pixel-art ${gameStarted ? 'game-active' : ''} ${kingCheckedAlert && gameStarted && !game.isGameOver() ? 'screen-flash-active' : ''}`} onClick={triggerInteractiveAudioContext}>
      
      {kingCheckedAlert && gameStarted && !game.isGameOver() && (
        <div className="screen-flash-overlay" onClick={() => setKingCheckedAlert(false)}>
          <div className="flash-alert-text">CHECK!</div>
        </div>
      )}

      <header className="game-header">
        <h1 className="pixel-title">NEO <span>CHESS DX</span></h1>
        <div className="header-subtitle"><span className="pixel-diamond" />SELECT STAGE WORLD<span className="pixel-diamond" /></div>
      </header>

      {isStarting && (
        <div className="retro-modal-overlay procedural-start-screen">
          <div className="procedural-counter-box">
            <div className="procedural-number-glitch pulse-text">{countdownValue}</div>
            <div className="procedural-title-load mt-4">NEO CHESS DX LOADING...</div>
          </div>
        </div>
      )}

      {pendingPromotion && (
        <div className="retro-modal-overlay">
          <div className="bento-pixel retro-modal-body" style={{ borderColor: '#ffcc00' }}>
            <h2 className="modal-title-pixel" style={{ color: '#ffcc00' }}>[PAWN EVOLUTION]</h2>
            <p className="modal-text-pixel">CHOOSE PROMOTED ARTIFACT:</p>
            <div className="promo-grid">
              <button className="promo-btn promo-queen" onClick={() => handlePromotionSelection('q')}>
                <span className="promo-icon">♛</span>QUEEN
              </button>
              <button className="promo-btn promo-rook" onClick={() => handlePromotionSelection('r')}>
                <span className="promo-icon">♜</span>ROOK
              </button>
              <button className="promo-btn promo-bishop" onClick={() => handlePromotionSelection('b')}>
                <span className="promo-icon">♝</span>BISHOP
              </button>
              <button className="promo-btn promo-knight" onClick={() => handlePromotionSelection('n')}>
                <span className="promo-icon">♞</span>KNIGHT
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="retro-modal-overlay">
          <div className="bento-pixel retro-modal-body" style={activeModal === 'game_over' ? { borderColor: '#ffcc00' } : undefined}>
            {activeModal === 'save_success' && (
              <>
                <h2 className="modal-title-pixel">[SYSTEM UPDATE]</h2>
                <p className="modal-text-pixel">STATE SAVED SLOTS UPDATED SUCCESSFUL!</p>
                <button className="pixel-action-btn action-save" onClick={() => { playRetroSound('click', audioCtxRef); setActiveModal(null); }}>
                  OK (CONTINUE)
                </button>
              </>
            )}

            {activeModal === 'confirm_quit' && (
              <>
                <h2 className="modal-title-pixel alert-title">[WARN MODULE]</h2>
                <p className="modal-text-pixel">RESET EMULATOR BACK TO MENU?</p>
                <div className="btn-group-pixel">
                  <button className="diff-hard active" onClick={executeQuitToMenu}>YES (RESET)</button>
                  <button className="cancel-modal-btn" onClick={() => { playRetroSound('click', audioCtxRef); setActiveModal(null); }}>NO (CANCEL)</button>
                </div>
              </>
            )}

            {activeModal === 'confirm_delete' && (
              <>
                <h2 className="modal-title-pixel alert-title">[WARN MODULE]</h2>
                <p className="modal-text-pixel">DELETE THIS DATA SLOT PERMANENTLY?</p>
                <div className="btn-group-pixel">
                  <button className="diff-hard active" onClick={confirmDeleteSlot}>YES (ERASE)</button>
                  <button className="cancel-modal-btn" onClick={() => { playRetroSound('click', audioCtxRef); setActiveModal(null); }}>NO (KEEP)</button>
                </div>
              </>
            )}

            {activeModal === 'game_over' && (
              <>
                <h2 className="modal-title-pixel winner-title">[GAME OVER]</h2>
                <p className="modal-text-pixel">{gameStatus}</p>
                <div className="btn-group-pixel">
                  <button className="pixel-action-btn game-over-btn-replay" onClick={restartMatch}>
                    ↺ REPLAY
                  </button>
                  <button className="pixel-action-btn game-over-btn-menu" onClick={executeQuitToMenu}>
                    ▤ MAIN MENU
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!gameStarted ? (
        <div className={`menu-wrapper-layout ${isCompactLayout ? 'compact-wizard-layout' : ''}`}>
          {isCompactLayout ? (
            <>
              <div className="menu-container bento-pixel wizard-card">
                <div className="menu-header-row">
                  <h2 className="section-pixel-title">[CONFIG MODULE]</h2>
                  {audioToggleButton}
                </div>

                <div className="wizard-progress-track">
                  {Array.from({ length: wizardTotalSteps }).map((_, idx) => {
                    const stepNum = idx + 1;
                    const dotState = stepNum < wizardCurrentStepNumber ? 'done' : stepNum === wizardCurrentStepNumber ? 'active' : 'pending';
                    return <span key={stepNum} className={`wizard-progress-dot ${dotState}`} />;
                  })}
                </div>

                <div className="wizard-step-body">
                  {menuStep === 'mode' && modeSelectionSection}
                  {menuStep === 'difficulty' && gameMode === 'bot' && difficultySelectionSection}
                  {menuStep === 'time' && timeSelectionSection}
                </div>

                <div className="wizard-nav-row">
                  {menuStep !== 'mode' && (
                    <button type="button" className="wizard-back-btn" onClick={goToPrevMenuStep}>
                      ◀ BACK
                    </button>
                  )}
                  {menuStep !== 'time' ? (
                    <button
                      type="button"
                      className="wizard-next-btn"
                      onClick={goToNextMenuStep}
                      disabled={(menuStep === 'mode' && !gameMode) || (menuStep === 'difficulty' && !difficulty)}
                    >
                      NEXT ▶
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="start-pixel-btn"
                      onClick={startGame}
                      disabled={!gameMode || (gameMode === 'bot' && !difficulty) || !timeMode}
                    >
                      PUSH START BUTTON
                    </button>
                  )}
                </div>
              </div>

              {menuStep === 'mode' && savedMatchesPanel}
            </>
          ) : (
            <>
              <div className="menu-container bento-pixel">
                <div className="menu-header-row">
                  <h2 className="section-pixel-title">[CONFIG MODULE]</h2>
                  {audioToggleButton}
                </div>

                {modeSelectionSection}
                {gameMode === 'bot' && difficultySelectionSection}
                {timeSelectionSection}

                <button className="start-pixel-btn" onClick={startGame} disabled={!gameMode || (gameMode === 'bot' && !difficulty) || !timeMode}>
                  PUSH START BUTTON
                </button>
              </div>

              {savedMatchesPanel}
            </>
          )}
        </div>
      ) : (
        <div className="game-grid-pixel">
          <div className="bento-pixel board-frame" ref={boardWrapperRef} style={{ position: 'relative' }}>
            <canvas 
              ref={canvasRef} 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                pointerEvents: 'none', 
                zIndex: 10 
              }} 
            />
            <main className="board-container-pixel" ref={boardInnerRef}>
              {/* 📍 STEP 3: Dito in-inject ang boardWidth prop sa Chessboard */}
              <Chessboard 
                boardWidth={boardWidth} 
                position={game.fen()} 
                onPieceDrop={onDrop}
                customPieces={pixelPieces} 
                customSquareStyles={customSquareStyles}
                customBoardStyle={BOARD_STYLE}
                customDarkSquareStyle={DARK_SQUARE_STYLE} 
                customLightSquareStyle={LIGHT_SQUARE_STYLE} 
              />
            </main>
          </div>

          <div className="side-pixel-wrapper">
            <div className="bento-pixel monitor-panel">
              <div className="monitor-title">SYSTEM STATUS</div>
              <div className="monitor-badge blinking-text">{gameStatus}</div>
              <div className="stage-info">STAGE: {gameMode === 'bot' ? 'WORLD CPU BOT' : 'WORLD 1v1 LOCAL'}</div>
            </div>

            <div className="bento-pixel player-panel-pixel black-retro">
              <div className="player-title-bar">
                <span className="player-tag" style={{ color: '#00b3ff' }}>P2 [BLUE] {gameMode === 'bot' && '(CPU)'}</span>
                {timeMode !== 'none' && <div className="arcade-timer">{formatTime(blackTime)}</div>}
              </div>
            </div>

            <div className="bento-pixel player-panel-pixel white-retro">
              <div className="player-title-bar">
                <span className="player-tag" style={{ color: '#ff3333' }}>P1 [RED] (YOU)</span>
                {timeMode !== 'none' && <div className="arcade-timer">{formatTime(whiteTime)}</div>}
              </div>
            </div>

            <div className="bento-pixel controls-panel-pixel">
              <button className="pixel-action-btn action-save" onClick={saveGame} disabled={isAnimatingMove || pendingPromotion}>
                [ SAVE SLOT ]
              </button>
              <button className="pixel-action-btn action-forfeit" onClick={() => { playRetroSound('click', audioCtxRef); setActiveModal('confirm_quit'); }} disabled={isAnimatingMove || pendingPromotion}>
                SELECT MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;