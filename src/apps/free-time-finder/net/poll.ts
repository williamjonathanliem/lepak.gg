// A Free-Time Finder poll in Firebase Realtime Database.
//
//   free/{CODE}/meta            { owner, title, days[], from, to }   whoever made it
//   free/{CODE}/people/{uid}    { n: nickname, f: "0101..." }        each person their own
//   free/{CODE}/updatedAt       for the nightly clean-up
//
// See database.rules.json for who may write what.

import type { Person, PollMeta } from '../logic/free';

export interface Poll {
  selfId: string;
  onMeta(cb: (m: PollMeta | null) => void, onError?: (e: Error) => void): () => void;
  onPeople(cb: (people: Person[]) => void): () => void;
  create(meta: Omit<PollMeta, 'owner'>): Promise<void>;
  saveMine(nick: string, free: string): Promise<void>;
  close(): void;
}

export async function openPoll(code: string): Promise<Poll> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../../../lib/firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const r = (path = '') => fb.ref(db, `free/${code}${path ? `/${path}` : ''}`);
  const offs: (() => void)[] = [];
  const watch = (off: () => void) => {
    offs.push(off);
    return off;
  };

  return {
    selfId: uid,
    onMeta: (cb, onError) =>
      watch(
        fb.onValue(
          r('meta'),
          (s) => {
            const v = s.val() as Partial<PollMeta> | null;
            cb(
              v && Array.isArray(v.days)
                ? {
                    owner: v.owner ?? '',
                    title: v.title ?? '',
                    days: v.days,
                    from: v.from ?? 9,
                    to: v.to ?? 22,
                  }
                : null,
            );
          },
          onError,
        ),
      ),
    onPeople: (cb) =>
      watch(
        fb.onValue(r('people'), (s) => {
          const all = (s.val() ?? {}) as Record<string, { n?: string; f?: string }>;
          cb(Object.entries(all).map(([id, p]) => ({ uid: id, nick: p.n ?? '', free: p.f ?? '' })));
        }),
      ),
    async create(meta) {
      const existing = await fb.get(r('meta'));
      if (existing.exists()) throw new Error('taken');
      await fb.update(r(), { meta: { ...meta, owner: uid }, updatedAt: fb.serverTimestamp() });
    },
    async saveMine(nick, free) {
      await fb.update(r(), {
        [`people/${uid}`]: { n: nick.slice(0, 16), f: free },
        updatedAt: fb.serverTimestamp(),
      });
    },
    close() {
      offs.forEach((off) => off());
    },
  };
}
