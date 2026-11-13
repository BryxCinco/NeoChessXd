import { Chess } from 'chess.js';

const START_FEN = new Chess().fen();
const isLegalFromStart = (move) => {
  try {
    return !!new Chess().move(move);
  } catch {
    return false;
  }
};

// requestBotMove keeps its Worker in module state, so every test loads a
// fresh copy of the module after setting up (or removing) the global Worker.
async function loadFresh() {
  vi.resetModules();
  return (await import('./requestBotMove')).requestBotMove;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestBotMove', () => {
  it('searches on the main thread when Web Workers are unavailable', async () => {
    vi.stubGlobal('Worker', undefined);
    const requestBotMove = await loadFresh();
    expect(isLegalFromStart(await requestBotMove(START_FEN, 'easy'))).toBe(true);
  });

  it('sends the position to the worker and resolves with its answer', async () => {
    const posted = [];
    class FakeWorker {
      postMessage(msg) {
        posted.push(msg);
        queueMicrotask(() => this.onmessage({ data: { id: msg.id, move: { from: 'e7', to: 'e5' } } }));
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const requestBotMove = await loadFresh();

    await expect(requestBotMove('some-fen', 'hard', 'some-pgn')).resolves.toEqual({ from: 'e7', to: 'e5' });
    expect(posted[0]).toMatchObject({ fen: 'some-fen', difficulty: 'hard', pgn: 'some-pgn' });
  });

  it('falls back to the main thread when the worker crashes', async () => {
    class CrashingWorker {
      postMessage() {
        queueMicrotask(() => this.onerror(new Error('boom')));
      }
    }
    vi.stubGlobal('Worker', CrashingWorker);
    const requestBotMove = await loadFresh();
    expect(isLegalFromStart(await requestBotMove(START_FEN, 'easy'))).toBe(true);
  });

  it('falls back to the main thread when the worker cannot be created', async () => {
    vi.stubGlobal('Worker', class {
      constructor() {
        throw new Error('blocked by CSP');
      }
    });
    const requestBotMove = await loadFresh();
    expect(isLegalFromStart(await requestBotMove(START_FEN, 'easy'))).toBe(true);
  });
});

describe('botWorker', () => {
  it('answers a search request with the same id and a legal move', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('postMessage', postMessage);
    vi.resetModules();
    await import('./botWorker');

    self.onmessage({ data: { id: 7, fen: START_FEN, difficulty: 'easy', pgn: null } });

    expect(postMessage).toHaveBeenCalledTimes(1);
    const reply = postMessage.mock.calls[0][0];
    expect(reply.id).toBe(7);
    expect(isLegalFromStart(reply.move)).toBe(true);
    self.onmessage = null;
  });

  it('replies with a null move instead of dying when the search throws', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('postMessage', postMessage);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
    await import('./botWorker');

    self.onmessage({ data: { id: 8, fen: 'not a fen', difficulty: 'easy' } });

    expect(postMessage).toHaveBeenCalledWith({ id: 8, move: null });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    self.onmessage = null;
  });
});
