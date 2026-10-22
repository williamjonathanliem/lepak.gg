// A class's deadline board in Firebase Realtime Database.
//
//   deadlines/{CODE}/meta          { owner, title, open }     the class rep only
//   deadlines/{CODE}/items/{id}    { title, course, due, note, by, byUid }
//                                  the class rep, or anyone when `open` (their own items)
//   deadlines/{CODE}/updatedAt     for the nightly clean-up
//
// See database.rules.json for who may write what.

import type { BoardMeta, Deadline } from '../logic/deadlines';

export interface Board {
  selfId: string;
  onMeta(cb: (m: BoardMeta | null) => void, onError?: (e: Error) => void): () => void;
  onItems(cb: (items: Deadline[]) => void): () => void;
  /** Make a new board (fails if the code is taken). */
  create(title: string): Promise<void>;
  saveMeta(meta: BoardMeta): Promise<void>;
  add(d: Omit<Deadline, 'id' | 'byUid'>): Promise<void>;
  update(d: Deadline): Promise<void>;
  remove(id: string): Promise<void>;
  close(): void;
}

export async function openBoard(code: string): Promise<Board> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../../../lib/firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const r = (path = '') => fb.ref(db, `deadlines/${code}${path ? `/${path}` : ''}`);
  const offs: (() => void)[] = [];
  const watch = (off: () => void) => {
    offs.push(off);
    return off;
  };
  const touch = { updatedAt: fb.serverTimestamp() };
  const itemData = (d: Omit<Deadline, 'id'>) => ({
    title: d.title,
    course: d.course,
    due: d.due,
    note: d.note,
    by: d.by,
    byUid: d.byUid,
  });

  return {
    selfId: uid,
    onMeta: (cb, onError) =>
      watch(
        fb.onValue(
          r('meta'),
          (s) => {
            const v = s.val() as Partial<BoardMeta> | null;
            cb(v ? { owner: v.owner ?? '', title: v.title ?? '', open: !!v.open } : null);
          },
          onError,
        ),
      ),
    onItems: (cb) =>
      watch(
        fb.onValue(r('items'), (s) => {
          const all = (s.val() ?? {}) as Record<string, Partial<Deadline>>;
          cb(
            Object.entries(all).map(([id, d]) => ({
              id,
              title: d.title ?? '',
              course: d.course ?? '',
              due: d.due ?? 0,
              note: d.note ?? '',
              by: d.by ?? '',
              byUid: d.byUid ?? '',
            })),
          );
        }),
      ),
    async create(title) {
      const existing = await fb.get(r('meta'));
      if (existing.exists()) throw new Error('taken');
      await fb.update(r(), { meta: { owner: uid, title, open: false }, ...touch });
    },
    async saveMeta(meta) {
      await fb.update(r(), { meta, ...touch });
    },
    async add(d) {
      const id = fb.push(r('items')).key!;
      await fb.update(r(), { [`items/${id}`]: itemData({ ...d, byUid: uid }), ...touch });
    },
    async update(d) {
      await fb.update(r(), { [`items/${d.id}`]: itemData(d), ...touch });
    },
    async remove(id) {
      await fb.update(r(), { [`items/${id}`]: null, ...touch });
    },
    close() {
      offs.forEach((off) => off());
    },
  };
}
