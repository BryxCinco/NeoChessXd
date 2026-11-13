import { Chess } from 'chess.js';
import { pickBookMove } from './openingBook';

// ── CHESS FANTASY BOT ENGINE ──
// Negamax + alpha-beta + quiescence search, with piece-square tables and
// an incrementally-updated evaluation. Uses chess.js' internal move API
// (_moves / _makeMove / _undoMove) because the public move() recomputes SAN
// and legal moves on every call, which is ~20x slower — too slow for a
// real search on a phone. chess.js is pinned to an exact version in
// package.json for that reason; if the internals ever disappear we fall
// back to a simple 1-ply public-API search instead of crashing.

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;
// When the bot is clearly ahead (static eval, centipawns) a draw is scored
// as if it cost this much, so it won't shuffle into a repetition / 50-move
// draw while winning. When it is behind, a draw scores 0 and is welcome.
const WINNING_MARGIN = 100;
const CONTEMPT = 150;

// Piece-square tables, white's point of view, row 0 = rank 8 (same row
// order as chess.js' 0x88 board, so `sq >> 4` indexes them directly).
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};
// In the endgame the king should walk to the centre instead of hiding.
const KING_ENDGAME = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

// chess.js move flag bits (BITS in chess.js)
const EP_CAPTURE = 8;
const KSIDE_CASTLE = 32;
const QSIDE_CASTLE = 64;

// Difficulty profiles. `blunder` = chance to play a random legal move,
// `noise` = random centipawns added per root move so the bot isn't
// predictable, `timeMs` = search budget (iterative deepening stops there).
export const DIFFICULTY = {
  // `bookPlies`: how many half-moves of opening book the level follows
  // (missing = the whole book). EASY knows only the first two moves of each
  // opening, then plays its own (weak, random-ish) moves.
  easy: { maxDepth: 1, quiescence: false, noise: 120, blunder: 0.3, timeMs: 150, bookPlies: 4 },
  medium: { maxDepth: 2, quiescence: true, noise: 30, blunder: 0.05, timeMs: 500 },
  // Between NORMAL and HARD CORE: looks 4 plies ahead, never blunders on
  // purpose, but a little noise keeps it from always playing the top move.
  tough: { maxDepth: 4, quiescence: true, noise: 12, blunder: 0, timeMs: 900 },
  hard: { maxDepth: 5, quiescence: true, noise: 0, blunder: 0, timeMs: 1500 },
};

function pstIndex(sq, color) {
  const row = sq >> 4;
  const col = sq & 7;
  return (color === 'w' ? row : 7 - row) * 8 + col;
}

function isEndgame(game) {
  let nonPawn = 0;
  for (const row of game.board()) {
    for (const p of row) {
      if (p && p.type !== 'p' && p.type !== 'k') nonPawn += VALUE[p.type];
    }
  }
  return nonPawn <= 1300 * 2;
}

class Searcher {
  constructor(game, profile) {
    this.g = game;
    this.profile = profile;
    this.kingTable = isEndgame(game) ? KING_ENDGAME : PST.k;
    this.deadline = 0;
    this.nodes = 0;
    this.aborted = false;
    // Repetition detection piggybacks on chess.js' own Zobrist position
    // counter (the one isThreefoldRepetition() reads). When the game was
    // loaded from a PGN it already holds every position played so far.
    this.trackRepetition = typeof game._incPositionCount === 'function'
      && typeof game._decPositionCount === 'function'
      && typeof game._getPositionCount === 'function'
      && game._hash !== undefined;
    this.contempt = 0;
  }

  // _makeMove / _undoMove plus the position counter the public move() keeps.
  make(m) {
    this.g._makeMove(m);
    if (this.trackRepetition) this.g._incPositionCount();
  }

  unmake() {
    if (this.trackRepetition) this.g._decPositionCount(this.g._hash);
    this.g._undoMove();
  }

  // True when the current position already occurred earlier — in the real
  // game or higher up this search line. One earlier occurrence is enough:
  // whoever wants the draw could simply repeat again.
  isRepetition() {
    return this.trackRepetition && this.g._getPositionCount(this.g._hash) >= 2;
  }

  // Value of a drawn position for the side to move at `ply`
  // (even ply = the bot itself, odd ply = its opponent).
  drawScore(ply) {
    return ply & 1 ? this.contempt : -this.contempt;
  }

  pieceScore(type, sq, color) {
    const table = type === 'k' ? this.kingTable : PST[type];
    return VALUE[type] + table[pstIndex(sq, color)];
  }

  // Static eval from WHITE's point of view (computed once at the root;
  // the search then updates it per move via moveDelta).
  evaluateBoard() {
    let score = 0;
    const board = this.g._board;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = board[sq];
      if (!p) continue;
      const s = this.pieceScore(p.type, sq, p.color);
      score += p.color === 'w' ? s : -s;
    }
    return score;
  }

  // How much `move` changes the eval, from the MOVER's point of view.
  moveDelta(m) {
    const us = m.color;
    const them = us === 'w' ? 'b' : 'w';
    let d = this.pieceScore(m.promotion || m.piece, m.to, us) - this.pieceScore(m.piece, m.from, us);
    if (m.flags & EP_CAPTURE) {
      const capSq = us === 'w' ? m.to + 16 : m.to - 16;
      d += this.pieceScore('p', capSq, them);
    } else if (m.captured) {
      d += this.pieceScore(m.captured, m.to, them);
    }
    if (m.flags & KSIDE_CASTLE) {
      d += this.pieceScore('r', m.to - 1, us) - this.pieceScore('r', m.to + 1, us);
    } else if (m.flags & QSIDE_CASTLE) {
      d += this.pieceScore('r', m.to + 1, us) - this.pieceScore('r', m.to - 2, us);
    }
    return d;
  }

  // MVV-LVA ordering: promotions and big captures by small pieces first.
  orderMoves(moves) {
    for (const m of moves) {
      let s = 0;
      if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece] + 10000;
      if (m.promotion) s += VALUE[m.promotion] + 9000;
      m._order = s;
    }
    return moves.sort((a, b) => b._order - a._order);
  }

  checkTime() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.aborted = true;
  }

  quiesce(alpha, beta, standPat, qDepth) {
    this.checkTime();
    if (this.aborted) return 0;
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
    if (qDepth <= 0) return standPat;

    const captures = this.orderMoves(this.g._moves().filter((m) => m.captured || m.promotion));
    for (const m of captures) {
      const delta = this.moveDelta(m);
      this.make(m);
      const score = -this.quiesce(-beta, -alpha, -(standPat + delta), qDepth - 1);
      this.unmake();
      if (this.aborted) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  // `evalUs` = static eval from the side-to-move's point of view.
  negamax(depth, alpha, beta, evalUs, ply) {
    this.checkTime();
    if (this.aborted) return 0;

    // Draw by repetition: checked first, a repeated position can't be mate.
    if (this.isRepetition()) return this.drawScore(ply);

    const moves = this.g._moves();
    if (moves.length === 0) {
      return this.g._isKingAttacked(this.g._turn) ? -MATE + ply : 0;
    }
    if (this.g._halfMoves >= 100) return this.drawScore(ply); // 50-move rule
    if (depth <= 0) {
      return this.profile.quiescence ? this.quiesce(alpha, beta, evalUs, 6) : evalUs;
    }

    let best = -Infinity;
    for (const m of this.orderMoves(moves)) {
      const delta = this.moveDelta(m);
      this.make(m);
      const score = -this.negamax(depth - 1, -beta, -alpha, -(evalUs + delta), ply + 1);
      this.unmake();
      if (this.aborted) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Iterative deepening at the root. Each finished depth's result is kept,
  // so running out of time mid-search still returns a sane move, and the
  // previous best move is searched first at the next depth (better pruning).
  search() {
    const { maxDepth, timeMs, noise } = this.profile;
    this.deadline = Date.now() + timeMs;
    const sign = this.g._turn === 'w' ? 1 : -1;
    const rootEval = sign * this.evaluateBoard();
    this.contempt = rootEval >= WINNING_MARGIN ? CONTEMPT : 0;

    let rootMoves = this.orderMoves(this.g._moves());
    if (rootMoves.length === 0) return null;
    const jitter = new Map(rootMoves.map((m) => [m, noise ? (Math.random() - 0.5) * 2 * noise : 0]));

    let bestMove = rootMoves[0];
    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -Infinity;
      let depthBest = null;
      const scored = [];
      for (const m of rootMoves) {
        const delta = this.moveDelta(m);
        // Shift the window by this move's jitter, otherwise a fail-low
        // bound plus noise can look better than the real best move.
        const j = jitter.get(m);
        this.make(m);
        const score = -this.negamax(depth - 1, -Infinity, -(alpha - j), -(rootEval + delta), 1) + j;
        this.unmake();
        if (this.aborted) break;
        scored.push([m, score]);
        if (score > alpha) {
          alpha = score;
          depthBest = m;
        }
      }
      if (this.aborted) {
        // Partial depth: only trust it if it already found something better
        // than the previous depth's choice when searched first.
        if (depthBest && scored.length && scored[0][0] === bestMove && depthBest !== bestMove) bestMove = depthBest;
        break;
      }
      bestMove = depthBest || bestMove;
      if (alpha >= MATE - 100) break; // forced mate found, no need to go deeper
      scored.sort((a, b) => b[1] - a[1]);
      rootMoves = scored.map(([m]) => m);
    }
    return bestMove;
  }
}

function hasInternals(game) {
  return typeof game._moves === 'function'
    && typeof game._makeMove === 'function'
    && typeof game._undoMove === 'function'
    && typeof game._isKingAttacked === 'function'
    && Array.isArray(game._board);
}

const toAlgebraic = (sq) => 'abcdefgh'[sq & 7] + (8 - (sq >> 4));

// Builds the position to search. With a PGN the game keeps its full move
// history, which is what lets the search see repetitions of positions that
// were already played; a bare FEN knows nothing about the past.
function loadPosition(fen, pgn) {
  if (pgn) {
    try {
      const game = new Chess();
      game.loadPgn(pgn);
      if (!fen || game.fen() === fen) return game;
    } catch {
      // unreadable PGN — fall back to the FEN
    }
  }
  return new Chess(fen);
}

// Static evaluation in centipawns from the SIDE TO MOVE's point of view
// (positive = the side to move is ahead).
export function evaluatePosition(fen) {
  const game = new Chess(fen);
  let white = 0;
  if (hasInternals(game)) {
    white = new Searcher(game, DIFFICULTY.hard).evaluateBoard();
  } else {
    for (const row of game.board()) for (const p of row) if (p) white += (p.color === 'w' ? 1 : -1) * VALUE[p.type];
  }
  return game.turn() === 'w' ? white : -white;
}

// Public entry point: returns { from, to, promotion } or null.
// `pgn` (optional) is the game so far; pass it so the bot can avoid — or,
// when it is losing, aim for — a draw by repetition.
// `useBook: false` skips the opening book (used for hints and tests that
// need the search itself).
export function findBestMove(fen, difficulty = 'medium', pgn = null, { useBook = true } = {}) {
  const profile = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const game = loadPosition(fen, pgn);
  const legal = game.moves({ verbose: true });
  if (legal.length === 0) return null;

  // Still in a known opening? Play a book move (varies from game to game).
  if (useBook) {
    const bookMove = pickBookMove(game, Math.random, profile.bookPlies ?? Infinity);
    if (bookMove) return bookMove;
  }

  if (Math.random() < profile.blunder) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    return { from: m.from, to: m.to, promotion: m.promotion };
  }

  if (!hasInternals(game)) {
    // Fallback: greedy 1-ply on material only.
    const best = legal.reduce((a, b) => ((VALUE[b.captured] || 0) > (VALUE[a.captured] || 0) ? b : a));
    return { from: best.from, to: best.to, promotion: best.promotion };
  }

  const m = new Searcher(game, profile).search();
  if (!m) return null;
  return { from: toAlgebraic(m.from), to: toAlgebraic(m.to), promotion: m.promotion || undefined };
}
