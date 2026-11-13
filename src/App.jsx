import { useState } from 'react';
import './App.css';
import './styles/features.css';

import { useAudio, useBgmLoop } from './hooks/useAudio';
import { useChessGame } from './hooks/useChessGame';
import { useSavedMatches } from './hooks/useSavedMatches';
import { useMenuWizard } from './hooks/useMenuWizard';
import { useResponsiveLayout, useScrollLock, useScrollTopOnChange } from './hooks/useResponsiveLayout';
import { useSettings } from './hooks/useSettings';
import { useToast } from './hooks/useToast';
import { copyText, downloadText, pgnFileName } from './game/pgnExport';

import { CountdownOverlay } from './components/CountdownOverlay';
import { PromotionModal } from './components/PromotionModal';
import { GameModals } from './components/GameModals';
import { GameOverBar } from './components/GameOverBar';
import { PixelToast } from './components/PixelToast';
import { StartMenuScreen } from './components/StartMenuScreen';
import { GameBoardScreen } from './components/GameBoardScreen';
import { PieceSprite } from './pixelPieces';
import { PixelLogo } from './components/PixelLogo';
import { FxGallery } from './components/FxGallery';

function App() {
  const [activeModal, setActiveModal] = useState(null);
  const [showGallery, setShowGallery] = useState(false);

  const audio = useAudio();
  const { settings, updateSetting, resetSettings, theme } = useSettings();
  const { toast, notify, dismiss: dismissToast } = useToast();
  const chess = useChessGame({ audio, activeModal, setActiveModal, animations: settings.animations, notify });
  const matches = useSavedMatches({ chess, audio, setActiveModal });
  const wizard = useMenuWizard({ chess, matches, audio });
  const { isCompactLayout } = useResponsiveLayout();

  useBgmLoop({
    gameStarted: chess.gameStarted,
    isMuted: audio.isMuted,
    audioCtxRef: audio.audioCtxRef,
    triggerInteractiveAudioContext: audio.triggerInteractiveAudioContext,
  });

  useScrollTopOnChange(chess.gameStarted || chess.isStarting);
  useScrollLock(chess.isStarting || !!activeModal || !!chess.pendingPromotion || showGallery);

  function executeQuitToMenu() {
    chess.quitMatch();
    wizard.setMenuStep('start');
    matches.loadSavedMatchesFromStorage();
    setActiveModal(null);
    audio.play('click');
  }

  async function copyPgn() {
    audio.play('click');
    const ok = await copyText(chess.exportPgn());
    notify(ok ? 'PGN COPIED TO CLIPBOARD' : 'COPY FAILED - TRY DOWNLOAD', ok ? 'success' : 'alert');
  }

  function downloadPgn() {
    audio.play('click');
    const ok = downloadText(chess.exportPgn(), pgnFileName());
    notify(ok ? 'PGN DOWNLOADED' : 'DOWNLOAD FAILED', ok ? 'success' : 'alert');
  }

  const showCheckFlash = chess.kingCheckedAlert && chess.gameStarted && !chess.isGameOver;

  return (
    <div
      className={`app-container pixel-art ${chess.gameStarted ? 'game-active' : ''} ${
        showCheckFlash ? 'screen-flash-active' : ''
      }`}
      onClick={audio.triggerInteractiveAudioContext}
    >
      {showCheckFlash && (
        <div className="screen-flash-overlay" onClick={() => chess.setKingCheckedAlert(false)}>
          <div className="flash-alert-text">CHECK!</div>
        </div>
      )}

      <PixelToast toast={toast} onDismiss={dismissToast} />

      {!chess.gameStarted && (
        <header className="game-header">
          <PixelLogo />
          <div className="header-vs" aria-hidden="true">
            <div className="header-army">
              {['wP', 'wN', 'wB', 'wR', 'wQ'].map((code) => (
                <PieceSprite key={code} code={code} size={30} className="header-army-extra" />
              ))}
              <PieceSprite code="wK" size={44} animated />
            </div>
            <span className="vs-text">VS</span>
            <div className="header-army">
              <PieceSprite code="bK" size={44} animated />
              {['bQ', 'bR', 'bB', 'bN', 'bP'].map((code) => (
                <PieceSprite key={code} code={code} size={30} className="header-army-extra" />
              ))}
            </div>
          </div>
          <div className="header-subtitle"><span className="pixel-diamond" />SELECT STAGE WORLD<span className="pixel-diamond" /></div>
          <button
            type="button"
            className="fx-gallery-open-btn"
            onClick={() => { audio.triggerInteractiveAudioContext(); audio.play('click'); setShowGallery(true); }}
          >
            <span aria-hidden="true">★ </span>FX GALLERY
          </button>
        </header>
      )}

      {chess.gameStarted && (
        <div
          className="top-controls-row"
          style={{
            position: 'fixed',
            top: '12px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 12px',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
            <button
              type="button"
              className="top-menu-trigger-btn top-undo-btn icon-btn-pixel"
              style={{ position: 'static', pointerEvents: 'auto', fontSize: '1.1rem', lineHeight: 1 }}
              onClick={() => chess.undoMove()}
              disabled={!chess.canUndo}
              aria-label="Undo last move"
              title="Undo last move"
            >
              ↶
            </button>
            <button
              type="button"
              className="top-menu-trigger-btn icon-btn-pixel"
              style={{ position: 'static', pointerEvents: 'auto', fontSize: '1.1rem', lineHeight: 1 }}
              onClick={() => { audio.play('click'); setActiveModal('pause_menu'); }}
              disabled={chess.isAnimatingMove || chess.pendingPromotion}
              aria-label="Pause game and open menu"
              title="Pause menu"
            >
              ☰
            </button>
            <button
              type="button"
              className="top-menu-trigger-btn top-redo-btn icon-btn-pixel"
              style={{ position: 'static', pointerEvents: 'auto', fontSize: '1.1rem', lineHeight: 1 }}
              onClick={() => chess.redoMove()}
              disabled={!chess.canRedo}
              aria-label="Redo move"
              title="Redo move"
            >
              ↷
            </button>
            {/* Hints exist only against the CPU on EASY (3) and NORMAL (1). */}
            {chess.hintLimit > 0 && (
              <button
                type="button"
                className={`top-menu-trigger-btn top-hint-btn icon-btn-pixel ${chess.hintLoading ? 'is-loading' : ''}`}
                style={{ position: 'static', pointerEvents: 'auto', lineHeight: 1 }}
                onClick={() => chess.requestHint()}
                disabled={!chess.canHint}
                aria-label={`Show a hint (${chess.hintsLeft} left)`}
                title={`Hint (${chess.hintsLeft} left)`}
              >
                <span aria-hidden="true">{chess.hintLoading ? '…' : '?'}</span>
                <span className="hint-count" aria-hidden="true">{chess.hintsLeft}</span>
              </button>
            )}
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <PixelLogo size="sm" as="div" />
          </div>
        </div>
      )}

      {showGallery && <FxGallery play={audio.play} onClose={() => setShowGallery(false)} />}

      {chess.isStarting && (
        <CountdownOverlay
          countdownValue={chess.countdownValue}
          gameMode={chess.gameMode}
          difficulty={chess.difficulty}
          playerColor={chess.playerColor}
        />
      )}

      {chess.pendingPromotion && (
        <PromotionModal
          color={chess.pendingPromotion.color}
          onSelect={chess.handlePromotionSelection}
          onCancel={chess.cancelPromotion}
        />
      )}

      <GameModals
        activeModal={activeModal}
        isAnimatingMove={chess.isAnimatingMove}
        pendingPromotion={chess.pendingPromotion}
        pendingLoadMatch={matches.pendingLoadMatch}
        pendingDrawOffer={chess.pendingDrawOffer}
        canEndManually={chess.canEndManually}
        gameMode={chess.gameMode}
        settings={settings}
        play={audio.play}
        onClose={() => setActiveModal(null)}
        onOpenModal={setActiveModal}
        onRestart={chess.restartMatch}
        onSave={matches.saveGame}
        onConfirmOverwrite={matches.confirmOverwriteOldest}
        onConfirmLoad={matches.confirmLoadMatch}
        onConfirmQuit={executeQuitToMenu}
        onConfirmDelete={matches.confirmDeleteSlot}
        onConfirmResign={chess.resign}
        onOfferDraw={chess.offerDraw}
        onAnswerDraw={chess.respondToDraw}
        onCopyPgn={copyPgn}
        onDownloadPgn={downloadPgn}
        onChangeSetting={updateSetting}
        onResetSettings={resetSettings}
      />

      {!chess.gameStarted ? (
        <StartMenuScreen
          isCompactLayout={isCompactLayout}
          isMuted={audio.isMuted}
          onToggleAudio={audio.toggleMute}
          onOpenSettings={() => { audio.triggerInteractiveAudioContext(); audio.play('click'); setActiveModal('settings'); }}
          menuStep={wizard.menuStep}
          wizardTotalSteps={wizard.wizardTotalSteps}
          wizardCurrentStepNumber={wizard.wizardCurrentStepNumber}
          gameMode={chess.gameMode}
          difficulty={chess.difficulty}
          timeMode={chess.timeMode}
          colorChoice={chess.colorChoice}
          savedMatches={matches.savedMatches}
          onNewGame={wizard.chooseNewGame}
          onLoadGame={wizard.chooseLoadGame}
          onResume={matches.requestLoadMatch}
          onDelete={matches.triggerDeletePrompt}
          onSelectMode={(mode) => { audio.play('click'); chess.setGameMode(mode); }}
          onSelectDifficulty={(diff) => { audio.play('click'); chess.setDifficulty(diff); }}
          onSelectColor={(color) => { audio.play('click'); chess.setColorChoice(color); }}
          onSelectTime={(time) => { audio.play('click'); chess.setTimeMode(time); }}
          onNextStep={wizard.goToNextMenuStep}
          onPrevStep={wizard.goToPrevMenuStep}
          onStartGame={chess.startGame}
        />
      ) : (
        <div className={`game-screen-wrap ${chess.showGameOver ? 'has-game-over-bar' : ''}`}>
          <GameBoardScreen
            boardWrapperRef={chess.boardWrapperRef}
            boardInnerRef={chess.boardInnerRef}
            canvasRef={chess.canvasRef}
            boardWidth={chess.boardWidth}
            game={chess.game}
            onDrop={chess.onDrop}
            onSquareClick={chess.onSquareClick}
            onPieceDragBegin={chess.onPieceDragBegin}
            captured={chess.captured}
            checkmateFx={chess.checkmateFx}
            isGameOver={chess.isGameOver}
            isDraggablePiece={chess.isDraggablePiece}
            botThinking={chess.botThinking}
            customSquareStyles={chess.customSquareStyles}
            displayPosition={chess.displayPosition}
            gameStatus={chess.gameStatus}
            gameMode={chess.gameMode}
            timeMode={chess.timeMode}
            whiteTime={chess.whiteTime}
            blackTime={chess.blackTime}
            formatTime={chess.formatTime}
            moveHistory={chess.moveHistory}
            lastMove={chess.lastMove}
            isCompactLayout={isCompactLayout}
            boardOrientation={chess.boardOrientation}
            playerColor={chess.playerColor}
            theme={theme}
            animations={settings.animations}
            onJumpToPly={chess.isGameOver ? chess.jumpToPly : undefined}
            activePly={chess.isReviewing ? chess.reviewPly : undefined}
            matchNotes={chess.matchNotes}
          >
            {/* Game over is a bar, never a modal: in the side column on
                desktop, docked to the bottom of the screen on phones. */}
            {chess.showGameOver && (
              <GameOverBar
                gameStatus={chess.gameStatus}
                winner={chess.winner}
                isReviewing={chess.isReviewing}
                reviewPly={chess.reviewPly}
                totalPlies={chess.totalPlies}
                onRematch={chess.restartMatch}
                onViewBoard={() => { audio.play('click'); chess.startReview(); }}
                onExit={executeQuitToMenu}
                onStep={chess.stepReview}
                onJump={chess.jumpToPly}
                onExitReview={chess.exitReview}
                onCopyPgn={copyPgn}
                onDownloadPgn={downloadPgn}
              />
            )}
          </GameBoardScreen>
        </div>
      )}
    </div>
  );
}

export default App;
