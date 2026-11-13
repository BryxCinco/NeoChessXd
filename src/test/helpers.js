import { vi } from 'vitest';
import { Chess } from 'chess.js';

// A game WITH its move history (what a save slot / session restores).
export function makeChessFromPgn(pgn) {
  const game = new Chess();
  game.loadPgn(pgn);
  return game;
}

// A bare position, no history.
export function makeChessFromFen(fen) {
  return new Chess(fen);
}

// Plays a list of moves (SAN strings or { from, to, promotion }) onto a
// new game and returns it. `fen` is the optional starting position.
export function playMoves(moves, fen) {
  const game = fen ? new Chess(fen) : new Chess();
  for (const move of moves) game.move(move);
  return game;
}

let storageSpies = [];
// jsdom's Storage class (the methods live on the prototype, not the object).
const storageProto = () => Object.getPrototypeOf(localStorage);

// Makes localStorage writes throw, like a full disk (QuotaExceededError).
// With { read: true } reads and removals throw too, like a browser that
// blocks storage entirely (private mode → SecurityError).
export function mockLocalStorageFailure({ read = false } = {}) {
  const fail = (name) => () => {
    throw new DOMException('storage unavailable (test)', name);
  };
  storageSpies.push(vi.spyOn(storageProto(), 'setItem').mockImplementation(fail('QuotaExceededError')));
  if (read) {
    storageSpies.push(vi.spyOn(storageProto(), 'getItem').mockImplementation(fail('SecurityError')));
    storageSpies.push(vi.spyOn(storageProto(), 'removeItem').mockImplementation(fail('SecurityError')));
  }
}

// Undoes mockLocalStorageFailure() and empties the storage.
export function restoreLocalStorage() {
  storageSpies.forEach((spy) => spy.mockRestore());
  storageSpies = [];
  localStorage.clear();
}
