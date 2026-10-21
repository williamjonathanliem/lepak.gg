// Drafts kept on this device for a few days (AI Notes, AI Slides). Nothing goes to a server.
// Each feature makes its own store with a storage key and a Zod schema, so broken or
// old-format data is skipped instead of crashing the page.

import type { z } from 'zod';
import { readStorage, writeStorage } from './storage';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Draft<T> {
  id: string;
  savedAt: number;
  data: T;
}

export interface DraftStore<T> {
  readonly days: number;
  /** Drafts still within their time, newest first. Expired ones are dropped from storage. */
  load(now?: number): Draft<T>[];
  /** Keep this as a new draft; returns its id. */
  save(data: T, now?: number): string;
  /** Replace an existing draft's data (e.g. after editing). */
  update(id: string, data: T, now?: number): void;
  remove(id: string, now?: number): Draft<T>[];
}

export function createDraftStore<T>(
  key: string,
  schema: z.ZodType<T>,
  { days = 7, max = 10 } = {},
): DraftStore<T> {
  const write = (list: Draft<T>[]) => writeStorage(key, JSON.stringify(list));

  function read(): Draft<T>[] {
    try {
      const raw = JSON.parse(readStorage(key) ?? '[]') as unknown[];
      return raw.flatMap((d) => {
        const x = d as Partial<Draft<T>> & { notes?: unknown };
        // `notes` is the field name older AI Notes drafts used.
        const parsed = schema.safeParse(x.data ?? x.notes);
        return typeof x.id === 'string' && typeof x.savedAt === 'number' && parsed.success
          ? [{ id: x.id, savedAt: x.savedAt, data: parsed.data }]
          : [];
      });
    } catch {
      return [];
    }
  }

  const store: DraftStore<T> = {
    days,
    load(now = Date.now()) {
      const all = read();
      const live = all.filter((d) => now - d.savedAt < days * DAY_MS);
      if (live.length !== all.length) write(live);
      return live.sort((a, b) => b.savedAt - a.savedAt);
    },
    save(data, now = Date.now()) {
      const id = `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      write([{ id, savedAt: now, data }, ...store.load(now)].slice(0, max));
      return id;
    },
    update(id, data, now = Date.now()) {
      write(store.load(now).map((d) => (d.id === id ? { ...d, data } : d)));
    },
    remove(id, now = Date.now()) {
      const next = store.load(now).filter((d) => d.id !== id);
      write(next);
      return next;
    },
  };
  return store;
}

/** "today", "yesterday", "3 days ago" plus how long until it's deleted. */
export function draftAge(
  savedAt: number,
  days: number,
  now = Date.now(),
): { saved: string; left: string } {
  const age = Math.floor((now - savedAt) / DAY_MS);
  const saved = age <= 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`;
  const remaining = days - age;
  const left = remaining <= 1 ? 'deleted tomorrow' : `kept ${remaining} more days`;
  return { saved, left };
}
