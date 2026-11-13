import { defineEffect, registerEffect } from './effectRegistry.js';
import { createBase, makeEffect, spawn, rand } from './fxKit.js';

// ── CHECKMATE: IRON CAGE ──
// A cage on a chain drops onto the mated king, bounces once, and locks.
// It stays on the board (persist) until the next game clears the canvas.
function build(opts) {
  const fx = createBase(opts);
  const { size } = fx;
  const u = size / 15;
  const w = u * 16;
  const cage = { y: fx.y - size * 2.5, vy: 0, bounces: 0, landed: false, lockFrame: -1 };
  const gravity = size * 0.045;

  const rect = (ctx, color, x, y, rw, rh) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh));
  };

  return makeEffect(fx, 55, (f) => {
    if (cage.landed) return;
    cage.vy += gravity;
    cage.y += cage.vy;
    if (cage.y < fx.y) return;
    cage.y = fx.y;
    if (cage.bounces === 0) {
      // first impact: dust burst + a small bounce
      cage.bounces = 1;
      cage.vy = -cage.vy * 0.28;
      for (let d = 0; d < 18; d++) {
        spawn(fx, {
          x: fx.x + rand(-size / 2, size / 2),
          y: fx.y + size / 2 - 2,
          vx: rand(-3, 3),
          vy: -rand(1, 4),
          g: 0.15,
          s: Math.max(2, Math.round(size / 16)) * (Math.random() > 0.5 ? 2 : 1),
          color: Math.random() > 0.5 ? '#94a3b8' : '#64748b',
          life: rand(14, 24),
          fade: false,
        });
      }
    } else {
      cage.landed = true;
      cage.lockFrame = f;
    }
  }, (ctx, f) => {
    const left = fx.x - w / 2;
    const top = cage.y - w / 2;

    // chain up to the top edge of the board
    let link = 0;
    for (let cy = top - u * 3; cy > -u * 2; cy -= u * 2.5) {
      rect(ctx, link++ % 2 ? '#64748b' : '#334155', left + w / 2 - u, cy - u, u * 2, u * 2);
    }
    // shadow on the square once landed
    if (cage.landed) rect(ctx, 'rgba(0, 0, 0, 0.3)', left + u, top + w - u, w - u * 2, u);
    // hook + top beam
    rect(ctx, '#1e293b', left + w / 2 - u * 2, top - u * 2, u * 4, u * 2);
    rect(ctx, '#1e293b', left, top, w, u * 2);
    rect(ctx, '#94a3b8', left + u, top, w - u * 2, u);
    // bars
    for (let i = 0; i < 5; i++) {
      const bx = left + u + i * u * 3;
      rect(ctx, '#1e293b', bx, top + u * 2, u * 2, w - u * 4);
      rect(ctx, '#cbd5e1', bx, top + u * 2, u, w - u * 4);
    }
    // bottom rail
    rect(ctx, '#1e293b', left, top + w - u * 2, w, u * 2);
    rect(ctx, '#64748b', left + u, top + w - u * 2, w - u * 2, u);
    // padlock (flashes white for a few frames right after it locks)
    const flashing = cage.lockFrame >= 0 && f - cage.lockFrame < 8 && (f - cage.lockFrame) % 4 < 2;
    const lx = left + w / 2 - u * 2;
    const ly = top + w - u * 6;
    rect(ctx, '#120a1a', lx - u, ly - u * 2, u * 6, u * 6);
    rect(ctx, flashing ? '#ffffff' : '#c48a00', lx, ly - u, u * 4, u);
    rect(ctx, flashing ? '#ffffff' : '#ffd83a', lx, ly, u * 4, u * 3);
    rect(ctx, '#120a1a', lx + u * 1.5, ly + u, u, u);
  });
}

export const kingCage = registerEffect(
  defineEffect({
    id: 'kingCage',
    name: 'KING CAGE',
    trigger: 'checkmate',
    duration: 920,
    sound: 'cage',
    persist: true,
    build,
  })
);
