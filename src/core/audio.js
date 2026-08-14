/**
 * Tiny WebAudio synth — no asset downloads, everything is generated.
 * A master gain + compressor keeps the chiptune stack from clipping.
 */

import { settings, save } from './storage.js';

let ctx = null;
let master = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let noiseBuffer = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 12;
    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : settings.volume;
    master.connect(comp);
    comp.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (c && c.state === 'suspended') c.resume();
  return c;
}

export function setVolume(v) {
  settings.volume = Math.max(0, Math.min(1, v));
  save();
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
}

export function setMuted(m) {
  settings.muted = !!m;
  save();
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
}

export function toggleMuted() {
  setMuted(!settings.muted);
  return settings.muted;
}

function noise() {
  const c = ac();
  if (!c) return null;
  if (!noiseBuffer) {
    const len = c.sampleRate * 0.5;
    noiseBuffer = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Single oscillator blip with optional pitch slide. */
export function blip(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t0 + dur);
    g.gain.setValueAtTime(Math.max(0.0001, vol), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {
    /* audio is a nicety, never a crash */
  }
}

/** Filtered white-noise hit — punchier than an oscillator for impacts. */
export function noiseHit(dur = 0.12, vol = 0.08, freq = 1200, q = 1, delay = 0) {
  const c = ac();
  const buf = noise();
  if (!c || !buf) return;
  try {
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.25), t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  shoot: () => {
    blip(180, 0.09, 'square', 0.055, 60);
    blip(1200, 0.05, 'sawtooth', 0.02, 300);
    noiseHit(0.07, 0.05, 2600, 0.8);
  },
  shotgun: () => {
    blip(90, 0.22, 'sawtooth', 0.07, 40);
    noiseHit(0.25, 0.1, 1400, 0.5);
  },
  rail: () => {
    blip(1600, 0.28, 'sawtooth', 0.05, 180);
    noiseHit(0.3, 0.06, 3200, 2);
  },
  charge: () => blip(220, 0.55, 'triangle', 0.03, 1400),
  hit: () => blip(800, 0.06, 'square', 0.05, 500),
  head: () => blip(1400, 0.09, 'square', 0.06, 800),
  kill: () => blip(320, 0.14, 'square', 0.05, 700),
  hurt: () => {
    blip(110, 0.25, 'sawtooth', 0.07, 45);
    noiseHit(0.18, 0.06, 500, 0.6);
  },
  jump: () => blip(300, 0.1, 'triangle', 0.04, 480),
  dash: () => {
    blip(520, 0.18, 'sawtooth', 0.04, 90);
    noiseHit(0.2, 0.05, 1800, 0.7);
  },
  land: () => blip(90, 0.08, 'triangle', 0.05, 60),
  reload: () => blip(520, 0.07, 'square', 0.04, 260),
  empty: () => blip(200, 0.05, 'square', 0.03, 150),
  swap: () => {
    blip(420, 0.06, 'square', 0.035, 700);
    blip(880, 0.07, 'square', 0.025, 1200, 0.05);
  },
  wave: () => {
    blip(440, 0.15, 'square', 0.05);
    blip(660, 0.2, 'square', 0.05, 0, 0.14);
    blip(880, 0.28, 'square', 0.05, 0, 0.28);
  },
  boss: () => {
    blip(70, 0.9, 'sawtooth', 0.09, 45);
    blip(140, 0.9, 'square', 0.05, 90, 0.05);
    noiseHit(1.1, 0.07, 260, 0.4);
  },
  spawn: () => blip(200, 0.25, 'triangle', 0.03, 500),
  ui: () => blip(600, 0.06, 'square', 0.035, 900),
  pickup: () => {
    blip(700, 0.08, 'square', 0.04, 1000);
    blip(1050, 0.12, 'square', 0.04, 1500, 0.07);
  },
  upgrade: () => {
    [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.18, 'square', 0.04, 0, i * 0.08));
  },
  levelup: () => {
    [392, 523, 659, 880].forEach((f, i) => blip(f, 0.22, 'triangle', 0.05, 0, i * 0.06));
  },
  death: () => {
    blip(320, 1.1, 'sawtooth', 0.08, 40);
    blip(160, 1.3, 'square', 0.05, 25, 0.08);
  },
  // --- intro stingers ---
  boot: () => {
    blip(60, 0.6, 'sine', 0.05, 120);
    noiseHit(0.8, 0.03, 400, 0.3);
  },
  type: () => blip(1400 + Math.random() * 600, 0.02, 'square', 0.012, 900),
  slam: (i = 0) => {
    blip(140 - i * 8, 0.34, 'sawtooth', 0.11, 45);
    noiseHit(0.3, 0.11, 900 + i * 260, 0.6);
  },
  riser: () => {
    blip(120, 1.5, 'sawtooth', 0.045, 900);
    noiseHit(1.6, 0.04, 600, 0.4);
  },
  logo: () => {
    [261, 329, 392, 523, 659].forEach((f, i) => blip(f, 0.5, 'square', 0.05, 0, i * 0.055));
    blip(65, 1.2, 'sine', 0.09, 40);
  },
};

/* ---------------- adaptive background music ---------------- */

const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic
const ROOT = 55; // A1

/** Intensity 0..1 raises tempo + adds layers. */
let musicIntensity = 0;
export function setMusicIntensity(v) {
  musicIntensity = Math.max(0, Math.min(1, v));
}

export function startMusic() {
  const c = ac();
  if (!c || musicTimer) return;
  musicGain.gain.setTargetAtTime(0.5, c.currentTime, 1.2);
  const tick = () => {
    const step = musicStep++;
    const beat = 60 / (92 + musicIntensity * 46) / 2;
    const deg = SCALE[(step * 3) % SCALE.length];
    const oct = step % 8 < 4 ? 1 : 2;
    const f = ROOT * Math.pow(2, deg / 12) * oct;
    // bass pulse
    tone(f, beat * 0.9, 'square', 0.035 + musicIntensity * 0.02);
    // hat
    if (step % 2 === 1) noiseHit(0.04, 0.012 + musicIntensity * 0.012, 7000, 1.2);
    // kick
    if (step % 4 === 0) tone(48, 0.14, 'sine', 0.07, 26);
    // lead arp appears as things heat up
    if (musicIntensity > 0.35 && step % 4 === 2) {
      tone(f * 4, beat * 0.5, 'triangle', 0.018 * musicIntensity);
    }
    musicTimer = setTimeout(tick, beat * 1000);
  };
  tick();
}

function tone(freq, dur, type, vol, slide) {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(musicGain);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch {
    /* ignore */
  }
}

export function stopMusic() {
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}
