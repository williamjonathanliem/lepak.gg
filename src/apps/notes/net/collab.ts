// Live co-editing for Lepak Pages notes, with Yjs (a CRDT: everyone's edits merge cleanly,
// whatever order they arrive in) and Firebase Realtime Database to pass the edits around.
//
//   collab/{room}/updates/{id}   one Yjs update, base64          anyone in the room
//   collab/{room}/seeded         true once someone loaded the saved note in
//   collab/{room}/peers/{uid}    { n: nickname } while the editor is open
//   collab/{room}/updatedAt      for the 1-day clean-up
//
// {room} is a SHA-256 of the slug and the page's secret edit key, so only people with the
// edit link can find the room. The saved page still lives in Supabase; this is just the
// live scratchpad between saves. See database.rules.json.

import type * as YType from 'yjs';
import type { TextChange } from '../logic/textDiff';

const LOCAL = 'local';
const REMOTE = 'remote';
const SEND_EVERY_MS = 120;
const COMPACT_AFTER = 150; // squash the update log once it gets this long

export interface Collab {
  readonly selfId: string;
  readonly text: YType.Text;
  /** Apply a change typed in this browser. */
  apply(change: TextChange): void;
  onPeers(cb: (names: string[]) => void): () => void;
  close(): void;
}

export const LOCAL_ORIGIN = LOCAL;

async function roomId(slug: string, editKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(`lepak-pages:${slug}:${editKey}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) {
    s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function openCollab(
  slug: string,
  editKey: string,
  seed: string,
  nickname: string,
): Promise<Collab> {
  const [Y, { getFirebase }, fb, room] = await Promise.all([
    import('yjs'),
    import('../../../lib/firebase'),
    import('firebase/database'),
    roomId(slug, editKey),
  ]);
  const { db, uid } = await getFirebase();
  const base = `collab/${room}`;
  const r = (path: string) => fb.ref(db, `${base}/${path}`);
  const doc = new Y.Doc();
  const text = doc.getText('body');
  const seen = new Set<string>();
  const offs: (() => void)[] = [];

  // 1. Load what's there.
  const existing = (await fb.get(r('updates'))).val() as Record<string, string> | null;
  for (const [key, data] of Object.entries(existing ?? {})) {
    seen.add(key);
    try {
      Y.applyUpdate(doc, fromBase64(data), REMOTE);
    } catch {
      // a broken update: skip it
    }
  }

  // 2. Send our own edits, a few times a second, merged.
  let pending: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (!pending.length) return;
    const merged = Y.mergeUpdates(pending);
    pending = [];
    const key = fb.push(r('updates')).key!;
    seen.add(key);
    void fb.update(fb.ref(db, base), {
      [`updates/${key}`]: toBase64(merged),
      updatedAt: fb.serverTimestamp(),
    });
    if (seen.size > COMPACT_AFTER) compact();
  };
  doc.on('update', (u: Uint8Array, origin: unknown) => {
    if (origin === REMOTE) return;
    pending.push(u);
    timer ??= setTimeout(flush, SEND_EVERY_MS);
  });

  /** Replace the long log with one update holding the whole note. */
  const compact = () => {
    const old = [...seen];
    const key = fb.push(r('updates')).key!;
    const patch: Record<string, unknown> = {
      [`updates/${key}`]: toBase64(Y.encodeStateAsUpdate(doc)),
      updatedAt: fb.serverTimestamp(),
    };
    for (const k of old) patch[`updates/${k}`] = null;
    seen.clear();
    seen.add(key);
    void fb.update(fb.ref(db, base), patch);
  };

  // 3. First one in loads the saved note (only one browser wins, so it isn't doubled).
  if (text.length === 0 && seed) {
    const won = await fb
      .runTransaction(r('seeded'), (cur: unknown) => (cur ? undefined : true))
      .then((t) => t.committed)
      .catch(() => false);
    if (won) doc.transact(() => text.insert(0, seed), LOCAL);
  }

  // 4. Everyone else's edits as they arrive.
  offs.push(
    fb.onChildAdded(r('updates'), (snap) => {
      const key = snap.key!;
      if (seen.has(key)) return;
      seen.add(key);
      const data = snap.val() as unknown;
      if (typeof data !== 'string') return;
      try {
        Y.applyUpdate(doc, fromBase64(data), REMOTE);
      } catch {
        // skip
      }
    }),
  );
  offs.push(fb.onChildRemoved(r('updates'), (snap) => void seen.delete(snap.key!)));

  // 5. Who's here.
  const me = r(`peers/${uid}`);
  offs.push(
    fb.onValue(fb.ref(db, '.info/connected'), (snap) => {
      if (snap.val() !== true) return;
      void fb
        .onDisconnect(me)
        .remove()
        .then(() => fb.set(me, { n: nickname.slice(0, 16) }));
    }),
  );

  return {
    selfId: uid,
    text,
    apply(change) {
      doc.transact(() => {
        if (change.remove) text.delete(change.index, change.remove);
        if (change.insert) text.insert(change.index, change.insert);
      }, LOCAL);
    },
    onPeers(cb) {
      const off = fb.onValue(r('peers'), (snap) => {
        const all = (snap.val() ?? {}) as Record<string, { n?: string }>;
        cb(
          Object.entries(all)
            .filter(([id]) => id !== uid)
            .map(([, p]) => p.n ?? 'someone'),
        );
      });
      offs.push(off);
      return off;
    },
    close() {
      if (timer) {
        clearTimeout(timer);
        flush();
      }
      offs.forEach((off) => off());
      void fb.remove(me);
      doc.destroy();
    },
  };
}
