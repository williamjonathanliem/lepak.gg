import { firebaseEnabled, getFirebase } from './firebase';

// "Vote for next" on planned apps. Stored in Realtime Database as
//   votes/{appId}/{uid}: true
// so each guest can vote once per app (rules check uid). Counts are public.

export interface VoteSnapshot {
  counts: Record<string, number>;
  mine: Set<string>;
}

export const votesEnabled = firebaseEnabled;

/** Live vote counts. Returns an unsubscribe function. */
export function watchVotes(cb: (snap: VoteSnapshot) => void): () => void {
  let off: (() => void) | null = null;
  let cancelled = false;
  void (async () => {
    const [{ db, uid }, { ref, onValue }] = await Promise.all([
      getFirebase(),
      import('firebase/database'),
    ]);
    if (cancelled) return;
    off = onValue(ref(db, 'votes'), (s) => {
      const all = (s.val() ?? {}) as Record<string, Record<string, unknown>>;
      const counts: Record<string, number> = {};
      const mine = new Set<string>();
      for (const [app, voters] of Object.entries(all)) {
        counts[app] = Object.keys(voters).length;
        if (uid in voters) mine.add(app);
      }
      cb({ counts, mine });
    });
  })().catch(() => {
    // offline or not configured: the vote buttons just stay hidden
  });
  return () => {
    cancelled = true;
    off?.();
  };
}

export async function setVote(appId: string, on: boolean): Promise<void> {
  const [{ db, uid }, { ref, set, remove }] = await Promise.all([
    getFirebase(),
    import('firebase/database'),
  ]);
  const r = ref(db, `votes/${appId}/${uid}`);
  await (on ? set(r, true) : remove(r));
}
