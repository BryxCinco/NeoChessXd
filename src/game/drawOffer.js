// How the CPU answers a draw offer.
// It accepts when the position is roughly level: the evaluation (in
// centipawns, from either side's point of view) is within half a pawn.
// It never accepts in the first moves — the starting position is "level"
// too, and agreeing a draw on move 1 would just be a free way out.
export const DRAW_EVAL_MARGIN = 50; // centipawns = 0.5 pawns
export const DRAW_MIN_PLIES = 20; // 10 moves each

export function botAcceptsDraw(evalCentipawns, pliesPlayed) {
  return pliesPlayed >= DRAW_MIN_PLIES && Math.abs(evalCentipawns) <= DRAW_EVAL_MARGIN;
}
