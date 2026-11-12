// Generates public/og-image.png (1200x630), the social-share preview image.
// Pure Node, no dependencies: pixels are drawn into an RGBA buffer using the
// game's own 16x16 piece sprites plus a tiny 5x7 bitmap font, then encoded
// as a PNG with node:zlib.
//
//   node scripts/make-og-image.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { SPRITES, PALETTE } from '../src/sprites/pieceSprites.js';

const W = 1200;
const H = 630;
const px = Buffer.alloc(W * H * 4);

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

function rect(x, y, w, h, color) {
  const [r, g, b] = hex(color);
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
      const i = (yy * W + xx) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
}

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const textWidth = (str, scale) => str.length * 6 * scale - scale;

function text(str, x, y, scale, color) {
  [...str].forEach((ch, n) => {
    FONT[ch].forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit === '1') rect(x + (n * 6 + rx) * scale, y + ry * scale, scale, scale, color);
      });
    });
  });
}

// Centred text with a hard pixel drop shadow.
function title(str, y, scale, color, shadow) {
  const x = Math.round((W - textWidth(str, scale)) / 2);
  text(str, x + scale, y + scale, scale, shadow);
  text(str, x, y, scale, color);
}

function sprite(code, x, y, scale) {
  SPRITES[code].forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch !== '.') rect(x + rx * scale, y + ry * scale, scale, scale, PALETTE[ch]);
    });
  });
}

// ── background: dark checkerboard ──
const SQ = 90;
for (let y = 0; y < H; y += SQ) {
  for (let x = 0; x < W; x += SQ) {
    rect(x, y, SQ, SQ, ((x + y) / SQ) % 2 === 0 ? '#1d1230' : '#140b22');
  }
}

// ── title ──
title('NEO CHESS DX', 78, 14, '#ffd83a', '#000000');

// ── the two armies facing off ──
const S = 9; // sprite scale -> 144 px
const GAP = 14;
const VS_SCALE = 8;
const army = (codes) => codes.length * 16 * S + (codes.length - 1) * GAP;
const red = ['wR', 'wN', 'wK'];
const blue = ['bK', 'bN', 'bR'];
const vsW = textWidth('VS', VS_SCALE);
const rowW = army(red) + 36 + vsW + 36 + army(blue);
let x = Math.round((W - rowW) / 2);
const rowY = 252;
for (const code of red) { sprite(code, x, rowY, S); x += 16 * S + GAP; }
x += 36 - GAP;
text('VS', x + VS_SCALE, rowY + 52 + VS_SCALE, VS_SCALE, '#000000');
text('VS', x, rowY + 52, VS_SCALE, '#ffffff');
x += vsW + 36;
for (const code of blue) { sprite(code, x, rowY, S); x += 16 * S + GAP; }

// ── subtitle ──
title('RETRO PIXEL CHESS', 470, 6, '#3fe0ff', '#000000');

// ── CRT scanlines + gold frame ──
for (let y = 0; y < H; y += 3) {
  for (let i = y * W * 4; i < (y + 1) * W * 4; i += 4) {
    px[i] = px[i] * 0.86; px[i + 1] = px[i + 1] * 0.86; px[i + 2] = px[i + 2] * 0.86;
  }
}
const FRAME = 12;
for (const [fx, fy, fw, fh] of [[0, 0, W, FRAME], [0, H - FRAME, W, FRAME], [0, 0, FRAME, H], [W - FRAME, 0, FRAME, H]]) {
  rect(fx, fy, fw, fh, '#ffcc00');
}

// ── PNG encoding ──
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(W, 0);
header.writeUInt32BE(H, 4);
header[8] = 8; // bit depth
header[9] = 2; // colour type: RGB
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  const rowStart = y * (W * 3 + 1);
  raw[rowStart] = 0; // filter: none
  for (let xx = 0; xx < W; xx++) {
    const s = (y * W + xx) * 4;
    raw[rowStart + 1 + xx * 3] = px[s];
    raw[rowStart + 2 + xx * 3] = px[s + 1];
    raw[rowStart + 3 + xx * 3] = px[s + 2];
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = new URL('../public/og-image.png', import.meta.url);
writeFileSync(out, png);
console.log(`Wrote public/og-image.png (${W}x${H}, ${(png.length / 1024).toFixed(1)} KB)`);
