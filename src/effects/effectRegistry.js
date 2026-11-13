// ── EFFECT REGISTRY ──
// Every visual effect in the game is a module registered here:
//
//   {
//     id        'chainsaw'                      unique
//     name      'CHAINSAW'                      shown in SETTINGS / FX GALLERY
//     trigger   'capture' | 'promotion' | 'check' | 'checkmate' | 'move' | 'theme_change'
//     duration  800                             milliseconds
//     draw(ctx, params)                         paints the frame at params.elapsed ms
//     cleanup()                                 drops any state draw() built up
//   }
//
// plus a few optional extras (sound, attackers, commitAt, persist, ...).
//
// Write a module with defineEffect() — you give it a `build(params)`
// function that returns `{ draw(ctx, frame), cleanup? }` for ONE run of the
// effect, and it supplies create() / draw() / cleanup() around it.
// To add an effect: create a file in this folder, defineEffect + registerEffect
// it, and import the file from index.js. Settings, the gallery and the game
// pick it up from the registry.

export const TRIGGERS = ['capture', 'promotion', 'check', 'checkmate', 'move', 'theme_change'];

const FRAME_MS = 1000 / 60;
const registry = new Map();

export function defineEffect({
  id,
  name,
  trigger,
  duration, // ms
  build,
  sound = null, // audioEngine sound name
  attackers = null, // capture only: piece types allowed to use it (null = any)
  signature = false, // capture only: a finisher that belongs to its attacker
  speed = 1, // animation frames per 1/60 s of real time
  commitAt = duration, // ms after which the game may carry on (move lands)
  persist = false, // keeps its last frame on screen until cleared (the cage)
  hidesAttacker = false, // the effect draws the capturing piece itself
}) {
  const live = new Set(); // every running instance of this effect
  const keyed = new Map(); // instances made through module.draw()

  function create(params = {}) {
    const run = build(params);
    const instance = {
      effect: null, // set below
      params,
      frameAt: (elapsed) => Math.floor((Math.max(0, elapsed) / FRAME_MS) * speed) + 1,
      draw(ctx, elapsed) {
        run.draw(ctx, instance.frameAt(elapsed));
      },
      cleanup() {
        if (run.cleanup) run.cleanup();
        if (Array.isArray(run.particles)) run.particles.length = 0;
        live.delete(instance);
      },
    };
    live.add(instance);
    return instance;
  }

  const effect = {
    id,
    name,
    trigger,
    duration,
    sound,
    attackers,
    signature,
    speed,
    commitAt: Math.min(commitAt, duration),
    persist,
    hidesAttacker,
    create,
    // Stateful convenience form: call it every frame with the time since the
    // effect started. `params.key` tells runs apart (default: one at a time).
    draw(ctx, params = {}) {
      const key = params.key ?? 'default';
      let instance = keyed.get(key);
      if (!instance) {
        instance = create(params);
        keyed.set(key, instance);
      }
      instance.draw(ctx, params.elapsed ?? 0);
    },
    cleanup() {
      for (const instance of [...live]) instance.cleanup();
      keyed.clear();
    },
    liveCount: () => live.size,
  };
  // instances point back at their module
  const originalCreate = effect.create;
  effect.create = (params) => {
    const instance = originalCreate(params);
    instance.effect = effect;
    return instance;
  };
  return effect;
}

export function registerEffect(effect) {
  const problems = [];
  if (!effect || typeof effect !== 'object') throw new Error('registerEffect: not an effect module');
  if (typeof effect.id !== 'string' || !effect.id) problems.push('id must be a non-empty string');
  if (typeof effect.name !== 'string' || !effect.name) problems.push('name must be a non-empty string');
  if (!TRIGGERS.includes(effect.trigger)) problems.push(`trigger must be one of ${TRIGGERS.join(', ')}`);
  if (!(Number.isFinite(effect.duration) && effect.duration > 0)) problems.push('duration must be a positive number of ms');
  if (typeof effect.draw !== 'function') problems.push('draw(ctx, params) is required');
  if (typeof effect.cleanup !== 'function') problems.push('cleanup() is required');
  if (problems.length) throw new Error(`registerEffect(${effect.id || '?'}): ${problems.join('; ')}`);
  if (registry.has(effect.id)) throw new Error(`registerEffect: "${effect.id}" is already registered`);
  registry.set(effect.id, effect);
  return effect;
}

export const unregisterEffect = (id) => registry.delete(id);
export const getEffect = (id) => registry.get(id) || null;
export const hasEffect = (id) => registry.has(id);

// All effects, or only those for one trigger, in registration order.
export function listEffects(trigger) {
  const all = [...registry.values()];
  return trigger ? all.filter((e) => e.trigger === trigger) : all;
}

// Total running instances across every effect (0 = nothing left behind).
export const liveEffectCount = () => listEffects().reduce((n, e) => n + (e.liveCount ? e.liveCount() : 0), 0);

// Stops and forgets every running instance of every effect.
export function cleanupAllEffects() {
  for (const effect of registry.values()) effect.cleanup();
}

// ── choosing an effect ──
// options: { effectsEnabled, disabledEffects: [ids], captureEffect: 'random' | id }
export function isEffectEnabled(effect, options = {}) {
  if (!effect) return false;
  if (options.effectsEnabled === false) return false;
  return !(options.disabledEffects || []).includes(effect.id);
}

const canUse = (effect, attackerType) =>
  !effect.attackers || !attackerType || effect.attackers.includes(attackerType);

// Capture effects this attacker may use right now.
export function eligibleCaptureEffects(attackerType, options = {}) {
  return listEffects('capture').filter((e) => canUse(e, attackerType) && isEffectEnabled(e, options));
}

// A shuffled "bag" per attacker type: every eligible effect is shown once
// before any repeats, in a different order each time round.
const bags = {};
export function resetEffectBags() {
  for (const key of Object.keys(bags)) delete bags[key];
}

export function pickCaptureEffect(attackerType, options = {}, random = Math.random) {
  const eligible = eligibleCaptureEffects(attackerType, options);
  if (eligible.length === 0) return null;

  const wanted = options.captureEffect;
  if (wanted && wanted !== 'random') {
    const chosen = eligible.find((e) => e.id === wanted);
    if (chosen) return chosen;
    // the chosen effect is off, or this piece cannot use it: fall through
  }

  const key = attackerType || 'any';
  const stillGood = (id) => eligible.some((e) => e.id === id);
  bags[key] = (bags[key] || []).filter(stillGood);
  if (bags[key].length === 0) {
    const ids = eligible.map((e) => e.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    bags[key] = ids;
  }
  return getEffect(bags[key].shift());
}

// The (first enabled) effect for a non-capture trigger, e.g. 'checkmate'.
export function pickEffectFor(trigger, options = {}) {
  if (trigger === 'capture') return pickCaptureEffect(options.attackerType, options);
  return listEffects(trigger).find((e) => isEffectEnabled(e, options)) || null;
}
