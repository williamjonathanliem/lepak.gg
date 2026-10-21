// Shared helpers for the daily puzzle games (Sudoku, Hive Mind, Edgewise, Mosaic, Domino
// Logic, Word Weave, Pocket Crossword). Pure, except load/save which use localStorage.

import { readStorage, writeStorage } from './storage';

// ---------- the day ----------

const EPOCH = Date.UTC(2026, 0, 1); // puzzle #1
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // a new puzzle at midnight Malaysia time

/** Puzzle number for a moment in time, starting at 1. Same as Letterlock's. */
export function dayNumber(nowMs: number): number {
  return Math.floor((nowMs + MYT_OFFSET_MS - EPOCH) / 86_400_000) + 1;
}

export function today(): number {
  return dayNumber(Date.now());
}

// ---------- seeded randomness ----------

export type Rng = () => number;

/** Same seed, same numbers (mulberry32), so everyone gets the same daily puzzle. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!;
}

/** Which of `count` pre-built puzzles a seed means: the day's for daily seeds
 * ("<id>-<day>"), a random one for practice seeds. */
export function puzzleIndex(seed: string, count: number): number {
  const daily = /-(\d+)$/.exec(seed);
  if (daily && !seed.startsWith('practice')) return (Number(daily[1]) - 1) % count;
  return Math.floor(seededRng(seed)() * count);
}

/** A fresh random seed for practice puzzles. */
export function practiceSeed(): string {
  return `practice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- stats ----------

export interface PuzzleStats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastDay: number | null;
}

export const EMPTY_PUZZLE_STATS: PuzzleStats = {
  played: 0,
  won: 0,
  streak: 0,
  maxStreak: 0,
  lastDay: null,
};

/** Count a finished daily puzzle. A day only counts once; a missed day resets the streak. */
export function recordResult(stats: PuzzleStats, day: number, won: boolean): PuzzleStats {
  if (stats.lastDay === day) return stats;
  const continues = stats.lastDay === day - 1;
  const streak = won ? (continues ? stats.streak + 1 : 1) : 0;
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastDay: day,
  };
}

// ---------- saved progress ----------

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = readStorage(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as object) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  writeStorage(key, JSON.stringify(value));
}

/** Formats seconds as m:ss. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
