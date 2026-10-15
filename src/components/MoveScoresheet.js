// src/components/MoveScoresheet.js — PURE JS, NO JSX
import React, { useRef, useEffect, memo } from 'react';

// memo: the clock re-renders the board screen every tick; the scoresheet
// only needs to update when a move is made.
export const MoveScoresheet = memo(function MoveScoresheet({ moveHistory, lastMove, gameStatus, isCompactLayout }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moveHistory, lastMove]);

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

  // Build move rows using React.createElement (no JSX)
  const moveRows = moveHistory.map((movePair, index) => {
    const isLastPair = index === moveHistory.length - 1;
    const hasBlack = !!movePair.black;
    const whiteHighlight = isLastPair && !hasBlack;
    const blackHighlight = isLastPair && hasBlack;

    const whiteStyle = {
      color: whiteHighlight ? '#ff6b6b' : '#d0d0e0',
      fontWeight: whiteHighlight ? 'bold' : 'normal',
      padding: '1px 4px',
      borderRadius: '2px',
      background: whiteHighlight ? 'rgba(255, 107, 107, 0.15)' : 'transparent',
    };

    const blackStyle = {
      color: blackHighlight ? '#4dabf7' : '#d0d0e0',
      fontWeight: blackHighlight ? 'bold' : 'normal',
      padding: '1px 4px',
      borderRadius: '2px',
      background: blackHighlight ? 'rgba(77, 171, 247, 0.15)' : 'transparent',
    };

    return React.createElement(
      React.Fragment,
      { key: movePair.number },
      React.createElement('span', { style: numberStyle }, movePair.number + '.'),
      React.createElement('span', { style: whiteStyle }, movePair.white || '...'),
      React.createElement('span', { style: blackStyle }, movePair.black || '...')
    );
  });

  const bodyContent = moveHistory.length === 0
    ? React.createElement('div', { style: emptyStyle }, 'No moves yet...')
    : React.createElement('div', { style: gridStyle }, moveRows);

  const resultContent = isGameOver && moveHistory.length > 0
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
      resultContent
    )
  );
});
