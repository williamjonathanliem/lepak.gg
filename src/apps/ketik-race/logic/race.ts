// Ketik Race rooms: settings, and who's winning. Pure: data in, data out.
//
// Two modes on the same room:
//   sentence  everyone types the same text; first to finish wins (WPM and accuracy shown)
//   words     space mode: zap words before they reach your ship. Win by time (best score
//             when the clock runs out) or by points (first to the target score)

import type { TextLength, TextSource } from './text';
import { DEFAULT_TARGET, type Goal } from './waves';

export type Mode = 'sentence' | 'words';
export type Phase = 'lobby' | 'race';

export const COUNTDOWN_MS = 3500;
export const MAX_RACERS = 10;
/** Time limits: sentence races are short, word mode lasts until everyone's out or this. */
export const LIMIT_CHOICES: Record<Mode, readonly number[]> = {
  sentence: [60, 120, 180],
  words: [120, 180, 300],
};
export const DEFAULT_LIMIT: Record<Mode, number> = { sentence: 120, words: 180 };

export interface RaceMeta {
  host: string;
  mode: Mode;
  source: TextSource;
  length: TextLength;
  /** The host's own text (custom source), already cleaned. */
  custom: string;
  limitSec: number;
  /** Word mode: how you win. */
  goal: Goal;
  /** Word mode, points game: the score to reach. */
  targetScore: number;
  /** Class mode: the host only watches, e.g. on a projector. */
  hostPlays: boolean;
  phase: Phase;
  /** Server time the race starts (0 in the lobby). */
  startAt: number;
  /** Goes up by one each rematch: new text, fresh scores. */
  round: number;
}

/** One racer, written by that racer. */
export interface Racer {
  uid: string;
  nick: string;
  /** Avatar (index into the animal list). */
  av: number;
  round: number;
  // sentence mode
  pos: number;
  total: number;
  correct: number;
  errors: number;
  /** Server time they finished the text (0 = still typing). */
  finishedAt: number;
  // word mode (finishedAt is when a points game's target was reached)
  score: number;
  lives: number;
  /** When they ran out of lives (ms after the start, 0 = still alive). */
  outAt: number;
}

export const raceSeed = (code: string, round: number) => `ketik-${code}-${round}`;

export function newMeta(host: string, mode: Mode): RaceMeta {
  return {
    host,
    mode,
    source: 'sentences',
    length: 'short',
    custom: '',
    limitSec: DEFAULT_LIMIT[mode],
    goal: 'time',
    targetScore: DEFAULT_TARGET,
    hostPlays: true,
    phase: 'lobby',
    startAt: 0,
    round: 1,
  };
}

export const startRace = (meta: RaceMeta, now: number): RaceMeta => ({
  ...meta,
  phase: 'race',
  startAt: now + COUNTDOWN_MS,
});

export const rematch = (meta: RaceMeta): RaceMeta => ({
  ...meta,
  phase: 'lobby',
  startAt: 0,
  round: meta.round + 1,
});

/** Switching mode also resets the time limit to that mode's default. */
export const setMode = (meta: RaceMeta, mode: Mode): RaceMeta =>
  mode === meta.mode ? meta : { ...meta, mode, limitSec: DEFAULT_LIMIT[mode] };

export const endsAt = (meta: RaceMeta) => meta.startAt + meta.limitSec * 1000;

export const inRound = (meta: RaceMeta, racers: readonly Racer[]) =>
  racers.filter((r) => r.round === meta.round);

/** Done racing: finished the text (sentence), or out of lives or at the target (words). */
const isDone = (meta: RaceMeta, r: Racer) =>
  meta.mode === 'sentence' ? r.finishedAt > 0 : r.finishedAt > 0 || r.outAt > 0 || r.lives <= 0;

/**
 * Over at the time limit, or once every racer is done. A points game also ends as soon as
 * someone reaches the target: first there wins.
 */
export function isOver(meta: RaceMeta, racers: readonly Racer[], now: number): boolean {
  if (meta.phase !== 'race' || now < meta.startAt) return false;
  if (now >= endsAt(meta)) return true;
  const mine = inRound(meta, racers);
  if (meta.mode === 'words' && meta.goal === 'points' && mine.some((r) => r.finishedAt > 0)) {
    return true;
  }
  return mine.length > 0 && mine.every((r) => isDone(meta, r));
}

export type Standing = Racer & {
  place: number;
  /** 0..1 along the track (sentence) or of the time survived (words). */
  progress: number;
  /** Sentence mode: time to finish, for finishers. */
  timeMs: number | null;
  done: boolean;
};

/**
 * Sentence mode: finishers by time, then by how far everyone else got (fewer errors first).
 * Word mode: whoever reached the target first (points game), then by score, then whoever
 * survived longer, then fewer errors.
 */
export function standings(meta: RaceMeta, racers: readonly Racer[], now: number): Standing[] {
  const limitMs = meta.limitSec * 1000;
  const rows = inRound(meta, racers).map((r): Omit<Standing, 'place'> => {
    const done = isDone(meta, r);
    if (meta.mode === 'sentence') {
      const finished = r.finishedAt > 0;
      return {
        ...r,
        done,
        timeMs: finished ? Math.max(0, r.finishedAt - meta.startAt) : null,
        progress: r.total ? Math.min(1, r.pos / r.total) : 0,
      };
    }
    const survived = r.outAt > 0 ? r.outAt : Math.max(0, now - meta.startAt);
    const won = meta.goal === 'points' && r.finishedAt > 0;
    return {
      ...r,
      done,
      timeMs: won ? Math.max(0, r.finishedAt - meta.startAt) : null,
      progress:
        meta.goal === 'points'
          ? Math.min(1, r.score / meta.targetScore)
          : Math.min(1, survived / limitMs),
    };
  });
  rows.sort((a, b) => {
    if (meta.mode === 'sentence') {
      const fa = a.timeMs !== null;
      const fb = b.timeMs !== null;
      if (fa !== fb) return fa ? -1 : 1;
      if (fa && fb && a.timeMs !== b.timeMs) return a.timeMs! - b.timeMs!;
      return b.pos - a.pos || a.errors - b.errors || a.nick.localeCompare(b.nick);
    }
    const wa = a.timeMs !== null;
    const wb = b.timeMs !== null;
    if (wa !== wb) return wa ? -1 : 1;
    if (wa && wb && a.timeMs !== b.timeMs) return a.timeMs! - b.timeMs!;
    const sa = a.outAt > 0 ? a.outAt : Infinity;
    const sb = b.outAt > 0 ? b.outAt : Infinity;
    return b.score - a.score || sb - sa || a.errors - b.errors || a.nick.localeCompare(b.nick);
  });
  return rows.map((r, i) => ({ ...r, place: i + 1 }));
}
