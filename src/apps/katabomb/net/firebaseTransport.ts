import type { Database } from 'firebase/database';
import type { GameState } from '../logic/types';
import type { Intent } from './messages';
import { CHAT_HISTORY, type ChatMessage, type RoomTransport, type Unsubscribe } from './transport';

// Real rooms over Firebase Realtime Database.
//
//   rooms/katabomb/{CODE}/
//     state          full snapshot, only the host may write (rules check hostId)
//     intents/{id}   { from: uid, data, at } players' moves; host reads then deletes
//     typing/{uid}   live typing preview
//     presence/{uid} true while the tab is open; Firebase removes it on disconnect
//     chat/{id}      { from: uid, nick, text, at } room chat
//     updatedAt      for cleaning up old rooms
//
// See database.rules.json for who may read and write what.

type Db = typeof import('firebase/database');

export class FirebaseTransport implements RoomTransport {
  readonly kind = 'firebase' as const;
  private offset = 0;
  private unsubs: Unsubscribe[] = [];
  private base: string;

  private constructor(
    readonly code: string,
    readonly selfId: string,
    private db: Database,
    private fb: Db,
  ) {
    this.base = `rooms/katabomb/${code}`;
  }

  static async open(code: string): Promise<FirebaseTransport> {
    const [{ getFirebase }, fb] = await Promise.all([
      import('../../../lib/firebase'),
      import('firebase/database'),
    ]);
    const { db, uid } = await getFirebase();
    const t = new FirebaseTransport(code, uid, db, fb);
    t.start();
    return t;
  }

  private ref(path = '') {
    return this.fb.ref(this.db, path ? `${this.base}/${path}` : this.base);
  }

  private start() {
    const { onValue, onDisconnect, set, ref } = this.fb;
    // Clock offset so every device agrees on when the fuse runs out.
    this.unsubs.push(
      onValue(ref(this.db, '.info/serverTimeOffset'), (snap) => {
        this.offset = Number(snap.val()) || 0;
      }),
    );
    // Presence: mark online now and whenever the connection comes back.
    const me = this.ref(`presence/${this.selfId}`);
    this.unsubs.push(
      onValue(ref(this.db, '.info/connected'), (snap) => {
        if (snap.val() !== true) return;
        void onDisconnect(me)
          .remove()
          .then(() => set(me, true));
        void onDisconnect(this.ref(`typing/${this.selfId}`)).remove();
      }),
    );
  }

  now() {
    return Date.now() + this.offset;
  }

  onState(cb: (s: GameState | null) => void): Unsubscribe {
    const off = this.fb.onValue(this.ref('state'), (snap) => {
      cb(snap.exists() ? normalize(snap.val() as GameState) : null);
    });
    this.unsubs.push(off);
    return off;
  }

  publishState(state: GameState) {
    const { update, serverTimestamp } = this.fb;
    void update(this.ref(), { state, updatedAt: serverTimestamp() });
  }

  sendIntent(intent: Intent) {
    const { push, serverTimestamp } = this.fb;
    void push(this.ref('intents'), { from: this.selfId, data: intent, at: serverTimestamp() });
  }

  onIntent(cb: (from: string, data: unknown) => void): Unsubscribe {
    const { onChildAdded, remove } = this.fb;
    const off = onChildAdded(this.ref('intents'), (snap) => {
      const v = snap.val() as { from?: unknown; data?: unknown } | null;
      void remove(snap.ref);
      if (v && typeof v.from === 'string') cb(v.from, v.data);
    });
    this.unsubs.push(off);
    return off;
  }

  sendTyping(text: string) {
    void this.fb.set(this.ref(`typing/${this.selfId}`), text);
  }

  onTyping(cb: (from: string, text: string) => void): Unsubscribe {
    const off = this.fb.onValue(this.ref('typing'), (snap) => {
      const all = (snap.val() ?? {}) as Record<string, unknown>;
      for (const [id, text] of Object.entries(all)) {
        if (typeof text === 'string') cb(id, text);
      }
    });
    this.unsubs.push(off);
    return off;
  }

  sendChat(nick: string, text: string) {
    const { push, serverTimestamp } = this.fb;
    void push(this.ref('chat'), { from: this.selfId, nick, text, at: serverTimestamp() });
  }

  onChat(cb: (messages: ChatMessage[]) => void): Unsubscribe {
    const { onValue, query, limitToLast } = this.fb;
    const off = onValue(query(this.ref('chat'), limitToLast(CHAT_HISTORY)), (snap) => {
      const messages: ChatMessage[] = [];
      snap.forEach((child) => {
        const v = child.val() as Partial<ChatMessage>;
        if (typeof v.from === 'string' && typeof v.text === 'string') {
          messages.push({
            id: child.key ?? '',
            from: v.from,
            nick: String(v.nick ?? ''),
            text: v.text,
            at: Number(v.at) || 0,
          });
        }
      });
      cb(messages);
    });
    this.unsubs.push(off);
    return off;
  }

  onPresence(cb: (online: ReadonlySet<string>) => void): Unsubscribe {
    const off = this.fb.onValue(this.ref('presence'), (snap) => {
      cb(new Set(Object.keys((snap.val() ?? {}) as Record<string, unknown>)));
    });
    this.unsubs.push(off);
    return off;
  }

  close() {
    this.unsubs.forEach((off) => off());
    this.unsubs = [];
    void this.fb.remove(this.ref(`presence/${this.selfId}`));
    void this.fb.remove(this.ref(`typing/${this.selfId}`));
  }
}

/** Firebase drops empty arrays and nulls. Put them back so the rules code sees a full state. */
function normalize(s: GameState): GameState {
  return {
    ...s,
    players: (s.players ?? []).map((p) => ({
      ...p,
      longest: p.longest ?? '',
      outAt: p.outAt ?? null,
      streak: p.streak ?? 0,
      color: p.color ?? null,
      emoji: p.emoji ?? null,
    })),
    usedWords: s.usedWords ?? [],
    kicked: s.kicked ?? [],
    placements: s.placements ?? [],
    turn: s.turn ? { ...s.turn, solutions: s.turn.solutions ?? 0 } : null,
    matchStartedAt: s.matchStartedAt ?? 0,
    event: s.event ?? null,
  };
}
