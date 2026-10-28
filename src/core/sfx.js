// All sounds are synthesized with Web Audio, no audio assets.
import { state, on } from './store.js';

let ctx, master, noiseBuf;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35 * (state.settings.volume ?? 0.8);
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

on('volume', (v) => { if (master) master.gain.value = 0.35 * v; });

const enabled = () => state.settings.sound && ac();

function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(freq, dur, { type = 'square', vol = 0.15, when = 0, slide = null } = {}) {
  const c = enabled();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function burst(dur, { vol = 0.25, freq = 3000, q = 0.8, when = 0 } = {}) {
  const c = enabled();
  if (!c) return;
  const t = c.currentTime + when;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  unlock: () => ac(),
  get context() { return ac(); },
  get output() { ac(); return master; },
  tick: () => burst(0.018, { vol: 0.35, freq: 4200, q: 2 }),
  select: () => { tone(1250, 0.05, { vol: 0.1 }); tone(1850, 0.07, { vol: 0.1, when: 0.05 }); },
  tab: () => { burst(0.05, { vol: 0.3, freq: 1800 }); tone(520, 0.05, { type: 'sine', vol: 0.15 }); },
  back: () => tone(900, 0.08, { slide: 420, vol: 0.1 }),
  error: () => tone(150, 0.25, { type: 'sawtooth', vol: 0.12 }),
  beep: (f = 880, d = 0.12) => tone(f, d, { vol: 0.12 }),
  geiger: () => burst(0.006, { vol: 0.9, freq: 2500, q: 0.4 }),
  quest: () => [660, 880, 990].forEach((f, i) => tone(f, 0.14, { when: i * 0.09, vol: 0.1 })),
  levelUp: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
    tone(f, 0.16, { when: i * 0.09, vol: 0.1 })),
  boot: () => {
    tone(55, 1.4, { type: 'sawtooth', slide: 240, vol: 0.06 });
    burst(0.6, { vol: 0.15, freq: 800, when: 0.1 });
    tone(1400, 0.08, { when: 1.3, vol: 0.08 });
  },
  // Looping radio static; returns a handle with stop().
  static(vol = 0.12) {
    const c = enabled();
    if (!c) return { stop() {} };
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 0.5;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start();
    return {
      stop() {
        g.gain.setTargetAtTime(0, c.currentTime, 0.08);
        src.stop(c.currentTime + 0.4);
      },
    };
  },
};
