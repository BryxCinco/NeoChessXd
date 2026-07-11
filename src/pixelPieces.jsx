import React, { useState, useRef, useCallback } from 'react';

/* ============================================================
   SOUND ENGINE — synthesized with Web Audio API (no audio files)
   Each piece type gets its own tiny sonic signature.
   ============================================================ */
let sharedCtx = null;
function getCtx() {
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new AC();
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
}

function tone(ctx, { freq, start, dur, type = 'sine', gain = 0.18, glideTo = null }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noiseBurst(ctx, { start, dur, gain = 0.15, filterFreq = 1200 }) {
  const bufferSize = ctx.sampleRate * dur;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filt).connect(g).connect(ctx.destination);
  src.start(start);
}

export function playPieceSound(kind) {
  try {
    const ctx = getCtx();
    const t0 = ctx.currentTime;
    switch (kind) {
      case 'P': // pawn — soft little blip
        tone(ctx, { freq: 420, start: t0, dur: 0.09, type: 'sine', gain: 0.14, glideTo: 560 });
        break;
      case 'N': // knight — two hoofbeats
        noiseBurst(ctx, { start: t0, dur: 0.06, gain: 0.2, filterFreq: 300 });
        tone(ctx, { freq: 90, start: t0, dur: 0.08, type: 'square', gain: 0.12 });
        noiseBurst(ctx, { start: t0 + 0.12, dur: 0.06, gain: 0.18, filterFreq: 260 });
        tone(ctx, { freq: 80, start: t0 + 0.12, dur: 0.08, type: 'square', gain: 0.1 });
        break;
      case 'B': // bishop — magical ascending chime
        tone(ctx, { freq: 523.25, start: t0, dur: 0.18, type: 'sine', gain: 0.14 });
        tone(ctx, { freq: 659.25, start: t0 + 0.08, dur: 0.2, type: 'sine', gain: 0.13 });
        tone(ctx, { freq: 987.77, start: t0 + 0.16, dur: 0.28, type: 'triangle', gain: 0.12 });
        break;
      case 'R': // rook — heavy stone thud
        tone(ctx, { freq: 70, start: t0, dur: 0.28, type: 'sine', gain: 0.22, glideTo: 45 });
        noiseBurst(ctx, { start: t0, dur: 0.1, gain: 0.16, filterFreq: 180 });
        break;
      case 'Q': // queen — elegant harp glissando
        [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((f, i) =>
          tone(ctx, { freq: f, start: t0 + i * 0.045, dur: 0.22, type: 'triangle', gain: 0.11 })
        );
        break;
      case 'K': // king — low brass horn chord
        tone(ctx, { freq: 130.81, start: t0, dur: 0.4, type: 'sawtooth', gain: 0.12 });
        tone(ctx, { freq: 164.81, start: t0, dur: 0.4, type: 'sawtooth', gain: 0.1 });
        tone(ctx, { freq: 196.0, start: t0, dur: 0.4, type: 'sawtooth', gain: 0.08 });
        break;
      case 'capture':
        noiseBurst(ctx, { start: t0, dur: 0.18, gain: 0.25, filterFreq: 1500 });
        tone(ctx, { freq: 1200, start: t0, dur: 0.15, type: 'square', gain: 0.08, glideTo: 300 });
        break;
      case 'check':
        tone(ctx, { freq: 880, start: t0, dur: 0.12, type: 'square', gain: 0.15 });
        tone(ctx, { freq: 880, start: t0 + 0.15, dur: 0.12, type: 'square', gain: 0.15 });
        break;
      default:
        tone(ctx, { freq: 440, start: t0, dur: 0.1, type: 'sine', gain: 0.12 });
    }
  } catch (e) {
    // Audio not available (e.g. no user gesture yet) — fail silently.
  }
}

/* ============================================================
   ANIMATION + LIGHTING STYLES
   ============================================================ */
const animationStyles = `
  @keyframes pixel-idle { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-1px) scaleY(1.05); } }
  @keyframes eye-blink { 0%,90%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
  @keyframes arm-swing-l { 0%,100% { transform: rotate(-10deg); } 50% { transform: rotate(9deg); } }
  @keyframes arm-swing-r { 0%,100% { transform: rotate(10deg); } 50% { transform: rotate(-9deg); } }
  @keyframes leg-march-l { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.8px); } }
  @keyframes leg-march-r { 0%,100% { transform: translateY(-0.8px); } 50% { transform: translateY(0); } }
  @keyframes glow-pulse { 0%,100% { filter: brightness(1) drop-shadow(0 0 0px currentColor); } 50% { filter: brightness(1.6) drop-shadow(0 0 2.5px currentColor); } }
  @keyframes sparkle-twinkle { 0%,100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1.3); } }
  @keyframes dust-drift { 0% { opacity: 0; transform: translate(0,0); } 35% { opacity: 0.85; } 100% { opacity: 0; transform: translate(2.5px,-7px); } }
  @keyframes crown-glint { 0%,100% { opacity: 0; } 48%,52% { opacity: 0.9; } }
  @keyframes select-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }

  .pixel-piece { transform-origin: bottom center; animation: pixel-idle 1.2s ease-in-out infinite; }
  .pixel-eye { transform-origin: center; animation: eye-blink 4s infinite; }
  .pixel-arm-l { transform-origin: 50% 0%; animation: arm-swing-l 1.5s ease-in-out infinite; }
  .pixel-arm-r { transform-origin: 50% 0%; animation: arm-swing-r 1.5s ease-in-out infinite; }
  .pixel-leg-l { transform-origin: 50% 100%; animation: leg-march-l 1.5s ease-in-out infinite; }
  .pixel-leg-r { transform-origin: 50% 100%; animation: leg-march-r 1.5s ease-in-out infinite; }
  .pixel-glow { animation: glow-pulse 2.2s ease-in-out infinite; }
  .pixel-sparkle { animation: sparkle-twinkle 1.8s ease-in-out infinite; }
  .pixel-sparkle-2 { animation: sparkle-twinkle 1.8s ease-in-out infinite 0.6s; }
  .pixel-sparkle-3 { animation: sparkle-twinkle 1.8s ease-in-out infinite 1.2s; }
  .pixel-dust { animation: dust-drift 2.6s ease-in-out infinite; }
  .pixel-dust-2 { animation: dust-drift 2.6s ease-in-out infinite 0.9s; }
  .pixel-dust-3 { animation: dust-drift 2.6s ease-in-out infinite 1.8s; }
  .pixel-glint { animation: crown-glint 3s ease-in-out infinite; }
  .pixel-selected { animation: select-pulse 0.5s ease-in-out infinite; }
`;

/* Shared <defs> — soft glow filter + top-down light sheen gradient.
   Included per-svg since each piece is an independent document. */
const SharedDefs = ({ uid }) => (
  <defs>
    <filter id={`soft-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="0.6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
      <stop offset="35%" stopColor="#ffffff" stopOpacity="0.12" />
      <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
    </linearGradient>
    <radialGradient id={`ground-shadow-${uid}`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#000000" stopOpacity="0.35" />
      <stop offset="100%" stopColor="#000000" stopOpacity="0" />
    </radialGradient>
  </defs>
);

/* Reusable little arm/leg/particle kit so every piece gets
   hands, feet and ambient motion without hand-authoring 12x the paths. */
const Limbs = ({ uid, armColor, legColor, footColor }) => (
  <>
    {/* Ground contact shadow */}
    <ellipse cx="8" cy="15.3" rx="5.5" ry="1" fill={`url(#ground-shadow-${uid})`} />

    {/* Arms with tiny hands */}
    <g className="pixel-arm-l">
      <rect x="0.5" y="9" width="1.6" height="3.4" fill={armColor} />
      <rect x="0.3" y="12" width="1.9" height="1.1" fill="#fbd38d" />
    </g>
    <g className="pixel-arm-r">
      <rect x="13.9" y="9" width="1.6" height="3.4" fill={armColor} />
      <rect x="13.8" y="12" width="1.9" height="1.1" fill="#fbd38d" />
    </g>

    {/* Legs with feet, marching out of phase */}
    <g className="pixel-leg-l">
      <rect x="5" y="13.6" width="2.1" height="1.6" fill={legColor} />
      <rect x="4.7" y="15" width="2.6" height="1" fill={footColor} />
    </g>
    <g className="pixel-leg-r">
      <rect x="8.9" y="13.6" width="2.1" height="1.6" fill={legColor} />
      <rect x="8.7" y="15" width="2.6" height="1" fill={footColor} />
    </g>
  </>
);

const Sparkles = ({ color = '#fffbe0' }) => (
  <>
    <circle className="pixel-sparkle" cx="2" cy="4" r="0.5" fill={color} />
    <circle className="pixel-sparkle-2" cx="14" cy="3" r="0.4" fill={color} />
    <circle className="pixel-sparkle-3" cx="12.5" cy="9" r="0.4" fill={color} />
  </>
);

const SandDust = ({ color = '#e2c98f' }) => (
  <>
    <circle className="pixel-dust" cx="3" cy="14.5" r="0.5" fill={color} />
    <circle className="pixel-dust-2" cx="8" cy="15" r="0.45" fill={color} />
    <circle className="pixel-dust-3" cx="12.5" cy="14.6" r="0.5" fill={color} />
  </>
);

/* ============================================================
   PIECE DEFINITIONS
   ============================================================ */
export const pixelPieces = {
  // ── PAWN (white) — little foot-soldier, now with hands, feet, and a scuff of trail dust ──
  wP: ({ squareWidth, selected, onClick }) => {
    const uid = 'wP';
    return (
      <svg
        width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none"
        xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}
      >
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`}>
          <SandDust />
          <Limbs uid={uid} armColor="#ff3333" legColor="#ff3333" footColor="#4a5568" />
          <path d="M5 1h6v2H5V1zm-2 2h10v1H3V3z" fill="#718096" />
          <path d="M3 4h10v4H3V4z" fill="#fbd38d" />
          <path className="pixel-eye" d="M5 5h1v2H5V5zm5 0h1v2h-1V5z" fill="#000000" />
          <path d="M3 6h1v1H3V6zm9 0h1v1h-1V6z" fill="#f56565" />
          <path d="M7 7h2v1H7V7z" fill="#742a2a" />
          <path d="M3 8h10v5H3V8zm1 5h8v1H4v-1z" fill="#ff3333" />
          <path d="M3 8h10v5H3V8z" fill={`url(#sheen-${uid})`} />
          <path d="M3 10h10v1H3v-1z" fill="#2d3748" />
        </g>
      </svg>
    );
  },

  // ── KNIGHT (white) — armored rider, glowing cyan visor, marching hooves-turned-feet ──
  wN: ({ squareWidth, selected, onClick }) => {
    const uid = 'wN';
    return (
      <svg
        width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none"
        xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}
      >
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.2s' }}>
          <SandDust />
          <Limbs uid={uid} armColor="#a0aec0" legColor="#4a5568" footColor="#1a202c" />
          <path d="M2 1h5v2H2V1zm5 1h3v1H7V2z" fill="#ff3333" />
          <path d="M3 3h10v5H3V3z" fill="#a0aec0" />
          <path d="M4 4h8v3H4V4z" fill="#4a5568" />
          <path className="pixel-glow" d="M5 5h2v1H5V5zm4 0h2v1H9V5z" fill="#00ffff" style={{ color: '#00ffff' }} />
          <path d="M3 8h10v5H3V8zm2 5h6v1H5v-1z" fill="#ff3333" />
          <path d="M3 8h10v5H3V8z" fill={`url(#sheen-${uid})`} />
          <path d="M1 8h2v3H1V8zm12 0h2v3h-2V8z" fill="#e2e8f0" />
        </g>
      </svg>
    );
  },

  // ── BISHOP (white) — spellcaster with glowing eyes and drifting magic sparkles ──
  wB: ({ squareWidth, selected, onClick }) => {
    const uid = 'wB';
    return (
      <svg
        width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none"
        xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}
      >
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.4s' }}>
          <Sparkles />
          <Limbs uid={uid} armColor="#ff3333" legColor="#990000" footColor="#e2e8f0" />
          <path d="M7 0h2v2H7V0zm-1 2h4v1H6V2zm-1 3h6v1H5V3zm-1 1h8v1H4V4z" fill="#ff3333" />
          <path d="M4 5h8v4H4V5z" fill="#fbd38d" />
          <path className="pixel-eye pixel-glow" d="M5 6h1v1H5V6zm5 0h1v1h-1V6z" fill="#00ffff" style={{ color: '#00ffff' }} />
          <path d="M5 9h6v3H5V9zm1 3h4v1H6v-1z" fill="#e2e8f0" />
          <path d="M3 10h10v4H3v-4z" fill="#ff3333" />
          <path d="M3 10h10v4H3v-4z" fill={`url(#sheen-${uid})`} />
        </g>
      </svg>
    );
  },

  // ── ROOK (white) — hulking golem, heavy stomping feet and drifting sand at its base ──
  wR: ({ squareWidth, selected, onClick }) => {
    const uid = 'wR';
    return (
      <svg
        width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none"
        xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}
      >
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.1s' }}>
          <SandDust color="#c9a35f" />
          <Limbs uid={uid} armColor="#718096" legColor="#1a202c" footColor="#000000" />
          <path d="M2 1h3v2H2V1zm4 0h4v2H6V1zm5 0h3v2h-3V1z" fill="#4a5568" />
          <path d="M2 3h12v5H2V3z" fill="#fbd38d" />
          <path d="M4 4h2v1H4V4zm6 0h2v1h-2V4z" fill="#000000" />
          <path d="M3 6h10v1H3V6z" fill="#4a1505" />
          <path d="M1 8h14v5H1V8z" fill="#ff3333" />
          <path d="M1 8h14v5H1V8z" fill={`url(#sheen-${uid})`} />
          <path d="M4 9h8v2H4V9z" fill="#718096" />
        </g>
      </svg>
    );
  },

  // ── QUEEN (white) — regal, harp-glissando sparkle trail ──
  wQ: ({ squareWidth, selected, onClick }) => {
    const uid = 'wQ';
    return (
      <svg
        width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none"
        xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}
      >
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.3s' }}>
          <Sparkles color="#ffe9a8" />
          <Limbs uid={uid} armColor="#ecc94b" legColor="#990000" footColor="#fff5f5" />
          <path className="pixel-glint" d="M3 1h2v2H3V1zm4-1h2v3H7V0zm4 1h2v2h-2V1z" fill="#fffbe0" />
          <path d="M3 1h2v2H3V1zm4-1h2v3H7V0zm4 1h2v2h-2V1z" fill="#d69e2e" />
          <path d="M4 2h8v1H4V2z" fill="#ecc94b" />
          <path d="M3 3h10v6H3V3z" fill="#ecc94b" />
          <path d="M5 4h6v4H5V4z" fill="#fbd38d" />
          <path className="pixel-eye" d="M5 5h1v1H5V5zm5 0h1v1h-1V5z" fill="#000000" />
          <path d="M7 7h2v1H7V7z" fill="#f56565" />
          <path d="M2 9h12v5H2V9z" fill="#ff3333" />
          <path d="M2 9h12v5H2V9z" fill={`url(#sheen-${uid})`} />
          <path d="M5 9h6v2H5V9z" fill="#fff5f5" />
        </g>
      </svg>
    );
  },

  // ── KING (white) — crown glints, brass-horn presence ──
  wK: ({ squareWidth, selected, onClick }) => {
    const uid = 'wK';
    return (
      <svg
        width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none"
        xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}
      >
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.5s' }}>
          <Sparkles color="#ffe9a8" />
          <Limbs uid={uid} armColor="#ecc94b" legColor="#990000" footColor="#fff5f5" />
          <path className="pixel-glint" d="M4 0h2v2H4V0zm6 0h2v2h-2V0z" fill="#fffbe0" />
          <path d="M3 2h10v2H3V2z" fill="#ecc94b" />
          <path d="M4 4h8v4H4V4z" fill="#fbd38d" />
          <path className="pixel-eye" d="M5 5h1v1H5V5zm5 0h1v1h-1V5z" fill="#000000" />
          <path d="M4 6h8v1H4V6z" fill="#744210" />
          <path d="M2 10h12v4H2v-4z" fill="#ff3333" />
          <path d="M2 10h12v4H2v-4z" fill={`url(#sheen-${uid})`} />
          <path d="M4 10h8v1H4v-1z" fill="#ecc94b" />
        </g>
      </svg>
    );
  },

  // ── BLACK PIECES ──
  bP: ({ squareWidth, selected, onClick }) => {
    const uid = 'bP';
    return (
      <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}>
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.6s' }}>
          <SandDust />
          <Limbs uid={uid} armColor="#00b3ff" legColor="#00b3ff" footColor="#1a202c" />
          <path d="M5 1h6v2H5V1zm-1 2h8v1H4V3z" fill="#4a5568" />
          <path d="M4 4h8v4H4V4z" fill="#cbd5e0" />
          <path className="pixel-eye" d="M5 5h1v2H5V5zm5 0h1v2h-1V5z" fill="#ff3333" />
          <path d="M3 8h10v5H3V8zm1 5h8v1H4v-1z" fill="#00b3ff" />
          <path d="M3 8h10v5H3V8z" fill={`url(#sheen-${uid})`} />
          <path d="M3 10h10v1H3v-1z" fill="#004499" />
        </g>
      </svg>
    );
  },
  bN: ({ squareWidth, selected, onClick }) => {
    const uid = 'bN';
    return (
      <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}>
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.7s' }}>
          <SandDust />
          <Limbs uid={uid} armColor="#718096" legColor="#1a202c" footColor="#000000" />
          <path d="M2 1h5v2H2V1zm5 1h3v1H7V2z" fill="#00b3ff" />
          <path d="M3 3h10v5H3V3z" fill="#4a5568" />
          <path d="M4 4h8v3H4V4z" fill="#2d3748" />
          <path className="pixel-glow" d="M5 5h2v1H5V5zm4 0h2v1H9V5z" fill="#00b3ff" style={{ color: '#00b3ff' }} />
          <path d="M3 8h10v5H3V8zm2 5h6v1H5v-1z" fill="#00b3ff" />
          <path d="M3 8h10v5H3V8z" fill={`url(#sheen-${uid})`} />
        </g>
      </svg>
    );
  },
  bB: ({ squareWidth, selected, onClick }) => {
    const uid = 'bB';
    return (
      <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}>
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.8s' }}>
          <Sparkles color="#bfe8ff" />
          <Limbs uid={uid} armColor="#00b3ff" legColor="#004499" footColor="#718096" />
          <path d="M7 0h2v2H7V0zm-1 2h4v1H6V2zm-1 3h6v1H5V3zm-1 1h8v1H4V4z" fill="#00b3ff" />
          <path d="M4 5h8v4H4V5z" fill="#cbd5e0" />
          <path className="pixel-eye pixel-glow" d="M5 6h1v1H5V6zm5 0h1v1h-1V6z" fill="#ff3333" style={{ color: '#ff3333' }} />
          <path d="M5 9h6v3H5V9zm1 3h4v1H6v-1z" fill="#718096" />
          <path d="M3 10h10v4H3v-4z" fill="#00b3ff" />
          <path d="M3 10h10v4H3v-4z" fill={`url(#sheen-${uid})`} />
        </g>
      </svg>
    );
  },
  bR: ({ squareWidth, selected, onClick }) => {
    const uid = 'bR';
    return (
      <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}>
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '0.9s' }}>
          <SandDust color="#8fa9c9" />
          <Limbs uid={uid} armColor="#2d3748" legColor="#1a202c" footColor="#000000" />
          <path d="M2 1h3v2H2V1zm4 0h4v2H6V1zm5 0h3v2h-3V1z" fill="#1a202c" />
          <path d="M2 3h12v5H2V3z" fill="#cbd5e0" />
          <path d="M4 4h2v1H4V4zm6 0h2v1h-2V4z" fill="#ff3333" />
          <path d="M3 6h10v1H3V6z" fill="#2d3748" />
          <path d="M1 8h14v5H1V8z" fill="#00b3ff" />
          <path d="M1 8h14v5H1V8z" fill={`url(#sheen-${uid})`} />
          <path d="M4 9h8v2H4V9z" fill="#2d3748" />
        </g>
      </svg>
    );
  },
  bQ: ({ squareWidth, selected, onClick }) => {
    const uid = 'bQ';
    return (
      <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}>
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '1.0s' }}>
          <Sparkles color="#bfe8ff" />
          <Limbs uid={uid} armColor="#ecc94b" legColor="#004499" footColor="#fff5f5" />
          <path className="pixel-glint" d="M3 1h2v2H3V1zm4-1h2v3H7V0zm4 1h2v2h-2V1z" fill="#fffbe0" />
          <path d="M3 1h2v2H3V1zm4-1h2v3H7V0zm4 1h2v2h-2V1z" fill="#d69e2e" />
          <path d="M4 2h8v1H4V2z" fill="#ecc94b" />
          <path d="M3 3h10v6H3V3z" fill="#4a5568" />
          <path d="M5 4h6v4H5V4z" fill="#cbd5e0" />
          <path className="pixel-eye" d="M5 5h1v1H5V5zm5 0h1v1h-1V5z" fill="#ff3333" />
          <path d="M7 7h2v1H7V7z" fill="#e53e3e" />
          <path d="M2 9h12v5H2V9z" fill="#00b3ff" />
          <path d="M2 9h12v5H2V9z" fill={`url(#sheen-${uid})`} />
          <path d="M5 9h6v2H5V9z" fill="#fff5f5" />
        </g>
      </svg>
    );
  },
  bK: ({ squareWidth, selected, onClick }) => {
    const uid = 'bK';
    return (
      <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={onClick} style={{ cursor: 'pointer' }}>
        <style>{animationStyles}</style>
        <SharedDefs uid={uid} />
        <g className={`pixel-piece ${selected ? 'pixel-selected' : ''}`} style={{ animationDelay: '1.1s' }}>
          <Sparkles color="#bfe8ff" />
          <Limbs uid={uid} armColor="#ecc94b" legColor="#004499" footColor="#fff5f5" />
          <path className="pixel-glint" d="M4 0h2v2H4V0zm6 0h2v2h-2V0z" fill="#fffbe0" />
          <path d="M3 2h10v2H3V2z" fill="#ecc94b" />
          <path d="M4 4h8v4H4V4z" fill="#cbd5e0" />
          <path className="pixel-eye" d="M5 5h1v1H5V5zm5 0h1v1h-1V5z" fill="#ff3333" />
          <path d="M4 6h8v1H4V6z" fill="#2d3748" />
          <path d="M2 10h12v4H2v-4z" fill="#00b3ff" />
          <path d="M2 10h12v4H2v-4z" fill={`url(#sheen-${uid})`} />
          <path d="M4 10h8v1H4v-1z" fill="#ecc94b" />
        </g>
      </svg>
    );
  },
};

/* ============================================================
   DEMO BOARD — click any piece to hear its sound + see the pulse
   ============================================================ */
const START_POSITION = [
  ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
  ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
  ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'],
];

export default function PixelPiecesFantasy() {
  const [selected, setSelected] = useState(null);
  const [audioPrimed, setAudioPrimed] = useState(false);
  const squareWidth = 52;

  const handlePieceClick = useCallback((code, r, c) => {
    setAudioPrimed(true);
    setSelected(`${r}-${c}`);
    playPieceSound(code[1]); // 'P','N','B','R','Q','K'
    setTimeout(() => setSelected(null), 500);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      padding: 24, background: 'radial-gradient(circle at 50% 0%, #2b2440 0%, #14101f 70%)',
      borderRadius: 16, fontFamily: 'system-ui, sans-serif',
    }}>
      <h2 style={{ color: '#f4e9c9', margin: 0, letterSpacing: 1, fontSize: 18 }}>
        ✨ Fantasy Pixel Chess Set
      </h2>
      <p style={{ color: '#a8a0c0', margin: 0, fontSize: 13, textAlign: 'center', maxWidth: 420 }}>
        {audioPrimed ? 'Click any piece — each has its own sound.' : 'Click a piece to enable sound, then tap others to hear them.'}
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(8, ${squareWidth}px)`,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)', borderRadius: 6, overflow: 'hidden',
        border: '3px solid #3a2f57',
      }}>
        {START_POSITION.map((row, r) =>
          row.map((code, c) => {
            const isLight = (r + c) % 2 === 0;
            const PieceComp = code ? pixelPieces[code] : null;
            const key = `${r}-${c}`;
            return (
              <div
                key={key}
                style={{
                  width: squareWidth, height: squareWidth,
                  background: isLight ? '#e8dcc0' : '#7a5c3e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {PieceComp && (
                  <PieceComp
                    squareWidth={squareWidth}
                    selected={selected === key}
                    onClick={() => handlePieceClick(code, r, c)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
      <p style={{ color: '#6f6690', margin: 0, fontSize: 11 }}>
        Hands, feet, marching legs, magic sparkles, drifting sand, and synthesized SFX — all in pure SVG + Web Audio.
      </p>
    </div>
  );
}