import { useState } from 'react';

const STORAGE_KEY = 'neochess_8bit_matches';

// Manages the named save-slot list (distinct from the single auto-saved
// "active session" that useChessGame restores on refresh). `chess` is the
// object returned by useChessGame, `audio` is { play, triggerInteractiveAudioContext }.
export function useSavedMatches({ chess, audio, setActiveModal }) {
  const [savedMatches, setSavedMatches] = useState(() => {
    const matches = localStorage.getItem(STORAGE_KEY);
    if (!matches) return [];
    try {
      return JSON.parse(matches);
    } catch (e) {
      return [];
    }
  });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  function loadSavedMatchesFromStorage() {
    const matches = localStorage.getItem(STORAGE_KEY);
    if (matches) {
      try {
        setSavedMatches(JSON.parse(matches));
      } catch (e) {
        setSavedMatches([]);
      }
    }
  }

  function saveGame() {
    const formattedDate = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const newMatchSave = {
      id: 'match_' + Date.now(),
      date: formattedDate,
      fen: chess.game.fen(),
      gameMode: chess.gameMode,
      difficulty: chess.difficulty,
      timeMode: chess.timeMode,
      gameStatus: chess.gameStatus,
      whiteTime: chess.whiteTime,
      blackTime: chess.blackTime,
    };

    const updatedMatches = [newMatchSave, ...savedMatches];
    setSavedMatches(updatedMatches);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMatches));

    audio.play('save');
    setActiveModal('save_success');
  }

  function resumeMatch(match) {
    try {
      audio.triggerInteractiveAudioContext();
      audio.play('success');
      chess.loadMatchState(match);
    } catch (error) {
      alert('FAIL TO READ SAVED BLOCK.');
    }
  }

  function triggerDeletePrompt(id, e) {
    e.stopPropagation();
    audio.triggerInteractiveAudioContext();
    audio.play('click');
    setPendingDeleteId(id);
    setActiveModal('confirm_delete');
  }

  function confirmDeleteSlot() {
    if (pendingDeleteId) {
      const updated = savedMatches.filter((m) => m.id !== pendingDeleteId);
      setSavedMatches(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      audio.play('click');
    }
    setActiveModal(null);
    setPendingDeleteId(null);
  }

  return {
    savedMatches,
    loadSavedMatchesFromStorage,
    saveGame,
    resumeMatch,
    triggerDeletePrompt,
    confirmDeleteSlot,
  };
}