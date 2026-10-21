// What you've been up to on this device, for the hub: recently opened apps and today's
// daily puzzles. Read from localStorage only.

import { readStorage, writeStorage } from './storage';

const RECENT_KEY = 'lepak.recent';
const MAX_RECENT = 6;

/** Remember that an app was opened (its route), newest first. */
export function rememberApp(route: string) {
  try {
    const list = JSON.parse(readStorage(RECENT_KEY) ?? '[]') as unknown;
    const prev = Array.isArray(list) ? list.filter((r): r is string => typeof r === 'string') : [];
    writeStorage(
      RECENT_KEY,
      JSON.stringify([route, ...prev.filter((r) => r !== route)].slice(0, MAX_RECENT)),
    );
  } catch {
    writeStorage(RECENT_KEY, JSON.stringify([route]));
  }
}

export function recentApps(): string[] {
  try {
    const list = JSON.parse(readStorage(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(list) ? list.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

export type DailyStatus = 'done' | 'started' | 'new';

/** Today's state of a daily puzzle game, from what this browser saved. */
export function dailyStatus(id: string, day: number): DailyStatus {
  // Every daily game saves lepak.<id>.stats and lepak.<id>.day.<n> (Letterlock and
  // Groupthink included).
  const statsKey = `lepak.${id}.stats`;
  const dayKey = `lepak.${id}.day.${day}`;
  try {
    const stats = JSON.parse(readStorage(statsKey) ?? '{}') as { lastDay?: number };
    if (stats.lastDay === day) return 'done';
  } catch {
    // ignore
  }
  return readStorage(dayKey) ? 'started' : 'new';
}
