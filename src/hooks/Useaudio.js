import { useState, useRef, useEffect } from 'react';
import { playRetroSound, startRetroBGM } from '../audioEngine';

// Owns the mute toggle, the shared AudioContext ref, and click/effect
// playback. Takes no dependency on match state so it can be constructed
// before useChessGame (which itself needs `play`/`triggerInteractiveAudioContext`).
// Pair with useBgmLoop() once `gameStarted` is known, further down in the tree.
export function useAudio() {
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef(null);

  function triggerInteractiveAudioContext() {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }

  function play(sound) {
    playRetroSound(sound, audioCtxRef);
  }

  return { isMuted, setIsMuted, audioCtxRef, triggerInteractiveAudioContext, play };
}

// ── 8-BIT PROCEDURAL CHIP-TUNE BGM LOOP ENGINE ──
// Plays only on the menu screens (never once a match has started) and only
// while unmuted.
export function useBgmLoop({ gameStarted, isMuted, audioCtxRef, triggerInteractiveAudioContext }) {
  const bgmIntervalRef = useRef(null);

  function stopRetroBGM() {
    if (bgmIntervalRef.current) {
      clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
    if (window.clearRetroBGM) {
      window.clearRetroBGM();
    }
  }

  useEffect(() => {
    if (!gameStarted && !isMuted) {
      triggerInteractiveAudioContext();
      if (!bgmIntervalRef.current) {
        bgmIntervalRef.current = startRetroBGM(audioCtxRef);
      }
    } else {
      stopRetroBGM();
    }

    return () => stopRetroBGM();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, isMuted]);
}