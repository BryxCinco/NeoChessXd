import { defineEffect, registerEffect } from './effectRegistry.js';
import { createBase, makeEffect, drawSprite, drawSpriteT, spawn, pixelRing, clamp01, easeOut, rand } from './fxKit.js';

// ── SOUL EXTRACTION ──
// The body collapses while a glowing wisp in the piece's own colour (red
// soul for red pieces, blue for blue) rises out of it, sways upward and
// fades away.   ~1000 ms
const SOUL = {
  w: { tint: 'soulRed', colors: ['#ffffff', '#ff8a9a', '#ff3b55'] },
  b: { tint: 'soulBlue', colors: ['#ffffff', '#9ad4ff', '#3b9bff'] },
};
const RISE_FROM = 6;

function build(opts) {
  const fx = createBase(opts);
  const { u, size, code } = fx;
  const soul = SOUL[code[0]] || SOUL.w;

  // where the wisp is at frame f
  const wisp = (f) => {
    const s = clamp01((f - RISE_FROM) / 50);
    return {
      s,
      dx: Math.sin(f * 0.3) * 1.6 * u * s,
      dy: -easeOut(s) * size * 1.7,
      alpha: s < 0.15 ? (s / 0.15) * 0.85 : 0.85 * (1 - clamp01((s - 0.55) / 0.45)),
    };
  };

  return makeEffect(fx, 60, (f) => {
    if (f < RISE_FROM || f > 48) return;
    const { dx, dy } = wisp(f);
    spawn(fx, {
      x: fx.x + dx + rand(-3, 3) * u,
      y: fx.y + dy + rand(2, 7) * u,
      vx: rand(-0.2, 0.2) * u,
      vy: rand(0.1, 0.4) * u,
      s: rand(1, 2.3) * u,
      colors: soul.colors,
      life: rand(8, 13),
      shrink: true,
    });
  }, (ctx, f) => {
    // the body left behind
    if (f < 44) {
      const collapse = clamp01(f / 34);
      drawSprite(ctx, fx, {
        sx: 1 + 0.15 * collapse,
        sy: 1 - 0.8 * collapse,
        tint: f < RISE_FROM ? (f % 2 ? 'white' : undefined) : collapse > 0.3 ? 'ash' : undefined,
        alpha: f < 34 ? 1 : 1 - (f - 34) / 10,
      });
    }
    // the soul
    if (f >= RISE_FROM) {
      const { dx, dy, alpha } = wisp(f);
      if (alpha > 0) {
        ctx.globalAlpha = alpha * 0.6;
        pixelRing(ctx, fx.x + dx, fx.y + dy, 6.5 * u, soul.colors[1], 1.2 * u, 12, f * 0.15);
        ctx.globalAlpha = 1;
        drawSpriteT(ctx, fx, { dx, dy, scale: 0.9 + 0.08 * Math.sin(f * 0.4), alpha, tint: soul.tint });
      }
    }
  });
}

export const soulExtraction = registerEffect(
  defineEffect({ id: 'soulExtraction', name: 'SOUL EXTRACTION', trigger: 'capture', duration: 1000, sound: 'soul', build })
);
