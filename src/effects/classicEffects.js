import { defineEffect, registerEffect } from './effectRegistry.js';
import { EFFECT_POOLS, EFFECT_LABELS, FX_SOUND, FINISHERS, FINISHER_FRAMES } from '../fx/eliminationFx.js';

// ── THE ORIGINAL FINISHERS, AS EFFECT MODULES ──
// The 17 per-piece finishers (and the plain SHATTER) keep their drawing code
// in src/fx/eliminationFx.js; here each one is wrapped in the module format
// and registered. They were tuned to play at 65% speed so every step of the
// destruction is readable, and that pacing is kept.
export const CLASSIC_SPEED = 0.65;

const ownerOf = Object.fromEntries(
  Object.entries(EFFECT_POOLS).flatMap(([attacker, ids]) => ids.map((id) => [id, attacker]))
);

export const classicEffects = Object.keys(FINISHERS).map((id) =>
  registerEffect(
    defineEffect({
      id,
      name: EFFECT_LABELS[id] || id.toUpperCase(),
      trigger: 'capture',
      duration: Math.round((FINISHER_FRAMES[id] / 60 / CLASSIC_SPEED) * 1000),
      speed: CLASSIC_SPEED,
      sound: FX_SOUND[id],
      attackers: ownerOf[id] ? [ownerOf[id]] : null, // SHATTER works for any piece
      signature: !!ownerOf[id],
      build: (params) => FINISHERS[id](params),
    })
  )
);
