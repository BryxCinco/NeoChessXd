import { findBestMove } from './engine';

let worker = null;
let nextId = 0;
const pending = new Map();

function getWorker() {
  if (worker || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./botWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const resolve = pending.get(e.data.id);
      if (resolve) {
        pending.delete(e.data.id);
        resolve(e.data.move);
      }
    };
    worker.onerror = () => {
      // Worker died (old browser, CSP, etc.) — answer everything still
      // waiting on the main thread and stop using the worker.
      worker = null;
      for (const [, resolve] of pending) resolve(undefined);
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

// Returns a Promise of { from, to, promotion } | null. `pgn` is the game so
// far, which lets the bot see draws by repetition and follow its opening
// book. `options` are passed through to findBestMove (e.g. { useBook: false }).
export function requestBotMove(fen, difficulty, pgn = null, options = undefined) {
  const w = getWorker();
  if (!w) return Promise.resolve(findBestMove(fen, difficulty, pgn, options));

  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, (move) => resolve(move === undefined ? findBestMove(fen, difficulty, pgn, options) : move));
    w.postMessage({ id, fen, difficulty, pgn, options });
  });
}
