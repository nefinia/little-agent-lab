// Tiny synthesized sound effects — no audio files.
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('lal-muted') === '1'; } catch { /* storage unavailable */ }

export const isMuted = () => muted;
export function setMuted(v: boolean) { muted = v; try { localStorage.setItem('lal-muted', v ? '1' : '0'); } catch { /* ignore */ } }

function ac() {
  if (muted) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, when = 0, slideTo?: number) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0.06, 'triangle', 0.08),
  key: () => { tone(880, 0.05, 'square', 0.04); tone(1320, 0.07, 'triangle', 0.05, 0.04); },
  unkey: () => tone(440, 0.08, 'triangle', 0.06, 0, 300),
  step: () => tone(200 + Math.random() * 60, 0.04, 'triangle', 0.035),
  pick: () => tone(520, 0.1, 'sine', 0.08, 0, 780),
  say: () => tone(700 + Math.random() * 300, 0.05, 'sine', 0.04),
  bump: () => tone(140, 0.14, 'square', 0.06, 0, 90),
  block: () => { tone(220, 0.12, 'square', 0.08); tone(165, 0.18, 'square', 0.07, 0.1); },
  leak: () => { for (let i = 0; i < 4; i++) tone(880, 0.22, 'sawtooth', 0.06, i * 0.26, 440); },
  alarm: () => { tone(900, 0.15, 'square', 0.05); tone(700, 0.15, 'square', 0.05, 0.16); },
  whoosh: () => tone(300, 0.35, 'sawtooth', 0.03, 0, 1400),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, i * 0.1)),
  star: (i: number) => { tone(988 + i * 200, 0.25, 'sine', 0.1); tone(1480 + i * 250, 0.3, 'sine', 0.05, 0.05); },
  fail: () => { tone(392, 0.25, 'triangle', 0.08); tone(330, 0.35, 'triangle', 0.08, 0.2); },
  reveal: () => { tone(600, 0.08, 'sine', 0.06); tone(900, 0.12, 'sine', 0.06, 0.08); },
};
