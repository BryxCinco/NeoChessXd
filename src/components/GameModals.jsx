import { PixelModal } from './PixelModal';
import { SettingsModal } from './SettingsModal';
import { MAX_SAVE_SLOTS } from '../hooks/useSavedMatches';

const COLOR_NAME = { w: 'RED', b: 'BLUE' };

// Renders whichever modal matches `activeModal`, all built on <PixelModal>.
// The pause-menu actions live here so App.jsx just wires up the callbacks.
// (Game over is NOT a modal: see <GameOverBar>, which leaves the board visible.)
export function GameModals({
  activeModal,
  isAnimatingMove,
  pendingPromotion,
  pendingLoadMatch,
  pendingDrawOffer,
  canEndManually,
  gameMode,
  settings,
  play,
  onClose,
  onOpenModal,
  onRestart,
  onSave,
  onConfirmOverwrite,
  onConfirmLoad,
  onConfirmQuit,
  onConfirmDelete,
  onConfirmResign,
  onOfferDraw,
  onAnswerDraw,
  onCopyPgn,
  onDownloadPgn,
  onChangeSetting,
  onResetSettings,
  onToggleEffect,
}) {
  if (!activeModal) return null;
  const disabled = !!(isAnimatingMove || pendingPromotion);
  const close = () => { play('click'); onClose(); };
  const open = (name) => { play('click'); onOpenModal(name); };

  switch (activeModal) {
    case 'pause_menu':
      return (
        <PixelModal title="[PAUSE MENU]" onCancel={close}>
          <div className="btn-group-pixel pause-menu-grid">
            <button type="button" className="pixel-action-btn action-continue pause-wide" onClick={close}>
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
              className="pixel-action-btn action-draw"
              onClick={() => { play('click'); onOfferDraw(); }}
              disabled={disabled || !canEndManually}
            >
              ½ OFFER DRAW
            </button>
            <button
              type="button"
              className="pixel-action-btn action-resign"
              onClick={() => open('confirm_resign')}
              disabled={disabled || !canEndManually}
            >
              ⚑ RESIGN
            </button>
            <button type="button" className="pixel-action-btn action-pgn" onClick={onCopyPgn}>
              ⧉ COPY PGN
            </button>
            <button type="button" className="pixel-action-btn action-pgn" onClick={onDownloadPgn}>
              ⇩ DOWNLOAD PGN
            </button>
            <button type="button" className="pixel-action-btn action-settings" onClick={() => open('settings')}>
              ⚙ SETTINGS
            </button>
            <button
              type="button"
              className="pixel-action-btn action-forfeit"
              onClick={() => open('confirm_quit')}
              disabled={disabled}
            >
              ⏻ OUT
            </button>
          </div>
        </PixelModal>
      );

    case 'settings':
      return (
        <SettingsModal settings={settings} onChange={onChangeSetting} onToggleEffect={onToggleEffect} onReset={onResetSettings} onClose={close} />
      );

    case 'confirm_resign':
      return (
        <PixelModal
          title="[RESIGN]"
          tone="alert"
          message={gameMode === 'bot' ? 'GIVE UP THIS MATCH? THE CPU WINS.' : 'GIVE UP THIS MATCH? YOUR OPPONENT WINS.'}
          confirmLabel="YES (RESIGN)"
          confirmVariant="danger"
          onConfirm={onConfirmResign}
          cancelLabel="NO (KEEP PLAYING)"
          onCancel={close}
        />
      );

    case 'draw_offer':
      return (
        <PixelModal
          title="[DRAW OFFER]"
          message={`${COLOR_NAME[pendingDrawOffer] || 'YOUR OPPONENT'} OFFERS A DRAW. ${
            COLOR_NAME[pendingDrawOffer === 'w' ? 'b' : 'w']
          }, DO YOU ACCEPT?`}
          confirmLabel="ACCEPT DRAW"
          onConfirm={() => onAnswerDraw(true)}
          cancelLabel="DECLINE"
          onCancel={() => onAnswerDraw(false)}
        />
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

    default:
      return null;
  }
}
