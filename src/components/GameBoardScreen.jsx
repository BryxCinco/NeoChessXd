import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { pixelPieces } from '../boardPieces';
import { MoveScoresheet } from './MoveScoresheet';
import { PlayerBar } from './PlayerBar';

// Gold frame drawn with box-shadow (not border) so it never adds to the
// measured board width and pushes the h-file off narrow screens.
const BOARD_STYLE = {
  boxShadow: '0 0 0 5px #ffcc00',
};
const DEFAULT_THEME = { light: '#e8cfa6', dark: '#2e2017' };
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
  boardOrientation = 'white',
  playerColor = 'w',
  theme = DEFAULT_THEME,
  animations = true,
  onJumpToPly,
  activePly,
  matchNotes,
  children, // extra side-panel content: the game-over bar
}) {
  // The clock re-renders this screen several times a second; memoizing the
  // board means react-chessboard (64 squares + 32 SVG pieces) only
  // re-renders when the position, size or square highlights actually
  // change — the single biggest smoothness win on phones. All handlers come
  // from useChessGame with stable identities.
  const darkSquareStyle = useMemo(() => ({ backgroundColor: theme.dark }), [theme.dark]);
  const lightSquareStyle = useMemo(() => ({ backgroundColor: theme.light }), [theme.light]);
  const board = useMemo(() => (
    <Chessboard
      boardWidth={boardWidth}
      boardOrientation={boardOrientation}
      position={displayPosition}
      onPieceDrop={onDrop}
      onSquareClick={onSquareClick}
      onPieceDragBegin={onPieceDragBegin}
      isDraggablePiece={isDraggablePiece}
      customPieces={pixelPieces}
      customSquareStyles={customSquareStyles}
      customBoardStyle={BOARD_STYLE}
      customDarkSquareStyle={darkSquareStyle}
      customLightSquareStyle={lightSquareStyle}
      animationDuration={animations ? 180 : 0}
    />
  ), [boardWidth, boardOrientation, displayPosition, onDrop, onSquareClick, onPieceDragBegin, isDraggablePiece,
    customSquareStyles, darkSquareStyle, lightSquareStyle, animations]);

  const turn = game.turn();
  const timed = timeMode !== 'none';
  const playerBar = (color) => {
    const time = color === 'w' ? whiteTime : blackTime;
    const isBot = gameMode === 'bot';
    const isCpu = isBot && color !== playerColor;
    const role = !isBot ? '' : isCpu ? ' (CPU)' : ' (YOU)';
    return (
      <PlayerBar
        color={color}
        label={(color === 'w' ? 'P1 RED' : 'P2 BLUE') + role}
        isActive={!isGameOver && turn === color}
        isThinking={isCpu && botThinking}
        capturedTypes={captured[color]}
        materialLead={color === 'w' ? captured.material : -captured.material}
        timeText={timed ? formatTime(time) : null}
        isLowTime={timed && time <= LOW_TIME_SECONDS}
      />
    );
  };

  // The side shown at the bottom of the board is the one facing the player.
  const bottomColor = boardOrientation === 'black' ? 'b' : 'w';
  const topColor = bottomColor === 'w' ? 'b' : 'w';

  return (
    <div className="game-grid-pixel">
      <div className="board-column">
        {playerBar(topColor)}

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

        {playerBar(bottomColor)}
      </div>

      <div className="side-pixel-wrapper">
        <div className="bento-pixel monitor-panel">
          <div className="monitor-title">SYSTEM STATUS</div>
          <div className={`monitor-badge ${isGameOver ? '' : 'blinking-text'}`}>
            {botThinking ? 'CPU THINKING...' : gameStatus}
          </div>
          <div className="stage-info">STAGE: {gameMode === 'bot' ? 'WORLD CPU BOT' : 'WORLD 1v1 LOCAL'}</div>
        </div>

        {children}

        <MoveScoresheet
          moveHistory={moveHistory}
          lastMove={lastMove}
          gameStatus={gameStatus}
          isCompactLayout={isCompactLayout}
          onJumpToPly={onJumpToPly}
          activePly={activePly}
          notes={matchNotes}
        />
      </div>
    </div>
  );
}
