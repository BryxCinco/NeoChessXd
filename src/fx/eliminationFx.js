import { SPRITES, PALETTE } from '../sprites/pieceSprites';

// ── PIECE ELIMINATION EFFECTS ──
// Every capture destroys the captured piece's ACTUAL sprite on the canvas,
// pixel by pixel. Each capturing piece has its own set of finishers, used
// in rotation so every one gets seen:
//
//   pawn   → STOMP · ARROW RAIN · BUBBLE
//   knight → SLASH · BAT SWARM · SANDWORM
//   bishop → FREEZE · THUNDER · PLASMA SURGE
//   rook   → ANVIL · MISSILE · SNIPER
//   queen  → BLACK HOLE · UFO · GIANT HAND
//   king   → BURN · NUKE
//
// Effects are time-based (`frame` = 1/60 s since start), so they look the
// same on 30, 60 and 120 Hz screens. Each one is a plain object:
//   { duration, draw(ctx, frame) }

export const EFFECT_POOLS = {
  p: ['stomp', 'arrowRain', 'bubble'],
  n: ['slash', 'batSwarm', 'sandworm'],
  b: ['freeze', 'thunder', 'plasma'],
  r: ['anvil', 'missile', 'sniper'],
  q: ['blackhole', 'ufo', 'handGrab'],
  k: ['burn', 'nuke'],
};

export const EFFECT_LABELS = {
  stomp: 'STOMP',
  arrowRain: 'ARROW RAIN',
  bubble: 'BUBBLE TRAP',
  slash: 'SLASH',
  batSwarm: 'BAT SWARM',
  sandworm: 'SANDWORM',
  freeze: 'DEEP FREEZE',
  thunder: 'THUNDER',
  plasma: 'PLASMA SURGE',
  anvil: 'ANVIL DROP',
  missile: 'MISSILE',
  sniper: 'SNIPER',
  blackhole: 'BLACK HOLE',
  ufo: 'UFO ABDUCTION',
  handGrab: 'GIANT HAND',
  burn: 'BURN',
  nuke: 'NUKE',
};

export const FX_SOUND = {
  stomp: 'bubble',
  arrowRain: 'arrow_rain',
  bubble: 'bubble',
  slash: 'swordslash',
  batSwarm: 'bat_swarm',
  sandworm: 'sandworm',
  freeze: 'frozen_eyes',
  thunder: 'thunder',
  plasma: 'plasma_surge',
  anvil: 'anvil',
  missile: 'missile',
  sniper: 'sniper',
  blackhole: 'blackhole',
  ufo: 'ufo',
  handGrab: 'hand_grab',
  burn: 'fire',
  nuke: 'nuclear_bomb',
  shatter: 'missile',
};

// Round-robin per attacker type (random starting point), so a game shows
// every finisher instead of repeating one.
const nextIndex = {};
export function pickEffect(attackerType) {
  const pool = EFFECT_POOLS[attackerType];
  if (!pool) return 'shatter';
  const i = nextIndex[attackerType] ?? Math.floor(Math.random() * pool.length);
  nextIndex[attackerType] = (i + 1) % pool.length;
  return pool[i];
}
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
  dark: () => '#120a1a',
  ash: (rgb) => mix([30, 28, 34], [175, 172, 180], lum(rgb)),
  plasma: (rgb) => mix([70, 10, 100], [250, 200, 255], lum(rgb)),
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

// ── extra drawing helpers ──
const easeOut = (t) => 1 - (1 - t) ** 2;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// Sprite drawn with translate / rotate / scale. pivot 'center' or 'bottom'.
function drawSpriteT(ctx, fx, { dx = 0, dy = 0, rot = 0, scale = 1, alpha = 1, tint, pivot = 'center' } = {}) {
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
function pixelDisc(ctx, cx, cy, r, color, step) {
  if (r <= 0) return;
  const st = Math.max(1, Math.round(step));
  ctx.fillStyle = color;
  for (let yy = -r; yy <= r; yy += st) {
    const half = Math.sqrt(Math.max(0, r * r - yy * yy));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + yy), Math.round(half * 2), st);
  }
}

// Ring of square dots.
function pixelRing(ctx, cx, cy, r, color, dot, count = 24, phase = 0) {
  ctx.fillStyle = color;
  const d = Math.max(1, Math.round(dot));
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r - d / 2), Math.round(cy + Math.sin(a) * r - d / 2), d, d);
  }
}

function drawText(ctx, fx, text, x, y, color, scale = 0.28) {
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

// ── BISHOP: THUNDER — lightning strike, x-ray flicker, crumbles to ash ──
function thunder(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const STRIKE = 6;
  const ASH = 20;
  const bolt = [];
  let yy = fx.top - size * 2.5;
  while (yy < fx.y) {
    const k = (yy - (fx.top - size * 2.5)) / (size * 3);
    bolt.push([fx.x + rand(-4, 4) * u * (1 - k * 0.7), yy]);
    yy += rand(2.5, 4.5) * u;
  }
  bolt.push([fx.x, fx.y - 2 * u]);
  return makeEffect(fx, 60, (f) => {
    if (f === STRIKE) {
      for (let i = 0; i < 16; i++) {
        const a = rand(0, Math.PI * 2);
        spawn(fx, { x: fx.x, y: fx.y - 2 * u, vx: Math.cos(a) * rand(0.8, 2) * u, vy: Math.sin(a) * rand(0.8, 2) * u, s: u * 1.2, color: i % 2 ? '#3fe0ff' : '#ffffff', life: rand(8, 16) });
      }
    }
    if (f === ASH) {
      explodePixels(fx, () => [rand(-0.25, 0.25) * u, rand(-0.3, 0) * u], { g: 0.1 * u, life: rand(22, 32), delay: 0 }, 'ash');
      for (const p of fx.particles) if (p.g) p.delay = Math.floor(rand(0, 14));
    }
  }, (ctx, f) => {
    if (f < STRIKE) {
      drawSprite(ctx, fx);
      ctx.fillStyle = `rgba(0, 0, 40, ${0.35 * (f / STRIKE)})`;
      ctx.fillRect(fx.left - size, fx.top - size, size * 3, size * 3);
    } else if (f < ASH) {
      drawSprite(ctx, fx, { tint: f % 4 < 2 ? 'white' : 'dark' });
    }
    if (f >= STRIKE && f < STRIKE + 8 && f % 2 === 0) {
      ctx.lineJoin = 'miter';
      for (const [w, c] of [[3.2 * u, '#3fe0ff'], [1.2 * u, '#ffffff']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        bolt.forEach(([bx, by], i) => (i ? ctx.lineTo(bx, by) : ctx.moveTo(bx, by)));
        ctx.stroke();
      }
    }
  });
}

// ── KNIGHT: SANDWORM — bursts from the ground and swallows the piece ──
function sandworm(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const bottom = fx.y + size / 2;
  const high = fx.top - 3 * u;
  const wormTop = (f) => {
    if (f < 8) return bottom + u;
    if (f < 16) return bottom + (high - bottom) * easeOut((f - 8) / 8);
    if (f < 26) return high;
    if (f < 40) return high + (bottom + 4 * u - high) * ((f - 26) / 14) ** 2;
    return bottom + 6 * u;
  };
  const sand = ['#e8c07a', '#d9a066', '#a86b32'];
  return makeEffect(fx, 56, (f) => {
    if (f < 8 && f % 2 === 0) {
      spawn(fx, { x: fx.x + rand(-6, 6) * u, y: bottom - u, vx: rand(-0.5, 0.5) * u, vy: -rand(0.5, 1.2) * u, s: u * 1.2, color: sand[f % 3], life: 12, g: 0.12 * u });
    }
    if (f === 8 || f === 38) {
      for (let i = 0; i < 18; i++) {
        spawn(fx, { x: fx.x + rand(-6, 6) * u, y: bottom - u, vx: rand(-1.6, 1.6) * u, vy: -rand(1, 2.4) * u, s: u * rand(1, 2), color: sand[i % 3], life: rand(16, 26), g: 0.14 * u });
      }
    }
  }, (ctx, f) => {
    const wt = wormTop(f);
    if (f < 18) {
      const visibleRows = Math.max(0, Math.min(16, Math.floor((wt - fx.top) / u)));
      ctx.save();
      if (f < 8) ctx.translate(Math.sin(f * 2) * u * 0.6, 0);
      drawSprite(ctx, fx, { srcRows: [0, visibleRows] });
      ctx.restore();
    }
    if (wt >= bottom) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx.left - size, fx.top - size * 3, size * 3, bottom - (fx.top - size * 3));
    ctx.clip();
    const w = 12 * u;
    const L = fx.x - w / 2;
    ctx.fillStyle = '#5a3414';
    ctx.fillRect(L - u, wt + 2 * u, w + 2 * u, bottom - wt);
    ctx.fillStyle = '#d9a066';
    ctx.fillRect(L, wt + 2 * u, w, bottom - wt);
    ctx.fillStyle = '#a86b32';
    for (let sy = wt + 5 * u; sy < bottom; sy += 3 * u) ctx.fillRect(L, sy, w, u);
    ctx.fillStyle = '#f2d39b';
    ctx.fillRect(L + u, wt + 2 * u, 2 * u, bottom - wt);
    const open = f < 18 || f > 30;
    if (open) {
      ctx.fillStyle = '#5a3414';
      ctx.fillRect(L - u, wt - u, w + 2 * u, 4 * u);
      ctx.fillStyle = '#2a0f05';
      ctx.fillRect(L + u, wt, w - 2 * u, 3 * u);
      ctx.fillStyle = '#ffffff';
      for (let tx = L + u; tx < L + w - u; tx += 2 * u) {
        ctx.fillRect(tx, wt, u, u);
        ctx.fillRect(tx + u, wt + 2 * u, u, u);
      }
    } else {
      ctx.fillStyle = '#5a3414';
      ctx.fillRect(L, wt - u, w, 3 * u);
      ctx.fillStyle = '#d9a066';
      ctx.fillRect(L + u, wt, w - 2 * u, 2 * u);
      ctx.fillStyle = '#2a0f05';
      ctx.fillRect(L + 2 * u, wt + u, w - 4 * u, u);
    }
    ctx.restore();
  });
}

// ── ROOK: MISSILE — rocket streaks in, explosion blows the pixels apart ──
function missile(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const IMPACT = 12;
  const sx = fx.x - size * 2.6;
  const sy = fx.y - size * 2.6;
  const pos = (f) => {
    const t = (f / IMPACT) ** 1.6;
    return [sx + (fx.x - sx) * t, sy + (fx.y - sy) * t];
  };
  return makeEffect(fx, 56, (f) => {
    if (f < IMPACT) {
      const [mx, my] = pos(f);
      spawn(fx, { x: mx - 3 * u, y: my - 3 * u, vx: rand(-0.2, 0.2) * u, vy: rand(-0.2, 0.2) * u, s: u * rand(2, 3), color: f % 2 ? '#9ca3af' : '#e5e7eb', life: 14, drag: 0.9, shrink: true });
    }
    if (f === IMPACT) {
      explodePixels(fx, (x, y) => {
        const a = Math.atan2(y - fx.y, x - fx.x) + rand(-0.4, 0.4);
        const sp = rand(1.6, 3.4) * u;
        return [Math.cos(a) * sp, Math.sin(a) * sp - u];
      }, { g: 0.14 * u, life: rand(24, 36) });
      for (let i = 0; i < 14; i++) {
        const a = rand(0, Math.PI * 2);
        spawn(fx, { x: fx.x, y: fx.y, vx: Math.cos(a) * rand(0.5, 1.2) * u, vy: Math.sin(a) * rand(0.5, 1.2) * u - 0.3 * u, s: u * rand(3, 5), colors: ['#ffffff', '#ffd83a', '#ff8a1f', '#6b7280'], life: rand(18, 28), drag: 0.92, shrink: true });
      }
    }
  }, (ctx, f) => {
    if (f < IMPACT) {
      drawSprite(ctx, fx, { dx: f > 8 ? rand(-1, 1) * u : 0 });
      const [mx, my] = pos(f);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#120a1a';
      ctx.fillRect(-7 * u, -2 * u, 11 * u, 4 * u);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-6 * u, -u, 9 * u, 2 * u);
      ctx.fillStyle = '#e8282b';
      ctx.fillRect(3 * u, -u, 2 * u, 2 * u);
      ctx.fillRect(-7 * u, -3 * u, 2 * u, 6 * u);
      ctx.fillStyle = f % 2 ? '#ffd83a' : '#ff8a1f';
      ctx.fillRect(-10 * u, -u, 3 * u, 2 * u);
      ctx.restore();
    } else if (f < IMPACT + 12) {
      const t = (f - IMPACT) / 12;
      const r = size * (0.25 + 0.5 * easeOut(t));
      ctx.globalAlpha = 1 - t * 0.8;
      pixelDisc(ctx, fx.x, fx.y, r, '#ff8a1f', u);
      pixelDisc(ctx, fx.x, fx.y, r * 0.7, '#ffd83a', u);
      pixelDisc(ctx, fx.x, fx.y, r * 0.4 * (1 - t), '#ffffff', u);
      ctx.globalAlpha = 1;
    }
  });
}

// ── PAWN: BUBBLE — trapped in a bubble, floats away and POPs ──
function bubble(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const FORM = 10;
  const POP = 40;
  const lift = (f) => (f < FORM ? 0 : -(((f - FORM) / (POP - FORM)) ** 1.3) * size * 1.2);
  return makeEffect(fx, 58, (f) => {
    if (f === POP) {
      const dy = lift(POP - 1);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        spawn(fx, { x: fx.x + Math.cos(a) * size * 0.45, y: fx.y + dy + Math.sin(a) * size * 0.45, vx: Math.cos(a) * 1.2 * u, vy: Math.sin(a) * 1.2 * u, s: u * 1.3, color: i % 2 ? '#bdeaff' : '#ffffff', life: 14 });
      }
      for (const px of spritePixels(fx.code)) {
        const x = fx.left + (px.px + 0.5) * u;
        const y = fx.top + (px.py + 0.5) * u + dy;
        const a = Math.atan2(y - (fx.y + dy), x - fx.x);
        spawn(fx, { x, y, vx: Math.cos(a) * rand(0.4, 1.4) * u, vy: Math.sin(a) * rand(0.4, 1.4) * u, s: u * 0.8, color: px.color, life: rand(16, 26), g: 0.1 * u });
      }
    }
  }, (ctx, f) => {
    if (f >= POP) {
      if (f < POP + 8) drawText(ctx, fx, 'POP!', fx.x, fx.y + lift(POP - 1), '#ffffff');
      return;
    }
    const dy = lift(f);
    const dx = f > FORM ? Math.sin(f * 0.3) * 2 * u : 0;
    const prog = clamp01((f - FORM) / (POP - FORM));
    drawSpriteT(ctx, fx, { dx, dy, scale: 1 - 0.25 * prog, rot: Math.sin(f * 0.2) * 0.15 * prog });
    const r = size * 0.56 * Math.min(1, f / FORM);
    ctx.globalAlpha = 0.28;
    pixelDisc(ctx, fx.x + dx, fx.y + dy, r, '#8fd8ff', u);
    ctx.globalAlpha = 1;
    pixelRing(ctx, fx.x + dx, fx.y + dy, r, '#bdeaff', u * 1.2, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fx.x + dx - r * 0.55, fx.y + dy - r * 0.6, 2 * u, u);
    ctx.fillRect(fx.x + dx - r * 0.65, fx.y + dy - r * 0.45, u, 2 * u);
  });
}

// ── QUEEN: UFO — tractor beam abducts the piece ──
function ufo(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const ARRIVE = 12;
  const BEAM = 14;
  const LIFTED = 38;
  const LEAVE = 44;
  const hover = fx.top - size * 1.05;
  const ufoY = (f) => (f < ARRIVE ? fx.top - size * 3 + (hover - fx.top + size * 3) * easeOut(f / ARRIVE) : hover + Math.sin(f * 0.3) * u);
  const ufoX = (f) => (f < LEAVE ? fx.x : fx.x + (f - LEAVE) ** 2 * 0.06 * size);
  return makeEffect(fx, 62, (f) => {
    if (f >= LEAVE && f % 2 === 0) {
      spawn(fx, { x: ufoX(f) - 6 * u, y: ufoY(f), vx: -0.4 * u, vy: 0, s: u * 1.5, color: f % 4 ? '#3fe0ff' : '#ffffff', life: 12 });
    }
  }, (ctx, f) => {
    const uy = ufoY(f);
    const ux = ufoX(f);
    if (f >= BEAM && f < LIFTED + 2) {
      const topW = size * 0.35;
      const botW = size * 0.95;
      const y0 = uy + 2 * u;
      const y1 = fx.y + size / 2;
      for (let yy = y0; yy < y1; yy += u) {
        const t = (yy - y0) / (y1 - y0);
        const w = topW + (botW - topW) * t;
        ctx.fillStyle = Math.floor((yy - y0) / u + f) % 4 < 2 ? 'rgba(120, 255, 170, 0.32)' : 'rgba(120, 255, 170, 0.18)';
        ctx.fillRect(Math.round(ux - w / 2), Math.round(yy), Math.round(w), Math.ceil(u));
      }
    }
    if (f < BEAM) {
      drawSprite(ctx, fx);
    } else if (f < LIFTED) {
      const t = (f - BEAM) / (LIFTED - BEAM);
      drawSpriteT(ctx, fx, { dy: (uy + size * 0.15 - fx.y) * easeOut(t), scale: 1 - 0.85 * t, rot: Math.sin(f * 0.5) * 0.25 });
    }
    ctx.fillStyle = '#120a1a';
    ctx.fillRect(ux - 10 * u, uy - u, 20 * u, 4 * u);
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(ux - 9 * u, uy, 18 * u, 2 * u);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(ux - 7 * u, uy + 2 * u, 14 * u, u);
    ctx.fillStyle = '#120a1a';
    ctx.fillRect(ux - 5 * u, uy - 5 * u, 10 * u, 4 * u);
    ctx.fillStyle = '#3fe0ff';
    ctx.fillRect(ux - 4 * u, uy - 4 * u, 8 * u, 3 * u);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ux - 3 * u, uy - 4 * u, 2 * u, u);
    const lights = ['#e8282b', '#ffd83a', '#33d873'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = lights[(i + Math.floor(f / 3)) % 3];
      ctx.fillRect(ux - 7 * u + i * 4 * u, uy + u, u, u);
    }
  });
}

// ── ROOK: SNIPER — crosshair locks on, one shot knocks the piece down ──
function sniper(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const LOCK = 16;
  const hitX = fx.x + u;
  const hitY = fx.y - 2 * u;
  return makeEffect(fx, 56, (f) => {
    if (f === LOCK) {
      for (let i = 0; i < 14; i++) {
        spawn(fx, { x: hitX, y: hitY, vx: -rand(0.6, 2.2) * u, vy: rand(-1.4, 1.4) * u, s: u * rand(0.8, 1.5), color: i % 3 ? '#ffd83a' : '#ffffff', life: rand(8, 16), g: 0.08 * u });
      }
    }
    if (f > LOCK && f < LOCK + 24 && f % 3 === 0) {
      spawn(fx, { x: hitX - (f - LOCK) * 0.3 * u, y: hitY, vx: rand(-0.2, 0.2) * u, vy: -0.6 * u, s: u * 2, color: '#9ca3af', life: 16, drag: 0.95, shrink: true });
    }
  }, (ctx, f) => {
    if (f < LOCK) {
      drawSprite(ctx, fx);
    } else {
      const t = clamp01((f - LOCK) / 22);
      const alpha = 1 - clamp01((f - LOCK - 20) / 14);
      drawSpriteT(ctx, fx, { pivot: 'bottom', rot: -t * 1.45, dx: -t * size * 0.3, alpha, tint: f < LOCK + 3 ? 'white' : undefined });
    }
    if (f < LOCK + 2) {
      const r = size * (1.25 - 0.85 * easeOut(Math.min(1, f / LOCK)));
      const col = f >= LOCK - 4 && f % 2 ? '#ffffff' : '#ff3b3b';
      pixelRing(ctx, hitX, hitY, r, col, u, 36, f * 0.05);
      ctx.fillStyle = col;
      ctx.fillRect(hitX - r - 2 * u, hitY - u / 2, 3 * u, u);
      ctx.fillRect(hitX + r - u, hitY - u / 2, 3 * u, u);
      ctx.fillRect(hitX - u / 2, hitY - r - 2 * u, u, 3 * u);
      ctx.fillRect(hitX - u / 2, hitY + r - u, u, 3 * u);
      ctx.fillRect(hitX - u / 2, hitY - u / 2, u, u);
    }
    if (f >= LOCK && f < LOCK + 4) {
      ctx.fillStyle = '#ffd83a';
      ctx.fillRect(hitX, hitY - u / 2, size * 3, u);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(fx.left, fx.top, size, size);
    }
  });
}

// ── QUEEN: GIANT HAND — reaches down, grabs the piece, yanks it away ──
function handGrab(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const REACH = 12;
  const GRAB = 17;
  const handY = (f) => {
    const rest = fx.top + 5 * u;
    if (f < REACH) return fx.top - size * 2 + (rest - fx.top + size * 2) * easeOut(f / REACH);
    if (f < GRAB) return rest;
    return rest - (f - GRAB) ** 2 * 0.012 * size;
  };
  return makeEffect(fx, 52, (f) => {
    if (f === GRAB) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spawn(fx, { x: fx.x, y: fx.top + 4 * u, vx: Math.cos(a) * 1.3 * u, vy: Math.sin(a) * 1.3 * u, s: u * 1.4, color: '#ffd83a', life: 12 });
      }
    }
  }, (ctx, f) => {
    const hy = handY(f);
    const lifted = f >= GRAB ? hy - handY(GRAB) : 0;
    drawSpriteT(ctx, fx, { dy: lifted, rot: f >= GRAB ? Math.sin(f * 0.6) * 0.12 : 0 });
    const hx = fx.x;
    const closed = f >= GRAB - 1;
    // arm + cuff
    ctx.fillStyle = '#120a1a';
    ctx.fillRect(hx - 4 * u, hy - size * 3, 8 * u, size * 3 - 6 * u);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx - 3 * u, hy - size * 3, 6 * u, size * 3 - 6 * u);
    ctx.fillStyle = fx.team;
    ctx.fillRect(hx - 5 * u, hy - 9 * u, 10 * u, 3 * u);
    // palm
    ctx.fillStyle = '#120a1a';
    ctx.fillRect(hx - 6 * u, hy - 6 * u, 12 * u, 6 * u);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx - 5 * u, hy - 5 * u, 10 * u, 4 * u);
    // fingers: spread while reaching, curled around the head once grabbed
    const fingerLen = closed ? 3 : 6;
    for (let i = 0; i < 4; i++) {
      const fxp = closed ? hx - 5 * u + i * 2.6 * u : hx - 7 * u + i * 4.2 * u;
      ctx.fillStyle = '#120a1a';
      ctx.fillRect(fxp - 0.5 * u, hy - u, 2.5 * u, (fingerLen + 1) * u);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fxp, hy - u, 1.5 * u, fingerLen * u);
    }
  });
}

// ── PAWN: ARROW RAIN — volley of arrows pins the piece, it topples over ──
function arrowRain(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const TOPPLE = 24;
  const dir = Math.random() < 0.5 ? -1 : 1;
  const arrows = Array.from({ length: 7 }, (_, i) => ({
    land: 2 + i * 2.6,
    lx: rand(-5, 5) * u, // landing point relative to the piece's bottom-centre
    ly: -rand(3, 13) * u,
  }));
  fx.hit = 0;
  const drawArrow = (ctx, x, y) => {
    // pointing down-right
    for (let k = 1; k <= 6; k++) {
      ctx.fillStyle = '#7a4320';
      ctx.fillRect(x - k * 0.7 * u, y - k * u, u, u);
    }
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x - u / 2, y - u / 2, 1.5 * u, 1.5 * u);
    ctx.fillStyle = '#e8282b';
    ctx.fillRect(x - 5.2 * u, y - 7 * u, 2 * u, 2 * u);
  };
  return makeEffect(fx, 60, (f) => {
    for (const a of arrows) {
      if (Math.floor(a.land) === f) {
        fx.hit = 3;
        for (let i = 0; i < 3; i++) spawn(fx, { x: fx.x + a.lx, y: fx.y + size / 2 + a.ly, vx: rand(-1, 1) * u, vy: -rand(0.5, 1.5) * u, s: u, color: '#ffffff', life: 10, g: 0.1 * u });
      }
    }
    if (fx.hit > 0) fx.hit--;
  }, (ctx, f) => {
    const t = clamp01((f - TOPPLE) / 10);
    const rot = dir * t * Math.PI / 2;
    const alpha = 1 - clamp01((f - 44) / 14);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(fx.x, fx.y + size / 2);
    ctx.rotate(rot);
    ctx.drawImage(spriteImage(fx.code, fx.hit > 0 ? 'white' : undefined), -size / 2, -size, size, size);
    for (const a of arrows) if (f >= a.land) drawArrow(ctx, a.lx, a.ly);
    ctx.restore();
    ctx.globalAlpha = 1;
    for (const a of arrows) {
      if (f < a.land && f > a.land - 6) {
        const k = (a.land - f) / 6;
        drawArrow(ctx, fx.x + a.lx - k * size * 0.7, fx.y + size / 2 + a.ly - k * size * 1.6);
      }
    }
  });
}

// ── KNIGHT: BAT SWARM — bats swarm in and carry the piece off bit by bit ──
function batSwarm(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const ARRIVE = 12;
  const CARRY = 20;
  const bats = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + rand(-0.2, 0.2);
    return { a, r0: size * rand(2, 2.8), phase: rand(0, 6), out: a + rand(-0.6, 0.6) };
  });
  const batPos = (b, f) => {
    if (f < ARRIVE) {
      const r = b.r0 + (size * 0.5 - b.r0) * easeOut(f / ARRIVE);
      return [fx.x + Math.cos(b.a) * r, fx.y + Math.sin(b.a) * r];
    }
    if (f < CARRY + 4) {
      const a = b.a + (f - ARRIVE) * 0.25;
      return [fx.x + Math.cos(a) * size * 0.5, fx.y + Math.sin(a) * size * 0.4];
    }
    const k = f - CARRY - 4;
    const a = b.a + (CARRY + 4 - ARRIVE) * 0.25;
    return [fx.x + Math.cos(a) * size * 0.5 + Math.cos(b.out) * k * 0.08 * size, fx.y + Math.sin(a) * size * 0.4 - k * 0.07 * size];
  };
  return makeEffect(fx, 62, (f) => {
    if (f === CARRY) {
      explodePixels(fx, () => [rand(-0.8, 0.8) * u, -rand(0.3, 1.1) * u], { g: -0.01 * u, drag: 0.98, life: rand(26, 38) });
      for (const p of fx.particles) p.delay = Math.floor(rand(0, 10));
    }
  }, (ctx, f) => {
    if (f < CARRY) drawSprite(ctx, fx, { tint: f >= ARRIVE && f % 4 < 2 ? 'dark' : undefined, dx: f >= ARRIVE ? rand(-0.6, 0.6) * u : 0 });
    if (f > 54) return;
    for (const b of bats) {
      const [bx, by] = batPos(b, f);
      const up = Math.floor(f / 2 + b.phase) % 2 === 0;
      ctx.fillStyle = '#120a1a';
      ctx.fillRect(bx - 1.5 * u, by - u, 3 * u, 2.5 * u);
      ctx.fillStyle = '#4c1d95';
      if (up) {
        ctx.fillRect(bx - 4.5 * u, by - 2 * u, 3 * u, u);
        ctx.fillRect(bx + 1.5 * u, by - 2 * u, 3 * u, u);
        ctx.fillRect(bx - 2.5 * u, by - u, u, u);
        ctx.fillRect(bx + 1.5 * u, by - u, u, u);
      } else {
        ctx.fillRect(bx - 4.5 * u, by + u, 3 * u, u);
        ctx.fillRect(bx + 1.5 * u, by + u, 3 * u, u);
        ctx.fillRect(bx - 2.5 * u, by, u, u);
        ctx.fillRect(bx + 1.5 * u, by, u, u);
      }
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(bx - u, by - 0.5 * u, 0.7 * u, 0.7 * u);
      ctx.fillRect(bx + 0.3 * u, by - 0.5 * u, 0.7 * u, 0.7 * u);
    }
  });
}

// ── KING: NUKE — bomb drops, white-out flash, shockwave, mushroom cloud ──
function nuke(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const BOOM = 11;
  const ground = fx.y + size / 2;
  return makeEffect(fx, 72, (f) => {
    if (f === BOOM) {
      explodePixels(fx, (x, y) => {
        const a = Math.atan2(y - fx.y, x - fx.x) + rand(-0.3, 0.3);
        const sp = rand(2.4, 4.6) * u;
        return [Math.cos(a) * sp, Math.sin(a) * sp - u];
      }, { colors: ['#ffffff', '#ffd83a', '#ff8a1f', '#e8282b', '#3d1410'], life: rand(20, 30), drag: 0.95 });
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        spawn(fx, { x: fx.x, y: ground - u, vx: Math.cos(a) * 3.2 * u, vy: Math.sin(a) * 1.2 * u, s: u * 1.6, color: i % 2 ? '#ffd83a' : '#ffffff', life: 16 });
      }
    }
  }, (ctx, f) => {
    if (f < BOOM) {
      drawSprite(ctx, fx);
      const by = fx.top - size * 2 + (fx.top + 3 * u - fx.top + size * 2) * (f / BOOM) ** 2;
      pixelDisc(ctx, fx.x, by, 3.5 * u, '#120a1a', u);
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(fx.x - 2 * u, by - 2 * u, u, u);
      ctx.fillStyle = '#7a4320';
      ctx.fillRect(fx.x, by - 5 * u, u, 2 * u);
      ctx.fillStyle = f % 2 ? '#ffd83a' : '#ff8a1f';
      ctx.fillRect(fx.x - u / 2, by - 7 * u, 2 * u, 2 * u);
      return;
    }
    const t = (f - BOOM) / 50;
    const cloudAlpha = 1 - clamp01((t - 0.55) / 0.45);
    const capY = ground - size * (0.25 + 1.15 * easeOut(Math.min(1, t * 1.4)));
    const capR = size * (0.2 + 0.38 * easeOut(Math.min(1, t * 1.6)));
    ctx.globalAlpha = cloudAlpha;
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(fx.x - 3 * u, capY, 6 * u, ground - capY);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(fx.x - 2 * u, capY, 4 * u, ground - capY);
    pixelDisc(ctx, fx.x, capY, capR, '#7c2d12', u);
    pixelDisc(ctx, fx.x, capY - u, capR * 0.82, '#ea580c', u);
    pixelDisc(ctx, fx.x, capY - 2 * u, capR * 0.5, '#fbbf24', u);
    pixelDisc(ctx, fx.x - capR * 0.9, capY + capR * 0.3, capR * 0.35, '#9a3412', u);
    pixelDisc(ctx, fx.x + capR * 0.9, capY + capR * 0.3, capR * 0.35, '#9a3412', u);
    ctx.globalAlpha = 1;
    if (f < BOOM + 18) {
      const k = (f - BOOM) / 18;
      ctx.globalAlpha = 1 - k;
      pixelRing(ctx, fx.x, ground - u, size * (0.3 + 1.6 * k), '#ffffff', u * 1.5, 40);
      ctx.globalAlpha = 1;
    }
    if (f < BOOM + 7) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - (f - BOOM) / 7)})`;
      ctx.fillRect(fx.x - size * 2.5, fx.y - size * 2.5, size * 5, size * 5);
    }
  });
}

// ── BISHOP: PLASMA SURGE — orbs charge the piece until it dissolves ──
function plasma(opts) {
  const fx = createBase(opts);
  const { u, size } = fx;
  const CHARGE = 20;
  const IMPLODE = 42;
  return makeEffect(fx, 58, (f) => {
    if (f === CHARGE) {
      explodePixels(fx, () => [rand(-0.4, 0.4) * u, -rand(0.3, 1) * u], { g: -0.01 * u, drag: 0.97, life: rand(22, 32) }, 'plasma');
      for (const p of fx.particles) p.delay = Math.floor(rand(0, 12));
    }
    if (f === IMPLODE) {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        spawn(fx, { x: fx.x + Math.cos(a) * size * 0.7, y: fx.y + Math.sin(a) * size * 0.7, vx: -Math.cos(a) * 1.6 * u, vy: -Math.sin(a) * 1.6 * u, s: u * 1.4, color: i % 2 ? '#e879f9' : '#ffffff', life: 9 });
      }
    }
  }, (ctx, f) => {
    if (f < CHARGE) {
      drawSprite(ctx, fx, { dx: rand(-0.5, 0.5) * u * (f / CHARGE) });
      drawSprite(ctx, fx, { tint: 'plasma', alpha: f / CHARGE });
    }
    if (f < IMPLODE) {
      const shrink = 1 - 0.55 * Math.min(1, f / CHARGE);
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = f * 0.28 + (i / 6) * Math.PI * 2;
        const ox = fx.x + Math.cos(a) * size * 0.6 * shrink;
        const oy = fx.y + Math.sin(a) * size * 0.45 * shrink;
        pts.push([ox, oy]);
        pixelDisc(ctx, ox, oy, 1.6 * u, i % 2 ? '#e879f9' : '#a855f7', u * 0.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox - u / 2, oy - u / 2, u, u);
      }
      if (f % 3 === 0) {
        const [ox, oy] = pts[Math.floor(rand(0, 6))];
        ctx.strokeStyle = f % 2 ? '#ffffff' : '#f0abfc';
        ctx.lineWidth = Math.max(1, u * 0.7);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo((ox + fx.x) / 2 + rand(-2, 2) * u, (oy + fx.y) / 2 + rand(-2, 2) * u);
        ctx.lineTo(fx.x, fx.y);
        ctx.stroke();
      }
    }
  });
}

const FACTORIES = {
  stomp, arrowRain, bubble,
  slash, batSwarm, sandworm,
  freeze, thunder, plasma,
  anvil, missile, sniper,
  blackhole, ufo, handGrab,
  burn, nuke,
  shatter,
};

export function createElimination({ kind, code, x, y, size, attackerColor }) {
  const make = FACTORIES[kind] || shatter;
  return make({ code, x, y, size, attackerColor });
}
