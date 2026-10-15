import { memo } from 'react';
import { PieceSprite } from '../pixelPieces';

// One player's strip above/below the board: avatar, name, captured-pieces
// tray with material lead, and the clock. memo'd because the parent
// re-renders on every clock tick — only the side whose time changes needs
// to repaint.
export const PlayerBar = memo(function PlayerBar({
  color, // 'w' (RED, P1) | 'b' (BLUE, P2)
  label,
  isActive,
  isThinking,
  capturedTypes, // piece types this player has taken from the opponent
  materialLead, // > 0 when this player is ahead
  timeText, // null when playing without a clock
  isLowTime,
}) {
  const opponent = color === 'w' ? 'b' : 'w';
  return (
    <div className={`player-bar player-bar-${color} ${isActive ? 'is-active' : ''}`}>
      <div className="player-bar-avatar">
        <PieceSprite code={`${color}K`} size={34} animated={isActive} />
      </div>

      <div className="player-bar-info">
        <div className="player-bar-name">
          {label}
          {isThinking && <span className="player-bar-thinking">THINKING</span>}
        </div>
        <div className="captured-tray" aria-label={`Captured pieces: ${capturedTypes.length}`}>
          {capturedTypes.length === 0 ? (
            <span className="captured-empty">NO CAPTURES</span>
          ) : (
            capturedTypes.map((type, i) => (
              <span
                key={i}
                className={`captured-piece ${i > 0 && capturedTypes[i - 1] === type ? 'is-stacked' : ''}`}
              >
                <PieceSprite code={`${opponent}${type.toUpperCase()}`} size={20} />
              </span>
            ))
          )}
          {materialLead > 0 && <span className="material-lead">+{materialLead}</span>}
        </div>
      </div>

      {timeText !== null && (
        <div className={`player-bar-clock ${isActive ? 'is-running' : ''} ${isLowTime ? 'is-low' : ''}`}>
          {timeText}
        </div>
      )}
    </div>
  );
});
