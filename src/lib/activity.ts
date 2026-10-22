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

// ---------- AI Notes flashcards due ----------
// Read straight from storage (no schema library), so the hub stays small. Keys and rules
// match src/apps/ai-notes (logic/drafts.ts, logic/saved.ts, logic/practice.ts).

const NOTES_DRAFTS_KEY = 'lepak.ainotes.drafts';
const NOTES_PROGRESS_KEY = 'lepak.ainotes.progress';
const NOTES_DRAFT_MS = 7 * 24 * 60 * 60 * 1000;

export interface CardsDue {
  draftId: string;
  title: string;
  due: number;
  total: number;
}

/** Sets of AI Notes flashcards you've started practising that have cards due now. */
export function flashcardsDue(now: number): CardsDue[] {
  try {
    const drafts = JSON.parse(readStorage(NOTES_DRAFTS_KEY) ?? '[]') as unknown;
    const progress = JSON.parse(readStorage(NOTES_PROGRESS_KEY) ?? '{}') as Record<
      string,
      Record<string, { due?: unknown }>
    >;
    if (!Array.isArray(drafts)) return [];
    return drafts
      .flatMap((d: { id?: unknown; savedAt?: unknown; data?: unknown }) => {
        const data = d.data as { title?: unknown; flashcards?: unknown } | undefined;
        if (typeof d.id !== 'string' || typeof d.savedAt !== 'number') return [];
        if (now - d.savedAt >= NOTES_DRAFT_MS || !Array.isArray(data?.flashcards)) return [];
        const p = progress[d.id];
        if (!p || !Object.keys(p).length) return []; // never practised: don't nag
        const total = data.flashcards.length;
        let due = 0;
        for (let i = 0; i < total; i++) {
          const at = p[i]?.due;
          if (typeof at !== 'number' || at <= now) due++;
        }
        const title = typeof data.title === 'string' ? data.title : 'Your notes';
        return due > 0 ? [{ draftId: d.id, title, due, total }] : [];
      })
      .sort((a, b) => b.due - a.due);
  } catch {
    return [];
  }
}
