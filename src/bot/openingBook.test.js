import { Chess } from 'chess.js';
import { OPENING_LINES, bookCandidates, pickBookMove } from './openingBook';
import { findBestMove, DIFFICULTY } from './engine';
import { playMoves, makeChessFromPgn } from '../test/helpers';

const START_FEN = new Chess().fen();

describe('TOUGH difficulty', () => {
  it('exists, between NORMAL and HARD CORE', () => {
    const { medium, tough, hard } = DIFFICULTY;
    expect(tough).toBeDefined();
    expect(tough.maxDepth).toBeGreaterThan(medium.maxDepth);
    expect(tough.maxDepth).toBeLessThan(hard.maxDepth);
    expect(tough.maxDepth).toBeGreaterThanOrEqual(3);
    expect(tough.maxDepth).toBeLessThanOrEqual(4);
  });

  it('has a little randomness but never blunders on purpose', () => {
    expect(DIFFICULTY.tough.noise).toBeGreaterThan(0);
    expect(DIFFICULTY.tough.noise).toBeLessThan(DIFFICULTY.medium.noise);
    expect(DIFFICULTY.tough.blunder).toBe(0);
  });

  it('plays legal moves and still finds a mate in 1', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
    expect(findBestMove(fen, 'tough')).toMatchObject({ from: 'd1', to: 'd8' });
    const middlegame = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';
    expect(() => new Chess(middlegame).move(findBestMove(middlegame, 'tough'))).not.toThrow();
  });
});

describe('opening book', () => {
  it('holds 10–20 lines, each 3–5 moves deep', () => {
    expect(OPENING_LINES.length).toBeGreaterThanOrEqual(10);
    expect(OPENING_LINES.length).toBeLessThanOrEqual(20);
    for (const line of OPENING_LINES) {
      expect(line.length).toBeGreaterThanOrEqual(6); // 3 moves each side
      expect(line.length).toBeLessThanOrEqual(10); // 5 moves each side
    }
  });

  it('every line is a legal game from the starting position', () => {
    for (const line of OPENING_LINES) {
      expect(() => playMoves(line), line.join(' ')).not.toThrow();
    }
  });

  it('offers several different first moves', () => {
    expect(bookCandidates([]).sort()).toEqual(['Nf3', 'c4', 'd4', 'e4']);
  });

  it('follows the game so far and stops when it leaves the book', () => {
    expect(bookCandidates(['e4']).sort()).toEqual(['c5', 'c6', 'd5', 'e5', 'e6']);
    expect(bookCandidates(['e4', 'e5', 'Nf3', 'Nc6'])).toEqual(expect.arrayContaining(['Bb5', 'Bc4', 'd4']));
    expect(bookCandidates(['a4'])).toEqual([]); // not a book opening
    expect(bookCandidates(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'])).toEqual([]); // end of the line
  });

  it('picks a legal book move for either side', () => {
    const first = pickBookMove(new Chess());
    expect(() => new Chess().move(first)).not.toThrow();

    const game = playMoves(['d4']);
    const reply = pickBookMove(game);
    const after = makeChessFromPgn(game.pgn());
    expect(() => after.move(reply)).not.toThrow();
    expect(['d5', 'Nf6']).toContain(after.history().at(-1));
  });

  it('chooses at random among the lines that fit', () => {
    const picks = (roll) => {
      const game = new Chess();
      game.move(pickBookMove(game, () => roll));
      return game.history()[0];
    };
    expect(new Set([picks(0), picks(0.3), picks(0.6), picks(0.99)]).size).toBeGreaterThan(1);

    const seen = new Set();
    for (let i = 0; i < 80; i++) seen.add(picks(Math.random()));
    expect(seen.size).toBeGreaterThan(1); // not always the same opening
  });

  it('returns null out of book, or when the game did not start from the normal position', () => {
    expect(pickBookMove(playMoves(['a4', 'a5']))).toBeNull();
    // Looks like move 1 with no history, but it is not the starting position.
    expect(pickBookMove(new Chess('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'))).toBeNull();
    // A game that began from a custom position.
    const custom = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNR w KQkq - 0 1');
    custom.move('e4');
    expect(pickBookMove(custom)).toBeNull();
  });
});

describe('the bot uses the book', () => {
  it('opens with a book move, and varies it', () => {
    const firstMoves = new Set();
    for (let i = 0; i < 40; i++) {
      const move = findBestMove(START_FEN, 'hard');
      firstMoves.add(move.from + move.to);
    }
    const bookFirst = ['e2e4', 'd2d4', 'c2c4', 'g1f3'];
    for (const move of firstMoves) expect(bookFirst).toContain(move);
    expect(firstMoves.size).toBeGreaterThan(1);
  });

  it('answers 1. e4 from the book when it knows the game so far', () => {
    const game = playMoves(['e4']);
    const move = findBestMove(game.fen(), 'easy', game.pgn());
    const after = makeChessFromPgn(game.pgn());
    after.move(move);
    expect(['e5', 'c5', 'e6', 'c6', 'd5']).toContain(after.history().at(-1));
  });

  it('thinks for itself once out of book, and when the book is switched off', () => {
    const offBook = playMoves(['a4', 'a5']);
    const move = findBestMove(offBook.fen(), 'medium', offBook.pgn());
    expect(() => makeChessFromPgn(offBook.pgn()).move(move)).not.toThrow();

    // useBook: false (hints) → a real search even on move 1
    const searched = findBestMove(START_FEN, 'medium', null, { useBook: false });
    expect(() => new Chess().move(searched)).not.toThrow();
  });
});
