import { defineEffect, registerEffect } from './effectRegistry.js';
import { createBase, makeEffect, drawSprite, spawn, spriteImage, clamp01, rand } from './fxKit.js';

// ── PIECE SQUASHING PIECE ──
// Heavy pieces only (rook, queen, king): the capturing piece drops out of
// the sky with a growing shadow and flattens its victim. The squash mark
// stays for a moment, then fades.   ~500 ms squash + ~1000 ms mark
const IMPACT = 9; // frame the piece lands
const LANDED = 30; // 500 ms: the real piece takes over on the board
const HOLD = 60; // the mark starts fading here
const END = 90;

function build(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const attackerCode = fx.attackerCode || `${fx.attackerColor || 'w'}R`;
  const floor = fx.y + size / 2;
  const cracks = Array.from({ length: 7 }, (_, i) => ({
    angle: Math.PI + (i / 6) * Math.PI + rand(-0.15, 0.15),
    length: rand(4, 8),
  }));

  return makeEffect(fx, END, (f) => {
    if (f !== IMPACT) return;
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      spawn(fx, {
        x: fx.x + side * rand(3, 7) * u,
        y: floor - rand(0, 2) * u,
        vx: side * rand(0.8, 2.4) * u,
        vy: -rand(0.1, 0.9) * u,
        drag: 0.9,
        s: rand(2, 4) * u,
        colors: ['#ffffff', '#cbd5e1', '#94a3b8'],
        life: rand(12, 20),
        shrink: true,
      });
    }
  }, (ctx, f) => {
    // shadow growing under the falling piece
    if (f < IMPACT) {
      const t = f / IMPACT;
      const half = size * (0.15 + 0.3 * t);
      ctx.globalAlpha = 0.15 + 0.3 * t;
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.round(fx.x - half), Math.round(floor - 2 * u), Math.round(half * 2), Math.ceil(2 * u));
      ctx.globalAlpha = 1;
    }

    // the victim: standing, then flattened into a mark on the square
    if (f < IMPACT) {
      drawSprite(ctx, fx);
    } else {
      const squash = clamp01((f - IMPACT) / 3);
      const alpha = f < HOLD ? 1 : clamp01(1 - (f - HOLD) / (END - HOLD));
      const shape = { sx: 1 + 0.5 * squash, sy: 1 - 0.9 * squash };
      drawSprite(ctx, fx, { ...shape, alpha });
      drawSprite(ctx, fx, { ...shape, tint: 'dark', alpha: 0.45 * squash * alpha });
      if (squash === 1) {
        ctx.globalAlpha = 0.5 * alpha;
        ctx.fillStyle = '#120a1a';
        for (const crack of cracks) {
          for (let step = 2; step < crack.length; step++) {
            ctx.fillRect(
              Math.round(fx.x + Math.cos(crack.angle) * step * u * 1.2),
              Math.round(floor - u + Math.sin(crack.angle) * step * u * 0.35),
              Math.ceil(u),
              Math.ceil(u)
            );
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // the capturing piece: falls, lands with a little squash-and-stretch,
    // then hands over to the real piece on the board
    if (f <= LANDED + 4) {
      const img = spriteImage(attackerCode);
      let top = fx.top;
      let stretch = 1;
      if (f < IMPACT) {
        const t = f / IMPACT;
        top = fx.top - (size * 3 + fx.top) * (1 - t * t);
      } else if (f < IMPACT + 5) {
        stretch = 0.82 + 0.18 * ((f - IMPACT) / 5);
      }
      const h = size * stretch;
      const w = size * (2 - stretch);
      ctx.drawImage(img, fx.x - w / 2, top + size - h, w, h);
    }
  });
}

export const squash = registerEffect(
  defineEffect({
    id: 'squash',
    name: 'PIECE SQUASH',
    trigger: 'capture',
    duration: 1500,
    commitAt: 500,
    sound: 'thud',
    attackers: ['r', 'q', 'k'],
    hidesAttacker: true,
    build,
  })
);
