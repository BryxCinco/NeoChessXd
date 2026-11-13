import { PieceSprite } from '../pixelPieces';

// Compact game-over strip docked at the bottom of the screen. Unlike a
// modal it leaves the board visible, so the final position can be looked
// at — and, through VIEW BOARD, replayed move by move.
export function GameOverBar({
  gameStatus,
  winner, // 'w' | 'b' | null (draw)
  isReviewing,
  reviewPly,
  totalPlies,
  onRematch,
  onViewBoard,
  onExit,
  onStep,
  onJump,
  onExitReview,
  onCopyPgn,
  onDownloadPgn,
}) {
  if (isReviewing) {
    const atStart = reviewPly <= 0;
    const atEnd = reviewPly >= totalPlies;
    return (
      <section className="game-over-bar is-review" aria-label="Game review">
        <div className="gob-review-row">
          <button type="button" className="gob-nav" onClick={() => onJump(0)} disabled={atStart} aria-label="First position">
            ⏮
          </button>
          <button type="button" className="gob-nav" onClick={() => onStep(-1)} disabled={atStart} aria-label="Previous move">
            ◀
          </button>
          <div className="gob-counter" role="status" aria-live="polite">
            MOVE {reviewPly} / {totalPlies}
          </div>
          <button type="button" className="gob-nav" onClick={() => onStep(1)} disabled={atEnd} aria-label="Next move">
            ▶
          </button>
          <button type="button" className="gob-nav" onClick={() => onJump(totalPlies)} disabled={atEnd} aria-label="Last position">
            ⏭
          </button>
        </div>
        <div className="gob-actions">
          <span className="gob-keys" aria-hidden="true">← → KEYS OR TAP A MOVE</span>
          <button type="button" className="gob-btn gob-done" onClick={onExitReview}>
            ✕ CLOSE REVIEW
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="game-over-bar" role="status" aria-label="Game over">
      <div className="gob-result">
        <span className="gob-hero" aria-hidden="true">
          {winner ? (
            <PieceSprite code={`${winner}K`} size={40} animated />
          ) : (
            <>
              <PieceSprite code="wK" size={30} />
              <PieceSprite code="bK" size={30} />
            </>
          )}
        </span>
        <div>
          <div className="gob-title">GAME OVER</div>
          <div className="gob-status">{gameStatus}</div>
        </div>
      </div>
      <div className="gob-actions">
        <button type="button" className="gob-btn gob-rematch" onClick={onRematch}>
          ↺ REMATCH
        </button>
        <button type="button" className="gob-btn gob-view" onClick={onViewBoard}>
          ◉ VIEW BOARD
        </button>
        <button type="button" className="gob-btn gob-exit" onClick={onExit}>
          ▤ EXIT
        </button>
      </div>
      <div className="gob-actions gob-secondary">
        <button type="button" className="gob-btn gob-pgn" onClick={onCopyPgn}>
          ⧉ COPY PGN
        </button>
        <button type="button" className="gob-btn gob-pgn" onClick={onDownloadPgn}>
          ⇩ DOWNLOAD PGN
        </button>
      </div>
    </section>
  );
}
