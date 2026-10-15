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

// Returns a Promise of { from, to, promotion } | null.
export function requestBotMove(fen, difficulty) {
  const w = getWorker();
  if (!w) return Promise.resolve(findBestMove(fen, difficulty));

  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, (move) => resolve(move === undefined ? findBestMove(fen, difficulty) : move));
    w.postMessage({ id, fen, difficulty });
  });
}
