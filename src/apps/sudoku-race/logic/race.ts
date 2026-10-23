// Sudoku Race rules. Pure: data in, data out. No React, no network.
//
// Everyone in a room gets the same puzzle (made from the room code and round), starts at the
// same moment, and races to finish. Each wrong number costs time, or in "3 strikes" mode
// three wrong numbers knock you out. Results rank finishers by time + penalties, then
// everyone else by how far they got.

import type { Difficulty, SudokuState } from '../../sudoku/logic/sudoku';

export type MistakeRule = 'penalty' | 'strikes';
export type Phase = 'lobby' | 'race';

/** What a wrong number costs in "penalty" mode. */
export const PENALTY_MS = 30_000;
/** Wrong numbers that knock you out in "strikes" mode. */
export const STRIKES = 3;
/** The countdown before a race starts, so everyone starts together. */
export const COUNTDOWN_MS = 3500;
export const LIMIT_CHOICES = [10, 15, 20, 30] as const;
export const DEFAULT_LIMIT_MIN = 20;
export const MAX_RACERS = 30;

/** The room's settings and state, written by the host. */
export interface RaceMeta {
  host: string;
  level: Difficulty;
  rule: MistakeRule;
  limitMin: number;
  /** Class mode: the host only watches (e.g. on a projector). */
  hostPlays: boolean;
  phase: Phase;
  /** Server time the race starts (0 in the lobby). */
  startAt: number;
  /** Goes up by one each rematch: new puzzle, fresh scores. */
  round: number;
}

/** One racer's progress, written by that racer. The board itself never leaves their device. */
export interface Racer {
  uid: string;
  nick: string;
  /** The round this progress is for (older rounds are ignored). */
  round: number;
  /** Correct numbers written so far (givens not counted). */
  filled: number;
  /** How many numbers the puzzle needs. */
  total: number;
  mistakes: number;
  /** Server time they finished (0 = still going). */
  finishedAt: number;
}

/** The puzzle for this room and round: same for everyone. */
export const raceSeed = (code: string, round: number) => `race-${code}-${round}`;

export function newMeta(host: string, level: Difficulty, rule: MistakeRule): RaceMeta {
  return {
    host,
    level,
    rule,
    limitMin: DEFAULT_LIMIT_MIN,
    hostPlays: true,
    phase: 'lobby',
    startAt: 0,
    round: 1,
  };
}

/** Start the race: a short countdown from now, then everyone goes. */
export function startRace(meta: RaceMeta, now: number): RaceMeta {
  return { ...meta, phase: 'race', startAt: now + COUNTDOWN_MS };
}

/** Back to the lobby with a new puzzle for a rematch. */
export function rematch(meta: RaceMeta): RaceMeta {
  return { ...meta, phase: 'lobby', startAt: 0, round: meta.round + 1 };
}

/** How many numbers the player still had to write when the puzzle started. */
export const blanks = (s: SudokuState) => s.puzzle.filter((n) => n === 0).length;

/** Correct numbers the player has written (givens not counted). */
export const correctFilled = (s: SudokuState) =>
  s.entries.filter((n, i) => s.puzzle[i] === 0 && n !== 0 && n === s.solution[i]).length;

/** Knocked out: only in "3 strikes" mode. */
export const isOut = (rule: MistakeRule, mistakes: number) =>
  rule === 'strikes' && mistakes >= STRIKES;

export const penaltyMs = (rule: MistakeRule, mistakes: number) =>
  rule === 'penalty' ? mistakes * PENALTY_MS : 0;

/** When the race ends: at the time limit, or once nobody is still racing. */
export const endsAt = (meta: RaceMeta) => meta.startAt + meta.limitMin * 60_000;

/** This round's racers only (a rematch leaves old progress behind until people rejoin). */
export const inRound = (meta: RaceMeta, racers: readonly Racer[]) =>
  racers.filter((r) => r.round === meta.round);

/** Is the race over? Time is up, or every racer has finished or been knocked out. */
export function isOver(meta: RaceMeta, racers: readonly Racer[], now: number): boolean {
  if (meta.phase !== 'race' || now < meta.startAt) return false;
  if (now >= endsAt(meta)) return true;
  const mine = inRound(meta, racers);
  return mine.length > 0 && mine.every((r) => r.finishedAt > 0 || isOut(meta.rule, r.mistakes));
}

export type Standing = Racer & {
  place: number;
  status: 'finished' | 'racing' | 'out';
  /** Finish time plus penalties, for finishers. */
  scoreMs: number | null;
  /** 0..1 of the puzzle done. */
  progress: number;
};

/**
 * Who's winning. Finishers first, fastest score (time + penalties) first. Then everyone
 * still going (or out of time) by how much they've done, fewer mistakes breaking ties.
 * Knocked-out racers come last, by how far they got.
 */
export function standings(meta: RaceMeta, racers: readonly Racer[]): Standing[] {
  const rows = inRound(meta, racers).map((r): Omit<Standing, 'place'> => {
    const out = isOut(meta.rule, r.mistakes);
    const finished = !out && r.finishedAt > 0;
    return {
      ...r,
      status: finished ? 'finished' : out ? 'out' : 'racing',
      scoreMs: finished
        ? Math.max(0, r.finishedAt - meta.startAt) + penaltyMs(meta.rule, r.mistakes)
        : null,
      progress: r.total ? Math.min(1, r.filled / r.total) : 0,
    };
  });
  const tier = { finished: 0, racing: 1, out: 2 } as const;
  rows.sort(
    (a, b) =>
      tier[a.status] - tier[b.status] ||
      (a.scoreMs ?? 0) - (b.scoreMs ?? 0) ||
      b.filled - a.filled ||
      a.mistakes - b.mistakes ||
      a.nick.localeCompare(b.nick),
  );
  return rows.map((r, i) => ({ ...r, place: i + 1 }));
}
