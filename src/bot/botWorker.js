import { findBestMove } from './engine';

// Runs the bot search off the main thread so the board, timers and
// animations stay smooth on phones while the CPU is "thinking".
self.onmessage = (e) => {
  const { id, fen, difficulty } = e.data;
  let move = null;
  try {
    move = findBestMove(fen, difficulty);
  } catch (err) {
    console.error('Bot worker search failed:', err);
  }
  self.postMessage({ id, move });
};
