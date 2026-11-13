export let bgmInterval = null;

// Master volumes, 0..1 (set from the settings screen).
const volume = { sfx: 1, music: 1 };
const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1));

export function setAudioVolumes({ sfx, music } = {}) {
  if (sfx !== undefined) volume.sfx = clamp01(sfx);
  if (music !== undefined) volume.music = clamp01(music);
}

export const getAudioVolumes = () => ({ ...volume });

// Every sound is routed through one gain node so its level can be scaled.
function outputAt(ctx, level) {
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(ctx.destination);
  return out;
}

// A burst of filtered white noise (cracks, hisses, thumps).
function playNoise(ctx, out, { duration, type = 'lowpass', from = 800, to = from, level = 0.2, delay = 0 }) {
  const start = ctx.currentTime + delay;
  const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  noise.start(start);
  noise.stop(start + duration);
}

export const playRetroSound = (type, audioCtxRef) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = audioCtxRef?.current ? audioCtxRef.current : new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    if (volume.sfx <= 0) return; // SFX volume at 0: nothing to play
    const out = outputAt(ctx, volume.sfx);
    
    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } 
    else if (type === 'save' || type === 'success') {
      [0, 0.06, 0.12].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const freqs = [523.25, 659.25, 783.99]; 
        osc.frequency.setValueAtTime(freqs[idx], ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.15);
        osc.connect(gain);
        gain.connect(out);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.15);
      });
    }
    else if (type === 'fire') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
    else if (type === 'thunder') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
    else if (type === 'sandworm') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.25);
      osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
    else if (type === 'frozen_eyes') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
    else if (type === 'missile') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
    else if (type === 'blackhole') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
    else if (type === 'bubble') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
    else if (type === 'ufo') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(550, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.2);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
    else if (type === 'sniper') {
      const bufferSize = ctx.sampleRate * 0.35; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.32);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime); 
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      const subThump = ctx.createOscillator();
      const subGain = ctx.createGain();
      subThump.type = 'triangle';
      subThump.frequency.setValueAtTime(180, ctx.currentTime);
      subThump.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.15);
      subGain.gain.setValueAtTime(0.3, ctx.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      subThump.connect(subGain);
      subGain.connect(out);

      noiseNode.start();
      subThump.start();
      noiseNode.stop(ctx.currentTime + 0.35);
      subThump.stop(ctx.currentTime + 0.15);
    }
    else if (type === 'cage' || type === 'checkmate') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
    else if (type === 'swordslash') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
    else if (type === 'hand_grab') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
    else if (type === 'arrow_rain') {
      [0, 0.05, 0.1, 0.15, 0.2].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + delay + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);
        osc.connect(gain);
        gain.connect(out);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.1);
      });
    }
    else if (type === 'anvil') {
      const whistleOsc = ctx.createOscillator();
      const whistleGain = ctx.createGain();
      whistleOsc.type = 'sine';
      whistleOsc.frequency.setValueAtTime(120, ctx.currentTime);
      whistleOsc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.18);
      whistleGain.gain.setValueAtTime(0.1, ctx.currentTime);
      whistleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      whistleOsc.connect(whistleGain);
      whistleGain.connect(out);
      whistleOsc.start();
      whistleOsc.stop(ctx.currentTime + 0.18);

      const impactOsc = ctx.createOscillator();
      const impactGain = ctx.createGain();
      impactOsc.type = 'triangle';
      impactOsc.frequency.setValueAtTime(880, ctx.currentTime + 0.18);
      impactOsc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.45);
      impactGain.gain.setValueAtTime(0.4, ctx.currentTime + 0.18);
      impactGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      impactOsc.connect(impactGain);
      impactGain.connect(out);
      impactOsc.start(ctx.currentTime + 0.18);
      impactOsc.stop(ctx.currentTime + 0.45);
    }
    else if (type === 'bat_swarm') {
      [0, 0.04, 0.09, 0.15, 0.22, 0.3].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1500 + (Math.random() * 400), ctx.currentTime + delay);
        osc.frequency.linearRampToValueAtTime(2500, ctx.currentTime + delay + 0.05);
        gain.gain.setValueAtTime(0.07, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.05);
        osc.connect(gain);
        gain.connect(out);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.05);
      });
    }
    else if (type === 'nuclear_bomb') {
      const duration = 0.8;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const lpFilter = ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.setValueAtTime(300, ctx.currentTime);
      lpFilter.frequency.linearRampToValueAtTime(40, ctx.currentTime + duration);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      const boomOsc = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boomOsc.type = 'sawtooth';
      boomOsc.frequency.setValueAtTime(110, ctx.currentTime);
      boomOsc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
      boomGain.gain.setValueAtTime(0.6, ctx.currentTime);
      boomGain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      noise.connect(lpFilter);
      lpFilter.connect(noiseGain);
      noiseGain.connect(out);

      boomOsc.connect(boomGain);
      boomGain.connect(out);

      noise.start();
      boomOsc.start();
      noise.stop(ctx.currentTime + duration);
      boomOsc.stop(ctx.currentTime + duration);
    }
    else if (type === 'plasma_surge') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.45);
      
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.45);
      
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
    else if (type === 'chainsaw') {
      // engine: a low sawtooth whose pitch revs up and wobbles, plus grit
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.linearRampToValueAtTime(190, t + 0.18);
      for (let i = 0; i < 6; i++) osc.frequency.setValueAtTime(i % 2 ? 150 : 210, t + 0.2 + i * 0.07);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.8);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.setValueAtTime(0.2, t + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.8);
      playNoise(ctx, out, { duration: 0.6, type: 'bandpass', from: 1800, to: 900, level: 0.12, delay: 0.15 });
    }
    else if (type === 'stone_crack') {
      // three dry cracks, then a low crumble
      [0, 0.09, 0.2].forEach((delay, i) => playNoise(ctx, out, { duration: 0.06, type: 'highpass', from: 2400 - i * 500, to: 1200, level: 0.3, delay }));
      playNoise(ctx, out, { duration: 0.32, type: 'lowpass', from: 500, to: 90, level: 0.35, delay: 0.3 });
    }
    else if (type === 'soul') {
      // airy rising tone with a slow shimmer
      const t = ctx.currentTime;
      [1, 1.5].forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260 * ratio, t);
        osc.frequency.exponentialRampToValueAtTime(1040 * ratio, t + 0.95);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(i ? 0.05 : 0.12, t + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.95);
      });
      playNoise(ctx, out, { duration: 0.9, type: 'bandpass', from: 600, to: 3200, level: 0.05 });
    }
    else if (type === 'drain') {
      // gurgling notes stepping downwards
      const t = ctx.currentTime;
      for (let i = 0; i < 9; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = t + i * 0.07;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520 - i * 42, at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(60, 300 - i * 30), at + 0.06);
        gain.gain.setValueAtTime(0.16, at);
        gain.gain.exponentialRampToValueAtTime(0.01, at + 0.07);
        osc.connect(gain);
        gain.connect(out);
        osc.start(at);
        osc.stop(at + 0.07);
      }
    }
    else if (type === 'thud') {
      // heavy body hitting the floor (lands with the squash, ~150 ms in)
      const t = ctx.currentTime + 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.28);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.32);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.32);
      playNoise(ctx, out, { duration: 0.14, type: 'lowpass', from: 900, to: 150, level: 0.35, delay: 0.14 });
    }
    else if (type === 'sizzle') {
      // three drips, then hissing that dies away
      const t = ctx.currentTime;
      [0.16, 0.23, 0.3].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, t + delay);
        osc.frequency.exponentialRampToValueAtTime(300, t + delay + 0.05);
        gain.gain.setValueAtTime(0.12, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.05);
        osc.connect(gain);
        gain.connect(out);
        osc.start(t + delay);
        osc.stop(t + delay + 0.05);
      });
      playNoise(ctx, out, { duration: 0.7, type: 'highpass', from: 3500, to: 6000, level: 0.14, delay: 0.18 });
    }
    else if (type === 'check_alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(out);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.log("Audio node exception:", e);
  }
};

export function startRetroBGM(audioCtxRef) {
  if (bgmInterval) return bgmInterval;
  
  const runSequence = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      
      if (ctx.state === 'suspended') return;
      if (volume.music <= 0) return; // music volume at 0: skip this bar
      const out = outputAt(ctx, volume.music);

      const notes = [261.63, 329.63, 392.00, 523.25, 349.23, 440.00, 523.25, 659.25];
      notes.forEach((freq, index) => {
        const startTime = ctx.currentTime + index * 0.25;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = index % 2 === 0 ? 'triangle' : 'square';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.015, startTime); 
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);
        
        osc.connect(gain);
        gain.connect(out);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch (err) {
      console.log("BGM Init handling:", err);
    }
  };

  runSequence();
  bgmInterval = setInterval(runSequence, 2000);

  window.clearRetroBGM = () => {
    bgmInterval = null;
  };

  return bgmInterval;
}