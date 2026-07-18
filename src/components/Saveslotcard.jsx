import React from 'react';

// Shared saved-match card renderer — used by BOTH the compact wizard's
// dedicated "LOAD GAME" step and the desktop always-visible save panel,
// so the two can never drift out of sync with each other.
export function SaveSlotCard({ match, onResume, onDelete }) {
  return (
    <div className="save-data-card" onClick={() => onResume(match)}>
      <div className="card-top">
        <span className="save-mode-badge">
          {match.gameMode === 'bot' ? `CPU (${match.difficulty.toUpperCase()})` : '1VS1'}
        </span>
        <span className="save-time-badge">TIME: {match.timeMode === 'none' ? 'INF' : `${match.timeMode}M`}</span>
      </div>
      <div className="card-mid">
        <div className="card-date">DATE: {match.date}</div>
        <div className="card-status">{match.gameStatus}</div>
      </div>
      <div className="card-bottom-actions">
        <button className="load-slot-btn">LOAD SLOT</button>
        <button className="delete-slot-btn" onClick={(e) => onDelete(match.id, e)}>CLR</button>
      </div>
    </div>
  );
}

export function SavedMatchesList({ savedMatches, onResume, onDelete }) {
  if (savedMatches.length === 0) {
    return <div className="no-saves-banner">-- NO CURRENT DATA FOUND --</div>;
  }
  return savedMatches.map((match) => (
    <SaveSlotCard key={match.id} match={match} onResume={onResume} onDelete={onDelete} />
  ));
}