import { useRef, useCallback, useEffect } from 'react';
import { pickCaptureEffect, pickEffectFor } from './effects/index.js';

// Runs the canvas effects from the registry (src/effects) on the board's
// overlay canvas. One requestAnimationFrame loop draws every running effect;
// it stops by itself when nothing is moving.
//
// `options` are the player's effect settings:
//   { effectsEnabled, disabledEffects, captureEffect, effectIntensity }
export function usePixelAnimation(options = {}) {
  const canvasRef = useRef(null);
  const animationsRef = useRef([]); // { effect, instance, start, onComplete, committed, frozen }
  const frameRef = useRef(null);
  const lastFrameRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // The callbacks below are created once (stable identities for the board),
  // so they reach the loop through this ref.
  const loopRef = useRef(null);
  loopRef.current = updateAndRender;

  // Centre and width of a board square, in canvas CSS pixels.
  function locate(square) {
    const canvas = canvasRef.current;
    const squareEl = canvas && canvas.parentElement && canvas.parentElement.querySelector(`[data-square="${square}"]`);
    if (!squareEl) return null;
    const canvasRect = canvas.getBoundingClientRect();
    const rect = squareEl.getBoundingClientRect();
    return {
      x: rect.left - canvasRect.left + rect.width / 2,
      y: rect.top - canvasRect.top + rect.height / 2,
      size: rect.width,
    };
  }

  // The canvas covers the whole board frame (padding included), so drawing
  // is clipped to the 8x8 board: nothing spills onto the frame or outside it.
  function boardClip() {
    const canvas = canvasRef.current;
    const boardEl = canvas && canvas.parentElement && canvas.parentElement.querySelector('.board-container-pixel');
    if (!boardEl) return null;
    const canvasRect = canvas.getBoundingClientRect();
    const rect = boardEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: rect.left - canvasRect.left, y: rect.top - canvasRect.top, width: rect.width, height: rect.height };
  }

  function start(effect, params, onComplete) {
    const intensity = Math.max(0, Math.min(100, Number(optionsRef.current.effectIntensity ?? 100))) / 100;
    const instance = effect.create({ intensity, ...params });
    animationsRef.current.push({ effect, instance, start: undefined, onComplete, committed: false, frozen: false });
    if (!frameRef.current) frameRef.current = requestAnimationFrame((now) => loopRef.current(now));
  }

  // Destroys the captured piece's own sprite with a capture effect chosen
  // from the player's settings. Returns the sound to play (or null when no
  // effect ran — the callback has then already been called).
  //   extra.from       square the capturing piece came from
  //   extra.onEffect   told which effect was picked
  const triggerElimination = useCallback((square, victimCode, attackerType, attackerColor, onComplete, extra = {}) => {
    const at = locate(square);
    const effect = at && pickCaptureEffect(attackerType, optionsRef.current);
    if (!effect) {
      if (onComplete) onComplete();
      return null;
    }
    const from = extra.from ? locate(extra.from) : null;
    start(
      effect,
      {
        ...at,
        code: victimCode,
        attackerColor,
        attackerCode: `${attackerColor}${String(attackerType).toUpperCase()}`,
        from: from && { x: from.x, y: from.y },
      },
      onComplete
    );
    if (extra.onEffect) extra.onEffect(effect);
    return effect.sound;
  }, []);

  // Plays the effect registered for another trigger ('checkmate',
  // 'promotion', ...) on a square. Returns the effect's id, or null.
  const triggerEffect = useCallback((trigger, square, onComplete = null, params = {}) => {
    const at = locate(square);
    const effect = at && pickEffectFor(trigger, optionsRef.current);
    if (!effect) {
      if (onComplete) onComplete();
      return null;
    }
    start(effect, { ...at, ...params }, onComplete);
    return effect.id;
  }, []);

  // Kept for the checkmate cage: triggerCaptureAnimation(square, cb, 'cage').
  const triggerCaptureAnimation = useCallback(
    (square, onComplete, customType = null) => {
      if (customType === 'cage') return triggerEffect('checkmate', square, onComplete) && 'cage';
      if (onComplete) onComplete();
      return null;
    },
    [triggerEffect]
  );

  function updateAndRender(now) {
    const canvas = canvasRef.current;
    if (!canvas) {
      frameRef.current = null;
      return;
    }

    // Cap the effects at ~60fps: on 90/120Hz phones this halves the work.
    if (now - lastFrameRef.current < 15) {
      frameRef.current = requestAnimationFrame((t) => loopRef.current(t));
      return;
    }
    lastFrameRef.current = now;

    const ctx = canvas.getContext('2d');
    // The canvas is sized in device pixels (crisp on retina); draw in CSS px.
    const dpr = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Whatever happens below, the loop's bookkeeping is settled in the
    // finally block: a broken effect must never leave the runner thinking it
    // is still running (it would never start again, and its last frame
    // would stay stuck on the board).
    frameRef.current = null;
    const still = [];
    try {
      const clip = boardClip();
      ctx.save();
      if (clip) {
        ctx.beginPath();
        ctx.rect(clip.x, clip.y, clip.width, clip.height);
        ctx.clip();
      }
      try {
        for (const anim of animationsRef.current) {
          if (anim.start === undefined) anim.start = now;
          const elapsed = now - anim.start;
          const { duration, commitAt, persist } = anim.effect;

          let failed = false;
          try {
            anim.instance.draw(ctx, Math.min(elapsed, duration));
          } catch (error) {
            failed = true; // drop just this effect; the move still lands below
            console.error(`Effect "${anim.effect.id}" failed:`, error);
          }

          // the game carries on (the move lands) once the effect says so
          if (!anim.committed && (failed || elapsed >= commitAt)) {
            anim.committed = true;
            if (anim.onComplete) anim.onComplete();
          }

          if (!failed && elapsed < duration) {
            still.push(anim);
          } else if (!failed && persist) {
            anim.frozen = true; // stays drawn until clearAnimations()
            still.push(anim);
          } else {
            anim.instance.cleanup();
          }
        }
      } finally {
        ctx.restore();
      }
    } finally {
      animationsRef.current = still;
      const running = still.some((a) => !a.frozen);
      if (running) {
        frameRef.current = requestAnimationFrame((t) => loopRef.current(t));
      } else {
        // Nothing is moving any more. Wipe the last frame of the effects
        // that just ended; only frozen ones (the checkmate cage) are drawn
        // again, so no stray particles are left next to them.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (still.length > 0) {
          const clip = boardClip();
          ctx.save();
          if (clip) {
            ctx.beginPath();
            ctx.rect(clip.x, clip.y, clip.width, clip.height);
            ctx.clip();
          }
          try {
            for (const anim of still) anim.instance.draw(ctx, anim.effect.duration);
          } finally {
            ctx.restore();
          }
        }
      }
    }
  }

  const stopAll = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    for (const anim of animationsRef.current) anim.instance.cleanup();
    animationsRef.current = [];
  }, []);

  // Wipes every effect (including a frozen cage) — used on restart / quit.
  const clearAnimations = useCallback(() => {
    stopAll();
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [stopAll]);

  useEffect(() => stopAll, [stopAll]);

  return { canvasRef, triggerCaptureAnimation, triggerElimination, triggerEffect, clearAnimations };
}
