import { memo } from 'react';
import { SPRITES, PALETTE, EYE_COLORS } from './sprites/pieceSprites';

// Turns a 16x16 character grid into one SVG path per colour (horizontal
// runs merged into single rects). Done once at module load, so each piece
// on the board is only a handful of <path> elements.
function buildLayers(rows) {
  const body = {};
  const eyes = {};
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        const target = EYE_COLORS.has(ch) ? eyes : body;
        (target[ch] ||= []).push(`M${x} ${y}h${end - x}v1h${x - end}z`);
      }
      x = end;
    }
  });
  const toPaths = (layer) => Object.entries(layer).map(([ch, d]) => ({ fill: PALETTE[ch], d: d.join('') }));
  return { body: toPaths(body), eyes: toPaths(eyes) };
}

const LAYERS = Object.fromEntries(Object.entries(SPRITES).map(([code, rows]) => [code, buildLayers(rows)]));

// Staggered idle bob so the armies don't move in lock-step.
const IDLE_DELAY = { P: '0s', N: '0.15s', B: '0.3s', R: '0.45s', Q: '0.6s', K: '0.75s' };

// Plain sprite — used on the board, in the captured-pieces trays and in the
// promotion picker. `animated` turns on the idle bob + blinking eyes.
export const PieceSprite = memo(function PieceSprite({ code, size, animated = false, className }) {
  const layers = LAYERS[code];
  if (!layers) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <g
        className={animated ? 'pixel-piece' : undefined}
        style={animated ? { animationDelay: IDLE_DELAY[code[1]] } : undefined}
      >
        {layers.body.map((p) => <path key={p.fill} fill={p.fill} d={p.d} />)}
        <g className={animated ? 'pixel-eye' : undefined}>
          {layers.eyes.map((p) => <path key={p.fill} fill={p.fill} d={p.d} />)}
        </g>
      </g>
    </svg>
  );
});

// react-chessboard `customPieces` map: { wP: ({ squareWidth }) => <svg/>, ... }
export const pixelPieces = Object.fromEntries(
  Object.keys(SPRITES).map((code) => [
    code,
    ({ squareWidth }) => <PieceSprite code={code} size={squareWidth} animated />,
  ])
);
