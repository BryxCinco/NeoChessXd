import { useState } from 'react';

// ── MOBILE / TABLET STEP WIZARD (NEW/LOAD → MODE → DIFFICULTY → TIME) ──
// 'start' = step 1, pick NEW GAME or LOAD GAME
// 'load'  = branch off 'start', shows saved match slots to resume
// 'mode'  = step 2, pick AI (bot) or LOCAL (1v1) — only via NEW GAME
// 'difficulty' = step 3, ONLY when gameMode === 'bot'
// 'time'  = final step, pick the time limit, then PUSH START
export function useMenuWizard({ chess, matches, audio }) {
  const [menuStep, setMenuStep] = useState('start');

  function goToNextMenuStep() {
    audio.play('click');
    if (menuStep === 'mode') {
      setMenuStep(chess.gameMode === 'bot' ? 'difficulty' : 'time');
    } else if (menuStep === 'difficulty') {
      setMenuStep('time');
    }
  }

  function goToPrevMenuStep() {
    audio.play('click');
    if (menuStep === 'time') {
      setMenuStep(chess.gameMode === 'bot' ? 'difficulty' : 'mode');
    } else if (menuStep === 'difficulty') {
      setMenuStep('mode');
    } else if (menuStep === 'mode' || menuStep === 'load') {
      setMenuStep('start');
    }
  }

  // Landing choice: begin a fresh NEW GAME config, or jump straight to LOAD GAME
  function chooseNewGame() {
    audio.play('click');
    chess.setGameMode(null);
    chess.setDifficulty(null);
    chess.setTimeMode(null);
    setMenuStep('mode');
  }

  function chooseLoadGame() {
    audio.play('click');
    matches.loadSavedMatchesFromStorage();
    setMenuStep('load');
  }

  // Wizard progress dots (NEW GAME path only): start → mode → [difficulty] → time
  // 3 steps for LOCAL (start → mode → time), 4 for BOT (start → mode → difficulty → time)
  const wizardTotalSteps = chess.gameMode === 'bot' ? 4 : 3;
  const wizardCurrentStepNumber =
    menuStep === 'start' ? 1 : menuStep === 'mode' ? 2 : menuStep === 'difficulty' ? 3 : wizardTotalSteps;

  return {
    menuStep,
    setMenuStep,
    goToNextMenuStep,
    goToPrevMenuStep,
    chooseNewGame,
    chooseLoadGame,
    wizardTotalSteps,
    wizardCurrentStepNumber,
  };
}