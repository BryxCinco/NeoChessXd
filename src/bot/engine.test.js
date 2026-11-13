import { Chess } from 'chess.js';
import { findBestMove, evaluatePosition, DIFFICULTY } from './engine';
import { makeChessFromPgn, playMoves } from '../test/helpers';

const START_FEN = new Chess().fen();

// HARD thinks for up to 1.5 s per move.
vi.setConfig({ testTimeout: 20000 });

// Applies the bot's move to a copy of `game` (history kept) and returns it.
function afterBotMove(game, move) {
  const next = makeChessFromPgn(game.pgn());
  next.move(move);
  return next;
}

// How many times the current position of `game` has occurred so far.
function occurrences(game) {
  const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
  const current = key(game.fen());
  const seen = game.history({ verbose: true }).map((m) => key(m.before));
  return seen.filter((k) => k === current).length + 1;
}

describe('findBestMove — basics', () => {
  it.each(['easy', 'medium', 'hard'])('returns a legal move from the starting position (%s)', (difficulty) => {
    const move = findBestMove(START_FEN, difficulty);
    expect(move).toEqual(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
    expect(() => new Chess().move(move)).not.toThrow();
  });

  it('falls back to the medium profile for an unknown difficulty', () => {
    const move = findBestMove(START_FEN, 'impossible');
    expect(() => new Chess().move(move)).not.toThrow();
  });

  it('returns null when the side to move has no legal moves', () => {
    // Fool's mate: white is checkmated.
    const mated = playMoves(['f3', 'e5', 'g4', 'Qh4#']);
    expect(mated.isCheckmate()).toBe(true);
    expect(findBestMove(mated.fen(), 'hard')).toBeNull();
  });

  it('finds a back-rank mate in 1', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
    const move = findBestMove(fen, 'hard');
    expect(move).toMatchObject({ from: 'd1', to: 'd8' });
    const game = new Chess(fen);
    game.move(move);
    expect(game.isCheckmate()).toBe(true);
  });

  it('takes a queen that is hanging', () => {
    // White rook on d1 can simply capture the undefended queen on d5.
    const move = findBestMove('6k1/5ppp/8/3q4/8/8/5PPP/3R2K1 w - - 0 1', 'hard');
    expect(move).toMatchObject({ from: 'd1', to: 'd5' });
  });

  it('promotes a pawn and reports the promotion piece', () => {
    const move = findBestMove('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', 'hard');
    expect(move).toMatchObject({ from: 'e7', to: 'e8', promotion: 'q' });
  });

  it('ignores a PGN that does not match the FEN and searches the FEN', () => {
    const otherGame = playMoves(['e4', 'e5']);
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
    expect(findBestMove(fen, 'hard', otherGame.pgn())).toMatchObject({ from: 'd1', to: 'd8' });
    expect(findBestMove(fen, 'hard', 'this is not a pgn')).toMatchObject({ from: 'd1', to: 'd8' });
  });

  it('EASY blunders on purpose: a forced "random move" roll still returns a legal move', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0); // 0 < blunder chance
    try {
      const move = findBestMove(START_FEN, 'easy');
      expect(() => new Chess().move(move)).not.toThrow();
    } finally {
      random.mockRestore();
    }
  });

  it('difficulty profiles get stronger from easy to hard', () => {
    expect(DIFFICULTY.easy.maxDepth).toBeLessThan(DIFFICULTY.medium.maxDepth);
    expect(DIFFICULTY.medium.maxDepth).toBeLessThan(DIFFICULTY.hard.maxDepth);
    expect(DIFFICULTY.hard.blunder).toBe(0);
  });
});

describe('findBestMove — draws by repetition (regression: the bot used to be blind to them)', () => {
  // Black (the bot) is a whole queen up, to move, in position P:
  //   6k1/5ppp/8/8/8/7P/q4PP1/6K1 b
  // Searching P on its own, the engine's favourite move is the quiet Kf8.
  // The history below makes exactly that move a repetition: the game starts
  // from the position AFTER Kf8, then Kh2 Kg8 Kg1 walks back to P. So
  // playing Kf8 again would bring an earlier position back on the board.
  const AFTER_KF8 = '5k2/5ppp/8/8/8/7P/q4PP1/6K1 w - - 0 1';
  const backToP = [{ from: 'g1', to: 'h2' }, { from: 'f8', to: 'g8' }, { from: 'h2', to: 'g1' }];

  it('when winning, avoids the move it would otherwise play if that move repeats a position', () => {
    const game = playMoves(backToP, AFTER_KF8);
    expect(evaluatePosition(game.fen())).toBeGreaterThan(500); // the bot really is winning

    // Blind (no history): it walks straight back into the earlier position.
    const blind = findBestMove(game.fen(), 'hard');
    expect(occurrences(afterBotMove(game, blind))).toBe(2);

    // With the game's history it picks something that is NOT a repetition.
    const aware = findBestMove(game.fen(), 'hard', game.pgn());
    expect(aware).not.toEqual(blind);
    expect(occurrences(afterBotMove(game, aware))).toBe(1);
  });

  it('when winning, never lets a position occur 3 times over a run of moves', () => {
    let game = playMoves(backToP, AFTER_KF8);

    for (let i = 0; i < 5 && !game.isGameOver(); i++) {
      game = afterBotMove(game, findBestMove(game.fen(), 'hard', game.pgn()));
      expect(game.isThreefoldRepetition()).toBe(false);
      if (game.isGameOver()) break;

      // White just shuffles its king back and forth, inviting the repetition.
      const legal = game.moves({ verbose: true });
      const reply = legal.find((m) => m.piece === 'k' && ['g1', 'h2'].includes(m.to)) || legal[0];
      game.move(reply);
      expect(game.isThreefoldRepetition()).toBe(false);
    }

    expect(game.isDraw()).toBe(false);
  }, 30000);

  it('when losing, heads for the repetition instead of avoiding it', () => {
    // Black (the bot) has a queen against two rooks and is behind, but can
    // keep checking: Kg2 Qd5+ Kg1 Qd1+ Kg2 ... Qd5+ repeats the position.
    const game = playMoves(
      [
        { from: 'g1', to: 'g2' }, { from: 'd1', to: 'd5' },
        { from: 'g2', to: 'g1' }, { from: 'd5', to: 'd1' },
        { from: 'g1', to: 'g2' },
      ],
      '7k/R5pp/1R6/8/8/6P1/5P1P/3q2K1 w - - 0 1'
    );
    expect(evaluatePosition(game.fen())).toBeLessThan(-100); // bot is behind

    const move = findBestMove(game.fen(), 'hard', game.pgn());
    expect(move).toMatchObject({ from: 'd1', to: 'd5' });
    expect(occurrences(afterBotMove(game, move))).toBe(2);
  });

});

describe('evaluatePosition', () => {
  it('is 0 for the symmetrical starting position', () => {
    expect(evaluatePosition(START_FEN)).toBe(0);
  });

  it('is positive when the side to move is ahead and negative when it is behind', () => {
    // White has an extra queen. Same position, only the side to move differs.
    const whiteToMove = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1';
    const blackToMove = '4k3/8/8/8/8/8/8/3QK3 b - - 0 1';
    expect(evaluatePosition(whiteToMove)).toBeGreaterThan(800);
    expect(evaluatePosition(blackToMove)).toBeLessThan(-800);
    expect(evaluatePosition(whiteToMove)).toBe(-evaluatePosition(blackToMove));
  });

  it('is positive for black to move when black is the one ahead', () => {
    expect(evaluatePosition('3qk3/8/8/8/8/8/8/4K3 b - - 0 1')).toBeGreaterThan(800);
  });
});
