import { useEffect } from 'react';
import { PieceSprite } from '../pixelPieces';

const CHOICES = [
  { type: 'q', label: 'QUEEN', key: 'Q' },
  { type: 'r', label: 'ROOK', key: 'R' },
  { type: 'b', label: 'BISHOP', key: 'B' },
  { type: 'n', label: 'KNIGHT', key: 'N' },
];

// Official rules: a pawn reaching the last rank must become a queen, rook,
// bishop or knight of the same colour (any of them, no limit). The pawn
// stays on its square until a piece is picked; CANCEL takes the move back.
export function PromotionModal({ color = 'w', onSelect, onCancel }) {
  useEffect(() => {
    const onKey = (e) => {
      const choice = CHOICES.find((c) => c.key === e.key.toUpperCase());
      if (choice) onSelect(choice.type);
      else if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelect, onCancel]);

  return (
    <div className="retro-modal-overlay" onClick={onCancel}>
      <div
        className={`bento-pixel retro-modal-body promo-modal promo-modal-${color}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose a piece to promote to"
      >
        <h2 className="modal-title-pixel promo-title">PAWN PROMOTION!</h2>
        <p className="modal-text-pixel promo-subtitle">CHOOSE YOUR POWER-UP</p>
        <div className="promo-grid">
          {CHOICES.map((c) => (
            <button key={c.type} type="button" className="promo-btn" onClick={() => onSelect(c.type)}>
              <PieceSprite code={`${color}${c.type.toUpperCase()}`} size={56} animated />
              <span className="promo-label">{c.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="promo-cancel-btn" onClick={onCancel}>
          ✕ CANCEL MOVE
        </button>
      </div>
    </div>
  );
}
