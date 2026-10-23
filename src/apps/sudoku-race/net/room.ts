// A Sudoku Race room in Firebase Realtime Database.
//
//   sudokuRace/{CODE}/meta            settings and state (logic/race.ts)   the host only
//   sudokuRace/{CODE}/racers/{uid}    { n, round, filled, total, mistakes, finishedAt }
//                                     each racer their own; removed when they close the page
//   sudokuRace/{CODE}/updatedAt       for the nightly clean-up
//
// Only progress numbers are shared, never the board: everyone makes the same puzzle from
// the room code. Times are server time (serverTimeOffset), so a phone with the wrong clock
// still starts and finishes on the same timeline as everyone else.

import type { RaceMeta, Racer } from '../logic/race';

export type Progress = Pick<Racer, 'round' | 'filled' | 'total' | 'mistakes'>;
/** A seat: progress plus the finish time (kept across a refresh, 0 while racing). */
export type Seat = Progress & Pick<Racer, 'finishedAt'>;

export interface RaceRoom {
  selfId: string;
  /** Server time now (ms). */
  now(): number;
  onMeta(cb: (m: RaceMeta | null) => void, onError?: (e: Error) => void): () => void;
  onRacers(cb: (racers: Racer[]) => void): () => void;
  /** Make the room. Throws 'taken' if the code is in use. */
  create(meta: RaceMeta): Promise<void>;
  setMeta(meta: RaceMeta): Promise<void>;
  /** Take a seat (and keep it while this page is open). */
  join(nick: string, seat: Seat): Promise<void>;
  /** Leave the race without closing the page (host in class mode). */
  leave(): Promise<void>;
  report(progress: Progress): Promise<void>;
  /** Mark this racer done, at server time. */
  finish(progress: Progress): Promise<void>;
  close(): void;
}

export async function openRaceRoom(code: string): Promise<RaceRoom> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../../../lib/firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const r = (path = '') => fb.ref(db, `sudokuRace/${code}${path ? `/${path}` : ''}`);
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
              round: p.round ?? 0,
              filled: p.filled ?? 0,
              total: p.total ?? 0,
              mistakes: p.mistakes ?? 0,
              finishedAt: p.finishedAt ?? 0,
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
    async join(nick, seat) {
      seated?.();
      // Re-seat after a dropped connection, and leave when the page closes.
      seated = watch(
        fb.onValue(fb.ref(db, '.info/connected'), (snap) => {
          if (snap.val() !== true) return;
          void fb
            .onDisconnect(me)
            .remove()
            .then(() => fb.update(me, { n: nick.slice(0, 16), ...seat }));
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
