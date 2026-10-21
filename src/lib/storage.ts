// localStorage can throw (private mode, blocked site data). Never let that crash the app.
//
// Lepak also forgets things you stop using: every `lepak.*` key remembers when it was last
// read or written, and anything untouched for 30 days is cleared on the next visit
// (see sweepStorage, called once at start-up). Matches the Privacy page.

const PREFIX = 'lepak.';
const TOUCH_KEY = 'lepak.touched';
export const LOCAL_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

const used = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Remember that `key` was used; saved a moment later in one write. */
function touch(key: string) {
  if (!key.startsWith(PREFIX) || key === TOUCH_KEY) return;
  used.add(key);
  if (saveTimer || typeof window === 'undefined') return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const stamps = readStamps();
      const now = Date.now();
      for (const k of used) stamps[k] = now;
      used.clear();
      localStorage.setItem(TOUCH_KEY, JSON.stringify(stamps));
    } catch {
      // storage unavailable
    }
  }, 2000);
}

function readStamps(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TOUCH_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function readStorage(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) touch(key);
    return v;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    touch(key);
  } catch {
    // Storage unavailable. The value lives only for this page view.
  }
}

/**
 * Clears `lepak.*` keys nobody has used for 30 days. Keys with no date yet get today's,
 * so the clock starts now. Returns the keys it removed.
 */
export function sweepStorage(now = Date.now()): string[] {
  const removed: string[] = [];
  try {
    const stamps = readStamps();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== TOUCH_KEY) keys.push(k);
    }
    const next: Record<string, number> = {};
    for (const k of keys) {
      const at = stamps[k] ?? now;
      if (now - at > LOCAL_KEEP_MS) {
        localStorage.removeItem(k);
        removed.push(k);
      } else next[k] = at;
    }
    localStorage.setItem(TOUCH_KEY, JSON.stringify(next));
    // The solo whiteboard's pictures live in IndexedDB; they go with the board.
    if (removed.includes('lepak.whiteboard.solo')) indexedDB.deleteDatabase('lepak-whiteboard');
  } catch {
    // storage unavailable: nothing to clear
  }
  return removed;
}
