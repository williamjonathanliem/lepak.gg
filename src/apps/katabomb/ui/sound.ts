// Tiny synth sound effects. No audio files: everything is generated with Web Audio,
// so there is nothing to download or license.

const MUTE_KEY = 'lepak.katabomb.muted';
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
}

function audio(): AudioContext | null {
  if (isMuted()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  at?: number; // seconds from now
  slideTo?: number; // end frequency
}

function tone(
  freq: number,
  dur: number,
  { type = 'square', gain = 0.06, at = 0, slideTo }: ToneOpts = {},
) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const amp = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.25) {
  const a = audio();
  if (!a) return;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const amp = a.createGain();
  src.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, a.currentTime);
  filter.frequency.exponentialRampToValueAtTime(120, a.currentTime + dur);
  amp.gain.setValueAtTime(gain, a.currentTime);
  src.connect(filter).connect(amp).connect(a.destination);
  src.start();
}

export const sfx = {
  /** Fuse is nearly out. */
  tick: () => tone(1400, 0.04, { type: 'square', gain: 0.035 }),
  /** Good word, bomb passes on. */
  word: () => {
    tone(660, 0.08, { type: 'triangle', gain: 0.09 });
    tone(990, 0.12, { type: 'triangle', gain: 0.09, at: 0.07 });
  },
  /** Word bounced. */
  reject: () => tone(180, 0.18, { type: 'sawtooth', gain: 0.05, slideTo: 110 }),
  /** Bomb went off. */
  boom: () => {
    noise(0.7, 0.35);
    tone(120, 0.5, { type: 'sine', gain: 0.25, slideTo: 40 });
  },
  /** It's your turn. */
  yourTurn: () => {
    tone(880, 0.07, { type: 'square', gain: 0.04 });
    tone(880, 0.07, { type: 'square', gain: 0.04, at: 0.1 });
  },
  /** Someone won. */
  win: () =>
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.18, { type: 'triangle', gain: 0.08, at: i * 0.11 }),
    ),
  /** Match starting. */
  start: () => tone(300, 0.3, { type: 'square', gain: 0.05, slideTo: 900 }),
};
