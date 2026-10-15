import { useState } from 'react';
import { PieceSprite } from '../pixelPieces';
import { PixelLogo } from './PixelLogo';

const TIPS = [
  'TAP A PIECE TO SEE WHERE IT CAN GO',
  'EVERY PIECE ELIMINATES IN ITS OWN STYLE',
  'QUEENS OPEN BLACK HOLES. KINGS BRING FIRE.',
  'A PAWN ON THE LAST ROW CAN BECOME ANY PIECE',
  'CHECKMATE TRAPS THE ENEMY KING IN A CAGE',
  'UNDO A MISTAKE WITH THE ↶ BUTTON',
];

const ARMY = ['P', 'N', 'B', 'R', 'Q'];

// Fighting-game style "VS" stage intro shown during the 3-2-1 countdown.
export function CountdownOverlay({ countdownValue, gameMode, difficulty }) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const isGo = typeof countdownValue === 'string';
  const step = isGo ? 4 : 4 - countdownValue; // 1..4
  const blueName = gameMode === 'bot' ? `CPU ${(difficulty === 'medium' ? 'NORMAL' : difficulty || '').toUpperCase()}` : 'PLAYER 2';

  return (
    <div className="stage-intro" role="status" aria-live="assertive">
      <div className="intro-half intro-half-red" />
      <div className="intro-half intro-half-blue" />

      <div className="intro-content">
        <PixelLogo size="sm" as="div" />

        <div className="intro-vs-row">
          <div className="intro-fighter intro-fighter-red">
            <PieceSprite code="wK" size={112} animated className="intro-king" />
            <div className="intro-army">
              {ARMY.map((p) => <PieceSprite key={p} code={`w${p}`} size={28} />)}
            </div>
            <div className="intro-name">RED ARMY</div>
            <div className="intro-sub">PLAYER 1</div>
          </div>

          <div className="intro-vs-badge">VS</div>

          <div className="intro-fighter intro-fighter-blue">
            <PieceSprite code="bK" size={112} animated className="intro-king" />
            <div className="intro-army">
              {ARMY.map((p) => <PieceSprite key={p} code={`b${p}`} size={28} />)}
            </div>
            <div className="intro-name">BLUE ARMY</div>
            <div className="intro-sub">{blueName}</div>
          </div>
        </div>

        <div key={countdownValue} className={`intro-count ${isGo ? 'is-go' : ''}`}>
          {countdownValue}
        </div>

        <div className="intro-loadbar" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={i < step * 2 ? 'is-filled' : ''} />
          ))}
        </div>
        <div className="intro-tip">TIP: {tip}</div>
      </div>
    </div>
  );
}
