import { useEffect, useRef, useState } from 'react';
import { createElimination, EFFECT_POOLS, EFFECT_LABELS, FX_SOUND } from '../fx/eliminationFx';
import { PieceSprite } from '../pixelPieces';

const ATTACKERS = [
  ['p', 'PAWN'],
  ['n', 'KNIGHT'],
  ['b', 'BISHOP'],
  ['r', 'ROOK'],
  ['q', 'QUEEN'],
  ['k', 'KING'],
];
const ALL_EFFECTS = ATTACKERS.flatMap(([type]) => EFFECT_POOLS[type].map((kind) => ({ kind, attacker: type })));
const VICTIMS = ['bQ', 'wR', 'bN', 'wB', 'bP', 'wQ', 'bR', 'wN', 'bB', 'wP'];
const FX_SPEED = 0.65; // same pacing as in-game
const STAGE_SQUARES = 5;

// Preview every elimination finisher on a mini 5x5 board, one at a time or
// all in a row. Runs its own canvas loop, independent of the game.
export function FxGallery({ onClose, play }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const queueRef = useRef([]);
  const victimRef = useRef(0);
  const [current, setCurrent] = useState(null); // { kind, attacker, victim, attackerColor }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function run(entry) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelAnimationFrame(rafRef.current);
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');

    const victim = VICTIMS[victimRef.current++ % VICTIMS.length];
    const attackerColor = victim[0] === 'w' ? 'b' : 'w';
    const size = rect.width / STAGE_SQUARES;
    const fx = createElimination({ kind: entry.kind, code: victim, x: rect.width / 2, y: rect.height / 2, size, attackerColor });
    setCurrent({ ...entry, victim, attackerColor });
    play(FX_SOUND[entry.kind]);

    const start = performance.now();
    const tick = (now) => {
      const frame = Math.floor(((now - start) / (1000 / 60)) * FX_SPEED) + 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      fx.draw(ctx, frame);
      if (frame < fx.duration) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
        const next = queueRef.current.shift();
        if (next) {
          rafRef.current = requestAnimationFrame(() => setTimeout(() => run(next), 350));
        } else {
          setCurrent(null);
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function playOne(entry) {
    queueRef.current = [];
    run(entry);
  }

  function playAll() {
    queueRef.current = ALL_EFFECTS.slice(1);
    run(ALL_EFFECTS[0]);
  }

  const idleVictim = VICTIMS[victimRef.current % VICTIMS.length];

  return (
    <div className="retro-modal-overlay fx-gallery-overlay" onClick={onClose}>
      <div className="bento-pixel retro-modal-body fx-gallery" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Effects gallery">
        <div className="fx-gallery-head">
          <h2 className="modal-title-pixel">FX GALLERY</h2>
          <button type="button" className="fx-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="fx-stage">
          <canvas ref={canvasRef} className="fx-stage-canvas" />
          {!current && (
            <div className="fx-stage-idle">
              <PieceSprite code={idleVictim} size={64} animated />
            </div>
          )}
          <div className="fx-stage-label">
            {current ? (
              <>
                <PieceSprite code={`${current.attackerColor}${current.attacker.toUpperCase()}`} size={22} />
                <span>{EFFECT_LABELS[current.kind]}</span>
              </>
            ) : (
              <span>PICK A FINISHER</span>
            )}
          </div>
        </div>

        <button type="button" className="fx-play-all" onClick={playAll}>
          ▶ PLAY ALL {ALL_EFFECTS.length} EFFECTS
        </button>

        <div className="fx-list">
          {ATTACKERS.map(([type, name]) => (
            <div key={type} className="fx-row">
              <div className="fx-row-head">
                <PieceSprite code={`w${type.toUpperCase()}`} size={26} />
                <PieceSprite code={`b${type.toUpperCase()}`} size={26} />
                <span>{name}</span>
              </div>
              <div className="fx-row-buttons">
                {EFFECT_POOLS[type].map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`fx-btn ${current && current.kind === kind ? 'is-playing' : ''}`}
                    onClick={() => playOne({ kind, attacker: type })}
                  >
                    {EFFECT_LABELS[kind]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
