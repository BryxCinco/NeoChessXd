import { SPRITES, PALETTE, EYE_COLORS } from './sprites/pieceSprites.js';

// ── PIECE SKINS ──
// A skin decides what all twelve pieces look like. Every piece is a 16x16
// pixel grid plus the colours it uses:
//
//   skin  = { id, name, description, pieces: { wK, wQ, ... bP } }
//   piece = { rows, palette, eyes, draw(ctx, x, y, size) }
//
//   rows     16 strings of 16 characters; '.' is transparent
//   palette  { character: '#rrggbb' }
//   eyes     characters drawn on the separate, blinking eye layer
//   draw     paints the piece on a canvas (used by the capture effects)
//
// The board draws pieces as SVG (see pixelPieces.jsx, which turns `rows`
// into one path per colour); the capture effects use the same grids on a
// canvas. To add a skin, build its twelve pieces and add it to PIECE_SKINS.
//
// RED is always chess "white" (codes starting with w), BLUE is "black".

export const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
export const DEFAULT_PIECE_SKIN = 'classic';

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

function makePiece(rows, palette, eyes) {
  const piece = { rows, palette, eyes };
  piece.draw = (ctx, x, y, size) => {
    const u = size / 16;
    rows.forEach((row, py) => {
      for (let px = 0; px < 16; px++) {
        const ch = row[px];
        if (ch === '.') continue;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(x + px * u, y + py * u, u, u);
      }
    });
  };
  return piece;
}

// ── CLASSIC: the original plumbers vs hedgehogs ──
const classicPieces = Object.fromEntries(PIECE_CODES.map((code) => [code, makePiece(SPRITES[code], PALETTE, EYE_COLORS)]));

// ── NEON: the classic shapes as glowing tubes on a dark body ──
// Outline → bright team colour, bright details → mid tone, everything else
// → near-black fill, plus a dim one-pixel halo around the silhouette.
const NEON_TEAM = {
  w: { N: '#ff2e63', M: '#96193d', F: '#16061a', H: '#5c0a26', E: '#ffffff', G: '#ffe3ea' },
  b: { N: '#22b8ff', M: '#10548f', F: '#060d20', H: '#07375f', E: '#ffffff', G: '#b8ffd9' },
};
const NEON_EYES = new Set(['E', 'G']);

function neonRows(rows) {
  const filled = (x, y) => y >= 0 && y < 16 && x >= 0 && x < 16 && rows[y][x] !== '.';
  return rows.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch === '.') return filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1) ? 'H' : '.';
        if (ch === 'K') return 'N';
        if (EYE_COLORS.has(ch)) return ch === 'G' ? 'G' : 'E';
        return luminance(PALETTE[ch]) > 0.6 ? 'M' : 'F';
      })
      .join('')
  );
}

const neonPieces = Object.fromEntries(
  PIECE_CODES.map((code) => [code, makePiece(neonRows(SPRITES[code]), NEON_TEAM[code[0]], NEON_EYES)])
);

// ── CURSED: skulls, bone and dripping cloaks ──
// One hand-drawn shape per piece type, coloured per team.
//   K outline   W bone   w bone shadow   T cloak   t cloak shadow
//   D drip      Y gold   E glowing eye (blinks)
const CURSED_SHAPES = {
  P: [
    '................',
    '................',
    '.....KKKKKK.....',
    '....KWWWWWWK....',
    '...KWWWWWWWWK...',
    '...KWEEWWEEWK...',
    '...KWEEWWEEWK...',
    '...KWWWKKWWWK...',
    '....KWWWWWWK....',
    '....KWKWKWKK....',
    '.....KKKKKK.....',
    '....KTTTTTTK....',
    '...KTTTDTTTTK...',
    '...KTtTDTTtTK...',
    '..KttttDtttttK..',
    '..KKKKKKKKKKKK..',
  ],
  N: [
    '................',
    '......KK.KK.....',
    '.....KWWKWWK....',
    '....KWWWWWWWK...',
    '...KWWEEWWWWTK..',
    '..KWWWEEWWWWTTK.',
    '.KWWWWWWWWWWTTK.',
    '.KWKWWWWWKWWTTK.',
    '.KWWWWWKKWWWTTK.',
    '..KKWKWKKWWWTTK.',
    '...KKKKKWWWWTK..',
    '......KWWWWTK...',
    '.....KTTTTTTK...',
    '....KTTDTTTTTK..',
    '...KttttDtttttK.',
    '...KKKKKKKKKKKK.',
  ],
  B: [
    '.......KK.......',
    '......KTTK......',
    '.....KTTTTK.....',
    '....KTTTTTTK....',
    '....KTKKKKTK....',
    '...KTKWWWWKTK...',
    '...KTKEWWEKTK...',
    '...KTKWKKWKTK...',
    '...KTTKWWKTTK...',
    '....KTTKKTTK....',
    '....KTTTTTTK....',
    '....KtTTDTTK....',
    '...KTtTTDTTTK...',
    '...KTtTTTTDTK...',
    '..KtttTTTttttK..',
    '..KKKKKKKKKKKK..',
  ],
  R: [
    '................',
    '..KKK.KKKK.KKK..',
    '..KTK.KTTK.KTK..',
    '..KTKKKTTKKKTK..',
    '..KTTTTTTTTTTK..',
    '..KKKKKKKKKKKK..',
    '...KwWWWWWWwK...',
    '...KwEEWWEEwK...',
    '...KwEEWWEEwK...',
    '...KwWWKKWWwK...',
    '...KwWKWKWWwK...',
    '...KTTTTTTTTK...',
    '...KwWDWWWWwK...',
    '..KwwWDWWDWwwK..',
    '..KTTTTTTTTTTK..',
    '..KKKKKKKKKKKK..',
  ],
  Q: [
    '................',
    '..K...K..K...K..',
    '..KT.KTKKTK.TK..',
    '..KTKTTTTTTKTK..',
    '..KTTTTYYTTTTK..',
    '..KKKKKKKKKKKK..',
    '...KWWWWWWWWK...',
    '...KWEEWWEEWK...',
    '...KWEEWWEEWK...',
    '...KWWWKKWWWK...',
    '....KWKWWKWK....',
    '....KKKKKKKK....',
    '...KTTTDTTTTK...',
    '..KTTtTDTTDTTK..',
    '..KtttttDttttK..',
    '..KKKKKKKKKKKK..',
  ],
  K: [
    '.......KK.......',
    '......KYYK......',
    '.....KKYYKK.....',
    '..KK.KYYYYK.KK..',
    '..KTKKKYYKKKTK..',
    '..KTTTTTTTTTTK..',
    '..KKKKKKKKKKKK..',
    '...KWWWWWWWWK...',
    '...KWEEWWEEWK...',
    '...KWEEWWEEWK...',
    '...KWWWKKWWWK...',
    '....KWKWKWKK....',
    '....KKKKKKKK....',
    '..KTTTTDTTTTTK..',
    '..KtttTDTtDttK..',
    '..KKKKKKKKKKKK..',
  ],
};
const CURSED_TEAM = {
  w: { K: '#120a1a', W: '#f3e9cf', w: '#b9aa84', T: '#c81e28', t: '#7a0f18', D: '#ff5a4d', Y: '#ffd83a', E: '#ff2a2a' },
  b: { K: '#120a1a', W: '#e2ecf7', w: '#9db0c8', T: '#2a5cf0', t: '#162f8f', D: '#7fe6ff', Y: '#ffd83a', E: '#2ad4ff' },
};
const CURSED_EYES = new Set(['E']);

const cursedPieces = Object.fromEntries(
  PIECE_CODES.map((code) => [code, makePiece(CURSED_SHAPES[code[1]], CURSED_TEAM[code[0]], CURSED_EYES)])
);

export const PIECE_SKINS = {
  classic: { id: 'classic', name: 'CLASSIC', description: 'PLUMBERS VS HEDGEHOGS', pieces: classicPieces },
  neon: { id: 'neon', name: 'NEON', description: 'GLOWING OUTLINES, DARK FILL', pieces: neonPieces },
  cursed: { id: 'cursed', name: 'CURSED', description: 'SKULLS, BONE AND DRIPS', pieces: cursedPieces },
};

export const getPieceSkin = (id) => PIECE_SKINS[id] || PIECE_SKINS[DEFAULT_PIECE_SKIN];

// ── SVG layers: one path per colour, horizontal runs merged ──
// Built on first use and kept, so each piece on the board is only a
// handful of <path> elements.
const layerCache = new Map();
export function pieceLayers(skinId, code) {
  const skin = getPieceSkin(skinId);
  const key = `${skin.id}:${code}`;
  if (layerCache.has(key)) return layerCache.get(key);
  const piece = skin.pieces[code];
  if (!piece) return null;

  const body = {};
  const eyes = {};
  piece.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        const target = piece.eyes.has(ch) ? eyes : body;
        (target[ch] ||= []).push(`M${x} ${y}h${end - x}v1h${x - end}z`);
      }
      x = end;
    }
  });
  const toPaths = (layer) => Object.entries(layer).map(([ch, d]) => ({ key: ch, fill: piece.palette[ch], d: d.join('') }));
  const layers = { body: toPaths(body), eyes: toPaths(eyes) };
  layerCache.set(key, layers);
  return layers;
}

// ── the skin in use ──
// The canvas effects live outside React, so the chosen skin is also kept
// here (set by useSettings) for them to read.
let activeSkinId = DEFAULT_PIECE_SKIN;
export function setActivePieceSkin(id) {
  activeSkinId = getPieceSkin(id).id;
}
export const getActivePieceSkin = () => PIECE_SKINS[activeSkinId];
