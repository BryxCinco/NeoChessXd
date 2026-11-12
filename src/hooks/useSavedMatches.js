import { useState } from 'react';

export const STORAGE_KEY = 'neochess_8bit_matches';
// Save slots are capped; saving past the cap asks to overwrite the oldest.
export const MAX_SAVE_SLOTS = 10;

// Reads the slot list. Blocked storage (private mode) or corrupt data just
// means "no saves" — it must never crash the menu.
function readSlots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Returns true when the list was written. Fails (false) when the storage is
// full (QuotaExceededError) or blocked (SecurityError).
function writeSlots(slots) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    return true;
  } catch {
    return false;
  }
}

// Manages the named save-slot list (distinct from the single auto-saved
// "active session" that useChessGame restores on refresh). `chess` is the
// object returned by useChessGame, `audio` is { play, triggerInteractiveAudioContext }.
export function useSavedMatches({ chess, audio, setActiveModal }) {
  // Newest first, so the oldest slot is always the last one.
  const [savedMatches, setSavedMatches] = useState(readSlots);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingLoadMatch, setPendingLoadMatch] = useState(null);

  function loadSavedMatchesFromStorage() {
    setSavedMatches(readSlots());
  }

  // Saves the current game into a new slot. Returns true on success.
  // With every slot taken it does NOT save: it opens the overwrite warning
  // and returns false, unless called with { overwriteOldest: true }.
  function saveGame({ overwriteOldest = false } = {}) {
    if (savedMatches.length >= MAX_SAVE_SLOTS && !overwriteOldest) {
      audio.play('click');
      setActiveModal('confirm_overwrite');
      return false;
    }

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
      pgn: chess.game.pgn(),
      fen: chess.game.fen(),
      gameMode: chess.gameMode,
      difficulty: chess.difficulty,
      timeMode: chess.timeMode,
      gameStatus: chess.gameStatus,
      whiteTime: chess.whiteTime,
      blackTime: chess.blackTime,
      timeoutLoser: chess.timeoutLoser,
      // Which side the human plays vs the CPU, and how the game ended /
      // what was logged, so a loaded match picks up exactly where it stopped.
      playerColor: chess.playerColor,
      manualEnd: chess.manualEnd,
      matchNotes: chess.matchNotes,
      hintsUsed: chess.hintsUsed,
    };

    // Keep the newest (cap - 1) slots, which drops the oldest when full.
    const updatedMatches = [newMatchSave, ...savedMatches.slice(0, MAX_SAVE_SLOTS - 1)];
    if (!writeSlots(updatedMatches)) {
      setActiveModal('save_failed');
      return false;
    }

    setSavedMatches(updatedMatches);
    audio.play('save');
    setActiveModal('save_success');
    return true;
  }

  function confirmOverwriteOldest() {
    return saveGame({ overwriteOldest: true });
  }

  // Clicking a slot asks first; confirmLoadMatch() does the actual load.
  function requestLoadMatch(match) {
    audio.triggerInteractiveAudioContext();
    audio.play('click');
    setPendingLoadMatch(match);
    setActiveModal('confirm_load');
  }

  // Returns true when the match was loaded.
  function resumeMatch(match) {
    try {
      audio.triggerInteractiveAudioContext();
      chess.loadMatchState(match); // closes the modal itself
      audio.play('success');
      return true;
    } catch {
      setActiveModal('load_failed');
      return false;
    }
  }

  function confirmLoadMatch() {
    const match = pendingLoadMatch;
    setPendingLoadMatch(null);
    if (!match) {
      setActiveModal(null);
      return false;
    }
    return resumeMatch(match);
  }

  function triggerDeletePrompt(id, e) {
    if (e) e.stopPropagation();
    audio.triggerInteractiveAudioContext();
    audio.play('click');
    setPendingDeleteId(id);
    setActiveModal('confirm_delete');
  }

  function confirmDeleteSlot() {
    if (pendingDeleteId) {
      const updated = savedMatches.filter((m) => m.id !== pendingDeleteId);
      setSavedMatches(updated);
      writeSlots(updated);
      audio.play('click');
    }
    setActiveModal(null);
    setPendingDeleteId(null);
  }

  return {
    savedMatches,
    pendingLoadMatch,
    loadSavedMatchesFromStorage,
    saveGame,
    confirmOverwriteOldest,
    requestLoadMatch,
    confirmLoadMatch,
    resumeMatch,
    triggerDeletePrompt,
    confirmDeleteSlot,
  };
}
