// Live bingo games over Firebase Realtime Database.
//
//   bingo/{CODE}/game            { hostId, numbers, items[], called[], winners[], updatedAt }  host only
//   bingo/{CODE}/players/{uid}   nickname                                                  each player
//   bingo/{CODE}/claims/{uid}    { nick, at }  a "Bingo!" claim, checked by the host       each player
//
// See database.rules.json for who may write what.

export interface Winner {
  uid: string;
  nick: string;
}

export interface Game {
  hostId: string;
  numbers: boolean;
  items: string[];
  called: string[];
  winners: Winner[];
}

export interface Claim {
  uid: string;
  nick: string;
  at: number;
}

export interface BingoRoom {
  selfId: string;
  onGame(cb: (g: Game | null) => void): () => void;
  onPlayers(cb: (players: Record<string, string>) => void): () => void;
  onClaims(cb: (claims: Claim[]) => void): () => void;
  /** Host: create or replace the game. */
  saveGame(g: Game): Promise<void>;
  join(nick: string): Promise<void>;
  claim(nick: string): Promise<void>;
  /** Host: remove a claim once it has been checked. */
  clearClaim(uid: string): Promise<void>;
  close(): void;
}

export async function openBingo(code: string): Promise<BingoRoom> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../../../lib/firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const r = (path = '') => fb.ref(db, `bingo/${code}${path ? `/${path}` : ''}`);
  const offs: (() => void)[] = [];
  const watch = (off: () => void) => {
    offs.push(off);
    return off;
  };

  return {
    selfId: uid,
    onGame: (cb) =>
      watch(
        fb.onValue(r('game'), (s) => {
          const v = s.val() as Partial<Game> | null;
          cb(
            v
              ? {
                  hostId: v.hostId ?? '',
                  numbers: !!v.numbers,
                  items: v.items ?? [],
                  called: v.called ?? [],
                  winners: v.winners ?? [],
                }
              : null,
          );
        }),
      ),
    onPlayers: (cb) =>
      watch(fb.onValue(r('players'), (s) => cb((s.val() ?? {}) as Record<string, string>))),
    onClaims: (cb) =>
      watch(
        fb.onValue(r('claims'), (s) => {
          const all = (s.val() ?? {}) as Record<string, { nick?: string; at?: number }>;
          cb(
            Object.entries(all).map(([id, c]) => ({ uid: id, nick: c.nick ?? '', at: c.at ?? 0 })),
          );
        }),
      ),
    async saveGame(g) {
      await fb.update(r(), { game: g, updatedAt: fb.serverTimestamp() });
    },
    async join(nick) {
      const me = r(`players/${uid}`);
      await fb.set(me, nick.slice(0, 16));
    },
    async claim(nick) {
      await fb.set(r(`claims/${uid}`), { nick: nick.slice(0, 16), at: fb.serverTimestamp() });
    },
    async clearClaim(id) {
      await fb.remove(r(`claims/${id}`));
    },
    close() {
      offs.forEach((off) => off());
    },
  };
}
