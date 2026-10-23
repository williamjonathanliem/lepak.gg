// Word mode: words ride meteors and enemy ships toward your ship. Type a word to zap it;
// let one reach you and you lose a life.
//
// Two ways to win (the host picks):
//   time    play until the clock runs out; best score wins
//   points  first to the target score wins
// It always gets harder: the closer you are to the target (the end of the clock, or the
// target score), the faster words fly, the more often they come, and the longer they get.
//
// Pure: data in, data out. Words come from the seed and the order they spawn, so in a
// time game everyone gets the same words at the same moments.

import { seededRng } from '../../../lib/puzzle';
import { WORDS } from './text';

export const LIVES = 3;
/** How many space sprites there are to ride on (enemy ships and meteors). */
export const SPRITES = 8;
export type Goal = 'time' | 'points';
export const TARGET_CHOICES = [500, 1000, 2000] as const;
export const DEFAULT_TARGET = 1000;

export interface Incoming {
  id: number;
  word: string;
  /** When it appeared (ms after the start). */
  spawnAt: number;
  /** How long it takes to reach your ship. */
  fallMs: number;
  /** Across the screen, 0..1. */
  x: number;
  sprite: number;
}

export interface WaveState {
  /** Every word so far, in the order it appeared. */
  words: Incoming[];
  /** When the next word appears (ms after the start). */
  nextAt: number;
  zapped: number[];
  missed: number[];
  lives: number;
  score: number;
  /** Words zapped in a row without a mistake. */
  combo: number;
  /** The word being typed, and how much of it. */
  target: number | null;
  typed: number;
  errors: number;
  /** When the last life went (ms after the start). */
  outAt: number | null;
  /** Points game: when the target score was reached (ms after the start). */
  wonAt: number | null;
}

export const newWaveState = (): WaveState => ({
  words: [],
  nextAt: 600,
  zapped: [],
  missed: [],
  lives: LIVES,
  score: 0,
  combo: 0,
  target: null,
  typed: 0,
  errors: 0,
  outAt: null,
  wonAt: null,
});

export interface Rules {
  seed: string;
  goal: Goal;
  /** The clock (both games end at the time limit). */
  limitMs: number;
  /** Points game: the score to reach. */
  targetScore: number;
}

/** How close you are to the target, 0 (start) to 1 (there). Drives how hard it is. */
export function difficulty(rules: Rules, s: WaveState, t: number): number {
  const d = rules.goal === 'time' ? t / rules.limitMs : s.score / rules.targetScore;
  return Math.min(1, Math.max(0, d));
}

const lerp = (a: number, b: number, d: number) => a + (b - a) * d;
export const fallMsAt = (d: number) => Math.round(lerp(10_500, 2800, d));
export const gapMsAt = (d: number) => Math.round(lerp(2300, 600, d));
/** Word lengths allowed at a difficulty: short words early, long ones near the end. */
export function lengthsAt(d: number): [number, number] {
  return [Math.min(3 + Math.floor(d * 4.5), 7), Math.min(4 + Math.floor(d * 5.5), 9)];
}

export const progress = (w: Incoming, t: number) => (t - w.spawnAt) / w.fallMs;

const gone = (s: WaveState) => new Set([...s.zapped, ...s.missed]);

/** Words on screen right now. */
export function onScreen(s: WaveState, t: number): Incoming[] {
  const done = gone(s);
  return s.words.filter((w) => !done.has(w.id) && w.spawnAt <= t && progress(w, t) < 1);
}

/** The next word: right length for the difficulty, and (if it can) a first letter that
 * isn't already on screen, so one keystroke always picks a clear target. */
function spawn(rules: Rules, s: WaveState, at: number, d: number): Incoming {
  const id = s.words.length;
  const rng = seededRng(`waves:${rules.seed}:${id}`);
  const [min, max] = lengthsAt(d);
  const taken = new Set(onScreen(s, at).map((w) => w.word[0]));
  let word = '';
  for (let tries = 0; tries < 12; tries++) {
    const pool = WORDS[min + Math.floor(rng() * (max - min + 1))]!;
    word = pool[Math.floor(rng() * pool.length)]!;
    if (!taken.has(word[0])) break;
  }
  return {
    id,
    word,
    spawnAt: Math.round(at),
    fallMs: Math.round(fallMsAt(d) * (0.9 + rng() * 0.2)),
    x: 0.1 + rng() * 0.8,
    sprite: Math.floor(rng() * SPRITES),
  };
}

/** Points for a word: longer words and longer combos are worth more. */
export const pointsFor = (word: string, combo: number) =>
  word.length * 10 + Math.min(combo, 20) * 5;

const playing = (s: WaveState) => s.outAt === null && s.wonAt === null;

/** Moves time on: new words appear, and any that reached your ship cost a life. */
export function tick(rules: Rules, s: WaveState, t: number): WaveState {
  if (!playing(s) || t < 0) return s;
  let next = s;
  while (next.nextAt <= t) {
    const d = difficulty(rules, next, next.nextAt);
    const w = spawn(rules, next, next.nextAt, d);
    next = {
      ...next,
      words: [...next.words, w],
      nextAt: next.nextAt + gapMsAt(d) * (0.8 + seededRng(`gap:${rules.seed}:${w.id}`)() * 0.4),
    };
  }
  const done = gone(next);
  const reached = next.words.filter((w) => !done.has(w.id) && progress(w, t) >= 1).map((w) => w.id);
  if (!reached.length) return next;
  const lives = Math.max(0, next.lives - reached.length);
  const lostTarget = next.target !== null && reached.includes(next.target);
  return {
    ...next,
    missed: [...next.missed, ...reached],
    lives,
    combo: 0,
    target: lostTarget ? null : next.target,
    typed: lostTarget ? 0 : next.typed,
    outAt: lives === 0 ? t : null,
  };
}

/**
 * One key. The first letter locks onto the closest word starting with it; the rest must
 * follow that word. Finish it and it's zapped. A wrong key breaks your combo.
 */
export function press(rules: Rules, s: WaveState, t: number, key: string): WaveState {
  if (!playing(s)) return s;
  const ch = key.toLowerCase();
  const visible = onScreen(s, t);
  let target = s.target !== null ? visible.find((w) => w.id === s.target) : undefined;
  let typed = target ? s.typed : 0;

  if (!target) {
    target = visible
      .filter((w) => w.word[0] === ch)
      .sort((a, b) => progress(b, t) - progress(a, t))[0];
    if (!target) return { ...s, target: null, typed: 0, errors: s.errors + 1, combo: 0 };
  } else if (target.word[typed] !== ch) {
    return { ...s, errors: s.errors + 1, combo: 0 };
  }

  typed += 1;
  if (typed < target.word.length) return { ...s, target: target.id, typed };
  const score = s.score + pointsFor(target.word, s.combo);
  return {
    ...s,
    zapped: [...s.zapped, target.id],
    score,
    combo: s.combo + 1,
    target: null,
    typed: 0,
    wonAt: rules.goal === 'points' && score >= rules.targetScore ? t : null,
  };
}

/** Backspace lets go of the word you locked onto, so you can pick another. */
export const release = (s: WaveState): WaveState => ({ ...s, target: null, typed: 0 });
