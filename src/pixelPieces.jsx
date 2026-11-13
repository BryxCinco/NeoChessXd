import { memo, useContext } from 'react';
import { pieceLayers } from './pieceSkins.js';
import { PieceSkinContext } from './pieceSkinContext.js';

// Staggered idle bob so the armies don't move in lock-step.
const IDLE_DELAY = { P: '0s', N: '0.15s', B: '0.3s', R: '0.45s', Q: '0.6s', K: '0.75s' };

// Plain sprite — used on the board, in the captured-pieces trays and in the
// promotion picker. `animated` turns on the idle bob + blinking eyes.
// `skin` overrides the skin from context (the settings preview uses it).
export const PieceSprite = memo(function PieceSprite({ code, size, animated = false, className, skin }) {
  const contextSkin = useContext(PieceSkinContext);
  const skinId = skin || contextSkin;
  const layers = pieceLayers(skinId, code);
  if (!layers) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
      data-skin={skinId}
      aria-hidden="true"
    >
      <g
        className={animated ? 'pixel-piece' : undefined}
        style={animated ? { animationDelay: IDLE_DELAY[code[1]] } : undefined}
      >
        {layers.body.map((p) => <path key={p.key} fill={p.fill} d={p.d} />)}
        <g className={animated ? 'pixel-eye' : undefined}>
          {layers.eyes.map((p) => <path key={p.key} fill={p.fill} d={p.d} />)}
        </g>
      </g>
    </svg>
  );
});
