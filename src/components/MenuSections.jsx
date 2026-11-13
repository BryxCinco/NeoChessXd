import { SavedMatchesList } from './SaveSlotCard';
import { PieceSprite } from '../pixelPieces';
import { TIME_PRESETS } from '../game/timeControl';

export function AudioToggleButton({ isMuted, onToggle }) {
  return (
    <button
      type="button"
      className={`audio-toggle-btn ${isMuted ? 'is-muted' : ''}`}
      onClick={onToggle}
    >
      <span className="led-dot" />AUDIO: {isMuted ? 'OFF' : 'ON'}
    </button>
  );
}

export function SettingsButton({ onOpen }) {
  return (
    <button type="button" className="settings-open-btn" onClick={onOpen} aria-label="Open settings">
      <span aria-hidden="true">⚙ </span>SETTINGS
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

const DIFFICULTIES = [
  { id: 'easy', label: 'EASY', className: 'diff-easy' },
  { id: 'medium', label: 'NORMAL', className: 'diff-medium' },
  { id: 'tough', label: 'TOUGH', className: 'diff-tough' },
  { id: 'hard', label: 'HARD CORE', className: 'diff-hard' },
];

export function DifficultySelectionSection({ difficulty, onSelect }) {
  return (
    <div className="menu-section">
      <h3><span className="menu-section-num">03</span> DIFFICULTY</h3>
      <div className="btn-group-pixel diff-grid">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            className={`${d.className} ${difficulty === d.id ? 'active' : ''}`}
            onClick={() => onSelect(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const SIDES = [
  { id: 'w', label: 'PLAY AS RED', hint: 'MOVES FIRST', className: 'side-red' },
  { id: 'b', label: 'PLAY AS BLUE', hint: 'CPU MOVES FIRST', className: 'side-blue' },
  { id: 'random', label: 'RANDOM', hint: 'SURPRISE ME', className: 'side-random' },
];

// Bot matches only: which army the human commands.
export function PlayAsSection({ colorChoice, onSelect }) {
  return (
    <div className="menu-section">
      <h3><span className="menu-section-num">04</span> CHOOSE YOUR SIDE</h3>
      <div className="btn-group-pixel side-grid" role="group" aria-label="Choose your side">
        {SIDES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${s.className} ${colorChoice === s.id ? 'active' : ''}`}
            aria-pressed={colorChoice === s.id}
            onClick={() => onSelect(s.id)}
          >
            <span className="side-sprite" aria-hidden="true">
              {s.id === 'random' ? (
                <>
                  <PieceSprite code="wK" size={26} />
                  <PieceSprite code="bK" size={26} />
                </>
              ) : (
                <PieceSprite code={`${s.id}K`} size={32} />
              )}
            </span>
            {s.label}
            <span className="side-hint">{s.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TimeSelectionSection({ gameMode, timeMode, onSelect }) {
  return (
    <div className="menu-section">
      <h3><span className="menu-section-num">{gameMode === 'bot' ? '05' : '03'}</span> TIME LIMIT</h3>
      <div className="btn-group-pixel time-grid">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={timeMode === preset.id ? 'active' : ''}
            onClick={() => onSelect(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="menu-section-note">M+S = MINUTES EACH, PLUS SECONDS ADDED AFTER EVERY MOVE</p>
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
