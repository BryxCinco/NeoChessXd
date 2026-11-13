import { defineEffect, registerEffect } from './effectRegistry.js';
import { createBase, makeEffect, spawn, pixelRing, rand, fxPalette } from './fxKit.js';

// ── PROMOTION: GOLD SPARKLE ──
// A ring of light closes on the square and gold stars burst upwards as the
// pawn becomes a new piece.
function build(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  return makeEffect(fx, 42, (f) => {
    if (f === 6) {
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(0.5, 2.2) * u;
        spawn(fx, {
          x: fx.x + Math.cos(a) * 3 * u,
          y: fx.y + Math.sin(a) * 3 * u,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1.2 * u,
          g: 0.07 * u,
          drag: 0.96,
          s: rand(1, 2.2) * u,
          colors: ['#ffffff', fxPalette.accent, '#ffb000'],
          life: rand(18, 34),
          shrink: true,
        });
      }
    }
  }, (ctx, f) => {
    if (f <= 14) {
      const t = f / 14;
      pixelRing(ctx, fx.x, fx.y, size * (1.1 - 0.75 * t), f % 2 ? '#ffffff' : fxPalette.accent, 1.6 * u, 16, f * 0.2);
    }
    if (f >= 6 && f < 12) {
      ctx.globalAlpha = 1 - (f - 6) / 6;
      ctx.fillStyle = '#fff6c2';
      ctx.fillRect(fx.left, fx.top, size, size);
      ctx.globalAlpha = 1;
    }
  });
}

export const promotionSparkle = registerEffect(
  defineEffect({
    id: 'promotionSparkle',
    name: 'PROMOTION SPARKLE',
    trigger: 'promotion',
    duration: 700,
    build,
  })
);
