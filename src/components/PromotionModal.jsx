import React from 'react';

export function PromotionModal({ onSelect }) {
  return (
    <div className="retro-modal-overlay">
      <div className="bento-pixel retro-modal-body" style={{ borderColor: '#ffcc00' }}>
        <h2 className="modal-title-pixel" style={{ color: '#ffcc00' }}>[PAWN EVOLUTION]</h2>
        <p className="modal-text-pixel">CHOOSE PROMOTED ARTIFACT:</p>
        <div className="promo-grid">
          <button className="promo-btn promo-queen" onClick={() => onSelect('q')}>
            <span className="promo-icon">♛</span>QUEEN
          </button>
          <button className="promo-btn promo-rook" onClick={() => onSelect('r')}>
            <span className="promo-icon">♜</span>ROOK
          </button>
          <button className="promo-btn promo-bishop" onClick={() => onSelect('b')}>
            <span className="promo-icon">♝</span>BISHOP
          </button>
          <button className="promo-btn promo-knight" onClick={() => onSelect('n')}>
            <span className="promo-icon">♞</span>KNIGHT
          </button>
        </div>
      </div>
    </div>
  );
}