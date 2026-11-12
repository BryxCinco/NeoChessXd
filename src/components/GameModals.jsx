import { PieceSprite } from '../pixelPieces';
import { PixelModal } from './PixelModal';
import { MAX_SAVE_SLOTS } from '../hooks/useSavedMatches';

// Renders whichever modal matches `activeModal`, all built on <PixelModal>.
// The pause-menu actions live here so App.jsx just wires up the callbacks.
export function GameModals({
  activeModal,
  gameStatus,
  isAnimatingMove,
  pendingPromotion,
  pendingLoadMatch,
  play,
  onClose,
  onOpenQuitConfirm,
  onRestart,
  onSave,
  onConfirmOverwrite,
  onConfirmLoad,
  onConfirmQuit,
  onConfirmDelete,
}) {
  if (!activeModal) return null;
  const disabled = !!(isAnimatingMove || pendingPromotion);
  const close = () => { play('click'); onClose(); };

  switch (activeModal) {
    case 'pause_menu':
      return (
        <PixelModal title="[PAUSE MENU]" onCancel={close}>
          <div className="btn-group-pixel pause-menu-grid">
            <button type="button" className="pixel-action-btn action-continue" onClick={close}>
              ▶ CONTINUE
            </button>
            <button type="button" className="pixel-action-btn action-restart" onClick={onRestart} disabled={disabled}>
              ↺ RESTART
            </button>
            <button type="button" className="pixel-action-btn action-save" onClick={() => onSave()} disabled={disabled}>
              💾 SAVE GAME
            </button>
            <button
              type="button"
              className="pixel-action-btn action-forfeit"
              onClick={() => { play('click'); onOpenQuitConfirm(); }}
              disabled={disabled}
            >
              ⏻ OUT
            </button>
          </div>
        </PixelModal>
      );

    case 'save_success':
      return (
        <PixelModal
          title="[SYSTEM UPDATE]"
          message="GAME SAVED SUCCESSFULLY!"
          confirmLabel="OK (CONTINUE)"
          onConfirm={close}
          onCancel={close}
        />
      );

    case 'save_failed':
      return (
        <PixelModal
          title="[SAVE ERROR]"
          tone="alert"
          message="SAVE FAILED — STORAGE FULL OR BLOCKED"
          confirmLabel="OK"
          onConfirm={close}
          onCancel={close}
        >
          <p className="modal-hint-pixel">FREE SOME SPACE OR LEAVE PRIVATE MODE, THEN TRY AGAIN.</p>
        </PixelModal>
      );

    case 'confirm_overwrite':
      return (
        <PixelModal
          title="[SLOTS FULL]"
          tone="alert"
          message={`ALL ${MAX_SAVE_SLOTS} SAVE SLOTS ARE USED. OVERWRITE THE OLDEST SAVE?`}
          confirmLabel="YES (OVERWRITE)"
          confirmVariant="danger"
          onConfirm={onConfirmOverwrite}
          cancelLabel="NO (CANCEL)"
          onCancel={close}
        />
      );

    case 'confirm_load':
      return (
        <PixelModal
          title="[LOAD DATA]"
          message="LOAD THIS SAVED MATCH?"
          confirmLabel="YES (LOAD)"
          onConfirm={onConfirmLoad}
          cancelLabel="NO (CANCEL)"
          onCancel={close}
        >
          {pendingLoadMatch && (
            <p className="modal-hint-pixel">
              {pendingLoadMatch.gameMode === 'bot'
                ? `CPU (${(pendingLoadMatch.difficulty || '').toUpperCase()})`
                : '1VS1'}
              {' · '}
              {pendingLoadMatch.date}
            </p>
          )}
        </PixelModal>
      );

    case 'load_failed':
      return (
        <PixelModal
          title="[LOAD ERROR]"
          tone="alert"
          message="FAILED TO READ THIS SAVE SLOT. THE DATA MAY BE DAMAGED."
          confirmLabel="OK"
          onConfirm={close}
          onCancel={close}
        />
      );

    case 'confirm_quit':
      return (
        <PixelModal
          title="[WARN MODULE]"
          tone="alert"
          message="QUIT THIS MATCH AND GO BACK TO THE MENU?"
          confirmLabel="YES (QUIT)"
          confirmVariant="danger"
          onConfirm={onConfirmQuit}
          cancelLabel="NO (CANCEL)"
          onCancel={close}
        />
      );

    case 'confirm_delete':
      return (
        <PixelModal
          title="[WARN MODULE]"
          tone="alert"
          message="DELETE THIS DATA SLOT PERMANENTLY?"
          confirmLabel="YES (ERASE)"
          confirmVariant="danger"
          onConfirm={onConfirmDelete}
          cancelLabel="NO (KEEP)"
          onCancel={close}
        />
      );

    case 'game_over': {
      // 'w' / 'b' when someone won (checkmate or time-out), null for a draw.
      const winnerColor = /WINNER: RED/.test(gameStatus) ? 'w' : /WINNER: BLUE/.test(gameStatus) ? 'b' : null;
      return (
        <PixelModal title="[GAME OVER]" tone="gold">
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
            <button type="button" className="pixel-action-btn game-over-btn-replay" onClick={onRestart}>
              ↺ REPLAY
            </button>
            <button type="button" className="pixel-action-btn game-over-btn-menu" onClick={onConfirmQuit}>
              ▤ MAIN MENU
            </button>
          </div>
        </PixelModal>
      );
    }

    default:
      return null;
  }
}
