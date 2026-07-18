import React, { useState } from 'react';
import './App.css';

import { useAudio, useBgmLoop } from './hooks/useAudio';
import { useChessGame } from './hooks/useChessGame';
import { useSavedMatches } from './hooks/useSavedMatches';
import { useMenuWizard } from './hooks/useMenuWizard';
import { useResponsiveLayout, useScrollLock } from './hooks/useResponsiveLayout';

import { CountdownOverlay } from './components/CountdownOverlay';
import { PromotionModal } from './components/PromotionModal';
import { GameModals } from './components/GameModals';
import { StartMenuScreen } from './components/StartMenuScreen';
import { GameBoardScreen } from './components/GameBoardScreen';

function App() {
  const [activeModal, setActiveModal] = useState(null);

  const audio = useAudio();
  const chess = useChessGame({ audio, setActiveModal });
  const matches = useSavedMatches({ chess, audio, setActiveModal });
  const wizard = useMenuWizard({ chess, matches, audio });
  const { isCompactLayout } = useResponsiveLayout();

  useBgmLoop({
    gameStarted: chess.gameStarted,
    isMuted: audio.isMuted,
    audioCtxRef: audio.audioCtxRef,
    triggerInteractiveAudioContext: audio.triggerInteractiveAudioContext,
  });

  useScrollLock(chess.isStarting || !!activeModal || !!chess.pendingPromotion);

  function executeQuitToMenu() {
    chess.quitMatch();
    wizard.setMenuStep('start');
    matches.loadSavedMatchesFromStorage();
    setActiveModal(null);
    audio.play('click');
  }

  return (
    <div
      className={`app-container pixel-art ${chess.gameStarted ? 'game-active' : ''} ${
        chess.kingCheckedAlert && chess.gameStarted && !chess.game.isGameOver() ? 'screen-flash-active' : ''
      }`}
      onClick={audio.triggerInteractiveAudioContext}
    >
      {chess.kingCheckedAlert && chess.gameStarted && !chess.game.isGameOver() && (
        <div className="screen-flash-overlay" onClick={() => chess.setKingCheckedAlert(false)}>
          <div className="flash-alert-text">CHECK!</div>
        </div>
      )}

      {!chess.gameStarted && (
        <header className="game-header">
          <h1 className="pixel-title">NEO <span>CHESS DX</span></h1>
          <div className="header-subtitle"><span className="pixel-diamond" />SELECT STAGE WORLD<span className="pixel-diamond" /></div>
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
              aria-label="Menu"
              title="Menu"
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
          </div>

          <h1
            className="pixel-title pixel-title-mini"
            style={{ pointerEvents: 'auto', margin: 0, fontSize: '1rem' }}
          >
            NEO <span>CHESS DX</span>
          </h1>
        </div>
      )}

      {chess.isStarting && <CountdownOverlay countdownValue={chess.countdownValue} />}

      {chess.pendingPromotion && <PromotionModal onSelect={chess.handlePromotionSelection} />}

      <GameModals
        activeModal={activeModal}
        gameStatus={chess.gameStatus}
        isAnimatingMove={chess.isAnimatingMove}
        pendingPromotion={chess.pendingPromotion}
        play={audio.play}
        onClose={() => setActiveModal(null)}
        onOpenQuitConfirm={() => setActiveModal('confirm_quit')}
        onRestart={chess.restartMatch}
        onSave={matches.saveGame}
        onConfirmQuit={executeQuitToMenu}
        onConfirmDelete={matches.confirmDeleteSlot}
      />

      {!chess.gameStarted ? (
        <StartMenuScreen
          isCompactLayout={isCompactLayout}
          isMuted={audio.isMuted}
          onToggleAudio={() => { audio.setIsMuted(!audio.isMuted); audio.triggerInteractiveAudioContext(); }}
          menuStep={wizard.menuStep}
          wizardTotalSteps={wizard.wizardTotalSteps}
          wizardCurrentStepNumber={wizard.wizardCurrentStepNumber}
          gameMode={chess.gameMode}
          difficulty={chess.difficulty}
          timeMode={chess.timeMode}
          savedMatches={matches.savedMatches}
          onNewGame={wizard.chooseNewGame}
          onLoadGame={wizard.chooseLoadGame}
          onResume={matches.resumeMatch}
          onDelete={matches.triggerDeletePrompt}
          onSelectMode={(mode) => { audio.play('click'); chess.setGameMode(mode); }}
          onSelectDifficulty={(diff) => { audio.play('click'); chess.setDifficulty(diff); }}
          onSelectTime={(time) => { audio.play('click'); chess.setTimeMode(time); }}
          onNextStep={wizard.goToNextMenuStep}
          onPrevStep={wizard.goToPrevMenuStep}
          onStartGame={chess.startGame}
        />
      ) : (
        <div style={{ paddingTop: '76px' }}>
          <GameBoardScreen
            boardWrapperRef={chess.boardWrapperRef}
            boardInnerRef={chess.boardInnerRef}
            canvasRef={chess.canvasRef}
            boardWidth={chess.boardWidth}
            game={chess.game}
            onDrop={chess.onDrop}
            customSquareStyles={chess.customSquareStyles}
            gameStatus={chess.gameStatus}
            gameMode={chess.gameMode}
            timeMode={chess.timeMode}
            whiteTime={chess.whiteTime}
            blackTime={chess.blackTime}
            formatTime={chess.formatTime}
            moveHistory={chess.moveHistory}
            lastMove={chess.lastMove}
            isCompactLayout={isCompactLayout}
          />
        </div>
      )}
    </div>
  );
}

export default App;