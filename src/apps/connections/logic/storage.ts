import { readStorage, writeStorage } from '../../../lib/storage';
import type { ConnState } from './connections';

// Today's progress and simple stats, kept in this browser only.

const dayKey = (day: number) => `lepak.connections.day.${day}`;
const STATS_KEY = 'lepak.connections.stats';

export interface ConnStats {
  played: number;
  wins: number;
  perfect: number; // won with no mistakes
  streak: number;
  lastDay: number | null;
}

export const EMPTY_STATS: ConnStats = { played: 0, wins: 0, perfect: 0, streak: 0, lastDay: null };

export function loadDay(day: number): ConnState | null {
  try {
    const raw = readStorage(dayKey(day));
    return raw ? (JSON.parse(raw) as ConnState) : null;
  } catch {
    return null;
  }
}

export function saveDay(day: number, state: ConnState) {
  writeStorage(dayKey(day), JSON.stringify(state));
}

export function loadStats(): ConnStats {
  try {
    const raw = readStorage(STATS_KEY);
    return raw ? { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<ConnStats>) } : EMPTY_STATS;
  } catch {
    return EMPTY_STATS;
  }
}

export function recordResult(stats: ConnStats, day: number, state: ConnState): ConnStats {
  if (state.status === 'playing' || stats.lastDay === day) return stats;
  const won = state.status === 'won';
  const next: ConnStats = {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    perfect: stats.perfect + (won && state.mistakes === 0 ? 1 : 0),
    streak: won ? (stats.lastDay === day - 1 ? stats.streak + 1 : 1) : 0,
    lastDay: day,
  };
  writeStorage(STATS_KEY, JSON.stringify(next));
  return next;
}
