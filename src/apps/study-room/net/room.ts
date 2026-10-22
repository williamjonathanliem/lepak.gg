// A study room in Firebase Realtime Database.
//
//   study/{CODE}/timer          the shared timer (logic/timer.ts)    anyone in the room
//   study/{CODE}/people/{uid}   { n: nickname, task, since }         each person their own,
//                               removed when they close the page
//   study/{CODE}/updatedAt      for the nightly clean-up
//
// Times are server time: each screen learns how far its clock is off (serverTimeOffset),
// so a phone with the wrong time still shows the same countdown as everyone else.

import { catchUp, type Timer } from '../logic/timer';

export interface Member {
  uid: string;
  nick: string;
  task: string;
  since: number;
}

export interface StudyRoom {
  selfId: string;
  /** Server time now (ms). */
  now(): number;
  onTimer(cb: (t: Timer | null) => void, onError?: (e: Error) => void): () => void;
  onPeople(cb: (people: Member[]) => void): () => void;
  create(t: Timer): Promise<void>;
  setTimer(t: Timer): Promise<void>;
  /** If the phase ran out, move on (only one screen wins, the rest see the result). */
  advanceIfDone(): Promise<void>;
  join(nick: string, task: string): Promise<void>;
  setTask(task: string): Promise<void>;
  close(): void;
}

export async function openStudyRoom(code: string): Promise<StudyRoom> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../../../lib/firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const r = (path = '') => fb.ref(db, `study/${code}${path ? `/${path}` : ''}`);
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
  const now = () => Date.now() + offset;
  const touch = () => fb.set(r('updatedAt'), fb.serverTimestamp());

  return {
    selfId: uid,
    now,
    onTimer: (cb, onError) =>
      watch(fb.onValue(r('timer'), (s) => cb((s.val() as Timer | null) ?? null), onError)),
    onPeople: (cb) =>
      watch(
        fb.onValue(r('people'), (s) => {
          const all = (s.val() ?? {}) as Record<
            string,
            { n?: string; task?: string; since?: number }
          >;
          cb(
            Object.entries(all).map(([id, p]) => ({
              uid: id,
              nick: p.n ?? '',
              task: p.task ?? '',
              since: p.since ?? 0,
            })),
          );
        }),
      ),
    async create(t) {
      const existing = await fb.get(r('timer'));
      if (existing.exists()) throw new Error('taken');
      await fb.update(r(), { timer: t, updatedAt: fb.serverTimestamp() });
    },
    async setTimer(t) {
      await fb.update(r(), { timer: t, updatedAt: fb.serverTimestamp() });
    },
    async advanceIfDone() {
      await fb.runTransaction(r('timer'), (cur: Timer | null) => {
        if (!cur) return undefined;
        const moved = catchUp(cur, now());
        return moved === cur ? undefined : moved; // undefined = leave it alone
      });
      await touch();
    },
    async join(nick, task) {
      const me = r(`people/${uid}`);
      watch(
        fb.onValue(fb.ref(db, '.info/connected'), (snap) => {
          if (snap.val() !== true) return;
          void fb
            .onDisconnect(me)
            .remove()
            .then(() =>
              fb.set(me, {
                n: nick.slice(0, 16),
                task: task.slice(0, 60),
                since: fb.serverTimestamp(),
              }),
            );
        }),
      );
      await touch();
    },
    async setTask(task) {
      await fb.update(r(`people/${uid}`), { task: task.slice(0, 60) });
    },
    close() {
      offs.forEach((off) => off());
      void fb.remove(r(`people/${uid}`)).catch(() => {});
    },
  };
}
