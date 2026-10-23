// A Ketik Race room in Firebase Realtime Database.
//
//   ketik/{CODE}/meta            settings and state (logic/race.ts)       the host only
//   ketik/{CODE}/racers/{uid}    { n, av, round, pos, total, correct, errors, finishedAt,
//                                  score, lives, outAt }                    each racer their own;
//                                removed when they close the page
//   ketik/{CODE}/updatedAt       for the nightly clean-up
//
// Only progress is shared, never keystrokes: everyone makes the same text and word waves
// from the room code. Times are server time (serverTimeOffset), so everyone starts together.

import type { RaceMeta, Racer } from '../logic/race';

/** What a racer reports: everything about them except who they are. */
export type Progress = Omit<Racer, 'uid' | 'nick' | 'finishedAt'>;

export interface KetikRoom {
  selfId: string;
  /** Server time now (ms). */
  now(): number;
  onMeta(cb: (m: RaceMeta | null) => void, onError?: (e: Error) => void): () => void;
  onRacers(cb: (racers: Racer[]) => void): () => void;
  /** Make the room. Throws 'taken' if the code is in use. */
  create(meta: RaceMeta): Promise<void>;
  setMeta(meta: RaceMeta): Promise<void>;
  /** Take a seat (kept while this page is open). `finishedAt` survives a refresh. */
  join(nick: string, progress: Progress, finishedAt: number): Promise<void>;
  /** Leave the race without closing the page (host in class mode). */
  leave(): Promise<void>;
  report(progress: Partial<Progress>): Promise<void>;
  /** Sentence mode: mark the text finished, at server time. */
  finish(progress: Partial<Progress>): Promise<void>;
  close(): void;
}

export async function openKetikRoom(code: string): Promise<KetikRoom> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../../../lib/firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const r = (path = '') => fb.ref(db, `ketik/${code}${path ? `/${path}` : ''}`);
  const me = r(`racers/${uid}`);
  const offs: (() => void)[] = [];
  const watch = (off: () => void) => {
    offs.push(off);
    return off;
  };
  let offset = 0;
  watch(
    fb.onValue(fb.ref(db, '.info/serverTimeOffset'), (s) => {
      offset = Number(s.val()) || 0;
    }),
  );
  const touch = () => fb.set(r('updatedAt'), fb.serverTimestamp());
  let seated: (() => void) | null = null;

  return {
    selfId: uid,
    now: () => Date.now() + offset,
    onMeta: (cb, onError) =>
      watch(fb.onValue(r('meta'), (s) => cb((s.val() as RaceMeta | null) ?? null), onError)),
    onRacers: (cb) =>
      watch(
        fb.onValue(r('racers'), (s) => {
          const all = (s.val() ?? {}) as Record<string, Partial<Racer> & { n?: string }>;
          cb(
            Object.entries(all).map(([id, p]) => ({
              uid: id,
              nick: p.n ?? '',
              av: p.av ?? 0,
              round: p.round ?? 0,
              pos: p.pos ?? 0,
              total: p.total ?? 0,
              correct: p.correct ?? 0,
              errors: p.errors ?? 0,
              finishedAt: p.finishedAt ?? 0,
              score: p.score ?? 0,
              lives: p.lives ?? 0,
              outAt: p.outAt ?? 0,
            })),
          );
        }),
      ),
    async create(meta) {
      const existing = await fb.get(r('meta'));
      if (existing.exists()) throw new Error('taken');
      await fb.update(r(), { meta, updatedAt: fb.serverTimestamp() });
    },
    async setMeta(meta) {
      await fb.update(r(), { meta, updatedAt: fb.serverTimestamp() });
    },
    async join(nick, progress, finishedAt) {
      seated?.();
      seated = watch(
        fb.onValue(fb.ref(db, '.info/connected'), (snap) => {
          if (snap.val() !== true) return;
          void fb
            .onDisconnect(me)
            .remove()
            .then(() => fb.set(me, { n: nick.slice(0, 16), ...progress, finishedAt }));
        }),
      );
      await touch();
    },
    async leave() {
      seated?.();
      seated = null;
      await fb.onDisconnect(me).cancel();
      await fb.remove(me);
    },
    async report(progress) {
      await fb.update(me, progress);
    },
    async finish(progress) {
      await fb.update(me, { ...progress, finishedAt: fb.serverTimestamp() });
      await touch();
    },
    close() {
      offs.forEach((off) => off());
      void fb.remove(me).catch(() => {});
    },
  };
}
