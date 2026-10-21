import { useCallback, useEffect, useRef, useState } from 'react';
import { PeerLink, linkQuality, newSession, readStats, type Quality } from '../../../lib/rtc/link';
import { openSignal, type Signal } from '../../../lib/rtc/signal';
import { useGoneFor } from '../../../lib/useGoneFor';
import {
  Assembler,
  CHUNK_BYTES,
  HIGH_WATER,
  LOW_WATER,
  MAX_TEXT,
  deviceName,
  parseControl,
  safeName,
  type Control,
  type Item,
} from '../logic/transfer';

// Two devices, one room. The one who opened it ("host") waits; the other says hello and
// the host sets up a direct connection with a data channel. Files then go straight
// between the two devices, in chunks, one at a time.

export type DropStatus =
  | 'connecting' // talking to the server
  | 'waiting' // host: nobody else here yet
  | 'linking' // setting up the direct connection
  | 'connected'
  | 'lost' // the direct connection dropped
  | 'not-found'
  | 'full'
  | 'blocked' // the server said no (database rules not set up)
  | 'closed' // the device that started the drop left
  | 'error';

export interface DropItem extends Item {
  /** Received file, ready to save. */
  url?: string;
}

const UI_EVERY_MS = 150;

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useDrop(code: string, create: boolean) {
  const [status, setStatus] = useState<DropStatus>('connecting');
  const [otherName, setOtherName] = useState<string | null>(null);
  const [quality, setQuality] = useState<Quality>('unknown');
  const [items, setItems] = useState<DropItem[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hostHere, setHostHere] = useState(true);
  const hostGone = useGoneFor(isHost || hostHere);

  const signal = useRef<Signal | null>(null);
  const link = useRef<{ peer: string; session: string; pc: PeerLink } | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const itemsRef = useRef<DropItem[]>([]);
  const queue = useRef<{ id: string; file?: File; text?: string }[]>([]);
  const sending = useRef(false);
  const cancelled = useRef(new Set<string>());
  const assembler = useRef(new Assembler());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urls = useRef<string[]>([]);

  // Items change very often while sending; only re-render a few times a second.
  const flush = useCallback((now = false) => {
    if (now) {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = null;
      setItems([...itemsRef.current]);
      return;
    }
    flushTimer.current ??= setTimeout(() => {
      flushTimer.current = null;
      setItems([...itemsRef.current]);
    }, UI_EVERY_MS);
  }, []);

  const patch = useCallback(
    (id: string, change: Partial<DropItem>, now = false) => {
      itemsRef.current = itemsRef.current.map((i) => (i.id === id ? { ...i, ...change } : i));
      flush(now);
    },
    [flush],
  );

  const add = useCallback(
    (item: DropItem) => {
      itemsRef.current = [item, ...itemsRef.current];
      flush(true);
    },
    [flush],
  );

  // ---- sending, one item at a time ----
  const pump = useCallback(async () => {
    const dc = channel.current;
    if (sending.current || !dc || dc.readyState !== 'open') return;
    sending.current = true;
    try {
      while (queue.current.length && dc.readyState === 'open') {
        const job = queue.current.shift()!;
        if (cancelled.current.has(job.id)) continue;
        const sendControl = (c: Control) => dc.send(JSON.stringify(c));
        if (job.text !== undefined) {
          sendControl({ t: 'text', id: job.id, text: job.text });
          patch(job.id, { status: 'done', done: job.text.length }, true);
          continue;
        }
        const file = job.file!;
        patch(job.id, { status: 'sending', startedAt: Date.now() }, true);
        sendControl({ t: 'file', id: job.id, name: file.name, size: file.size, mime: file.type });
        const max = Math.min(CHUNK_BYTES, link.current?.pc.pc.sctp?.maxMessageSize || CHUNK_BYTES);
        let offset = 0;
        let stopped = false;
        while (offset < file.size) {
          if (cancelled.current.has(job.id) || dc.readyState !== 'open') {
            stopped = true;
            break;
          }
          if (dc.bufferedAmount > HIGH_WATER) {
            await new Promise<void>((resolve) => {
              dc.bufferedAmountLowThreshold = LOW_WATER;
              dc.addEventListener('bufferedamountlow', () => resolve(), { once: true });
              dc.addEventListener('close', () => resolve(), { once: true });
            });
            continue;
          }
          const part = await file.slice(offset, offset + max).arrayBuffer();
          dc.send(part);
          offset += part.byteLength;
          patch(job.id, { done: offset });
        }
        if (stopped) {
          if (dc.readyState === 'open') sendControl({ t: 'cancel', id: job.id });
          patch(job.id, { status: cancelled.current.has(job.id) ? 'cancelled' : 'failed' }, true);
        } else {
          sendControl({ t: 'end', id: job.id });
          patch(job.id, { status: 'done', done: file.size }, true);
        }
      }
    } catch {
      // channel broke mid-send; the status below shows it
    } finally {
      sending.current = false;
    }
  }, [patch]);

  // ---- receiving ----
  const onChannel = useCallback(
    (dc: RTCDataChannel) => {
      dc.binaryType = 'arraybuffer';
      channel.current = dc;
      dc.onopen = () => {
        setStatus('connected');
        void pump();
      };
      dc.onclose = () => {
        if (channel.current === dc) {
          channel.current = null;
          setStatus('lost');
          // Anything half-received is gone.
          itemsRef.current = itemsRef.current.map((i) =>
            i.status === 'sending' || (i.status === 'waiting' && i.dir === 'out')
              ? { ...i, status: i.dir === 'out' && i.status === 'waiting' ? 'waiting' : 'failed' }
              : i,
          );
          flush(true);
        }
      };
      dc.onmessage = (e: MessageEvent<string | ArrayBuffer>) => {
        if (typeof e.data !== 'string') {
          const r = assembler.current.chunk(e.data);
          if (r) patch(r.id, { done: r.got });
          return;
        }
        const c = parseControl(e.data);
        if (!c) return;
        const r = assembler.current.control(c);
        if (r.type === 'start') {
          add({
            id: r.id,
            dir: 'in',
            kind: 'file',
            name: r.name,
            size: r.size,
            mime: r.mime,
            done: 0,
            status: 'sending',
            startedAt: Date.now(),
          });
        } else if (r.type === 'file') {
          const url = URL.createObjectURL(r.blob);
          urls.current.push(url);
          patch(r.id, { status: 'done', done: r.blob.size, url }, true);
        } else if (r.type === 'text') {
          add({
            id: r.id,
            dir: 'in',
            kind: 'text',
            name: 'Text',
            size: r.text.length,
            mime: 'text/plain',
            done: r.text.length,
            status: 'done',
            startedAt: Date.now(),
            text: r.text,
          });
        } else if (r.type === 'cancel') {
          patch(r.id, { status: 'cancelled' }, true);
        }
      };
      if (dc.readyState === 'open') dc.onopen(new Event('open'));
    },
    [add, flush, patch, pump],
  );

  // ---- connect ----
  useEffect(() => {
    let closed = false;
    let s: Signal | null = null;
    const offs: (() => void)[] = [];
    const mySession = newSession();

    const newLink = (peer: string, session: string, initiator: boolean) => {
      link.current?.pc.close();
      const pc = new PeerLink({
        initiator,
        send: (t, d) => s?.send(peer, session, t, d),
        onState: (state) => {
          if (link.current?.pc !== pc) return;
          if (state === 'failed') setStatus('lost');
        },
      });
      link.current = { peer, session, pc };
      return pc;
    };

    openSignal(code)
      .then(async (opened) => {
        if (closed) return opened.close();
        s = opened;
        signal.current = opened;
        if (create) await opened.claimHost('drop');
        opened.join(deviceName(navigator.userAgent));
        let started = false;
        let hostId: string | null = null;
        offs.push(
          opened.onMeta(
            (meta) => {
              if (!meta || meta.app !== 'drop') {
                if (!create) setStatus('not-found');
                return;
              }
              const host = meta.host === opened.selfId;
              hostId = meta.host;
              setIsHost(host);
              if (started) return;
              started = true;
              if (host) setStatus('waiting');
              else {
                setStatus('linking');
                newLink(meta.host, mySession, false);
                opened.send(meta.host, mySession, 'hello', {});
              }
            },
            (e) => setStatus(/permission/i.test(e.message) ? 'blocked' : 'error'),
          ),
        );
        offs.push(
          opened.onPeers((peers) => {
            const other = Object.entries(peers).find(([id]) => id !== opened.selfId);
            setOtherName(other ? other[1].n : null);
            if (hostId) setHostHere(!!peers[hostId]);
          }),
        );
        offs.push(
          opened.onMessage((msg) => {
            if (msg.t === 'hello') {
              // Host: someone wants in. One other device at a time.
              const cur = link.current;
              if (cur && cur.peer !== msg.from && cur.pc.pc.connectionState === 'connected') {
                opened.send(msg.from, msg.s, 'full', {});
                return;
              }
              setStatus('linking');
              const pc = newLink(msg.from, msg.s, true);
              onChannel(pc.pc.createDataChannel('drop', { ordered: true }));
              void pc.start();
              return;
            }
            if (msg.t === 'full') {
              setStatus('full');
              return;
            }
            const cur = link.current;
            if (!cur || cur.peer !== msg.from || cur.session !== msg.s) return;
            if (!cur.pc.pc.ondatachannel) cur.pc.pc.ondatachannel = (e) => onChannel(e.channel);
            void cur.pc.handle(msg.t, msg.d);
          }),
        );
      })
      .catch((e: unknown) => {
        if (closed) return;
        setStatus(/permission/i.test(String(e)) ? 'blocked' : 'error');
      });

    return () => {
      closed = true;
      offs.forEach((off) => off());
      link.current?.pc.close();
      link.current = null;
      channel.current = null;
      s?.close();
      signal.current = null;
    };
  }, [code, create, retry, onChannel]);

  // Free received files when leaving.
  useEffect(
    () => () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    [],
  );

  // Connection badge.
  useEffect(() => {
    if (status !== 'connected') return;
    const id = setInterval(() => {
      const pc = link.current?.pc.pc;
      if (pc) void readStats(pc).then((st) => setQuality(linkQuality(st)));
    }, 2000);
    return () => clearInterval(id);
  }, [status]);

  return {
    status: hostGone && status !== 'not-found' ? ('closed' as const) : status,
    isHost,
    otherName,
    quality,
    items,
    sendFiles(files: Iterable<File>) {
      for (const file of files) {
        const id = makeId();
        queue.current.push({ id, file });
        add({
          id,
          dir: 'out',
          kind: 'file',
          name: safeName(file.name),
          size: file.size,
          mime: file.type,
          done: 0,
          status: 'waiting',
          startedAt: Date.now(),
        });
      }
      void pump();
    },
    sendText(text: string) {
      const clean = text.slice(0, MAX_TEXT);
      if (!clean.trim()) return;
      const id = makeId();
      queue.current.push({ id, text: clean });
      add({
        id,
        dir: 'out',
        kind: 'text',
        name: 'Text',
        size: clean.length,
        mime: 'text/plain',
        done: 0,
        status: 'waiting',
        startedAt: Date.now(),
        text: clean,
      });
      void pump();
    },
    cancel(id: string) {
      cancelled.current.add(id);
      queue.current = queue.current.filter((j) => j.id !== id);
      patch(id, { status: 'cancelled' }, true);
    },
    reconnect() {
      setStatus('connecting');
      setRetry((n) => n + 1);
    },
  };
}
