import { useEffect, useRef, useState } from 'react';
import { listEffects, getEffect } from '../effects/index.js';
import { PieceSprite } from '../pixelPieces';

const ATTACKERS = [
  ['p', 'PAWN'],
  ['n', 'KNIGHT'],
  ['b', 'BISHOP'],
  ['r', 'ROOK'],
  ['q', 'QUEEN'],
  ['k', 'KING'],
];
// Rows: each piece's own finishers, the capture effects any piece can use,
// then the effects for other moments (checkmate, promotion).
const ROWS = [
  ...ATTACKERS.map(([type, name]) => ({
    key: type,
    name,
    sprites: [`w${type.toUpperCase()}`, `b${type.toUpperCase()}`],
    effects: listEffects('capture').filter((e) => e.signature && e.attackers[0] === type).map((e) => ({ kind: e.id, attacker: type })),
  })),
  {
    key: 'any',
    name: 'ANY PIECE',
    sprites: [],
    effects: listEffects('capture').filter((e) => !e.signature).map((e) => ({ kind: e.id, attacker: e.attackers ? e.attackers[0] : 'q' })),
  },
  {
    key: 'special',
    name: 'SPECIAL',
    sprites: [],
    effects: listEffects().filter((e) => e.trigger !== 'capture').map((e) => ({ kind: e.id, attacker: 'q' })),
  },
].filter((row) => row.effects.length > 0);
const ALL_EFFECTS = ROWS.flatMap((row) => row.effects);
const VICTIMS = ['bQ', 'wR', 'bN', 'wB', 'bP', 'wQ', 'bR', 'wN', 'bB', 'wP'];
const STAGE_SQUARES = 5;

// Preview every elimination finisher on a mini 5x5 board, one at a time or
// all in a row. Runs its own canvas loop, independent of the game.
export function FxGallery({ onClose, play }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const instanceRef = useRef(null);
  const queueRef = useRef([]);
  const victimRef = useRef(0);
  const [current, setCurrent] = useState(null); // { kind, attacker, victim, attackerColor }

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (instanceRef.current) instanceRef.current.cleanup();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function run(entry) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelAnimationFrame(rafRef.current);
    if (instanceRef.current) instanceRef.current.cleanup();
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');

    const victim = VICTIMS[victimRef.current++ % VICTIMS.length];
    const attackerColor = victim[0] === 'w' ? 'b' : 'w';
    const size = rect.width / STAGE_SQUARES;
    const effect = getEffect(entry.kind);
    const instance = effect.create({
      code: victim,
      x: rect.width / 2,
      y: rect.height / 2,
      size,
      attackerColor,
      attackerCode: `${attackerColor}${entry.attacker.toUpperCase()}`,
      from: { x: rect.width / 2 - size * 1.5, y: rect.height / 2 + size * 1.5 },
    });
    instanceRef.current = instance;
    setCurrent({ ...entry, victim, attackerColor });
    if (effect.sound) play(effect.sound);

    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      instance.draw(ctx, Math.min(elapsed, effect.duration));
      if (elapsed < effect.duration) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        instance.cleanup();
        instanceRef.current = null;
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
                <span>{getEffect(current.kind).name}</span>
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
          {ROWS.map((row) => (
            <div key={row.key} className="fx-row">
              <div className="fx-row-head">
                {row.sprites.map((code) => <PieceSprite key={code} code={code} size={26} />)}
                <span>{row.name}</span>
              </div>
              <div className="fx-row-buttons">
                {row.effects.map((entry) => (
                  <button
                    key={entry.kind}
                    type="button"
                    className={`fx-btn ${current && current.kind === entry.kind ? 'is-playing' : ''}`}
                    onClick={() => playOne(entry)}
                  >
                    {getEffect(entry.kind).name}
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
