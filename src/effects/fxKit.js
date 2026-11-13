import { getActivePieceSkin } from '../pieceSkins.js';

// ── EFFECT TOOLKIT ──
// Shared building blocks for the canvas effects in this folder: the captured
// piece's sprite (in the active piece skin), a small particle system, and
// pixel-art drawing helpers. An effect is built with makeEffect(), which
// runs its physics once per 60 Hz frame and then draws.

// Accent colour for score pop-ups and sparkles; follows the theme
// (applyTheme() in src/themes/themes.js sets it).
export const fxPalette = { accent: '#ffd83a' };
export function setFxAccent(color) {
  fxPalette.accent = color || '#ffd83a';
}

export const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const TEAM = { w: '#e8282b', b: '#2f7bff' };

// ── colour helpers ──
export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
export const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
export const ICE_DARK = [27, 79, 138];
export const ICE_LIGHT = [230, 251, 255];
export const HOT_DARK = [40, 10, 6];
export const HOT_LIGHT = [255, 170, 40];
export const TINTS = {
  ice: (rgb) => mix(ICE_DARK, ICE_LIGHT, lum(rgb)),
  hot: (rgb) => mix(HOT_DARK, HOT_LIGHT, lum(rgb)),
  white: () => '#ffffff',
  dark: () => '#120a1a',
  ash: (rgb) => mix([30, 28, 34], [175, 172, 180], lum(rgb)),
  plasma: (rgb) => mix([70, 10, 100], [250, 200, 255], lum(rgb)),
  stone: (rgb) => mix([58, 58, 66], [205, 205, 212], lum(rgb)),
  acid: (rgb) => mix([14, 70, 12], [196, 255, 96], lum(rgb)),
  soulRed: (rgb) => mix([150, 20, 40], [255, 214, 214], lum(rgb)),
  soulBlue: (rgb) => mix([20, 70, 170], [214, 240, 255], lum(rgb)),
  blood: (rgb) => mix([60, 0, 8], [255, 60, 70], lum(rgb)),
};

// ── sprite caches (16x16 offscreen canvases + per-pixel lists) ──
export const spriteCache = new Map();
export function spriteImage(code, tint) {
  const skin = getActivePieceSkin();
  const key = `${skin.id}:${code}:${tint || ''}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const { rows, palette } = skin.pieces[code];
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const g = canvas.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      g.fillStyle = tint ? TINTS[tint](hexToRgb(palette[ch])) : palette[ch];
      g.fillRect(x, y, 1, 1);
    }
  });
  spriteCache.set(key, canvas);
  return canvas;
}

export const pixelCache = new Map();
export function spritePixels(code) {
  const skin = getActivePieceSkin();
  const key = `${skin.id}:${code}`;
  if (pixelCache.has(key)) return pixelCache.get(key);
  const { rows, palette } = skin.pieces[code];
  const list = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      if (row[x] !== '.') list.push({ px: x, py: y, color: palette[row[x]], rgb: hexToRgb(palette[row[x]]) });
    }
  });
  pixelCache.set(key, list);
  return list;
}

export const rand = (a, b) => a + Math.random() * (b - a);

// ── shared building blocks ──
// opts: { code, x, y, size, attackerColor, attackerCode, from, intensity, top }
//   code          the captured piece ('bQ'); may be missing (cage, sparkles)
//   x, y, size    centre and width of its square, in canvas CSS pixels
//   attackerCode  the capturing piece ('wR'); from: { x, y } centre of the
//                 square it came from
//   intensity     0–1, share of particles actually spawned
export function createBase({ code, x, y, size, attackerColor, attackerCode, from, intensity = 1 }) {
  const u = size / 16;
  return {
    code,
    attackerCode,
    attackerColor,
    from: from || null,
    density: Math.max(0, Math.min(1, intensity)),
    x,
    y,
    size,
    u,
    left: x - size / 2,
    top: y - size / 2,
    team: TEAM[attackerColor] || fxPalette.accent,
    particles: [],
    lastFrame: 0,
    value: (code && PIECE_VALUE[code[1].toLowerCase()]) || 0,
  };
}

// Draws the victim sprite scaled around its bottom-centre.
export function drawSprite(ctx, fx, { tint, sx = 1, sy = 1, alpha = 1, dx = 0, dy = 0, srcRows } = {}) {
  const img = spriteImage(fx.code, tint);
  const w = fx.size * sx;
  const h = fx.size * sy;
  const left = fx.x - w / 2 + dx;
  const top = fx.y + fx.size / 2 - h + dy;
  ctx.globalAlpha = alpha;
  if (srcRows) {
    const [r0, r1] = srcRows; // only draw sprite rows r0..r1 (exclusive)
    if (r1 > r0) ctx.drawImage(img, 0, r0, 16, r1 - r0, left, top + (r0 / 16) * h, w, ((r1 - r0) / 16) * h);
  } else {
    ctx.drawImage(img, left, top, w, h);
  }
  ctx.globalAlpha = 1;
}

// p: { x, y, vx, vy, s, color, life, max, g, drag, colors? }
// With the intensity slider below 100 a matching share of particles is
// simply never created (`essential: true` particles always are).
export function spawn(fx, p) {
  if (fx.density < 1 && !p.essential && Math.random() >= fx.density) return;
  fx.particles.push({ g: 0, drag: 1, ...p, max: p.life });
}

export function stepParticles(fx) {
  for (const p of fx.particles) {
    if (p.delay > 0) {
      p.delay--;
      continue;
    }
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.spin) {
      p.angle += p.spin;
      p.dist *= p.pull;
      p.x = p.cx + Math.cos(p.angle) * p.dist;
      p.y = p.cy + Math.sin(p.angle) * p.dist;
    }
  }
  fx.particles = fx.particles.filter((p) => p.life > 0 && (!p.spin || p.dist > 0.6));
}

export function drawParticles(ctx, fx) {
  for (const p of fx.particles) {
    const t = p.life / p.max;
    ctx.globalAlpha = p.fade === false ? 1 : Math.min(1, t * 2);
    ctx.fillStyle = p.colors ? p.colors[Math.min(p.colors.length - 1, Math.floor((1 - t) * p.colors.length))] : p.color;
    const s = p.shrink ? Math.max(1, p.s * (p.spin ? Math.min(1, p.dist / (p.d0 || 1) + 0.2) : t)) : p.s;
    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s), Math.ceil(s));
  }
  ctx.globalAlpha = 1;
}

// Every victim pixel → one particle, starting where it sits on the board.
export function explodePixels(fx, makeVelocity, extra = {}, tint) {
  for (const px of spritePixels(fx.code)) {
    const x = fx.left + (px.px + 0.5) * fx.u;
    const y = fx.top + (px.py + 0.5) * fx.u;
    const [vx, vy] = makeVelocity(x, y, px);
    spawn(fx, {
      x, y, vx, vy,
      s: fx.u * 1.05,
      color: tint ? TINTS[tint](px.rgb) : px.color,
      life: rand(22, 34),
      ...extra,
    });
  }
}

// Mario-style "+N" score popup.
export function drawScore(ctx, fx, frame, start = 8) {
  if (!fx.value || frame < start) return;
  const t = (frame - start) / (fx.duration - start);
  const fontSize = Math.max(10, Math.round(fx.size * 0.3));
  ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
  ctx.font = `${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, fontSize / 3);
  ctx.strokeStyle = '#120a1a';
  const ty = fx.y - fx.size * 0.1 - t * fx.size * 0.7;
  ctx.strokeText(`+${fx.value}`, fx.x, ty);
  ctx.fillStyle = fxPalette.accent;
  ctx.fillText(`+${fx.value}`, fx.x, ty);
  ctx.globalAlpha = 1;
}

// Runs physics once per elapsed 60 Hz frame, then draws once.
export function makeEffect(fx, duration, tick, render) {
  fx.duration = duration;
  fx.draw = (ctx, frame) => {
    const target = Math.min(frame, fx.lastFrame + 4); // don't fast-forward huge gaps
    while (fx.lastFrame < target) {
      fx.lastFrame++;
      tick(fx.lastFrame);
      stepParticles(fx);
    }
    ctx.imageSmoothingEnabled = false;
    render(ctx, fx.lastFrame);
    drawParticles(ctx, fx);
    drawScore(ctx, fx, fx.lastFrame);
  };
  return fx;
}

export const easeOut = (t) => 1 - (1 - t) ** 2;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));

// Sprite drawn with translate / rotate / scale. pivot 'center' or 'bottom'.
export function drawSpriteT(ctx, fx, { dx = 0, dy = 0, rot = 0, scale = 1, alpha = 1, tint, pivot = 'center' } = {}) {
  const img = spriteImage(fx.code, tint);
  const s = fx.size * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (pivot === 'bottom') {
    ctx.translate(fx.x + dx, fx.y + fx.size / 2 + dy);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -s / 2, -s, s, s);
  } else {
    ctx.translate(fx.x + dx, fx.y + dy);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
  }
  ctx.restore();
}

// Filled circle built from horizontal pixel rows.
export function pixelDisc(ctx, cx, cy, r, color, step) {
  if (r <= 0) return;
  const st = Math.max(1, Math.round(step));
  ctx.fillStyle = color;
  for (let yy = -r; yy <= r; yy += st) {
    const half = Math.sqrt(Math.max(0, r * r - yy * yy));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + yy), Math.round(half * 2), st);
  }
}

// Ring of square dots.
export function pixelRing(ctx, cx, cy, r, color, dot, count = 24, phase = 0) {
  ctx.fillStyle = color;
  const d = Math.max(1, Math.round(dot));
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r - d / 2), Math.round(cy + Math.sin(a) * r - d / 2), d, d);
  }
}

export function drawText(ctx, fx, text, x, y, color, scale = 0.28) {
  const fontSize = Math.max(9, Math.round(fx.size * scale));
  ctx.font = `${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, fontSize / 3);
  ctx.strokeStyle = '#120a1a';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

