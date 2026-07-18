import React from 'react';
import {
  AudioToggleButton,
  StartSelectionSection,
  LoadGameSection,
  ModeSelectionSection,
  DifficultySelectionSection,
  TimeSelectionSection,
  SavedMatchesPanel,
} from './MenuSections';

export function StartMenuScreen({
  isCompactLayout,
  isMuted,
  onToggleAudio,
  menuStep,
  wizardTotalSteps,
  wizardCurrentStepNumber,
  gameMode,
  difficulty,
  timeMode,
  savedMatches,
  onNewGame,
  onLoadGame,
  onResume,
  onDelete,
  onSelectMode,
  onSelectDifficulty,
  onSelectTime,
  onNextStep,
  onPrevStep,
  onStartGame,
}) {
  const canGoNext = !((menuStep === 'mode' && !gameMode) || (menuStep === 'difficulty' && !difficulty));
  const canStart = !!gameMode && !(gameMode === 'bot' && !difficulty) && !!timeMode;
  const audioToggleButton = <AudioToggleButton isMuted={isMuted} onToggle={onToggleAudio} />;

  if (!isCompactLayout) {
    return (
      <div className="menu-wrapper-layout">
        <div className="menu-container bento-pixel">
          <div className="menu-header-row">
            <h2 className="section-pixel-title">[CONFIG MODULE]</h2>
            {audioToggleButton}
          </div>

          <ModeSelectionSection gameMode={gameMode} onSelect={onSelectMode} />
          {gameMode === 'bot' && <DifficultySelectionSection difficulty={difficulty} onSelect={onSelectDifficulty} />}
          <TimeSelectionSection gameMode={gameMode} timeMode={timeMode} onSelect={onSelectTime} />

          <button className="start-pixel-btn" onClick={onStartGame} disabled={!canStart}>
            PUSH START BUTTON
          </button>
        </div>

        <SavedMatchesPanel savedMatches={savedMatches} onResume={onResume} onDelete={onDelete} />
      </div>
    );
  }

  return (
    <div className="menu-wrapper-layout compact-wizard-layout">
      <div className="menu-container bento-pixel wizard-card">
        <div className="menu-header-row">
          <h2 className="section-pixel-title">[CONFIG MODULE]</h2>
          {audioToggleButton}
        </div>

        {menuStep !== 'load' && (
          <div className="wizard-progress-track">
            {Array.from({ length: wizardTotalSteps }).map((_, idx) => {
              const stepNum = idx + 1;
              const dotState =
                stepNum < wizardCurrentStepNumber ? 'done' : stepNum === wizardCurrentStepNumber ? 'active' : 'pending';
              return <span key={stepNum} className={`wizard-progress-dot ${dotState}`} />;
            })}
          </div>
        )}

        <div className="wizard-step-body">
          {menuStep === 'start' && <StartSelectionSection onNewGame={onNewGame} onLoadGame={onLoadGame} />}
          {menuStep === 'load' && <LoadGameSection savedMatches={savedMatches} onResume={onResume} onDelete={onDelete} />}
          {menuStep === 'mode' && <ModeSelectionSection gameMode={gameMode} onSelect={onSelectMode} />}
          {menuStep === 'difficulty' && gameMode === 'bot' && (
            <DifficultySelectionSection difficulty={difficulty} onSelect={onSelectDifficulty} />
          )}
          {menuStep === 'time' && <TimeSelectionSection gameMode={gameMode} timeMode={timeMode} onSelect={onSelectTime} />}
        </div>

        {menuStep !== 'start' && (
          <div className="wizard-nav-row">
            <button type="button" className="wizard-back-btn" onClick={onPrevStep}>
              ◀ BACK
            </button>
            {menuStep === 'load' ? null : menuStep !== 'time' ? (
              <button type="button" className="wizard-next-btn" onClick={onNextStep} disabled={!canGoNext}>
                NEXT ▶
              </button>
            ) : (
              <button type="button" className="start-pixel-btn" onClick={onStartGame} disabled={!canStart}>
                PUSH START BUTTON
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}