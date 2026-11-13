import { defineEffect, registerEffect } from './effectRegistry.js';
import { createBase, makeEffect, drawSprite, spawn, spritePixels, pixelRing, clamp01, rand } from './fxKit.js';

// ── BLOOD DRAIN ──
// Red droplets are pulled out of the captured piece and stream to the piece
// that captured it, while the victim shrivels and fades.   ~700 ms
const REDS = ['#ff2a3a', '#d4142a', '#8f0018'];

function build(opts) {
  const fx = createBase(opts);
  const { u, size, code } = fx;
  const pixels = spritePixels(code);
  // where the blood goes: the capturing piece's square (or just above)
  const target = fx.from || { x: fx.x, y: fx.y - size * 1.5 };
  let arrived = 0;

  return makeEffect(fx, 42, (f) => {
    if (f >= 2 && f <= 26) {
      for (let i = 0; i < 5; i++) {
        const px = pixels[Math.floor(Math.random() * pixels.length)];
        spawn(fx, {
          x: fx.left + (px.px + 0.5) * u,
          y: fx.top + (px.py + 0.5) * u,
          vx: rand(-1, 1) * u,
          vy: rand(-1, 1) * u,
          s: rand(1, 1.9) * u,
          colors: REDS,
          life: 16,
          fade: false,
          home: true,
        });
      }
    }
    // steer every droplet: the older it is, the harder the pull
    for (const p of fx.particles) {
      if (!p.home) continue;
      const pull = 0.05 + (p.max - p.life) * 0.03;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      p.vx = p.vx * 0.6 + dx * pull;
      p.vy = p.vy * 0.6 + dy * pull;
      if (Math.hypot(dx, dy) < 2.5 * u) {
        p.life = 0;
        arrived++;
      }
    }
  }, (ctx, f) => {
    const t = clamp01((f - 2) / 30);
    if (t < 1) {
      const scale = 1 - 0.6 * t;
      drawSprite(ctx, fx, {
        sx: scale,
        sy: scale,
        alpha: 1 - t,
        tint: t > 0.45 ? 'ash' : undefined,
        dx: f % 2 ? 0.3 * u : -0.3 * u,
      });
    }
    if (arrived > 0 && f < 40) {
      ctx.globalAlpha = 0.8;
      pixelRing(ctx, target.x, target.y, (3 + (f % 6)) * u, f % 2 ? '#ff2a3a' : '#ffffff', 1.2 * u, 10, f * 0.3);
      ctx.globalAlpha = 1;
    }
  });
}

export const bloodDrain = registerEffect(
  defineEffect({ id: 'bloodDrain', name: 'BLOOD DRAIN', trigger: 'capture', duration: 700, sound: 'drain', build })
);
