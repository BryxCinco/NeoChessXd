// ── PIXEL-ART BACKDROPS ──
// One hand-built scene per theme, drawn on a 160x90 "pixel" grid and
// returned as an SVG data URI (no image files, nothing to download, and it
// scales to any screen with hard pixel edges). The page shows it behind
// everything; see applyTheme() in themes.js.
const W = 160;
const H = 90;

// Small deterministic random generator, so a scene looks the same on every
// visit (and in every test run).
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function canvas() {
  const parts = [];
  const api = {
    rect(x, y, w, h, fill, opacity) {
      if (w <= 0 || h <= 0) return api;
      parts.push(`<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}'${opacity === undefined ? '' : ` opacity='${opacity}'`}/>`);
      return api;
    },
    // filled circle made of 1-pixel rows; colorAt(row 0..1) picks each row's colour
    disc(cx, cy, r, colorAt, skipRow = () => false) {
      for (let dy = -r; dy <= r; dy++) {
        if (skipRow(dy)) continue;
        const half = Math.round(Math.sqrt(r * r - dy * dy));
        const fill = typeof colorAt === 'function' ? colorAt((dy + r) / (2 * r)) : colorAt;
        api.rect(cx - half, cy + dy, half * 2, 1, fill);
      }
      return api;
    },
    // horizontal bands from top to bottom: [[untilY, colour], ...]
    bands(list) {
      let y = 0;
      for (const [until, fill] of list) {
        api.rect(0, y, W, until - y, fill);
        y = until;
      }
      return api;
    },
    // a ridge: column heights from a function, filled down to `base`
    ridge(base, heightAt, fill, step = 1) {
      for (let x = 0; x < W; x += step) {
        const h = Math.max(0, Math.round(heightAt(x)));
        api.rect(x, base - h, step, h, fill);
      }
      return api;
    },
    raw(svg) {
      parts.push(svg);
      return api;
    },
    toDataUri() {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='xMidYMax slice' shape-rendering='crispEdges'>${parts.join('')}</svg>`;
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    },
  };
  return api;
}

function stars(c, random, count, maxY, colors) {
  for (let i = 0; i < count; i++) {
    c.rect(Math.floor(random() * W), Math.floor(random() * maxY), 1, 1, colors[i % colors.length], 0.4 + random() * 0.6);
  }
}

// A puffy pixel cloud, w wide.
function cloud(c, x, y, w, light, shade) {
  c.rect(x + 2, y, w - 4, 1, light);
  c.rect(x + 1, y + 1, w - 2, 1, light);
  c.rect(x, y + 2, w, 2, light);
  c.rect(x + Math.floor(w / 3), y - 1, Math.floor(w / 3), 1, light);
  c.rect(x + 1, y + 4, w - 2, 1, shade);
}

// ── GAME BOY: four greens, hills, and LCD grid lines ──
function gameboy() {
  const c = canvas();
  const [darkest, dark, mid, light] = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
  c.rect(0, 0, W, H, light);
  c.disc(124, 20, 9, mid).disc(124, 20, 7, light);
  cloud(c, 14, 14, 22, mid, mid);
  cloud(c, 62, 8, 16, mid, mid);
  cloud(c, 96, 30, 20, mid, mid);
  c.ridge(70, (x) => 16 + 9 * Math.sin(x / 17) + 5 * Math.sin(x / 7 + 2), mid);
  c.ridge(78, (x) => 12 + 7 * Math.sin(x / 11 + 1) + 3 * Math.sin(x / 5), dark, 2);
  // pines
  for (const [x, h] of [[10, 12], [22, 9], [48, 14], [118, 11], [140, 15], [152, 9]]) {
    for (let i = 0; i < h; i += 3) c.rect(x - 1 - Math.floor(i / 3), 76 - h + i, 3 + 2 * Math.floor(i / 3), 3, darkest);
    c.rect(x, 76, 1, 3, darkest);
  }
  c.rect(0, 78, W, 12, darkest);
  for (let x = 0; x < W; x += 8) c.rect(x + ((x / 8) % 2 ? 2 : 5), 81 + ((x / 8) % 3), 2, 1, dark);
  // LCD grid: faint lines between every pixel
  c.raw(`<defs><pattern id='lcd' width='2' height='2' patternUnits='userSpaceOnUse'><rect width='2' height='0.35' fill='${darkest}' opacity='0.18'/><rect width='0.35' height='2' fill='${darkest}' opacity='0.18'/></pattern></defs><rect width='${W}' height='${H}' fill='url(#lcd)'/>`);
  return c.toDataUri();
}

// ── NES: 8-bit sky, clouds, hills, bricks ──
function nes() {
  const c = canvas();
  c.rect(0, 0, W, H, '#5c94fc');
  cloud(c, 12, 10, 24, '#ffffff', '#a4e4fc');
  cloud(c, 70, 20, 18, '#ffffff', '#a4e4fc');
  cloud(c, 118, 8, 28, '#ffffff', '#a4e4fc');
  cloud(c, 40, 36, 14, '#ffffff', '#a4e4fc');
  // rounded hills with spots
  const hill = (cx, r) => {
    c.disc(cx, 74, r, '#00a800', (dy) => dy > 0);
    c.rect(cx - 2, 74 - r + 4, 2, 3, '#005800').rect(cx + 3, 74 - r + 7, 2, 3, '#005800').rect(cx - 7, 74 - r + 10, 2, 3, '#005800');
  };
  hill(28, 18);
  hill(128, 13);
  // bushes
  for (const x of [58, 66, 74, 150]) c.disc(x, 74, 4, '#80d010', (dy) => dy > 0);
  // floating blocks
  const brick = (x, y) => {
    c.rect(x, y, 8, 8, '#c84c0c').rect(x, y, 8, 1, '#fca044').rect(x, y + 7, 8, 1, '#000000');
    c.rect(x, y + 3, 8, 1, '#000000').rect(x + 3, y, 1, 3, '#000000').rect(x + 6, y + 4, 1, 3, '#000000');
  };
  const question = (x, y) => {
    c.rect(x, y, 8, 8, '#fca044').rect(x, y, 8, 1, '#ffe0a8').rect(x, y + 7, 8, 1, '#7c3400').rect(x + 7, y, 1, 8, '#7c3400');
    c.rect(x + 3, y + 2, 2, 1, '#7c3400').rect(x + 4, y + 3, 1, 1, '#7c3400').rect(x + 3, y + 4, 1, 1, '#7c3400').rect(x + 3, y + 6, 1, 1, '#7c3400');
  };
  brick(84, 46);
  question(92, 46);
  brick(100, 46);
  question(40, 52);
  // ground: two rows of bricks
  for (let x = 0; x < W; x += 8) {
    brick(x, 74);
    brick(x, 82);
  }
  return c.toDataUri();
}

// ── CRT AMBER: black screen, amber scanlines, glow, noise ──
function amber() {
  const c = canvas();
  const random = seeded(7);
  c.rect(0, 0, W, H, '#0a0600');
  c.raw(`<defs><radialGradient id='glow' cx='50%' cy='45%' r='65%'><stop offset='0' stop-color='#ffb000' stop-opacity='0.30'/><stop offset='0.6' stop-color='#ffb000' stop-opacity='0.08'/><stop offset='1' stop-color='#ffb000' stop-opacity='0'/></radialGradient><pattern id='scan' width='2' height='2' patternUnits='userSpaceOnUse'><rect width='2' height='1' fill='#ffb000' opacity='0.07'/></pattern></defs><rect width='${W}' height='${H}' fill='url(#glow)'/>`);
  // wireframe mountains on the horizon
  const height = (x) => 14 + 10 * Math.sin(x / 13) + 6 * Math.sin(x / 5 + 1) + 4 * Math.sin(x / 29);
  for (let x = 0; x < W; x++) {
    const y = 72 - Math.round(height(x));
    c.rect(x, y, 1, 1, '#ffb000', 0.75);
    if (x % 8 === 0) c.rect(x, y + 1, 1, 72 - y - 1, '#ffb000', 0.18);
  }
  c.rect(0, 72, W, 1, '#ffb000', 0.8);
  // floor grid
  for (const y of [75, 79, 84, 89]) c.rect(0, y, W, 1, '#ffb000', 0.3);
  for (let i = -8; i <= 8; i++) c.raw(`<line x1='${80 + i * 4}' y1='72' x2='${80 + i * 26}' y2='90' stroke='#ffb000' stroke-width='0.5' opacity='0.3'/>`);
  // phosphor noise
  for (let i = 0; i < 260; i++) c.rect(Math.floor(random() * W), Math.floor(random() * 72), 1, 1, '#ffb000', 0.08 + random() * 0.3);
  c.raw(`<rect width='${W}' height='${H}' fill='url(#scan)'/>`);
  return c.toDataUri();
}

// ── CURSED: blood-red sky, moon, graveyard, fog, drips ──
function cursed() {
  const c = canvas();
  const random = seeded(13);
  c.bands([[14, '#120204'], [30, '#240408'], [46, '#3a070c'], [60, '#551014'], [72, '#701a1a'], [H, '#0a0203']]);
  stars(c, random, 40, 40, ['#ffb0a0', '#ffffff']);
  // moon with craters
  c.disc(112, 26, 13, '#e8d8b0').disc(108, 22, 3, '#cdbb90').disc(118, 30, 2, '#cdbb90').disc(111, 33, 1, '#cdbb90');
  // far hills
  c.ridge(72, (x) => 6 + 5 * Math.sin(x / 19) + 3 * Math.sin(x / 7 + 1), '#2a0508');
  // dead trees
  const tree = (x, h) => {
    c.rect(x, 72 - h, 2, h, '#050102');
    c.rect(x - 4, 72 - h + 3, 4, 1, '#050102').rect(x - 4, 72 - h + 1, 1, 2, '#050102');
    c.rect(x + 2, 72 - h + 6, 5, 1, '#050102').rect(x + 6, 72 - h + 3, 1, 3, '#050102');
    c.rect(x - 2, 72 - h + 9, 2, 1, '#050102').rect(x + 1, 72 - h - 3, 1, 3, '#050102');
  };
  tree(18, 26);
  tree(146, 22);
  // tombstones and crosses
  for (const [x, kind] of [[36, 0], [52, 1], [66, 0], [84, 1], [98, 0], [126, 1], [6, 1]]) {
    if (kind === 0) {
      c.rect(x, 66, 6, 6, '#050102').rect(x + 1, 65, 4, 1, '#050102').rect(x + 2, 67, 2, 1, '#3a070c');
    } else {
      c.rect(x + 2, 62, 2, 10, '#050102').rect(x, 65, 6, 2, '#050102');
    }
  }
  // skulls on the ground
  for (const x of [44, 74, 112, 136]) {
    c.rect(x, 78, 5, 3, '#cdbb90').rect(x + 1, 81, 3, 1, '#cdbb90').rect(x + 1, 79, 1, 1, '#120204').rect(x + 3, 79, 1, 1, '#120204');
  }
  // fog
  for (const [y, o] of [[58, 0.1], [63, 0.14], [69, 0.18], [74, 0.12]]) {
    for (let x = -10; x < W; x += 26) c.rect(x + Math.floor(random() * 10), y, 18 + Math.floor(random() * 10), 2, '#e8c8c0', o);
  }
  // blood dripping from the top edge
  c.rect(0, 0, W, 2, '#8a0a12');
  for (let x = 2; x < W; x += 5) {
    const len = 2 + Math.floor(random() * 11);
    c.rect(x, 2, 2, len, '#8a0a12').rect(x, 2 + len, 2, 1, '#c8141c');
  }
  return c.toDataUri();
}

// ── NEON: night sky, synthwave sun, glowing grid ──
function neon() {
  const c = canvas();
  const random = seeded(21);
  const horizon = 60;
  c.bands([[16, '#0b0624'], [30, '#150a36'], [42, '#27104e'], [52, '#45146a'], [horizon, '#6e1c80'], [H, '#0a0420']]);
  stars(c, random, 70, 44, ['#ffffff', '#ff8ae0', '#7ae8ff']);
  // sun: yellow at the top to pink at the bottom, sliced by dark stripes
  const sunColors = ['#fff275', '#ffd447', '#ffa53c', '#ff6b5e', '#ff3d8b', '#e0218a'];
  c.disc(80, horizon - 4, 20, (t) => sunColors[Math.min(sunColors.length - 1, Math.floor(t * sunColors.length))], (dy) => dy > 4 || (dy > -6 && (dy + 6) % 4 === 3));
  // mountains with a cyan rim
  const peak = (x) => Math.max(0, 16 - Math.abs(((x + 20) % 54) - 27) * 0.75) + 3 * Math.sin(x / 6);
  for (let x = 0; x < W; x++) {
    if (x > 52 && x < 108) continue; // leave the sun visible
    const h = Math.max(1, Math.round(peak(x)));
    c.rect(x, horizon - h, 1, h, '#12062e').rect(x, horizon - h, 1, 1, '#22e0ff', 0.8);
  }
  // ground grid
  c.rect(0, horizon, W, 1, '#ff4fd8');
  for (const y of [63, 67, 72, 78, 85]) c.rect(0, y, W, 1, '#ff4fd8', 0.75);
  for (let i = -10; i <= 10; i++) c.raw(`<line x1='${80 + i * 5}' y1='${horizon}' x2='${80 + i * 30}' y2='${H}' stroke='#ff4fd8' stroke-width='0.6' opacity='0.75'/>`);
  c.rect(0, horizon + 1, W, 3, '#ff4fd8', 0.15);
  return c.toDataUri();
}

const BUILDERS = { gameboy, nes, amber, cursed, neon };
const cache = new Map();

// Data URI of a theme's scene, or null when the theme has none.
export function sceneFor(id) {
  if (!BUILDERS[id]) return null;
  if (!cache.has(id)) cache.set(id, BUILDERS[id]());
  return cache.get(id);
}
