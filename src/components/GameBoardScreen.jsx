import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { pixelPieces } from '../pixelPieces';
import { MoveScoresheet } from './MoveScoresheet';
import { PlayerBar } from './PlayerBar';

// Gold frame drawn with box-shadow (not border) so it never adds to the
// measured board width and pushes the h-file off narrow screens.
const BOARD_STYLE = {
  boxShadow: '0 0 0 5px #ffcc00',
};
const DARK_SQUARE_STYLE = { backgroundColor: '#2e2017' };
const LIGHT_SQUARE_STYLE = { backgroundColor: '#e8cfa6' };
const LOW_TIME_SECONDS = 20;

export function GameBoardScreen({
  boardWrapperRef,
  boardInnerRef,
  canvasRef,
  boardWidth,
  game,
  onDrop,
  onSquareClick,
  onPieceDragBegin,
  isDraggablePiece,
  botThinking,
  checkmateFx,
  captured,
  customSquareStyles,
  displayPosition,
  gameStatus,
  gameMode,
  timeMode,
  whiteTime,
  blackTime,
  formatTime,
  moveHistory,
  lastMove,
  isCompactLayout,
  isGameOver,
}) {
  // The clock re-renders this screen several times a second; memoizing the
  // board means react-chessboard (64 squares + 32 SVG pieces) only
  // re-renders when the position, size or square highlights actually
  // change — the single biggest smoothness win on phones. All handlers come
  // from useChessGame with stable identities.
  const board = useMemo(() => (
    <Chessboard
      boardWidth={boardWidth}
      position={displayPosition}
      onPieceDrop={onDrop}
      onSquareClick={onSquareClick}
      onPieceDragBegin={onPieceDragBegin}
      isDraggablePiece={isDraggablePiece}
      customPieces={pixelPieces}
      customSquareStyles={customSquareStyles}
      customBoardStyle={BOARD_STYLE}
      customDarkSquareStyle={DARK_SQUARE_STYLE}
      customLightSquareStyle={LIGHT_SQUARE_STYLE}
      animationDuration={180}
    />
  ), [boardWidth, displayPosition, onDrop, onSquareClick, onPieceDragBegin, isDraggablePiece, customSquareStyles]);

  const turn = game.turn();
  const timed = timeMode !== 'none';
  const playerBar = (color) => {
    const time = color === 'w' ? whiteTime : blackTime;
    const isCpu = color === 'b' && gameMode === 'bot';
    return (
      <PlayerBar
        color={color}
        label={color === 'w' ? 'P1 RED' + (gameMode === 'bot' ? ' (YOU)' : '') : 'P2 BLUE' + (isCpu ? ' (CPU)' : '')}
        isActive={!isGameOver && turn === color}
        isThinking={isCpu && botThinking}
        capturedTypes={captured[color]}
        materialLead={color === 'w' ? captured.material : -captured.material}
        timeText={timed ? formatTime(time) : null}
        isLowTime={timed && time <= LOW_TIME_SECONDS}
      />
    );
  };

  return (
    <div className="game-grid-pixel">
      <div className="board-column">
        {playerBar('b')}

        <div
          className={`bento-pixel board-frame ${checkmateFx ? 'board-shake' : ''}`}
          ref={boardWrapperRef}
        >
          <canvas ref={canvasRef} className="fx-canvas" />
          <main className="board-container-pixel" ref={boardInnerRef}>
            {board}
          </main>
          {checkmateFx && (
            <div className="checkmate-banner" role="status">
              <span>CHECK</span><span>MATE!</span>
            </div>
          )}
        </div>

        {playerBar('w')}
      </div>

      <div className="side-pixel-wrapper">
        <div className="bento-pixel monitor-panel">
          <div className="monitor-title">SYSTEM STATUS</div>
          <div className={`monitor-badge ${isGameOver ? '' : 'blinking-text'}`}>
            {botThinking ? 'CPU THINKING...' : gameStatus}
          </div>
          <div className="stage-info">STAGE: {gameMode === 'bot' ? 'WORLD CPU BOT' : 'WORLD 1v1 LOCAL'}</div>
        </div>

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
