// Live shared boards over Firebase Realtime Database.
//
//   boards/{CODE}/elements/{shapeId}  { v: version, d: shape as JSON text }
//   boards/{CODE}/presence/{uid}      true while the board is open
//   boards/{CODE}/cursors/{uid}       { x, y, n: nickname, t: tool, b: button } live mouse position
//   boards/{CODE}/updatedAt           for cleaning up old boards
//
// Each browser sends only the shapes it changed, and merges what others send
// (see logic/sync.ts). See database.rules.json for who may write what.

import { MAX_ELEMENT_CHARS, type Versioned } from '../logic/sync';

export interface Cursor {
  x: number;
  y: number;
  n: string; // nickname
  t: 'pointer' | 'laser';
  b: 'up' | 'down';
}

export interface BoardConnection {
  /** This browser's id on the board (to skip our own cursor). */
  readonly selfId: string;
  /** Send shapes this browser changed. */
  send(elements: readonly Versioned[]): void;
  /** Share where our mouse is. Call often; it's throttled here. */
  sendCursor(cursor: Cursor): void;
  close(): void;
}

interface Handlers<T> {
  /** Shapes from other people (or the board's saved state on join). */
  onRemote(elements: T[]): void;
  /** How many people have the board open. */
  onPeople(count: number): void;
  /** Everyone's mouse positions, by id (includes ours). */
  onCursors(cursors: Record<string, Cursor>): void;
}

export async function openBoard<T extends Versioned>(
  code: string,
  { onRemote, onPeople, onCursors }: Handlers<T>,
): Promise<BoardConnection> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../../../lib/firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const base = `boards/${code}`;
  const r = (path: string) => fb.ref(db, `${base}/${path}`);
  const offs: (() => void)[] = [];

  // Presence
  const me = r(`presence/${uid}`);
  offs.push(
    fb.onValue(fb.ref(db, '.info/connected'), (snap) => {
      if (snap.val() !== true) return;
      void fb
        .onDisconnect(me)
        .remove()
        .then(() => fb.set(me, true));
    }),
  );
  offs.push(
    fb.onValue(r('presence'), (snap) => onPeople(Object.keys(snap.val() ?? {}).length || 1)),
  );

  // Cursors: removed automatically when the tab closes or drops.
  const myCursor = r(`cursors/${uid}`);
  void fb.onDisconnect(myCursor).remove();
  offs.push(
    fb.onValue(r('cursors'), (snap) => onCursors((snap.val() ?? {}) as Record<string, Cursor>)),
  );
  let lastCursorAt = 0;
  let queued: Cursor | null = null;
  let cursorTimer: ReturnType<typeof setTimeout> | null = null;
  const CURSOR_EVERY_MS = 60;
  const flushCursor = () => {
    cursorTimer = null;
    if (!queued) return;
    lastCursorAt = Date.now();
    void fb.set(myCursor, {
      x: Math.round(queued.x),
      y: Math.round(queued.y),
      n: queued.n.slice(0, 16),
      t: queued.t,
      b: queued.b,
    });
    queued = null;
  };

  // Shapes
  const parse = (snap: { val(): unknown }): T | null => {
    const v = snap.val() as { d?: unknown } | null;
    if (!v || typeof v.d !== 'string') return null;
    try {
      return JSON.parse(v.d) as T;
    } catch {
      return null;
    }
  };
  const take = (snap: { val(): unknown }) => {
    const el = parse(snap);
    if (el) onRemote([el]);
  };
  offs.push(fb.onChildAdded(r('elements'), take));
  offs.push(fb.onChildChanged(r('elements'), take));

  return {
    selfId: uid,
    sendCursor(cursor) {
      queued = cursor;
      if (cursorTimer) return;
      const wait = Math.max(0, CURSOR_EVERY_MS - (Date.now() - lastCursorAt));
      cursorTimer = setTimeout(flushCursor, wait);
    },
    send(elements) {
      const patch: Record<string, unknown> = {};
      for (const el of elements) {
        const d = JSON.stringify(el);
        if (d.length > MAX_ELEMENT_CHARS) continue; // huge freehand strokes stay local
        patch[`elements/${el.id}`] = { v: el.version, d };
      }
      if (Object.keys(patch).length === 0) return;
      patch.updatedAt = fb.serverTimestamp();
      void fb.update(fb.ref(db, base), patch);
    },
    close() {
      offs.forEach((off) => off());
      if (cursorTimer) clearTimeout(cursorTimer);
      void fb.remove(me);
      void fb.remove(myCursor);
    },
  };
}
