// What AI Notes keeps on this device beside each draft, and drops when the draft goes:
//  - flashcard progress (small, in localStorage)
//  - the file or text the notes came from (can be a few MB, so IndexedDB), used to make
//    more quiz questions later without asking you for the file again.
// Nothing here is sent anywhere until you ask for more questions.

import { readStorage, writeStorage } from '../../../lib/storage';
import type { Progress } from './practice';

// ---------- flashcard progress ----------

const PROGRESS_KEY = 'lepak.ainotes.progress';

function readAll(): Record<string, Progress> {
  try {
    const v = JSON.parse(readStorage(PROGRESS_KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, Progress>) : {};
  } catch {
    return {};
  }
}

export function loadProgress(draftId: string): Progress {
  return readAll()[draftId] ?? {};
}

export function saveProgress(draftId: string, p: Progress) {
  writeStorage(PROGRESS_KEY, JSON.stringify({ ...readAll(), [draftId]: p }));
}

// ---------- the original material ----------

/** What the notes were made from: the PDF itself, or the text read out of the file. */
export interface Source {
  text?: string;
  pdfBase64?: string;
  fileName?: string;
}

const DB_NAME = 'lepak-ainotes';
const STORE = 'sources';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSource(draftId: string, source: Source): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(source, draftId);
    await done(tx);
  } catch {
    // private mode or storage full: "add more questions" then works from the notes instead
  }
}

export async function loadSource(draftId: string): Promise<Source | null> {
  try {
    const db = await openDb();
    const req = db.transaction(STORE).objectStore(STORE).get(draftId);
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as Source | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Forgets progress and files for drafts that no longer exist (expired or deleted). */
export async function forgetOthers(keepIds: readonly string[]): Promise<void> {
  const keep = new Set(keepIds);
  const all = readAll();
  const kept = Object.fromEntries(Object.entries(all).filter(([id]) => keep.has(id)));
  if (Object.keys(kept).length !== Object.keys(all).length) {
    writeStorage(PROGRESS_KEY, JSON.stringify(kept));
  }
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      for (const k of req.result) if (!keep.has(String(k))) store.delete(k);
    };
    await done(tx);
  } catch {
    // nothing to tidy
  }
}
