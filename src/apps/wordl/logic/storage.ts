import { readStorage, writeStorage } from '../../../lib/storage';
import { EMPTY_STATS, dayNumber, type Stats } from './wordl';

/** Today's puzzle number, from the device clock. */
export function todayNumber(): number {
  return dayNumber(Date.now());
}

// Progress and stats live in this browser only (localStorage). No account needed.

const dayKey = (day: number) => `lepak.wordl.day.${day}`;
const STATS_KEY = 'lepak.wordl.stats';

export function loadDayGuesses(day: number): string[] {
  try {
    const raw = readStorage(dayKey(day));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === 'string') : [];
  } catch {
    return [];
  }
}

export function saveDayGuesses(day: number, guesses: string[]) {
  writeStorage(dayKey(day), JSON.stringify(guesses));
}

export function loadStats(): Stats {
  try {
    const raw = readStorage(STATS_KEY);
    return raw ? { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<Stats>) } : EMPTY_STATS;
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(stats: Stats) {
  writeStorage(STATS_KEY, JSON.stringify(stats));
}

let words: Promise<Set<string>> | null = null;

/** Every allowed 5 letter guess, loaded once (about 50 KB). */
export function loadGuessList(): Promise<Set<string>> {
  words ??= fetch('/words/en-5.txt')
    .then((r) => {
      if (!r.ok) throw new Error(`guess list ${r.status}`);
      return r.text();
    })
    .then((t) => new Set(t.split(/\r?\n/).filter(Boolean)));
  words.catch(() => {
    words = null;
  });
  return words;
}
