import { defineEffect, registerEffect } from './effectRegistry.js';
import { createBase, makeEffect, drawSprite, spawn, spritePixels, explodePixels, clamp01, rand } from './fxKit.js';

// ── CHAINSAW ──
// A chainsaw falls from the top of the board onto the captured piece, spins
// through it throwing sparks and chips, then the piece bursts into debris
// and the saw flies off.   ~800 ms
const LAND = 10; // touches the piece
const BURST = 30; // the piece comes apart
const LEAVE = 34; // the saw lifts away

// Pixel chainsaw, drawn around (0, 0) with the blade pointing down.
function drawSaw(ctx, u, f) {
  const r = (color, x, y, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * u, y * u, w * u, h * u);
  };
  // handle + engine
  r('#1f2937', -4, -10, 8, 2);
  r('#1f2937', -4, -10, 2, 4);
  r('#e8501e', -3, -8, 6, 5);
  r('#9c2c0c', -3, -4, 6, 1);
  r('#ffb37a', -2, -7, 2, 1);
  // guide bar
  r('#cbd5e1', -1.5, -3, 3, 11);
  r('#64748b', -0.5, -2, 1, 9);
  r('#cbd5e1', -1, 8, 2, 1);
  // chain teeth run down one side and up the other
  for (let i = 0; i < 10; i++) {
    const y = -3 + i;
    if ((i + f) % 2 === 0) r('#f8fafc', -2.5, y, 1, 1);
    else r('#334155', 1.5, y, 1, 1);
  }
}

function build(opts) {
  const fx = createBase(opts);
  const { u, size, code } = fx;
  const pixels = spritePixels(code);

  return makeEffect(fx, 48, (f) => {
    if (f >= LAND && f < BURST) {
      // sparks
      for (let i = 0; i < 4; i++) {
        const a = rand(0, Math.PI * 2);
        spawn(fx, {
          x: fx.x + rand(-2, 2) * u,
          y: fx.y + rand(-2, 2) * u,
          vx: Math.cos(a) * rand(1.2, 2.6) * u,
          vy: Math.sin(a) * rand(1.2, 2.6) * u,
          g: 0.1 * u,
          s: rand(0.8, 1.5) * u,
          colors: ['#ffffff', '#ffe066', '#ff9f1a'],
          life: rand(5, 9),
        });
      }
      // chips of the piece itself
      if (f % 2 === 0) {
        for (let i = 0; i < 5; i++) {
          const px = pixels[Math.floor(Math.random() * pixels.length)];
          const x = fx.left + (px.px + 0.5) * u;
          const y = fx.top + (px.py + 0.5) * u;
          const a = Math.atan2(y - fx.y, x - fx.x) + rand(-0.6, 0.6);
          spawn(fx, {
            x,
            y,
            vx: Math.cos(a) * rand(0.8, 2) * u,
            vy: Math.sin(a) * rand(0.8, 2) * u - 0.5 * u,
            g: 0.14 * u,
            s: u * 1.05,
            color: px.color,
            life: rand(10, 16),
          });
        }
      }
    }
    if (f === BURST) {
      explodePixels(fx, (x, y) => {
        const a = Math.atan2(y - fx.y, x - fx.x) + rand(-0.4, 0.4);
        const sp = rand(1, 2.6) * u;
        return [Math.cos(a) * sp, Math.sin(a) * sp - 0.8 * u];
      }, { g: 0.16 * u, life: 16 });
    }
  }, (ctx, f) => {
    // the victim, rattling while it is being cut
    if (f < BURST) {
      const cutting = f >= LAND;
      drawSprite(ctx, fx, {
        dx: cutting ? (f % 2 ? 0.7 : -0.7) * u : 0,
        tint: cutting && f % 3 === 0 ? 'white' : undefined,
      });
    }

    // the saw
    let cx = fx.x;
    let cy = fx.y;
    let rot = 0;
    let alpha = 1;
    if (f < LAND) {
      const t = f / LAND;
      // falls from above the board until the blade tip bites into the piece
      const start = -12 * u;
      const end = fx.top - 4 * u;
      cy = start + (end - start) * t * t;
      cx += (f % 2 ? 0.3 : -0.3) * u;
    } else {
      rot = (f - LAND) * 0.5;
      cy -= 2 * u;
      if (f >= LEAVE) {
        const t = clamp01((f - LEAVE) / (48 - LEAVE));
        cy -= t * t * size * 1.6;
        alpha = 1 - t;
      }
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    if (rot) {
      // spin around the middle of the blade, which sits on the piece
      ctx.translate(0, 2 * u);
      ctx.rotate(rot);
      ctx.translate(0, -2 * u);
    }
    drawSaw(ctx, u, f);
    ctx.restore();
    ctx.globalAlpha = 1;
  });
}

export const chainsaw = registerEffect(
  defineEffect({ id: 'chainsaw', name: 'CHAINSAW', trigger: 'capture', duration: 800, sound: 'chainsaw', build })
);
