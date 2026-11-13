// Generates the app icon in every size the site needs, from one 32x32
// pixel-art design: the red knight and the blue knight clashing head to
// head, a lightning bolt striking the point of impact, on a split
// red/blue "VS" background above a strip of chessboard.
//
//   node scripts/make-icons.mjs
//
// Writes to public/: icon.svg (scalable, crisp at any size), favicon-32.png,
// apple-touch-icon.png (192), icon-192.png, icon-512.png, site.webmanifest.
// Pure Node, no dependencies (PNG encoded with node:zlib).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { SPRITES, PALETTE } from '../src/sprites/pieceSprites.js';

const N = 32;
const grid = Array.from({ length: N }, () => Array(N).fill(null));
const put = (x, y, color) => {
  if (x >= 0 && x < N && y >= 0 && y < N && color) grid[y][x] = color;
};
const fill = (x, y, w, h, color) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, color);
};

// ── background: red side vs blue side, glowing brighter near the clash ──
const RED_SKY = ['#1c0309', '#2a050d', '#3b0812', '#4f0c18', '#66111f', '#7d1726'];
const BLUE_SKY = ['#030820', '#05102f', '#081a44', '#0c255c', '#123275', '#18408f'];
for (let y = 0; y < 28; y++) {
  const band = Math.min(5, Math.floor(y / 4));
  fill(0, y, 16, 1, RED_SKY[band]);
  fill(16, y, 16, 1, BLUE_SKY[band]);
}
// stars
for (const [x, y, c] of [[4, 3, '#ffffff'], [9, 6, '#ffb3b3'], [3, 9, '#ff8a8a'], [27, 4, '#ffffff'], [23, 8, '#9fd0ff'], [29, 10, '#bfe2ff'], [11, 2, '#ffd83a'], [21, 2, '#ffd83a']]) put(x, y, c);

// ── shock rays bursting out of the point of impact (behind the knights) ──
const CX = 15.5;
const CY = 20.5;
const RAY = ['#ffd83a', '#ff8a3d', '#ffd83a', '#ff5a3d'];
[-162, -140, -118, -62, -40, -18, 200, -20 - 180].forEach((deg, i) => {
  const a = (deg * Math.PI) / 180;
  for (let r = 3; r < 17; r++) {
    const x = Math.round(CX + Math.cos(a) * r);
    const y = Math.round(CY + Math.sin(a) * r);
    if (r % 5 === 4) continue; // dashed: reads as speed, not as a solid line
    put(x, y, RAY[i % RAY.length]);
  }
});

// ── chessboard floor ──
fill(0, 27, N, 1, '#120a1a');
for (let y = 28; y < N; y++) for (let x = 0; x < N; x++) put(x, y, (Math.floor(x / 4) + Math.floor((y - 28) / 4)) % 2 ? '#2e2017' : '#e8cfa6');

// ── lightning bolt from the top down into the clash ──
const BOLT = [
  [16, 0], [16, 1], [17, 2], [17, 3], [18, 4], [17, 5], [16, 6], [15, 7],
  [14, 8], [15, 9], [16, 10], [17, 11], [17, 12], [16, 13], [15, 14], [15, 15], [16, 16], [16, 17],
];
for (const [x, y] of BOLT) {
  put(x - 1, y, '#120a1a');
  put(x, y, '#ffd83a');
  put(x + 1, y, '#fff6c2');
  put(x + 2, y, '#120a1a');
}

// ── the two knights (the game's own sprites), snout to snout ──
// Red faces right (its sprite mirrored), blue faces left.
function sprite(code, ox, oy, mirror) {
  SPRITES[code].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      put(ox + (mirror ? 15 - x : x), oy + y, PALETTE[ch]);
    });
  });
}
sprite('wN', 0, 12, true);
sprite('bN', 16, 12, false);

// ── impact flash where the snouts meet ──
const W_ = '#ffffff';
const Y_ = '#ffd83a';
const O_ = '#ff8a3d';
for (const [x, y, c] of [
  [15, 18, W_], [16, 18, W_], [15, 19, W_], [16, 19, W_], [15, 20, W_], [16, 20, W_], [15, 21, Y_], [16, 21, Y_],
  [14, 19, Y_], [17, 19, Y_], [15, 17, Y_], [16, 22, O_], [15, 22, O_],
  [13, 17, Y_], [18, 17, Y_], [12, 16, O_], [19, 16, O_],
]) put(x, y, c);

// ── frame: dark outline with stepped (pixel) rounded corners ──
const CUT = [3, 2, 1]; // pixels cut from each corner, per row from the edge
for (let i = 0; i < CUT.length; i++) {
  for (let j = 0; j < CUT[i]; j++) {
    put(j, i, 'cut'); put(N - 1 - j, i, 'cut');
    put(j, N - 1 - i, 'cut'); put(N - 1 - j, N - 1 - i, 'cut');
  }
}
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N && grid[y][x] !== 'cut';
const border = [];
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (edge) border.push([x, y]);
  }
}
for (const [x, y] of border) grid[y][x] = '#120a1a';
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (grid[y][x] === 'cut') grid[y][x] = null;

// ── SVG: one path per colour, horizontal runs merged ──
const byColor = {};
grid.forEach((row, y) => {
  let x = 0;
  while (x < N) {
    const c = row[x];
    let end = x;
    while (end < N && row[end] === c) end++;
    if (c) (byColor[c] ||= []).push(`M${x} ${y}h${end - x}v1h${x - end}z`);
    x = end;
  }
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">
<title>CHESS FANTASY</title>
${Object.entries(byColor).map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('\n')}
</svg>
`;
writeFileSync('public/icon.svg', svg);

// ── PNGs (nearest-neighbour, so every pixel stays a sharp square) ──
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
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
// `background` fills the transparent corners (iOS shows those as black).
function png(size, file, background = null) {
  const scale = size / N;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const c = grid[Math.floor(y / scale)][Math.floor(x / scale)] || background;
      if (!c) continue;
      const [r, g, b] = hex(c);
      raw.set([r, g, b, 255], rowStart + 1 + x * 4);
    }
  }
  const file_ = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(file, file_);
}
png(32, 'public/favicon-32.png');
png(192, 'public/icon-192.png');
png(512, 'public/icon-512.png');
png(192, 'public/apple-touch-icon.png', '#120a1a');

writeFileSync(
  'public/site.webmanifest',
  JSON.stringify(
    {
      name: 'Chess Fantasy',
      short_name: 'Chess Fantasy',
      start_url: '/',
      display: 'standalone',
      background_color: '#181c26',
      theme_color: '#120a1a',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2
  ) + '\n'
);
console.log(`icons written (${Object.keys(byColor).length} colours, svg ${svg.length} bytes)`);
