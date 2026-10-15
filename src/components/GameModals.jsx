import { PieceSprite } from '../pixelPieces';

// Renders whichever modal body matches `activeModal`. All the pause-menu
// actions live here so App.jsx just wires up the handful of callbacks.
export function GameModals({
  activeModal,
  gameStatus,
  isAnimatingMove,
  pendingPromotion,
  play,
  onClose,
  onOpenQuitConfirm,
  onRestart,
  onSave,
  onConfirmQuit,
  onConfirmDelete,
}) {
  if (!activeModal) return null;
  const disabled = isAnimatingMove || pendingPromotion;
  // 'w' / 'b' when someone won (checkmate or time-out), null for a draw.
  const winnerColor = /WINNER: RED/.test(gameStatus) ? 'w' : /WINNER: BLUE/.test(gameStatus) ? 'b' : null;

  return (
    <div className="retro-modal-overlay">
      <div className="bento-pixel retro-modal-body" style={activeModal === 'game_over' ? { borderColor: '#ffcc00' } : undefined}>
        {activeModal === 'pause_menu' && (
          <>
            <h2 className="modal-title-pixel">[PAUSE MENU]</h2>
            <div className="btn-group-pixel pause-menu-grid">
              <button className="pixel-action-btn action-continue" onClick={() => { play('click'); onClose(); }}>
                ▶ CONTINUE
              </button>
              <button className="pixel-action-btn action-restart" onClick={onRestart} disabled={disabled}>
                ↺ RESTART
              </button>
              <button className="pixel-action-btn action-save" onClick={onSave} disabled={disabled}>
                💾 SAVE GAME
              </button>
              <button
                className="pixel-action-btn action-forfeit"
                onClick={() => { play('click'); onOpenQuitConfirm(); }}
                disabled={disabled}
              >
                ⏻ OUT
              </button>
            </div>
          </>
        )}

        {activeModal === 'save_success' && (
          <>
            <h2 className="modal-title-pixel">[SYSTEM UPDATE]</h2>
            <p className="modal-text-pixel">STATE SAVED SLOTS UPDATED SUCCESSFUL!</p>
            <button className="pixel-action-btn action-save" onClick={() => { play('click'); onClose(); }}>
              OK (CONTINUE)
            </button>
          </>
        )}

        {activeModal === 'confirm_quit' && (
          <>
            <h2 className="modal-title-pixel alert-title">[WARN MODULE]</h2>
            <p className="modal-text-pixel">RESET EMULATOR BACK TO MENU?</p>
            <div className="btn-group-pixel">
              <button className="diff-hard active" onClick={onConfirmQuit}>YES (RESET)</button>
              <button className="cancel-modal-btn" onClick={() => { play('click'); onClose(); }}>NO (CANCEL)</button>
            </div>
          </>
        )}

        {activeModal === 'confirm_delete' && (
          <>
            <h2 className="modal-title-pixel alert-title">[WARN MODULE]</h2>
            <p className="modal-text-pixel">DELETE THIS DATA SLOT PERMANENTLY?</p>
            <div className="btn-group-pixel">
              <button className="diff-hard active" onClick={onConfirmDelete}>YES (ERASE)</button>
              <button className="cancel-modal-btn" onClick={() => { play('click'); onClose(); }}>NO (KEEP)</button>
            </div>
          </>
        )}

        {activeModal === 'game_over' && (
          <>
            <h2 className="modal-title-pixel winner-title">[GAME OVER]</h2>
            <div className="game-over-hero">
              {winnerColor ? (
                <PieceSprite code={`${winnerColor}K`} size={80} animated />
              ) : (
                <>
                  <PieceSprite code="wK" size={60} animated />
                  <span className="vs-text">=</span>
                  <PieceSprite code="bK" size={60} animated />
                </>
              )}
            </div>
            <p className="modal-text-pixel">{gameStatus}</p>
            <div className="btn-group-pixel">
              <button className="pixel-action-btn game-over-btn-replay" onClick={onRestart}>
                ↺ REPLAY
              </button>
              <button className="pixel-action-btn game-over-btn-menu" onClick={onConfirmQuit}>
                ▤ MAIN MENU
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}