import { useState } from 'react';

// ── MOBILE / TABLET STEP WIZARD ──
// 'start'      = step 1, pick NEW GAME or LOAD GAME
// 'load'       = branch off 'start', shows saved match slots to resume
// 'mode'       = step 2, pick AI (bot) or LOCAL (1v1) — only via NEW GAME
// 'difficulty' = step 3, ONLY when gameMode === 'bot'
// 'color'      = step 4, ONLY when gameMode === 'bot' (play as RED / BLUE / RANDOM)
// 'time'       = final step, pick the time limit, then PUSH START
const BOT_STEPS = ['start', 'mode', 'difficulty', 'color', 'time'];
const LOCAL_STEPS = ['start', 'mode', 'time'];

export function useMenuWizard({ chess, matches, audio }) {
  const [menuStep, setMenuStep] = useState('start');
  const steps = chess.gameMode === 'bot' ? BOT_STEPS : LOCAL_STEPS;

  function goToNextMenuStep() {
    audio.play('click');
    const index = steps.indexOf(menuStep);
    // 'start' moves on through NEW GAME / LOAD GAME, not through NEXT.
    if (index > 0 && index < steps.length - 1) setMenuStep(steps[index + 1]);
  }

  function goToPrevMenuStep() {
    audio.play('click');
    if (menuStep === 'load') {
      setMenuStep('start');
      return;
    }
    const index = steps.indexOf(menuStep);
    if (index > 0) setMenuStep(steps[index - 1]);
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

  // Wizard progress dots (NEW GAME path only): 3 steps for LOCAL, 5 for BOT.
  const wizardTotalSteps = steps.length;
  const stepIndex = steps.indexOf(menuStep);
  const wizardCurrentStepNumber = stepIndex >= 0 ? stepIndex + 1 : wizardTotalSteps;

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
