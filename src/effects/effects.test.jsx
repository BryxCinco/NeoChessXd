import { render, screen, fireEvent, renderHook, act, within } from '@testing-library/react';
import {
  TRIGGERS,
  defineEffect,
  registerEffect,
  unregisterEffect,
  getEffect,
  hasEffect,
  listEffects,
  liveEffectCount,
  cleanupAllEffects,
  isEffectEnabled,
  eligibleCaptureEffects,
  pickCaptureEffect,
  pickEffectFor,
  resetEffectBags,
} from './index.js';
import { createBase, spawn, spritePixels, spriteImage, makeEffect } from './fxKit.js';
import { EFFECT_POOLS, EFFECT_LABELS, FX_SOUND, FINISHERS } from '../fx/eliminationFx.js';
import { usePixelAnimation } from '../usePixelAnimation';
import { useSettings, sanitizeSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from '../hooks/useSettings';
import { SettingsModal } from '../components/SettingsModal';
import { setActivePieceSkin } from '../pieceSkins.js';
import { playRetroSound, setAudioVolumes } from '../audioEngine';

// jsdom has no canvas. This stand-in accepts any drawing call and counts
// them: every property is the same callable object, 0 in arithmetic.
function fakeContext() {
  const stats = { calls: 0 };
  const ctx = new Proxy(function () {}, {
    get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : key === '__stats' ? stats : ctx),
    set: () => true,
    apply: () => {
      stats.calls++;
      return ctx;
    },
  });
  return ctx;
}

const NEW_EFFECTS = {
  chainsaw: { name: 'CHAINSAW', duration: 800, sound: 'chainsaw' },
  petrify: { name: 'PETRIFICATION', duration: 600, sound: 'stone_crack' },
  soulExtraction: { name: 'SOUL EXTRACTION', duration: 1000, sound: 'soul' },
  bloodDrain: { name: 'BLOOD DRAIN', duration: 700, sound: 'drain' },
  squash: { name: 'PIECE SQUASH', duration: 1500, sound: 'thud' },
  toxicAcid: { name: 'TOXIC ACID', duration: 900, sound: 'sizzle' },
};
const params = (extra = {}) => ({ code: 'bQ', x: 200, y: 200, size: 64, attackerColor: 'w', attackerCode: 'wR', from: { x: 72, y: 328 }, ...extra });
const ALL_IDS = () => listEffects().map((e) => e.id);

// Plays an effect from start to finish at 60 fps against the fake canvas.
function playThrough(effect, p = params()) {
  const ctx = fakeContext();
  const instance = effect.create(p);
  for (let t = 0; t <= effect.duration; t += 1000 / 60) instance.draw(ctx, t);
  return { instance, ctx };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext());
  resetEffectBags();
});

afterEach(() => {
  cleanupAllEffects();
  setActivePieceSkin('classic');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('effect registry', () => {
  it('knows the six triggers', () => {
    expect(TRIGGERS).toEqual(['capture', 'promotion', 'check', 'checkmate', 'move', 'theme_change']);
  });

  it('every registered effect has the module shape: id, name, trigger, duration, draw, cleanup', () => {
    expect(listEffects().length).toBeGreaterThanOrEqual(26);
    for (const effect of listEffects()) {
      expect(typeof effect.id).toBe('string');
      expect(effect.name).toBe(effect.name.toUpperCase());
      expect(TRIGGERS).toContain(effect.trigger);
      expect(effect.duration).toBeGreaterThan(0);
      expect(effect.commitAt).toBeLessThanOrEqual(effect.duration);
      expect(typeof effect.draw).toBe('function');
      expect(typeof effect.cleanup).toBe('function');
      expect(typeof effect.create).toBe('function');
      expect(getEffect(effect.id)).toBe(effect);
    }
    expect(new Set(ALL_IDS()).size).toBe(ALL_IDS().length);
    expect(new Set(listEffects().map((e) => e.name)).size).toBe(listEffects().length);
  });

  it('refuses broken modules and duplicate ids', () => {
    const good = () => defineEffect({ id: 'testFx', name: 'TEST', trigger: 'move', duration: 100, build: () => ({ draw() {} }) });
    expect(() => registerEffect(null)).toThrow(/not an effect/);
    expect(() => registerEffect({ ...good(), id: '' })).toThrow(/id/);
    expect(() => registerEffect({ ...good(), name: '' })).toThrow(/name/);
    expect(() => registerEffect({ ...good(), trigger: 'explosion' })).toThrow(/trigger/);
    expect(() => registerEffect({ ...good(), duration: 0 })).toThrow(/duration/);
    expect(() => registerEffect({ ...good(), draw: undefined })).toThrow(/draw/);
    expect(() => registerEffect({ ...good(), cleanup: undefined })).toThrow(/cleanup/);
    expect(hasEffect('testFx')).toBe(false);

    registerEffect(good());
    expect(hasEffect('testFx')).toBe(true);
    expect(() => registerEffect(good())).toThrow(/already registered/);
    expect(unregisterEffect('testFx')).toBe(true);
    expect(getEffect('testFx')).toBeNull();
  });

  it('a new effect is one defineEffect + registerEffect away from being listed and picked', () => {
    const draws = [];
    const custom = registerEffect(
      defineEffect({ id: 'testConfetti', name: 'CONFETTI', trigger: 'move', duration: 500, build: (p) => ({ draw: (_ctx, frame) => draws.push([p.x, frame]) }) })
    );
    try {
      expect(listEffects('move')).toEqual([custom]);
      expect(pickEffectFor('move')).toBe(custom);
      custom.create({ x: 7 }).draw(fakeContext(), 100);
      expect(draws).toEqual([[7, 7]]); // 100 ms = frame 7 at 60 Hz
    } finally {
      custom.cleanup();
      unregisterEffect('testConfetti');
    }
  });

  it('lists effects by trigger: each one fires on the right event', () => {
    const byTrigger = (t) => listEffects(t).map((e) => e.id);
    expect(byTrigger('capture')).toEqual([...Object.keys(FINISHERS), 'chainsaw', 'petrify', 'soulExtraction', 'bloodDrain', 'squash', 'toxicAcid']);
    expect(byTrigger('checkmate')).toEqual(['kingCage']);
    expect(byTrigger('promotion')).toEqual(['promotionSparkle']);
    expect(pickEffectFor('checkmate').id).toBe('kingCage');
    expect(pickEffectFor('promotion').id).toBe('promotionSparkle');
    expect(pickEffectFor('check')).toBeNull(); // nothing registered for it (yet)
    for (let i = 0; i < 60; i++) expect(pickEffectFor('capture', { attackerType: 'q' }).trigger).toBe('capture');
  });
});

describe('the original finishers were wrapped, not rewritten', () => {
  it('all 17 finishers + SHATTER are registered with their labels, sounds and owners', () => {
    for (const [attacker, ids] of Object.entries(EFFECT_POOLS)) {
      for (const id of ids) {
        const effect = getEffect(id);
        expect(effect.name).toBe(EFFECT_LABELS[id]);
        expect(effect.sound).toBe(FX_SOUND[id]);
        expect(effect.attackers).toEqual([attacker]);
        expect(effect.signature).toBe(true);
        expect(effect.trigger).toBe('capture');
      }
    }
    expect(getEffect('shatter').attackers).toBeNull();
    expect(Object.keys(FINISHERS)).toHaveLength(18);
  });

  it('they keep their slowed-down pacing (65% speed)', () => {
    const stomp = getEffect('stomp');
    expect(stomp.speed).toBe(0.65);
    expect(stomp.duration).toBe(Math.round((46 / 60 / 0.65) * 1000));
    expect(stomp.create(params()).frameAt(stomp.duration)).toBeGreaterThanOrEqual(46); // reaches its last frame
  });
});

describe('the six new capture effects', () => {
  it.each(Object.entries(NEW_EFFECTS))('%s: capture effect with the right name, length and sound', (id, spec) => {
    const effect = getEffect(id);
    expect(effect).toMatchObject({ id, trigger: 'capture', signature: false, speed: 1, ...spec });
  });

  it('PIECE SQUASH is for heavy pieces only and lets the move land after 500 ms', () => {
    const squash = getEffect('squash');
    expect(squash.attackers).toEqual(['r', 'q', 'k']);
    expect(squash.commitAt).toBe(500);
    expect(squash.duration - squash.commitAt).toBe(1000); // the mark fades for a second
    expect(squash.hidesAttacker).toBe(true);
    for (const id of ['chainsaw', 'petrify', 'soulExtraction', 'bloodDrain', 'toxicAcid']) {
      expect(getEffect(id).attackers).toBeNull(); // any piece
      expect(getEffect(id).commitAt).toBe(getEffect(id).duration);
      expect(getEffect(id).hidesAttacker).toBe(false);
    }
  });

  it('the other five work for every piece type; squash only for R, Q, K', () => {
    for (const type of ['p', 'n', 'b', 'r', 'q', 'k']) {
      const ids = eligibleCaptureEffects(type).map((e) => e.id);
      for (const id of ['chainsaw', 'petrify', 'soulExtraction', 'bloodDrain', 'toxicAcid', 'shatter']) expect(ids).toContain(id);
      expect(ids.includes('squash')).toBe(['r', 'q', 'k'].includes(type));
      for (const own of EFFECT_POOLS[type]) expect(ids).toContain(own);
    }
  });
});

describe('every effect draws and cleans up', () => {
  const ids = [...Object.keys(FINISHERS), ...Object.keys(NEW_EFFECTS), 'kingCage', 'promotionSparkle'];

  it.each(ids)('%s: plays start to finish on every victim without throwing, then leaves nothing behind', (id) => {
    const effect = getEffect(id);
    for (const code of ['wP', 'bN', 'wB', 'bR', 'wQ', 'bK']) {
      const { instance, ctx } = playThrough(effect, params({ code, attackerColor: code[0] === 'w' ? 'b' : 'w' }));
      expect(ctx.__stats.calls).toBeGreaterThan(20); // it really drew something
      expect(effect.liveCount()).toBe(1);
      instance.cleanup();
      expect(effect.liveCount()).toBe(0);
    }
  });

  it.each(ids)('%s: the module-level draw(ctx, params) / cleanup() pair works too', (id) => {
    const effect = getEffect(id);
    const ctx = fakeContext();
    for (let elapsed = 0; elapsed <= effect.duration; elapsed += 50) effect.draw(ctx, { ...params(), elapsed });
    expect(effect.liveCount()).toBe(1); // one run, reused on every call
    effect.draw(ctx, { ...params(), elapsed: 0, key: 'second' });
    expect(effect.liveCount()).toBe(2);
    effect.cleanup();
    expect(effect.liveCount()).toBe(0);
  });

  it('works without the optional params (no attacker square, no attacker piece)', () => {
    for (const id of Object.keys(NEW_EFFECTS)) {
      const effect = getEffect(id);
      expect(() => playThrough(effect, { code: 'wN', x: 100, y: 100, size: 40, attackerColor: 'b' })).not.toThrow();
    }
  });

  it('draws the captured piece in the active piece skin', () => {
    const classic = spritePixels('wK');
    setActivePieceSkin('cursed');
    const cursed = spritePixels('wK');
    expect(cursed).not.toBe(classic);
    expect(cursed.map((p) => p.color)).toContain('#f3e9cf'); // bone
    expect(spriteImage('wK')).not.toBe(spriteImage('bK'));
    setActivePieceSkin('classic');
    expect(spritePixels('wK')).toBe(classic); // cached per skin
    for (const skin of ['neon', 'cursed']) {
      setActivePieceSkin(skin);
      for (const id of Object.keys(NEW_EFFECTS)) expect(() => playThrough(getEffect(id))).not.toThrow();
    }
  });

  it('no memory leak: 300 captures later nothing is still alive', () => {
    const capture = listEffects('capture');
    for (let i = 0; i < 300; i++) {
      const { instance } = playThrough(capture[i % capture.length]);
      instance.cleanup();
    }
    expect(liveEffectCount()).toBe(0);
  });

  it('cleanup empties the particle list and is safe to call twice', () => {
    let fx;
    const probe = defineEffect({
      id: 'testProbe', name: 'PROBE', trigger: 'move', duration: 200,
      build: (p) => {
        fx = createBase(p);
        return makeEffect(fx, 12, () => spawn(fx, { x: 0, y: 0, vx: 0, vy: 0, s: 1, color: '#fff', life: 100 }), () => {});
      },
    });
    const instance = probe.create(params());
    instance.draw(fakeContext(), 100);
    expect(fx.particles.length).toBeGreaterThan(0);
    instance.cleanup();
    expect(fx.particles).toHaveLength(0);
    expect(() => instance.cleanup()).not.toThrow();
    expect(probe.liveCount()).toBe(0);
    cleanupAllEffects();
    expect(liveEffectCount()).toBe(0);
  });
});

describe('effect intensity (particle count)', () => {
  const countParticles = (intensity) => {
    const fx = createBase(params({ intensity }));
    for (let i = 0; i < 400; i++) spawn(fx, { x: 0, y: 0, vx: 0, vy: 0, s: 1, color: '#fff', life: 10 });
    return fx.particles.length;
  };

  it('100 keeps every particle, 0 keeps none, 50 about half', () => {
    expect(countParticles(1)).toBe(400);
    expect(countParticles(0)).toBe(0);
    const half = countParticles(0.5);
    expect(half).toBeGreaterThan(140);
    expect(half).toBeLessThan(260);
  });

  it('missing or out-of-range values are clamped; essential particles always spawn', () => {
    expect(countParticles(undefined)).toBe(400);
    expect(countParticles(7)).toBe(400);
    expect(countParticles(-1)).toBe(0);
    const fx = createBase(params({ intensity: 0 }));
    spawn(fx, { x: 0, y: 0, vx: 0, vy: 0, s: 1, color: '#fff', life: 10, essential: true });
    expect(fx.particles).toHaveLength(1);
  });

  it('effects still play at intensity 0 (sprite animation only)', () => {
    for (const id of Object.keys(NEW_EFFECTS)) expect(() => playThrough(getEffect(id), params({ intensity: 0 }))).not.toThrow();
  });
});

describe('choosing a capture effect from the settings', () => {
  it('per-effect toggle: a switched-off effect is never picked', () => {
    const off = ['chainsaw', 'squash', 'blackhole', 'ufo'];
    const options = { disabledEffects: off };
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(pickCaptureEffect('q', options).id);
    for (const id of off) expect(seen.has(id)).toBe(false);
    expect([...seen].sort()).toEqual(['bloodDrain', 'handGrab', 'petrify', 'shatter', 'soulExtraction', 'toxicAcid'].sort());
    expect(isEffectEnabled(getEffect('chainsaw'), options)).toBe(false);
    expect(isEffectEnabled(getEffect('petrify'), options)).toBe(true);
    expect(isEffectEnabled(null)).toBe(false);
  });

  it('master switch off: nothing plays, for any trigger', () => {
    const options = { effectsEnabled: false };
    expect(pickCaptureEffect('q', options)).toBeNull();
    expect(pickEffectFor('checkmate', options)).toBeNull();
    expect(pickEffectFor('promotion', options)).toBeNull();
    expect(eligibleCaptureEffects('p', options)).toEqual([]);
  });

  it('everything switched off one by one also means no effect', () => {
    expect(pickCaptureEffect('p', { disabledEffects: ALL_IDS() })).toBeNull();
    expect(pickEffectFor('checkmate', { disabledEffects: ['kingCage'] })).toBeNull();
  });

  it('RANDOM shows every available effect once before repeating any', () => {
    const available = eligibleCaptureEffects('r').map((e) => e.id);
    expect(available).toHaveLength(10); // 3 rook finishers + shatter + 6 new
    const firstRound = Array.from({ length: available.length }, () => pickCaptureEffect('r', { captureEffect: 'random' }).id);
    expect([...firstRound].sort()).toEqual([...available].sort());
    const secondRound = Array.from({ length: available.length }, () => pickCaptureEffect('r').id);
    expect([...secondRound].sort()).toEqual([...available].sort());
  });

  it('a pawn never gets another piece\'s finisher or the squash', () => {
    const allowed = new Set(eligibleCaptureEffects('p').map((e) => e.id));
    for (let i = 0; i < 100; i++) expect(allowed.has(pickCaptureEffect('p').id)).toBe(true);
    expect(allowed.has('squash')).toBe(false);
    expect(allowed.has('nuke')).toBe(false);
  });

  it('a specific effect is used every time it applies', () => {
    for (let i = 0; i < 20; i++) {
      expect(pickCaptureEffect('p', { captureEffect: 'petrify' }).id).toBe('petrify');
      expect(pickCaptureEffect('k', { captureEffect: 'squash' }).id).toBe('squash');
    }
  });

  it('a specific effect that does not apply falls back to RANDOM', () => {
    // squash chosen, but a knight is not a heavy piece
    expect(pickCaptureEffect('n', { captureEffect: 'squash' }).id).not.toBe('squash');
    // chainsaw chosen but switched off
    expect(pickCaptureEffect('n', { captureEffect: 'chainsaw', disabledEffects: ['chainsaw'] }).id).not.toBe('chainsaw');
    // unknown id
    expect(pickCaptureEffect('n', { captureEffect: 'nope' })).not.toBeNull();
  });

  it('the shuffle uses the random source it is given', () => {
    const order = (random) => {
      resetEffectBags();
      return Array.from({ length: 4 }, () => pickCaptureEffect('b', {}, random).id);
    };
    expect(order(() => 0)).toEqual(order(() => 0));
    expect(order(() => 0)).not.toEqual(order(() => 0.999));
  });
});

// ── the runner on the board canvas ──
describe('usePixelAnimation', () => {
  function mountBoard(options) {
    const board = document.createElement('div');
    const canvas = document.createElement('canvas');
    board.appendChild(canvas);
    for (const [name, left, top] of [['e4', 240, 240], ['a1', 0, 420], ['e8', 240, 0]]) {
      const square = document.createElement('div');
      square.setAttribute('data-square', name);
      square.getBoundingClientRect = () => ({ left, top, width: 60, height: 60 });
      board.appendChild(square);
    }
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 480 });
    document.body.appendChild(board);
    const view = renderHook((props) => usePixelAnimation(props), { initialProps: options });
    view.result.current.canvasRef.current = canvas;
    return { ...view, api: () => view.result.current, remove: () => board.remove() };
  }
  const advance = (ms) => act(() => vi.advanceTimersByTime(ms));

  beforeEach(() => vi.useFakeTimers());

  it('a capture plays an effect: returns its sound, lands the move at the end, then cleans up', () => {
    const board = mountBoard({ captureEffect: 'petrify' });
    const done = vi.fn();
    let sound;
    act(() => {
      sound = board.api().triggerElimination('e4', 'bN', 'p', 'w', done, { from: 'a1' });
    });
    expect(sound).toBe('stone_crack');
    expect(getEffect('petrify').liveCount()).toBe(1);

    advance(400);
    expect(done).not.toHaveBeenCalled();
    advance(350); // past 600 ms
    expect(done).toHaveBeenCalledTimes(1);
    expect(liveEffectCount()).toBe(0);
    advance(1000);
    expect(done).toHaveBeenCalledTimes(1);
    board.remove();
  });

  it('tells the game which effect was picked, and where the attacker came from', () => {
    const board = mountBoard({ captureEffect: 'squash' });
    const onEffect = vi.fn();
    const create = vi.spyOn(getEffect('squash'), 'create');
    act(() => {
      board.api().triggerElimination('e4', 'bN', 'q', 'w', () => {}, { from: 'a1', onEffect });
    });
    expect(onEffect).toHaveBeenCalledWith(getEffect('squash'));
    expect(create.mock.calls[0][0]).toMatchObject({ code: 'bN', x: 270, y: 270, size: 60, attackerColor: 'w', attackerCode: 'wQ', from: { x: 30, y: 450 }, intensity: 1 });
    board.remove();
  });

  it('PIECE SQUASH lands the move after 500 ms while the mark keeps fading', () => {
    const board = mountBoard({ captureEffect: 'squash' });
    const done = vi.fn();
    act(() => {
      board.api().triggerElimination('e4', 'bN', 'r', 'w', done);
    });
    advance(450);
    expect(done).not.toHaveBeenCalled();
    advance(120);
    expect(done).toHaveBeenCalledTimes(1);
    expect(getEffect('squash').liveCount()).toBe(1); // still drawing the mark
    advance(1100);
    expect(liveEffectCount()).toBe(0);
    board.remove();
  });

  it('the intensity setting reaches the effect', () => {
    const board = mountBoard({ captureEffect: 'chainsaw', effectIntensity: 25 });
    const create = vi.spyOn(getEffect('chainsaw'), 'create');
    act(() => {
      board.api().triggerElimination('e4', 'bN', 'p', 'w', () => {});
    });
    expect(create.mock.calls[0][0].intensity).toBe(0.25);
    board.remove();
  });

  it('effects off: no animation, but the move still lands at once', () => {
    for (const options of [{ effectsEnabled: false }, { disabledEffects: ALL_IDS() }]) {
      const board = mountBoard(options);
      const done = vi.fn();
      let sound = 'unset';
      act(() => {
        sound = board.api().triggerElimination('e4', 'bN', 'p', 'w', done);
      });
      expect(sound).toBeNull();
      expect(done).toHaveBeenCalledTimes(1);
      expect(liveEffectCount()).toBe(0);
      expect(board.api().triggerCaptureAnimation('e8', null, 'cage')).toBeNull();
      board.remove();
    }
  });

  it('a settings change applies to the very next capture', () => {
    const board = mountBoard({ captureEffect: 'petrify' });
    board.rerender({ captureEffect: 'toxicAcid' });
    let sound;
    act(() => {
      sound = board.api().triggerElimination('e4', 'bN', 'p', 'w', () => {});
    });
    expect(sound).toBe('sizzle');
    board.remove();
  });

  it('without a canvas or a square it just calls back', () => {
    const { result } = renderHook(() => usePixelAnimation());
    const done = vi.fn();
    expect(result.current.triggerElimination('e4', 'bN', 'p', 'w', done)).toBeNull();
    expect(result.current.triggerEffect('promotion', 'e8', done)).toBeNull();
    expect(result.current.triggerCaptureAnimation('e8', done, 'cage')).toBeNull();
    expect(result.current.triggerCaptureAnimation('e8', done)).toBeNull();
    expect(done).toHaveBeenCalledTimes(4);
    expect(() => result.current.clearAnimations()).not.toThrow();

    const board = mountBoard();
    expect(board.api().triggerElimination('h8', 'bN', 'p', 'w', done)).toBeNull(); // no such square
    expect(done).toHaveBeenCalledTimes(5);
    board.remove();
  });

  it('checkmate drops the cage, which stays until the board is cleared', () => {
    const board = mountBoard();
    let id;
    act(() => {
      id = board.api().triggerCaptureAnimation('e8', null, 'cage');
    });
    expect(id).toBe('cage');
    advance(3000);
    expect(getEffect('kingCage').liveCount()).toBe(1); // frozen on the king
    act(() => board.api().clearAnimations());
    expect(liveEffectCount()).toBe(0);
    board.remove();
  });

  it('a promotion plays the promotion effect', () => {
    const board = mountBoard();
    const done = vi.fn();
    let id;
    act(() => {
      id = board.api().triggerEffect('promotion', 'e8', done);
    });
    expect(id).toBe('promotionSparkle');
    advance(800);
    expect(done).toHaveBeenCalledTimes(1);
    expect(liveEffectCount()).toBe(0);
    board.remove();
  });

  it('an effect that throws is dropped, its move still lands, and the runner keeps working', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = getEffect('petrify');
    const create = vi.spyOn(broken, 'create').mockImplementationOnce(() => ({
      effect: broken,
      draw() {
        throw new Error('boom');
      },
      cleanup: vi.fn(),
    }));
    const board = mountBoard({ captureEffect: 'petrify' });
    const done = vi.fn();
    act(() => {
      board.api().triggerElimination('e4', 'bN', 'p', 'w', done);
    });
    advance(50);
    expect(done).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalled();
    expect(liveEffectCount()).toBe(0);

    // the next capture still plays and finishes normally
    create.mockRestore();
    const next = vi.fn();
    act(() => {
      board.api().triggerElimination('e4', 'bN', 'p', 'w', next);
    });
    expect(getEffect('petrify').liveCount()).toBe(1);
    advance(900);
    expect(next).toHaveBeenCalledTimes(1);
    expect(liveEffectCount()).toBe(0);
    board.remove();
  });

  it('when an effect ends the canvas is wiped and the loop stops; a frozen cage stays', () => {
    const board = mountBoard({ captureEffect: 'petrify' });
    const log = [];
    const ctx = new Proxy(function () {}, {
      get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : () => (log.push(key), ctx)),
      set: () => true,
    });
    board.api().canvasRef.current.getContext = () => ctx;
    act(() => {
      board.api().triggerCaptureAnimation('e8', null, 'cage');
      board.api().triggerElimination('e4', 'bN', 'p', 'w', () => {});
    });
    advance(2000); // petrify (600 ms) is over, the cage has landed and froze
    expect(getEffect('petrify').liveCount()).toBe(0);
    expect(getEffect('kingCage').liveCount()).toBe(1);
    expect(log).toContain('clearRect');

    log.length = 0;
    advance(1000);
    expect(log).toHaveLength(0); // nothing redraws any more: the loop has stopped
    act(() => board.api().clearAnimations());
    expect(liveEffectCount()).toBe(0);
    board.remove();
  });

  it('clearAnimations and unmounting stop everything mid-effect', () => {
    const board = mountBoard();
    const done = vi.fn();
    act(() => {
      board.api().triggerElimination('e4', 'bN', 'q', 'w', done);
      board.api().triggerElimination('e8', 'bR', 'n', 'w', done);
    });
    expect(liveEffectCount()).toBe(2);
    advance(100);
    act(() => board.api().clearAnimations());
    expect(liveEffectCount()).toBe(0);
    advance(5000);
    expect(done).not.toHaveBeenCalled(); // a cleared effect never lands its move

    act(() => {
      board.api().triggerElimination('e4', 'bN', 'q', 'w', done);
    });
    board.unmount();
    expect(liveEffectCount()).toBe(0);
    board.remove();
  });

  it('many captures in a row leave nothing running', () => {
    const board = mountBoard();
    for (let i = 0; i < 40; i++) {
      act(() => {
        board.api().triggerElimination('e4', 'bN', 'rqkpnb'[i % 6], 'w', () => {});
      });
      advance(2600);
    }
    expect(liveEffectCount()).toBe(0);
    board.remove();
  });
});

// ── settings ──
describe('effect settings', () => {
  it('defaults: everything on, random capture effect, full intensity', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toMatchObject({ effectsEnabled: true, captureEffect: 'random', effectIntensity: 100, disabledEffects: [] });
  });

  it('every effect setting is saved and survives a reload', () => {
    const first = renderHook(() => useSettings());
    act(() => first.result.current.updateSetting('effectsEnabled', false));
    act(() => first.result.current.updateSetting('captureEffect', 'chainsaw'));
    act(() => first.result.current.updateSetting('effectIntensity', 35));
    act(() => first.result.current.toggleEffect('ufo', false));
    act(() => first.result.current.toggleEffect('petrify', false));
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    expect(saved).toMatchObject({ effectsEnabled: false, captureEffect: 'chainsaw', effectIntensity: 35, disabledEffects: ['ufo', 'petrify'] });
    first.unmount();

    const second = renderHook(() => useSettings());
    expect(second.result.current.settings).toMatchObject(saved);
  });

  it('toggleEffect switches one effect off and back on, without duplicates', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.toggleEffect('nuke', false));
    act(() => result.current.toggleEffect('nuke', false));
    expect(result.current.settings.disabledEffects).toEqual(['nuke']);
    act(() => result.current.toggleEffect('nuke', true));
    expect(result.current.settings.disabledEffects).toEqual([]);
    act(() => result.current.toggleEffect('not-an-effect', false));
    expect(result.current.settings.disabledEffects).toEqual([]);
  });

  it('rejects bad values', () => {
    expect(sanitizeSettings({ captureEffect: 'kingCage' }).captureEffect).toBe('random'); // not a capture effect
    expect(sanitizeSettings({ captureEffect: 'nope' }).captureEffect).toBe('random');
    expect(sanitizeSettings({ captureEffect: 'squash' }).captureEffect).toBe('squash');
    expect(sanitizeSettings({ effectIntensity: 400 }).effectIntensity).toBe(100);
    expect(sanitizeSettings({ effectIntensity: -3 }).effectIntensity).toBe(0);
    expect(sanitizeSettings({ effectsEnabled: 'no' }).effectsEnabled).toBe(true);
    expect(sanitizeSettings({ disabledEffects: 'ufo' }).disabledEffects).toEqual([]);
    expect(sanitizeSettings({ disabledEffects: ['ufo', 'ufo', 42, 'ghost', 'kingCage'] }).disabledEffects).toEqual(['ufo', 'kingCage']);
  });

  it('RESET switches every effect back on and never shares the default list', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.toggleEffect('ufo', false));
    act(() => result.current.updateSetting('effectIntensity', 10));
    act(() => result.current.resetSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.current.settings.disabledEffects).not.toBe(DEFAULT_SETTINGS.disabledEffects);
    expect(DEFAULT_SETTINGS.disabledEffects).toEqual([]);
  });
});

describe('SETTINGS → EFFECTS section', () => {
  const renderSettings = (settings = {}) => {
    const props = { onChange: vi.fn(), onToggleEffect: vi.fn(), onReset: vi.fn(), onClose: vi.fn() };
    render(<SettingsModal settings={{ ...DEFAULT_SETTINGS, ...settings }} {...props} />);
    return props;
  };

  it('has a master switch, a capture-effect chooser and an intensity slider', () => {
    const { onChange } = renderSettings();
    expect(screen.getByRole('heading', { name: 'EFFECTS' })).toBeInTheDocument();

    const master = screen.getByRole('switch', { name: 'ALL EFFECTS' });
    expect(master).toBeChecked();
    fireEvent.click(master);
    expect(onChange).toHaveBeenCalledWith('effectsEnabled', false);

    const chooser = screen.getByLabelText(/CAPTURE EFFECT/);
    expect(chooser).toHaveValue('random');
    const options = within(chooser).getAllByRole('option');
    expect(options).toHaveLength(1 + listEffects('capture').length);
    expect(options[0]).toHaveTextContent('RANDOM');
    expect(within(chooser).getByRole('option', { name: 'PIECE SQUASH (ROOK/QUEEN/KING)' })).toHaveValue('squash');
    expect(within(chooser).getByRole('option', { name: 'CHAINSAW' })).toHaveValue('chainsaw');
    expect(within(chooser).queryByRole('option', { name: 'KING CAGE' })).not.toBeInTheDocument();
    fireEvent.change(chooser, { target: { value: 'toxicAcid' } });
    expect(onChange).toHaveBeenCalledWith('captureEffect', 'toxicAcid');

    const slider = screen.getByLabelText(/EFFECT INTENSITY/);
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '100');
    fireEvent.change(slider, { target: { value: '40' } });
    expect(onChange).toHaveBeenCalledWith('effectIntensity', 40);
  });

  it('has one switch per effect, showing what is on', () => {
    const { onToggleEffect } = renderSettings({ disabledEffects: ['chainsaw', 'kingCage'] });
    expect(screen.getByText(`EFFECT LIST (${listEffects().length - 2}/${listEffects().length} ON)`)).toBeInTheDocument();
    for (const effect of listEffects()) {
      const toggle = screen.getByRole('switch', { name: effect.name });
      expect(toggle).toHaveAttribute('aria-checked', String(!['chainsaw', 'kingCage'].includes(effect.id)));
    }
    fireEvent.click(screen.getByRole('switch', { name: 'CHAINSAW' }));
    expect(onToggleEffect).toHaveBeenCalledWith('chainsaw', true);
    fireEvent.click(screen.getByRole('switch', { name: 'TOXIC ACID' }));
    expect(onToggleEffect).toHaveBeenCalledWith('toxicAcid', false);
  });

  it('a switched-off effect cannot be chosen as the capture effect', () => {
    renderSettings({ disabledEffects: ['petrify'] });
    const chooser = screen.getByLabelText(/CAPTURE EFFECT/);
    expect(within(chooser).getByRole('option', { name: 'PETRIFICATION' })).toBeDisabled();
    expect(within(chooser).getByRole('option', { name: 'BLOOD DRAIN' })).toBeEnabled();
  });

  it('with ALL EFFECTS off the other effect controls are disabled', () => {
    const { onToggleEffect } = renderSettings({ effectsEnabled: false });
    expect(screen.getByRole('switch', { name: 'ALL EFFECTS' })).not.toBeChecked();
    expect(screen.getByLabelText(/CAPTURE EFFECT/)).toBeDisabled();
    expect(screen.getByLabelText(/EFFECT INTENSITY/)).toBeDisabled();
    const toggle = screen.getByRole('switch', { name: 'CHAINSAW' });
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(onToggleEffect).not.toHaveBeenCalled();
  });
});

describe('sounds for the new effects', () => {
  it.each(['chainsaw', 'stone_crack', 'soul', 'drain', 'thud', 'sizzle'])('%s builds a sound through the SFX volume', (name) => {
    const gains = [];
    const node = () =>
      new Proxy(function () {}, {
        get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : node()),
        set: () => true,
        apply: () => node(),
      });
    const ctx = {
      state: 'running',
      currentTime: 0,
      sampleRate: 8000,
      destination: {},
      createGain() {
        const gain = { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
        gains.push(gain);
        return gain;
      },
      createOscillator: node,
      createBiquadFilter: node,
      createBufferSource: node,
      createBuffer: (_channels, size) => ({ getChannelData: () => new Float32Array(size) }),
    };
    vi.stubGlobal('AudioContext', function FakeAudioContext() {
      return ctx;
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    setAudioVolumes({ sfx: 0.5 });

    playRetroSound(name, { current: ctx });
    expect(log).not.toHaveBeenCalled(); // no "Audio node exception"
    expect(gains[0].gain.value).toBe(0.5); // master gain
    expect(gains.length).toBeGreaterThan(1); // plus the sound's own

    gains.length = 0;
    setAudioVolumes({ sfx: 0 });
    playRetroSound(name, { current: ctx });
    expect(gains).toHaveLength(0);
    setAudioVolumes({ sfx: 1 });
  });

  it('every effect sound name exists in the audio engine', async () => {
    const source = (await import('../audioEngine.js?raw')).default;
    for (const effect of listEffects()) {
      if (effect.sound) expect(source, effect.id).toContain(`'${effect.sound}'`);
    }
  });
});
