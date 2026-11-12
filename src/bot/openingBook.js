import { Chess } from 'chess.js';

// ── TINY OPENING BOOK ──
// A handful of sound, well-known openings, 3–5 moves deep. While the game
// is still following one of these lines the bot plays the next book move —
// picked at random among the lines that fit — so it doesn't open every
// game the same way. As soon as the game leaves the book, the normal
// search takes over.
export const OPENING_LINES = [
  // 1. e4 e5
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'], // Ruy Lopez
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6'], // Italian Game
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Be7'], // Two Knights (quiet)
  ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6'], // Scotch Game
  ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4'], // Petrov Defence
  ['e4', 'e5', 'Nc3', 'Nf6', 'Bc4', 'Nc6', 'd3', 'Bb4'], // Vienna Game
  // 1. e4, other replies
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'], // Sicilian Najdorf
  ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'g6'], // Sicilian, Accelerated Dragon
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Be7'], // French Defence
  ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'], // Caro-Kann
  ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6'], // Scandinavian
  // 1. d4
  ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7'], // Queen's Gambit Declined
  ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4'], // Slav Defence
  ['d4', 'd5', 'c4', 'dxc4', 'Nf3', 'Nf6', 'e3', 'e6'], // Queen's Gambit Accepted
  ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'], // King's Indian
  ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'O-O'], // Nimzo-Indian
  ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3', 'Nc6'], // London System
  // Flank openings
  ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6', 'g3', 'd5'], // English Opening
  ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2', 'e6', 'O-O', 'Be7'], // Réti / King's Indian Attack
];

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// All book continuations for the moves played so far (SAN strings).
export function bookCandidates(history) {
  const next = new Set();
  for (const line of OPENING_LINES) {
    if (line.length <= history.length) continue;
    if (history.every((san, i) => line[i] === san)) next.add(line[history.length]);
  }
  return [...next];
}

// Returns { from, to, promotion } for a book move, or null when the game is
// out of book. `game` must carry its move history (loaded from a PGN) and
// must have started from the normal starting position.
export function pickBookMove(game, random = Math.random) {
  const verbose = game.history({ verbose: true });
  const startedNormally = (verbose.length ? verbose[0].before : game.fen()) === START_FEN;
  if (!startedNormally) return null;

  const candidates = bookCandidates(verbose.map((m) => m.san));
  if (candidates.length === 0) return null;

  const san = candidates[Math.floor(random() * candidates.length)];
  try {
    const probe = new Chess(game.fen());
    const move = probe.move(san);
    return { from: move.from, to: move.to, promotion: move.promotion };
  } catch {
    return null; // a line that doesn't fit this position: just search instead
  }
}
