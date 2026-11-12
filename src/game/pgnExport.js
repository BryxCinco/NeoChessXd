import { Chess } from 'chess.js';

const DIFFICULTY_NAME = { easy: 'Easy', medium: 'Normal', tough: 'Tough', hard: 'Hard Core' };

// PGN result code from who won: 'w' → 1-0, 'b' → 0-1, draw → 1/2-1/2,
// game still going → *.
export function resultCode({ isGameOver, winner }) {
  if (!isGameOver) return '*';
  if (winner === 'w') return '1-0';
  if (winner === 'b') return '0-1';
  return '1/2-1/2';
}

export function playerNames({ gameMode, difficulty, playerColor = 'w' }) {
  if (gameMode !== 'bot') return { white: 'Player 1 (Red)', black: 'Player 2 (Blue)' };
  const cpu = `CPU (${DIFFICULTY_NAME[difficulty] || 'Normal'})`;
  return playerColor === 'w'
    ? { white: 'Player (Red)', black: `${cpu} (Blue)` }
    : { white: `${cpu} (Red)`, black: 'Player (Blue)' };
}

const pad = (n) => String(n).padStart(2, '0');
export const pgnDate = (date) => `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;

// Full PGN text with the standard header tags. Built on a copy, so the
// live game never carries export headers around.
export function buildPgn({ game, gameMode, difficulty, playerColor, isGameOver, winner, date = new Date(), site }) {
  const copy = new Chess();
  copy.loadPgn(game.pgn());
  const names = playerNames({ gameMode, difficulty, playerColor });
  const where = site || (typeof window !== 'undefined' && window.location ? window.location.host : '') || '?';
  copy.setHeader('Event', 'NEO CHESS DX casual game');
  copy.setHeader('Site', where);
  copy.setHeader('Date', pgnDate(date));
  copy.setHeader('White', names.white);
  copy.setHeader('Black', names.black);
  copy.setHeader('Result', resultCode({ isGameOver, winner }));
  return copy.pgn();
}

export const pgnFileName = (date = new Date()) =>
  `neo-chess-dx-${pgnDate(date).replace(/\./g, '-')}-${pad(date.getHours())}${pad(date.getMinutes())}.pgn`;

// Resolves true when the text reached the clipboard.
export async function copyText(text) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Offers the text as a file download. Returns false where that's impossible.
export function downloadText(text, fileName) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
