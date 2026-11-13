import { defineEffect, registerEffect } from './effectRegistry.js';
import { createBase, makeEffect, drawSprite, spawn, clamp01, rand } from './fxKit.js';

// ── TOXIC ACID ──
// Three green drops fall from the top of the board; the captured piece
// melts into a bubbling puddle and green smoke.   ~900 ms
const DROPS = [
  { hit: 10, dx: -2 },
  { hit: 14, dx: 2 },
  { hit: 18, dx: 0 },
];
const FALL = 10; // frames a drop is in the air

function build(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const hitY = fx.top + 3 * u;
  const floor = fx.y + size / 2;

  return makeEffect(fx, 54, (f) => {
    for (const drop of DROPS) {
      if (f !== drop.hit) continue;
      for (let i = 0; i < 8; i++) {
        const a = rand(Math.PI * 1.1, Math.PI * 1.9);
        spawn(fx, {
          x: fx.x + drop.dx * u,
          y: hitY,
          vx: Math.cos(a) * rand(0.6, 1.6) * u,
          vy: Math.sin(a) * rand(0.6, 1.5) * u,
          g: 0.14 * u,
          s: rand(1, 2) * u,
          colors: ['#d8ff8a', '#7be33a', '#3f9c1c'],
          life: rand(10, 15),
        });
      }
    }
    if (f >= 14 && f <= 42 && f % 2 === 0) {
      // bubbles popping up out of the puddle
      spawn(fx, {
        x: fx.x + rand(-5, 5) * u,
        y: floor - rand(1, 3) * u,
        vx: 0,
        vy: -rand(0.3, 0.8) * u,
        s: rand(1, 2.2) * u,
        colors: ['#eaffb8', '#9df04a'],
        life: rand(7, 12),
        fade: false,
      });
    }
    if (f >= 16 && f <= 36 && f % 3 === 0) {
      spawn(fx, {
        x: fx.x + rand(-4, 4) * u,
        y: fx.y + rand(-2, 4) * u,
        vx: rand(-0.3, 0.3) * u,
        vy: -rand(0.5, 1) * u,
        drag: 0.97,
        s: rand(2.2, 3.6) * u,
        colors: ['#b6e872', '#7f9c64', '#4c5a48'],
        life: rand(12, 17),
        shrink: true,
      });
    }
  }, (ctx, f) => {
    // the piece melting down
    const melt = clamp01((f - DROPS[0].hit) / 30);
    const fade = f > 40 ? clamp01(1 - (f - 40) / 8) : 1;
    if (fade > 0) {
      const shape = { sx: 1 + 0.35 * melt, sy: 1 - 0.85 * melt };
      if (melt < 1) drawSprite(ctx, fx, { ...shape, alpha: (1 - melt) * fade });
      if (melt > 0) drawSprite(ctx, fx, { ...shape, tint: 'acid', alpha: Math.min(1, melt * 1.6) * fade });
    }

    // puddle
    if (melt > 0) {
      const alpha = f > 44 ? clamp01(1 - (f - 44) / 10) : 1;
      const half = (3 + 5 * melt) * u;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#3f9c1c';
      ctx.fillRect(Math.round(fx.x - half), Math.round(floor - 2 * u), Math.round(half * 2), Math.ceil(2 * u));
      ctx.fillStyle = '#9df04a';
      ctx.fillRect(Math.round(fx.x - half + u), Math.round(floor - 2 * u), Math.round(half * 2 - 2 * u), Math.ceil(u));
      ctx.globalAlpha = 1;
    }

    // drops in the air
    for (const drop of DROPS) {
      const t = (f - (drop.hit - FALL)) / FALL;
      if (t < 0 || t >= 1) continue;
      const y = -3 * u + (hitY + 3 * u) * t * t;
      const x = fx.x + drop.dx * u;
      ctx.fillStyle = '#3f9c1c';
      ctx.fillRect(Math.round(x - u), Math.round(y - 3 * u), Math.ceil(2 * u), Math.ceil(3 * u));
      ctx.fillStyle = '#9df04a';
      ctx.fillRect(Math.round(x - u), Math.round(y - 1.5 * u), Math.ceil(2 * u), Math.ceil(1.5 * u));
      ctx.fillStyle = '#eaffb8';
      ctx.fillRect(Math.round(x - u), Math.round(y - u), Math.ceil(u), Math.ceil(u));
    }
  });
}

export const toxicAcid = registerEffect(
  defineEffect({ id: 'toxicAcid', name: 'TOXIC ACID', trigger: 'capture', duration: 900, sound: 'sizzle', build })
);
