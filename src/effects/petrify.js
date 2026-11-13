import { defineEffect, registerEffect } from './effectRegistry.js';
import { createBase, makeEffect, drawSprite, spawn, spritePixels, clamp01, rand, TINTS } from './fxKit.js';

// ── PETRIFICATION ──
// The captured piece turns to grey stone, cracks spread across it, then it
// crumbles from the bottom up into dust.   ~600 ms
const STONE = 10; // fully stone by this frame
const CRUMBLE = 22; // falls apart here

function build(opts) {
  const fx = createBase(opts);
  const { u, code } = fx;
  const pixels = spritePixels(code);
  const solid = new Set(pixels.map((p) => `${p.px},${p.py}`));

  // four jagged cracks walking outwards from a point inside the piece
  const origin = { x: rand(6, 10), y: rand(5, 9) };
  const cracks = [0, 1, 2, 3].map((i) => {
    let angle = (i * Math.PI) / 2 + rand(-0.5, 0.5);
    let { x, y } = origin;
    const points = [];
    for (let step = 0; step < 9; step++) {
      angle += rand(-0.7, 0.7);
      x += Math.cos(angle);
      y += Math.sin(angle);
      points.push([Math.round(x), Math.round(y)]);
    }
    return points;
  });

  return makeEffect(fx, 36, (f) => {
    if (f !== CRUMBLE) return;
    for (const px of pixels) {
      spawn(fx, {
        x: fx.left + (px.px + 0.5) * u,
        y: fx.top + (px.py + 0.5) * u,
        vx: rand(-0.5, 0.5) * u,
        vy: rand(-0.5, 0.2) * u,
        g: 0.16 * u,
        s: u * 1.05,
        color: TINTS.stone(px.rgb),
        life: rand(6, 9),
        delay: Math.floor((15 - px.py) * 0.28), // bottom rows give way first
      });
    }
    for (let i = 0; i < 12; i++) {
      spawn(fx, {
        x: fx.x + rand(-6, 6) * u,
        y: fx.y + rand(4, 7) * u,
        vx: rand(-0.8, 0.8) * u,
        vy: -rand(0.1, 0.5) * u,
        drag: 0.92,
        s: rand(2, 3.5) * u,
        colors: ['#d4d4d8', '#a1a1aa', '#71717a'],
        life: rand(9, 13),
        shrink: true,
      });
    }
  }, (ctx, f) => {
    if (f >= CRUMBLE) return;
    const stone = clamp01(f / STONE);
    const shake = f >= STONE ? (f % 2 ? 0.4 : -0.4) * u : 0;
    if (stone < 1) drawSprite(ctx, fx);
    drawSprite(ctx, fx, { tint: 'stone', alpha: stone, dx: shake });

    if (f >= STONE - 2) {
      const shown = Math.ceil(((f - STONE + 2) / (CRUMBLE - STONE + 2)) * 9);
      ctx.fillStyle = '#17171c';
      for (const crack of cracks) {
        for (const [px, py] of crack.slice(0, shown)) {
          if (solid.has(`${px},${py}`)) ctx.fillRect(Math.round(fx.left + px * u + shake), Math.round(fx.top + py * u), Math.ceil(u), Math.ceil(u));
        }
      }
    }
  });
}

export const petrify = registerEffect(
  defineEffect({ id: 'petrify', name: 'PETRIFICATION', trigger: 'capture', duration: 600, sound: 'stone_crack', build })
);
