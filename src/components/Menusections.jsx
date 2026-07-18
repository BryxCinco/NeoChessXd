import React from 'react';
import { SavedMatchesList } from './SaveSlotCard';

export function AudioToggleButton({ isMuted, onToggle }) {
  return (
    <button className={`audio-toggle-btn ${isMuted ? 'is-muted' : ''}`} onClick={onToggle}>
      <span className="led-dot" />AUDIO: {isMuted ? 'OFF' : 'ON'}
    </button>
  );
}

export function StartSelectionSection({ onNewGame, onLoadGame }) {
  return (
    <div className="menu-section start-select-section">
      <h3><span className="menu-section-num">01</span> MAIN MENU</h3>
      <div className="btn-group-pixel start-grid">
        <button className="mode-btn-pvp start-choice-btn" onClick={onNewGame}>
          <span className="btn-tag">NEW</span>NEW GAME
        </button>
        <button className="mode-btn-cpu start-choice-btn" onClick={onLoadGame}>
          <span className="btn-tag">LOAD</span>LOAD GAME
        </button>
      </div>
    </div>
  );
}

export function LoadGameSection({ savedMatches, onResume, onDelete }) {
  return (
    <div className="menu-section load-game-wizard-section">
      <h3><span className="menu-section-num">--</span> LOAD GAME</h3>
      <div className="matches-log-list">
        <SavedMatchesList savedMatches={savedMatches} onResume={onResume} onDelete={onDelete} />
      </div>
    </div>
  );
}

export function ModeSelectionSection({ gameMode, onSelect }) {
  return (
    <div className="menu-section">
      <h3><span className="menu-section-num">02</span> SELECT MODE</h3>
      <div className="btn-group-pixel mode-grid">
        <button className={`mode-btn-pvp ${gameMode === '1v1' ? 'active' : ''}`} onClick={() => onSelect('1v1')}>
          <span className="btn-tag">PVP</span>1 VS 1 LOCAL
        </button>
        <button className={`mode-btn-cpu ${gameMode === 'bot' ? 'active' : ''}`} onClick={() => onSelect('bot')}>
          <span className="btn-tag">CPU</span>BOT MATCH
        </button>
      </div>
    </div>
  );
}

export function DifficultySelectionSection({ difficulty, onSelect }) {
  return (
    <div className="menu-section">
      <h3><span className="menu-section-num">03</span> DIFFICULTY</h3>
      <div className="btn-group-pixel diff-grid">
        <button className={`diff-easy ${difficulty === 'easy' ? 'active' : ''}`} onClick={() => onSelect('easy')}>EASY</button>
        <button className={`diff-medium ${difficulty === 'medium' ? 'active' : ''}`} onClick={() => onSelect('medium')}>NORMAL</button>
        <button className={`diff-hard ${difficulty === 'hard' ? 'active' : ''}`} onClick={() => onSelect('hard')}>HARD CORE</button>
      </div>
    </div>
  );
}

export function TimeSelectionSection({ gameMode, timeMode, onSelect }) {
  return (
    <div className="menu-section">
      <h3><span className="menu-section-num">{gameMode === 'bot' ? '04' : '03'}</span> TIME LIMIT</h3>
      <div className="btn-group-pixel time-grid">
        <button className={timeMode === 'none' ? 'active' : ''} onClick={() => onSelect('none')}>NO LIMIT</button>
        <button className={timeMode === '0.5' ? 'active' : ''} onClick={() => onSelect('0.5')}>00:30</button>
        <button className={timeMode === '1' ? 'active' : ''} onClick={() => onSelect('1')}>01:00</button>
        <button className={timeMode === '5' ? 'active' : ''} onClick={() => onSelect('5')}>05:00</button>
        <button className={timeMode === '10' ? 'active' : ''} onClick={() => onSelect('10')}>10:00</button>
        <button className={timeMode === '30' ? 'active' : ''} onClick={() => onSelect('30')}>30:00</button>
      </div>
    </div>
  );
}

export function SavedMatchesPanel({ savedMatches, onResume, onDelete }) {
  return (
    <div className="save-manager-container bento-pixel">
      <h2 className="section-pixel-title">[SAVED MATCHES DATA]</h2>
      <div className="matches-log-list">
        <SavedMatchesList savedMatches={savedMatches} onResume={onResume} onDelete={onDelete} />
      </div>
    </div>
  );
}