import { SPRITES, PALETTE } from '../sprites/pieceSprites';

// ── PIECE ELIMINATION EFFECTS ──
// Every capture destroys the captured piece's ACTUAL sprite on the canvas,
// pixel by pixel, in a style picked by the piece that made the capture:
//
//   pawn   → STOMP      a boot drops, the piece squashes flat, POOF + stars
//   knight → SLASH      a diagonal cut, the two halves slide apart and fall
//   bishop → FREEZE     ice climbs up the piece, it cracks and shatters
//   rook   → ANVIL      an anvil crushes it, pixels spray out sideways
//   queen  → BLACK HOLE every pixel spirals into a collapsing void
//   king   → BURN       fire eats it from the feet up, leaving embers
//
// Effects are time-based (`frame` = 1/60 s since start), so they look the
// same on 30, 60 and 120 Hz screens. Each one is a plain object:
//   { duration, draw(ctx, frame) }

export const FX_BY_ATTACKER = { p: 'stomp', n: 'slash', b: 'freeze', r: 'anvil', q: 'blackhole', k: 'burn' };
export const FX_SOUND = {
  stomp: 'bubble',
  slash: 'swordslash',
  freeze: 'frozen_eyes',
  anvil: 'anvil',
  blackhole: 'blackhole',
  burn: 'fire',
  shatter: 'missile',
};
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const TEAM = { w: '#e8282b', b: '#2f7bff' };

// ── colour helpers ──
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
const ICE_DARK = [27, 79, 138];
const ICE_LIGHT = [230, 251, 255];
const HOT_DARK = [40, 10, 6];
const HOT_LIGHT = [255, 170, 40];
const TINTS = {
  ice: (rgb) => mix(ICE_DARK, ICE_LIGHT, lum(rgb)),
  hot: (rgb) => mix(HOT_DARK, HOT_LIGHT, lum(rgb)),
  white: () => '#ffffff',
};

// ── sprite caches (16x16 offscreen canvases + per-pixel lists) ──
const spriteCache = new Map();
function spriteImage(code, tint) {
  const key = `${code}:${tint || ''}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const g = canvas.getContext('2d');
  SPRITES[code].forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      g.fillStyle = tint ? TINTS[tint](hexToRgb(PALETTE[ch])) : PALETTE[ch];
      g.fillRect(x, y, 1, 1);
    }
  });
  spriteCache.set(key, canvas);
  return canvas;
}

const pixelCache = new Map();
function spritePixels(code) {
  if (pixelCache.has(code)) return pixelCache.get(code);
  const list = [];
  SPRITES[code].forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      if (row[x] !== '.') list.push({ px: x, py: y, color: PALETTE[row[x]], rgb: hexToRgb(PALETTE[row[x]]) });
    }
  });
  pixelCache.set(code, list);
  return list;
}

const rand = (a, b) => a + Math.random() * (b - a);

// ── shared building blocks ──
function createBase({ code, x, y, size, attackerColor }) {
  const u = size / 16;
  return {
    code,
    x,
    y,
    size,
    u,
    left: x - size / 2,
    top: y - size / 2,
    team: TEAM[attackerColor] || '#ffd83a',
    particles: [],
    lastFrame: 0,
    value: PIECE_VALUE[code[1].toLowerCase()] || 0,
  };
}

// Draws the victim sprite scaled around its bottom-centre.
function drawSprite(ctx, fx, { tint, sx = 1, sy = 1, alpha = 1, dx = 0, dy = 0, srcRows } = {}) {
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
function spawn(fx, p) {
  fx.particles.push({ g: 0, drag: 1, ...p, max: p.life });
}

function stepParticles(fx) {
  for (const p of fx.particles) {
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

function drawParticles(ctx, fx) {
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
function explodePixels(fx, makeVelocity, extra = {}, tint) {
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
function drawScore(ctx, fx, frame, start = 8) {
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
  ctx.fillStyle = '#ffd83a';
  ctx.fillText(`+${fx.value}`, fx.x, ty);
  ctx.globalAlpha = 1;
}

// Runs physics once per elapsed 60 Hz frame, then draws once.
function makeEffect(fx, duration, tick, render) {
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

// ── PAWN: STOMP ──
function stomp(opts) {
  const fx = createBase(opts);
  const { u } = fx;
  const IMPACT = 6;
  return makeEffect(fx, 46, (f) => {
    if (f === IMPACT) {
      for (let i = 0; i < 10; i++) {
        const a = rand(Math.PI, Math.PI * 2);
        spawn(fx, { x: fx.x + rand(-4, 4) * u, y: fx.y + 6 * u, vx: Math.cos(a) * rand(1, 2.4) * u * 0.6, vy: Math.sin(a) * rand(0.3, 1.2) * u * 0.6, s: rand(2.5, 4.5) * u, color: i % 2 ? '#ffffff' : '#cbd5e1', life: rand(16, 24), drag: 0.9, shrink: true });
      }
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.45;
        spawn(fx, { x: fx.x, y: fx.y + 3 * u, vx: Math.cos(a) * 1.6 * u * 0.7, vy: Math.sin(a) * 2.2 * u * 0.7, s: 2 * u, color: '#ffd83a', life: 30, g: 0.12 * u });
      }
    }
  }, (ctx, f) => {
    // boot falling onto the head, then riding the squash down
    const squash = f < IMPACT ? 0 : Math.min(1, (f - IMPACT) / 4);
    const sy = 1 - 0.85 * squash;
    if (f < IMPACT + 10) {
      drawSprite(ctx, fx, { sx: 1 + 0.4 * squash, sy, tint: f >= IMPACT && f < IMPACT + 3 ? 'white' : undefined });
    }
    if (f < IMPACT + 14) {
      const headTop = fx.y + fx.size / 2 - fx.size * sy;
      const bootY = f < IMPACT ? fx.top - fx.size + (f / IMPACT) ** 2 * (headTop - fx.top + fx.size) : headTop;
      const alpha = f < IMPACT + 8 ? 1 : 1 - (f - IMPACT - 8) / 6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#120a1a';
      ctx.fillRect(fx.x - 5 * u, bootY - 5 * u, 10 * u, 5 * u);
      ctx.fillStyle = fx.team;
      ctx.fillRect(fx.x - 4 * u, bootY - 4 * u, 8 * u, 2 * u);
      ctx.fillStyle = '#7a4320';
      ctx.fillRect(fx.x - 4 * u, bootY - 2 * u, 8 * u, u);
      ctx.globalAlpha = 1;
    }
  });
}

// ── KNIGHT: SLASH ──
function slash(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const CUT = 6;
  // cut runs from top-right to bottom-left; normal points to the upper-left half
  const nx = -Math.SQRT1_2;
  const ny = -Math.SQRT1_2;
  const halves = [
    { side: 1, ox: 0, oy: 0, vx: nx * 0.45 * u, vy: ny * 0.6 * u, rot: 0, vr: -0.025 },
    { side: -1, ox: 0, oy: 0, vx: -nx * 0.45 * u, vy: -ny * 0.2 * u, rot: 0, vr: 0.03 },
  ];
  return makeEffect(fx, 46, (f) => {
    if (f === CUT) {
      for (let i = 0; i < 12; i++) {
        const t = rand(0, 1);
        spawn(fx, { x: fx.left + size * (1 - t), y: fx.top + size * t, vx: rand(-1.5, 1.5) * u * 0.6, vy: rand(-1.5, 1.5) * u * 0.6, s: u * rand(1, 2), color: i % 3 ? '#ffffff' : '#ffd83a', life: rand(10, 18) });
      }
    }
    if (f > CUT) {
      for (const h of halves) {
        h.ox += h.vx;
        h.oy += h.vy;
        h.vy += 0.06 * u;
        h.rot += h.vr;
      }
    }
  }, (ctx, f) => {
    if (f <= CUT) {
      drawSprite(ctx, fx);
    } else {
      const alpha = f > 34 ? Math.max(0, 1 - (f - 34) / 12) : 1;
      for (const h of halves) {
        ctx.save();
        ctx.translate(fx.x + h.ox, fx.y + h.oy);
        ctx.rotate(h.rot);
        ctx.beginPath();
        // half-plane on one side of the diagonal through the centre
        const R = size;
        if (h.side === 1) {
          ctx.moveTo(-R, R); ctx.lineTo(R, -R); ctx.lineTo(-R, -R);
        } else {
          ctx.moveTo(-R, R); ctx.lineTo(R, -R); ctx.lineTo(R, R);
        }
        ctx.closePath();
        ctx.clip();
        ctx.globalAlpha = alpha;
        ctx.drawImage(spriteImage(fx.code), -size / 2, -size / 2, size, size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // the blade streak
    if (f <= CUT + 6) {
      const grow = Math.min(1, f / CUT);
      const fadeOut = f > CUT ? 1 - (f - CUT) / 6 : 1;
      ctx.save();
      ctx.globalAlpha = fadeOut;
      ctx.translate(fx.x, fx.y);
      ctx.rotate(-Math.PI / 4);
      const len = size * 1.5 * grow;
      ctx.fillStyle = fx.team;
      ctx.fillRect(-size * 0.75, -u * 1.5, len, u * 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-size * 0.75, -u * 0.5, len, u);
      ctx.restore();
    }
  });
}

// ── BISHOP: FREEZE & SHATTER ──
function freeze(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const FROZEN = 16;
  const SHATTER = 26;
  const cracks = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + rand(-0.3, 0.3);
    const pts = [[0, 0]];
    let r = 0;
    while (r < 7) {
      r += rand(1.5, 2.5);
      pts.push([Math.cos(a + rand(-0.4, 0.4)) * r, Math.sin(a + rand(-0.4, 0.4)) * r]);
    }
    return pts;
  });
  return makeEffect(fx, 58, (f) => {
    if (f < SHATTER && f % 2 === 0) {
      const a = rand(0, Math.PI * 2);
      spawn(fx, { x: fx.x + Math.cos(a) * size * 0.6, y: fx.y + Math.sin(a) * size * 0.6, vx: -Math.cos(a) * 0.5 * u, vy: -Math.sin(a) * 0.5 * u, s: u * rand(1, 1.6), color: '#e6fbff', life: 16 });
    }
    if (f === SHATTER) {
      explodePixels(fx, (x, y) => {
        const a = Math.atan2(y - fx.y, x - fx.x);
        const sp = rand(0.6, 1.6) * u;
        return [Math.cos(a) * sp, Math.sin(a) * sp - 1.2 * u];
      }, { g: 0.16 * u, life: rand(26, 34) }, 'ice');
      for (let i = 0; i < 10; i++) {
        spawn(fx, { x: fx.x + rand(-6, 6) * u, y: fx.y + rand(-6, 6) * u, vx: rand(-2, 2) * u * 0.6, vy: rand(-3, 0) * u * 0.6, s: u * 2, color: '#ffffff', life: rand(18, 28), g: 0.16 * u });
      }
    }
  }, (ctx, f) => {
    if (f >= SHATTER) return;
    const iceRows = Math.min(16, Math.round((f / FROZEN) * 16));
    drawSprite(ctx, fx, { srcRows: [0, 16 - iceRows] });
    drawSprite(ctx, fx, { tint: 'ice', srcRows: [16 - iceRows, 16] });
    if (f >= FROZEN) {
      // ice block
      ctx.fillStyle = 'rgba(160, 230, 255, 0.28)';
      ctx.fillRect(fx.left + u, fx.top, size - 2 * u, size);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(fx.left + u, fx.top, size - 2 * u, u);
      ctx.fillRect(fx.left + u, fx.top, u, size * 0.6);
      // cracks spreading from the centre
      const reach = Math.min(1, (f - FROZEN) / 8);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, u * 0.8);
      ctx.beginPath();
      for (const pts of cracks) {
        const n = Math.max(1, Math.round(pts.length * reach));
        ctx.moveTo(fx.x, fx.y);
        for (let i = 1; i < n; i++) ctx.lineTo(fx.x + pts[i][0] * u, fx.y + pts[i][1] * u);
      }
      ctx.stroke();
    }
  });
}

// ── ROOK: ANVIL ──
function anvil(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const IMPACT = 9;
  const restY = fx.y + size / 2 - size * 0.18; // anvil bottom after the squash
  const anvilBottom = (f) => {
    if (f < IMPACT) return fx.top - size * 1.6 + (f / IMPACT) ** 2 * (restY - fx.top + size * 1.6);
    if (f < IMPACT + 6) return restY - Math.sin(((f - IMPACT) / 6) * Math.PI) * u * 2; // little bounce
    return restY;
  };
  return makeEffect(fx, 56, (f) => {
    if (f === IMPACT) {
      explodePixels(fx, (x) => {
        const dir = x < fx.x ? -1 : 1;
        return [dir * rand(0.8, 2.4) * u, -rand(0.4, 2.2) * u];
      }, { g: 0.2 * u, life: rand(24, 34) });
      for (let i = 0; i < 8; i++) {
        spawn(fx, { x: fx.x + rand(-7, 7) * u, y: fx.y + 7 * u, vx: rand(-1.5, 1.5) * u * 0.6, vy: -rand(0.2, 1) * u * 0.6, s: rand(3, 5) * u, color: '#94a3b8', life: rand(14, 22), drag: 0.9, shrink: true });
      }
    }
  }, (ctx, f) => {
    if (f < IMPACT) drawSprite(ctx, fx);
    else if (f < IMPACT + 3) drawSprite(ctx, fx, { sx: 1.4, sy: 0.18, tint: 'white' });

    const alpha = f > 40 ? Math.max(0, 1 - (f - 40) / 12) : 1;
    const by = anvilBottom(f) - (f > 40 ? (f - 40) * u * 0.8 : 0);
    ctx.globalAlpha = alpha;
    const L = fx.x - 7 * u;
    // base, waist, top plate + horn
    ctx.fillStyle = '#120a1a';
    ctx.fillRect(L + u, by - 3 * u, 12 * u, 3 * u);
    ctx.fillRect(L + 4 * u, by - 6 * u, 6 * u, 3 * u);
    ctx.fillRect(L - u, by - 10 * u, 16 * u, 4 * u);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(L + 2 * u, by - 2 * u, 10 * u, u);
    ctx.fillRect(L + 5 * u, by - 5 * u, 4 * u, 2 * u);
    ctx.fillRect(L, by - 9 * u, 14 * u, 2 * u);
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(L, by - 9 * u, 14 * u, u);
    ctx.globalAlpha = 1;
  });
}

// ── QUEEN: BLACK HOLE ──
function blackhole(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const SUCK = 5;
  const COLLAPSE = 40;
  return makeEffect(fx, 54, (f) => {
    if (f === SUCK) {
      for (const px of spritePixels(fx.code)) {
        const x = fx.left + (px.px + 0.5) * u;
        const y = fx.top + (px.py + 0.5) * u;
        const dist = Math.hypot(x - fx.x, y - fx.y);
        fx.particles.push({
          x, y, vx: 0, vy: 0, g: 0, drag: 1, s: u * 1.05, color: px.color, life: 60, max: 60, fade: false, shrink: true,
          spin: rand(0.1, 0.16), angle: Math.atan2(y - fx.y, x - fx.x), dist, d0: dist, pull: rand(0.9, 0.94), cx: fx.x, cy: fx.y,
        });
      }
    }
    if (f === COLLAPSE) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        spawn(fx, { x: fx.x, y: fx.y, vx: Math.cos(a) * 1.4 * u, vy: Math.sin(a) * 1.4 * u, s: u * 1.5, color: i % 2 ? '#e879f9' : '#ffffff', life: 16 });
      }
    }
  }, (ctx, f) => {
    if (f < SUCK) drawSprite(ctx, fx, { sx: 1 - f * 0.02, sy: 1 + f * 0.02 });
    // the void: pixel disc + orbiting ring
    const grow = Math.min(1, f / 10);
    const shrink = f > COLLAPSE ? Math.max(0, 1 - (f - COLLAPSE) / 6) : 1;
    const r = size * 0.32 * grow * shrink;
    if (r > 0.5) {
      const step = Math.max(1, Math.round(u));
      ctx.fillStyle = '#2e0a3d';
      for (let yy = -r; yy <= r; yy += step) {
        const half = Math.sqrt(Math.max(0, r * r - yy * yy)) + step;
        ctx.fillRect(Math.round(fx.x - half), Math.round(fx.y + yy), Math.round(half * 2), step);
      }
      ctx.fillStyle = '#05010a';
      const r2 = r * 0.7;
      for (let yy = -r2; yy <= r2; yy += step) {
        const half = Math.sqrt(Math.max(0, r2 * r2 - yy * yy));
        ctx.fillRect(Math.round(fx.x - half), Math.round(fx.y + yy), Math.round(half * 2), step);
      }
      for (let i = 0; i < 10; i++) {
        const a = f * 0.2 + (i / 10) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? '#c026d3' : '#a855f7';
        ctx.fillRect(Math.round(fx.x + Math.cos(a) * r * 1.25 - u), Math.round(fx.y + Math.sin(a) * r * 0.7 - u), Math.ceil(u * 2), Math.ceil(u * 2));
      }
    }
    if (f >= COLLAPSE && f < COLLAPSE + 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(fx.left, fx.top, size, size);
    }
  });
}

// ── KING: BURN ──
function burn(opts) {
  const fx = createBase(opts);
  const { u } = fx;
  const BURN_FRAMES = 32;
  const lineAt = (f) => 16 - Math.min(18, (f / BURN_FRAMES) * 18); // sprite row of the fire line
  let lastRow = 16;
  const pixels = spritePixels(fx.code);
  return makeEffect(fx, 60, (f) => {
    const row = Math.ceil(lineAt(f));
    // rows the fire passed this frame turn into rising embers
    for (let r = row; r < lastRow; r++) {
      for (const px of pixels) {
        if (px.py !== r) continue;
        spawn(fx, {
          x: fx.left + (px.px + 0.5) * u, y: fx.top + (px.py + 0.5) * u,
          vx: rand(-0.3, 0.3) * u, vy: -rand(0.4, 1.1) * u, s: u * 1.05,
          colors: ['#fff4b0', '#ffd83a', '#ff8a1f', '#e8282b', '#3d1410'], life: rand(18, 30), drag: 0.97,
        });
      }
    }
    lastRow = Math.min(lastRow, row);
    if (f < BURN_FRAMES + 6) {
      for (let i = 0; i < 3; i++) {
        spawn(fx, {
          x: fx.left + rand(2, 14) * u, y: fx.top + Math.max(0, lineAt(f)) * u,
          vx: rand(-0.2, 0.2) * u, vy: -rand(0.8, 1.6) * u, s: u * rand(1.5, 2.5),
          colors: ['#ffffff', '#ffd83a', '#ff8a1f', '#e8282b'], life: rand(10, 16), shrink: true,
        });
      }
    }
  }, (ctx, f) => {
    const line = lineAt(f);
    const solidEnd = Math.max(0, Math.floor(line));
    drawSprite(ctx, fx, { srcRows: [0, Math.max(0, solidEnd - 2)] });
    drawSprite(ctx, fx, { tint: 'hot', srcRows: [Math.max(0, solidEnd - 2), solidEnd] });
  });
}

// ── fallback: pixel explosion ──
function shatter(opts) {
  const fx = createBase(opts);
  const { u } = fx;
  return makeEffect(fx, 44, (f) => {
    if (f === 4) {
      explodePixels(fx, (x, y) => {
        const a = Math.atan2(y - fx.y, x - fx.x) + rand(-0.3, 0.3);
        const sp = rand(1, 2.4) * u;
        return [Math.cos(a) * sp, Math.sin(a) * sp - u];
      }, { g: 0.15 * u });
    }
  }, (ctx, f) => {
    if (f < 4) drawSprite(ctx, fx, { tint: f % 2 ? 'white' : undefined });
  });
}

const FACTORIES = { stomp, slash, freeze, anvil, blackhole, burn, shatter };

export function createElimination({ kind, code, x, y, size, attackerColor }) {
  const make = FACTORIES[kind] || shatter;
  return make({ code, x, y, size, attackerColor });
}
