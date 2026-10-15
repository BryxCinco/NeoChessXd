import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { pixelPieces } from '../pixelPieces';
import { MoveScoresheet } from './MoveScoresheet';

const BOARD_STYLE = {
  border: '6px solid #ffcc00',
  boxShadow: '0 0 0 6px #000, 0 15px 0 rgba(0,0,0,0.4)',
};
const DARK_SQUARE_STYLE = { backgroundColor: '#2e2017' };
const LIGHT_SQUARE_STYLE = { backgroundColor: '#e8cfa6' };

export function GameBoardScreen({
  boardWrapperRef,
  boardInnerRef,
  canvasRef,
  boardWidth,
  game,
  onDrop,
  isDraggablePiece,
  botThinking,
  customSquareStyles,
  gameStatus,
  gameMode,
  timeMode,
  whiteTime,
  blackTime,
  formatTime,
  moveHistory,
  lastMove,
  isCompactLayout,
}) {
  // The clock re-renders this screen several times a second; memoizing the
  // board means react-chessboard (64 squares + 32 SVG pieces) only
  // re-renders when the position, size or hidden square actually changes —
  // the single biggest smoothness win on phones. `onDrop` and
  // `isDraggablePiece` come from useChessGame with stable identities.
  const fen = game.fen();
  const board = useMemo(() => (
    <Chessboard
      boardWidth={boardWidth}
      position={fen}
      onPieceDrop={onDrop}
      isDraggablePiece={isDraggablePiece}
      customPieces={pixelPieces}
      customSquareStyles={customSquareStyles}
      customBoardStyle={BOARD_STYLE}
      customDarkSquareStyle={DARK_SQUARE_STYLE}
      customLightSquareStyle={LIGHT_SQUARE_STYLE}
    />
  ), [boardWidth, fen, onDrop, isDraggablePiece, customSquareStyles]);

  return (
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
            zIndex: 10,
          }}
        />
        <main className="board-container-pixel" ref={boardInnerRef}>
          {board}
        </main>
      </div>

      <div className="side-pixel-wrapper">
        <div className="bento-pixel monitor-panel">
          <div className="monitor-title">SYSTEM STATUS</div>
          <div className="monitor-badge blinking-text">{botThinking ? 'CPU THINKING...' : gameStatus}</div>
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

        {/* ── NOTATION, docked right under the P1/P2 panels ── */}
        <MoveScoresheet
          moveHistory={moveHistory}
          lastMove={lastMove}
          gameStatus={gameStatus}
          isCompactLayout={isCompactLayout}
        />
      </div>
    </div>
  );
}