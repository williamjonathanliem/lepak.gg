// A live quiz room in Firebase Realtime Database. The host's screen runs the game.
//
//   quiz/{CODE}/game              { hostId, title, questions[{q, options}], limitSec }  host
//   quiz/{CODE}/secret            { answers[], whys[] }        host only (players can't peek)
//   quiz/{CODE}/state             { phase, index, openedAt }                            host
//   quiz/{CODE}/reveal/{i}        { answer, why, tally[] }     written when a question ends
//   quiz/{CODE}/scores/{uid}      running total                                         host
//   quiz/{CODE}/players/{uid}     nickname                                     each player
//   quiz/{CODE}/answers/{i}/{uid} { choice, at }   once, while question i is open
//   quiz/{CODE}/hostHere          true while the host's screen is open
//
// See database.rules.json for who may write what.

import type { Answer, LiveQuestion } from '../logic/game';

export type QuizPhase = 'lobby' | 'question' | 'reveal' | 'end';

export interface QuizGame {
  hostId: string;
  title: string;
  questions: LiveQuestion[];
  limitSec: number;
}

export interface QuizState {
  phase: QuizPhase;
  index: number;
  /** Server time question `index` opened. */
  openedAt: number;
}

export interface Reveal {
  answer: number;
  why: string;
  tally: number[];
}

export interface Secret {
  answers: number[];
  whys: string[];
}

export interface QuizRoom {
  selfId: string;
  now(): number;
  onGame(cb: (g: QuizGame | null) => void, onError?: (e: Error) => void): () => void;
  onState(cb: (s: QuizState) => void): () => void;
  onPlayers(cb: (p: Record<string, string>) => void): () => void;
  onScores(cb: (s: Record<string, number>) => void): () => void;
  onReveal(index: number, cb: (r: Reveal | null) => void): () => void;
  onAnswers(index: number, cb: (a: Record<string, Answer>) => void): () => void;
  onHostHere(cb: (here: boolean) => void): () => void;
  create(game: QuizGame, secret: Secret): Promise<void>;
  readSecret(): Promise<Secret | null>;
  setState(s: Omit<QuizState, 'openedAt'> & { stamp?: boolean }): Promise<void>;
  finishQuestion(index: number, reveal: Reveal, scores: Record<string, number>): Promise<void>;
  markHostHere(): void;
  join(nick: string): Promise<void>;
  answer(index: number, choice: number): Promise<void>;
  close(): void;
}

export async function openQuizRoom(code: string): Promise<QuizRoom> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../../../lib/firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const r = (path = '') => fb.ref(db, `quiz/${code}${path ? `/${path}` : ''}`);
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
  const touch = { updatedAt: fb.serverTimestamp() };

  return {
    selfId: uid,
    now: () => Date.now() + offset,
    onGame: (cb, onError) =>
      watch(
        fb.onValue(
          r('game'),
          (s) => {
            const v = s.val() as Partial<QuizGame> | null;
            cb(
              v
                ? {
                    hostId: v.hostId ?? '',
                    title: v.title ?? '',
                    questions: (v.questions ?? []).map((q) => ({
                      q: q.q ?? '',
                      options: q.options ?? [],
                    })),
                    limitSec: v.limitSec ?? 20,
                  }
                : null,
            );
          },
          onError,
        ),
      ),
    onState: (cb) =>
      watch(
        fb.onValue(r('state'), (s) => {
          const v = (s.val() ?? {}) as Partial<QuizState>;
          cb({ phase: v.phase ?? 'lobby', index: v.index ?? 0, openedAt: v.openedAt ?? 0 });
        }),
      ),
    onPlayers: (cb) =>
      watch(fb.onValue(r('players'), (s) => cb((s.val() ?? {}) as Record<string, string>))),
    onScores: (cb) =>
      watch(fb.onValue(r('scores'), (s) => cb((s.val() ?? {}) as Record<string, number>))),
    onReveal: (index, cb) =>
      watch(fb.onValue(r(`reveal/${index}`), (s) => cb((s.val() as Reveal | null) ?? null))),
    onAnswers: (index, cb) =>
      watch(
        fb.onValue(r(`answers/${index}`), (s) => cb((s.val() ?? {}) as Record<string, Answer>)),
      ),
    onHostHere: (cb) => watch(fb.onValue(r('hostHere'), (s) => cb(s.val() === true))),
    async create(game, secret) {
      const existing = await fb.get(r('game'));
      if (existing.exists()) throw new Error('taken');
      // Game first (the rules check the host from it), then the rest.
      await fb.set(r('game'), game);
      await fb.update(r(), {
        secret,
        state: { phase: 'lobby', index: 0, openedAt: 0 },
        ...touch,
      });
    },
    async readSecret() {
      const s = await fb.get(r('secret'));
      return (s.val() as Secret | null) ?? null;
    },
    async setState({ phase, index, stamp }) {
      await fb.update(r(), {
        state: { phase, index, openedAt: stamp ? fb.serverTimestamp() : 0 },
        ...touch,
      });
    },
    async finishQuestion(index, reveal, scores) {
      await fb.update(r(), {
        [`reveal/${index}`]: reveal,
        scores,
        'state/phase': 'reveal',
        ...touch,
      });
    },
    markHostHere() {
      const here = r('hostHere');
      watch(
        fb.onValue(fb.ref(db, '.info/connected'), (snap) => {
          if (snap.val() !== true) return;
          void fb
            .onDisconnect(here)
            .remove()
            .then(() => fb.set(here, true));
        }),
      );
    },
    async join(nick) {
      await fb.set(r(`players/${uid}`), nick.slice(0, 16));
    },
    async answer(index, choice) {
      await fb.set(r(`answers/${index}/${uid}`), { choice, at: fb.serverTimestamp() });
    },
    close() {
      offs.forEach((off) => off());
    },
  };
}
