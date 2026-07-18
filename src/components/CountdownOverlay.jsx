import React from 'react';

export function CountdownOverlay({ countdownValue }) {
  return (
    <div className="retro-modal-overlay procedural-start-screen">
      <div className="procedural-counter-box">
        <div className="procedural-number-glitch pulse-text">{countdownValue}</div>
        <div className="procedural-title-load mt-4">NEO CHESS DX LOADING...</div>
      </div>
    </div>
  );
}