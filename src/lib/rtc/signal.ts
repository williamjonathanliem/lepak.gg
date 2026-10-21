// Signalling for direct device-to-device connections (Watch Together, Device Drop).
//
// Browsers can't find each other on their own, so they swap a few small setup messages
// (offer, answer, network candidates) through Firebase. After that, video and files go
// straight between the devices, not through us.
//
//   rtc/{CODE}/meta              { host: uid, app: 'watch' | 'drop' }   who started the room
//   rtc/{CODE}/peers/{uid}       { n: name }    while the page is open (removed on disconnect)
//   rtc/{CODE}/inbox/{uid}/{id}  { from, s, t, d }  setup messages for one person, read then deleted
//   rtc/{CODE}/chat/{id}         { from, n, text, at }   Watch Together chat
//   rtc/{CODE}/updatedAt         for cleaning up old rooms
//
// See database.rules.json: only you can read your inbox, and only the host can set meta.

export type RtcApp = 'watch' | 'drop';

export interface RoomMeta {
  host: string;
  app: RtcApp;
}

export interface SignalMessage {
  from: string;
  /** Session of the link this belongs to, so messages from an old page load are ignored. */
  s: string;
  t: string;
  d: unknown;
}

export interface ChatLine {
  id: string;
  from: string;
  n: string;
  text: string;
  at: number;
}

export interface Signal {
  readonly selfId: string;
  /** Become the host of this room (only works if nobody else is). */
  claimHost(app: RtcApp): Promise<void>;
  onMeta(cb: (meta: RoomMeta | null) => void, onError?: (e: Error) => void): () => void;
  /** Show up in the room under this name until the page closes. */
  join(name: string): void;
  onPeers(cb: (peers: Record<string, { n: string }>) => void): () => void;
  send(to: string, s: string, t: string, d: unknown): void;
  onMessage(cb: (msg: SignalMessage) => void): () => void;
  sendChat(name: string, text: string): void;
  onChat(cb: (lines: ChatLine[]) => void): () => void;
  close(): void;
}

export async function openSignal(code: string): Promise<Signal> {
  const [{ getFirebase }, fb] = await Promise.all([
    import('../firebase'),
    import('firebase/database'),
  ]);
  const { db, uid } = await getFirebase();
  const r = (path: string) => fb.ref(db, `rtc/${code}/${path}`);
  const offs: (() => void)[] = [];
  const watch = (off: () => void) => {
    offs.push(off);
    return off;
  };
  const inbox = r(`inbox/${uid}`);
  // Old setup messages from an earlier visit are useless now.
  await fb.remove(inbox).catch(() => undefined);
  let me: ReturnType<typeof r> | null = null;

  return {
    selfId: uid,
    async claimHost(app) {
      await fb.update(fb.ref(db, `rtc/${code}`), {
        meta: { host: uid, app },
        updatedAt: fb.serverTimestamp(),
      });
    },
    onMeta: (cb, onError) =>
      watch(
        fb.onValue(
          r('meta'),
          (s) => {
            const v = s.val() as Partial<RoomMeta> | null;
            cb(
              v?.host && (v.app === 'watch' || v.app === 'drop')
                ? { host: v.host, app: v.app }
                : null,
            );
          },
          onError,
        ),
      ),
    join(name) {
      me = r(`peers/${uid}`);
      const mine = me;
      watch(
        fb.onValue(fb.ref(db, '.info/connected'), (snap) => {
          if (snap.val() !== true) return;
          void fb
            .onDisconnect(mine)
            .remove()
            .then(() => fb.set(mine, { n: name.slice(0, 16) }));
        }),
      );
    },
    onPeers: (cb) =>
      watch(fb.onValue(r('peers'), (s) => cb((s.val() ?? {}) as Record<string, { n: string }>))),
    send(to, s, t, d) {
      void fb.push(r(`inbox/${to}`), { from: uid, s, t, d: JSON.stringify(d) });
    },
    onMessage: (cb) =>
      watch(
        fb.onChildAdded(inbox, (snap) => {
          void fb.remove(snap.ref);
          const v = snap.val() as { from?: unknown; s?: unknown; t?: unknown; d?: unknown } | null;
          if (!v || typeof v.from !== 'string' || typeof v.t !== 'string') return;
          let d: unknown;
          try {
            d = typeof v.d === 'string' ? JSON.parse(v.d) : null;
          } catch {
            return;
          }
          cb({ from: v.from, s: typeof v.s === 'string' ? v.s : '', t: v.t, d });
        }),
      ),
    sendChat(name, text) {
      void fb.push(r('chat'), {
        from: uid,
        n: name.slice(0, 16),
        text: text.slice(0, 200),
        at: fb.serverTimestamp(),
      });
    },
    onChat: (cb) =>
      watch(
        fb.onValue(fb.query(r('chat'), fb.limitToLast(50)), (s) => {
          const all = (s.val() ?? {}) as Record<string, Omit<ChatLine, 'id'>>;
          cb(Object.entries(all).map(([id, l]) => ({ ...l, id })));
        }),
      ),
    close() {
      offs.forEach((off) => off());
      if (me) void fb.remove(me);
    },
  };
}
