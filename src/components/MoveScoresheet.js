// src/components/MoveScoresheet.js — PURE JS, NO JSX
import React, { useRef, useEffect, memo } from 'react';

// memo: the clock re-renders the board screen every tick; the scoresheet
// only needs to update when a move is made.
//
// `onJumpToPly(ply)` (optional): when given, every move becomes a button
// that jumps the board to the position after that move — used for the
// post-game review. `activePly` is the position currently on the board
// (defaults to the last move). `notes` are non-move events such as a
// resignation or a draw offer: [{ ply, text }].
export const MoveScoresheet = memo(function MoveScoresheet({
  moveHistory,
  lastMove,
  gameStatus,
  isCompactLayout,
  onJumpToPly,
  activePly,
  notes,
}) {
  const scrollRef = useRef(null);

  const totalPlies = moveHistory.reduce((n, row) => n + (row.white ? 1 : 0) + (row.black ? 1 : 0), 0);
  const currentPly = activePly === undefined || activePly === null ? totalPlies : activePly;
  const followsLive = currentPly === totalPlies;

  useEffect(() => {
    const body = scrollRef.current;
    if (!body) return;
    if (followsLive) {
      body.scrollTop = body.scrollHeight;
      return;
    }
    // Reviewing: keep the highlighted move in view.
    const active = body.querySelector('[data-active="true"]');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }, [moveHistory, lastMove, currentPly, followsLive, notes]);

  const isGameOver = gameStatus.includes('WINNER') || gameStatus.includes('DRAW') || gameStatus.includes('GAME OVER');

  const containerStyle = {
    margin: isCompactLayout ? '12px 8px 16px' : '0',
    maxWidth: '100%',
    padding: isCompactLayout ? '0 12px' : '0',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '2px solid #4a4a6a',
    borderBottom: 'none',
    borderRadius: '4px 4px 0 0',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#c0c0d0',
  };

  const bodyStyle = {
    maxHeight: isCompactLayout ? '140px' : '200px',
    overflowY: 'auto',
    overflowX: 'hidden',
    background: 'rgba(0, 0, 0, 0.25)',
    border: '2px solid #4a4a6a',
    borderTop: '1px solid #3a3a5a',
    borderRadius: '0 0 4px 4px',
    padding: '8px',
    fontSize: '0.85rem',
    lineHeight: 1.6,
  };

  const emptyStyle = {
    textAlign: 'center',
    color: '#6a6a8a',
    padding: '20px 0',
    fontStyle: 'italic',
    fontSize: '0.75rem',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '32px 1fr 1fr',
    gap: '0 8px',
  };

  const numberStyle = {
    color: '#6a6a8a',
    textAlign: 'right',
    fontSize: '0.75rem',
    paddingRight: '4px',
  };

  const resultStyle = {
    textAlign: 'center',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #3a3a5a',
    color: '#ffd43b',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  };

  const noteStyle = {
    marginTop: '6px',
    color: '#9fb4ff',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
  };

  // One move cell: a plain <span>, or a <button> when moves can be jumped to.
  let ply = 0;
  const moveCell = (san, color, key) => {
    if (!san) return React.createElement('span', { key, style: { color: '#d0d0e0', padding: '1px 4px' } }, '...');
    ply += 1;
    const thisPly = ply;
    const active = thisPly === currentPly;
    const accent = color === 'w' ? '#ff6b6b' : '#4dabf7';
    const style = {
      color: active ? accent : '#d0d0e0',
      fontWeight: active ? 'bold' : 'normal',
      padding: '1px 4px',
      borderRadius: '2px',
      background: active ? (color === 'w' ? 'rgba(255, 107, 107, 0.15)' : 'rgba(77, 171, 247, 0.15)') : 'transparent',
    };
    if (!onJumpToPly) {
      return React.createElement('span', { key, style, 'data-active': active ? 'true' : undefined }, san);
    }
    return React.createElement(
      'button',
      {
        key,
        type: 'button',
        className: 'scoresheet-move-btn',
        style,
        'data-active': active ? 'true' : undefined,
        'aria-current': active ? 'step' : undefined,
        'aria-label': `Go to move ${Math.ceil(thisPly / 2)} by ${color === 'w' ? 'Red' : 'Blue'}: ${san}`,
        onClick: () => onJumpToPly(thisPly),
      },
      san
    );
  };

  // Build move rows using React.createElement (no JSX)
  const moveRows = moveHistory.map((movePair) =>
    React.createElement(
      React.Fragment,
      { key: movePair.number },
      React.createElement('span', { style: numberStyle }, movePair.number + '.'),
      moveCell(movePair.white, 'w', 'w'),
      moveCell(movePair.black, 'b', 'b')
    )
  );

  const bodyContent = moveHistory.length === 0
    ? React.createElement('div', { style: emptyStyle }, 'No moves yet...')
    : React.createElement('div', { style: gridStyle }, moveRows);

  const noteContent = notes && notes.length > 0
    ? React.createElement(
        'ul',
        { className: 'scoresheet-notes', style: { listStyle: 'none', margin: 0, padding: 0 } },
        notes.map((note, i) =>
          React.createElement('li', { key: i, style: noteStyle }, `▸ ${note.text}`)
        )
      )
    : null;

  const resultContent = isGameOver && (moveHistory.length > 0 || noteContent)
    ? React.createElement(
        'div',
        { style: resultStyle },
        gameStatus.replace('WINNER: ', '').replace('GAME ', '')
      )
    : null;

  return React.createElement(
    'div',
    { className: 'scoresheet-container', style: containerStyle },
    React.createElement(
      'div',
      { className: 'scoresheet-header pixel-text', style: headerStyle },
      React.createElement('span', null, '♟ Notation'),
      React.createElement(
        'span',
        { style: { fontSize: '0.65rem', opacity: 0.7 } },
        moveHistory.length > 0 ? moveHistory.length + ' moves' : '—'
      )
    ),
    React.createElement(
      'div',
      { ref: scrollRef, className: 'scoresheet-body pixel-text', style: bodyStyle },
      bodyContent,
      noteContent,
      resultContent
    )
  );
});
