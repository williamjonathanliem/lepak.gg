import { useCallback, useEffect, useRef, useState } from 'react';
import { censorText } from '../../../lib/profanity';
import { PeerLink, linkQuality, newSession, readStats, type Quality } from '../../../lib/rtc/link';
import { openSignal, type ChatLine, type Signal } from '../../../lib/rtc/signal';
import { useGoneFor } from '../../../lib/useGoneFor';
import { MAX_VIEWERS, MODES, bitrateFor, type Mode } from '../logic/modes';

// Watch Together. The host captures a screen, tab or camera and sends it straight to each
// viewer (one direct connection per viewer). Viewers only receive.
//
// Setup messages (through Firebase): viewer -> host 'hello' (with a fresh session id),
// host -> viewer 'reset' (new connection coming) / 'offer' / 'ice', viewer -> host 'answer' / 'ice',
// host -> viewer 'stopped' / 'full'.

export type WatchStatus =
  | 'connecting'
  | 'ready'
  | 'not-found'
  | 'full'
  | 'blocked'
  | 'closed' // the host left
  | 'error';

/** Which incoming stream is which, sent by the host before each new connection. */
interface Layout {
  cam: string | null;
  mic: string | null;
}

export interface Viewer {
  id: string;
  name: string;
  quality: Quality;
}

interface ViewerLink {
  session: string;
  link: PeerLink | null;
}

function isBlocked(e: unknown) {
  return /permission/i.test(String(e));
}

export function useWatch(code: string, create: boolean, nickname: string) {
  const [status, setStatus] = useState<WatchStatus>('connecting');
  const [isHost, setIsHost] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [hostHere, setHostHere] = useState(true);
  const [peers, setPeers] = useState<Record<string, { n: string }>>({});
  const [chat, setChat] = useState<ChatLine[]>([]);
  // host
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cam, setCam] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState<MediaStream | null>(null);
  const [mode, setModeState] = useState<Mode>('movie');
  const [qualities, setQualities] = useState<Record<string, Quality>>({});
  // viewer
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [remoteCam, setRemoteCam] = useState<MediaStream | null>(null);
  const [remoteMic, setRemoteMic] = useState<MediaStream | null>(null);
  const [quality, setQuality] = useState<Quality>('unknown');

  const signal = useRef<Signal | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const camRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const layout = useRef<Layout>({ cam: null, mic: null }); // viewer side
  const modeRef = useRef<Mode>('movie');
  const viewers = useRef(new Map<string, ViewerLink>()); // host side
  const hostLink = useRef<{ host: string; session: string; link: PeerLink | null } | null>(null); // viewer side

  /** Host: tune what we send to one viewer for the current mode and audience size. */
  const tune = useCallback(async (link: PeerLink) => {
    const m = MODES[modeRef.current];
    const count = Math.max(1, [...viewers.current.values()].filter((v) => v.link).length);
    const camTrack = camRef.current?.getVideoTracks()[0];
    for (const sender of link.pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      const isCam = sender.track === camTrack;
      const params = sender.getParameters();
      params.encodings = params.encodings?.length ? params.encodings : [{}];
      // The face bubble is small, so it gets a small slice of the upload.
      params.encodings[0]!.maxBitrate = isCam ? 300_000 : bitrateFor(modeRef.current, count);
      params.encodings[0]!.maxFramerate = isCam ? 24 : m.fps;
      await sender.setParameters(params).catch(() => undefined);
    }
  }, []);

  /** Host: (re)connect one viewer with the current stream. */
  const connectViewer = useCallback(
    (id: string, session: string) => {
      const s = signal.current;
      const media = streamRef.current;
      const entry = viewers.current.get(id);
      entry?.link?.close();
      if (!s || !media) {
        viewers.current.set(id, { session, link: null });
        return;
      }
      const link = new PeerLink({ initiator: true, send: (t, d) => s.send(id, session, t, d) });
      for (const extra of [media, camRef.current, micRef.current]) {
        if (extra) for (const track of extra.getTracks()) link.pc.addTrack(track, extra);
      }
      viewers.current.set(id, { session, link });
      // Tell the viewer a brand new connection is coming, and which stream is the camera / mic.
      const sent: Layout = { cam: camRef.current?.id ?? null, mic: micRef.current?.id ?? null };
      s.send(id, session, 'reset', sent);
      void tune(link).then(() => link.start());
    },
    [tune],
  );

  // ---- connect ----
  useEffect(() => {
    let closed = false;
    let s: Signal | null = null;
    const offs: (() => void)[] = [];
    const viewerMap = viewers.current;

    const helloHost = (host: string) => {
      const session = newSession();
      hostLink.current?.link?.close();
      hostLink.current = { host, session, link: null };
      setRemote(null);
      setRemoteCam(null);
      setRemoteMic(null);
      s?.send(host, session, 'hello', {});
    };

    openSignal(code)
      .then(async (opened) => {
        if (closed) return opened.close();
        s = opened;
        signal.current = opened;
        setSelfId(opened.selfId);
        if (create) await opened.claimHost('watch');
        opened.join(nickname);
        let knownHost: string | null = null;
        let hostPresent = false;

        offs.push(
          opened.onMeta(
            (meta) => {
              if (!meta || meta.app !== 'watch') {
                if (!create) setStatus('not-found');
                return;
              }
              const host = meta.host === opened.selfId;
              setIsHost(host);
              setStatus('ready');
              if (knownHost === meta.host) return;
              knownHost = meta.host;
              if (!host) helloHost(meta.host);
            },
            (e) => setStatus(isBlocked(e) ? 'blocked' : 'error'),
          ),
        );

        offs.push(
          opened.onPeers((all) => {
            setPeers(all);
            if (!knownHost || knownHost === opened.selfId) {
              // Host: forget viewers who left.
              for (const id of [...viewerMap.keys()]) {
                if (!all[id]) {
                  viewerMap.get(id)?.link?.close();
                  viewerMap.delete(id);
                }
              }
              return;
            }
            const present = !!all[knownHost];
            setHostHere(present);
            // Host came back (e.g. refreshed): say hello again.
            if (present && !hostPresent) helloHost(knownHost);
            hostPresent = present;
          }),
        );

        offs.push(
          opened.onMessage((msg) => {
            // ---- host side ----
            if (msg.t === 'hello') {
              const known = viewerMap.has(msg.from);
              if (!known && viewerMap.size >= MAX_VIEWERS) {
                opened.send(msg.from, msg.s, 'full', {});
                return;
              }
              connectViewer(msg.from, msg.s);
              return;
            }
            const v = viewerMap.get(msg.from);
            if (v && v.session === msg.s) {
              void v.link?.handle(msg.t, msg.d);
              return;
            }
            // ---- viewer side ----
            const h = hostLink.current;
            if (!h || h.host !== msg.from || h.session !== msg.s) return;
            if (msg.t === 'full') return setStatus('full');
            if (msg.t === 'reset') {
              h.link?.close();
              h.link = null;
              const d = (msg.d ?? {}) as Partial<Layout>;
              layout.current = {
                cam: typeof d.cam === 'string' ? d.cam : null,
                mic: typeof d.mic === 'string' ? d.mic : null,
              };
              return;
            }
            if (msg.t === 'stopped') {
              h.link?.close();
              h.link = null;
              setRemote(null);
              setRemoteCam(null);
              setRemoteMic(null);
              return;
            }
            if (msg.t === 'offer') {
              // First offer of a new connection (a retry reuses the same one).
              if (!h.link) {
                const link = new PeerLink({
                  initiator: false,
                  send: (t, d) => opened.send(h.host, h.session, t, d),
                });
                setRemoteCam(null);
                setRemoteMic(null);
                link.pc.ontrack = (e) => {
                  const st = e.streams[0] ?? new MediaStream([e.track]);
                  if (st.id === layout.current.cam) setRemoteCam(st);
                  else if (st.id === layout.current.mic) setRemoteMic(st);
                  else setRemote(st);
                };
                h.link = link;
              }
            }
            void h.link?.handle(msg.t, msg.d);
          }),
        );

        offs.push(opened.onChat(setChat));
      })
      .catch((e: unknown) => !closed && setStatus(isBlocked(e) ? 'blocked' : 'error'));

    return () => {
      closed = true;
      offs.forEach((off) => off());
      viewerMap.forEach((v) => v.link?.close());
      viewerMap.clear();
      hostLink.current?.link?.close();
      hostLink.current = null;
      for (const r of [streamRef, camRef, micRef]) {
        r.current?.getTracks().forEach((t) => t.stop());
        r.current = null;
      }
      s?.close();
      signal.current = null;
    };
  }, [code, create, nickname, connectViewer]);

  // ---- connection badges ----
  useEffect(() => {
    if (status !== 'ready') return;
    const id = setInterval(() => {
      if (isHost) {
        const entries = [...viewers.current.entries()].filter(([, v]) => v.link);
        void Promise.all(
          entries.map(async ([vid, v]) => [vid, linkQuality(await readStats(v.link!.pc))] as const),
        ).then((pairs) => setQualities(Object.fromEntries(pairs)));
      } else {
        const pc = hostLink.current?.link?.pc;
        if (pc) void readStats(pc).then((st) => setQuality(linkQuality(st)));
      }
    }, 2000);
    return () => clearInterval(id);
  }, [status, isHost]);

  // ---- host actions ----
  const stopShare = useCallback(() => {
    for (const r of [streamRef, camRef, micRef]) {
      r.current?.getTracks().forEach((t) => t.stop());
      r.current = null;
    }
    setStream(null);
    setCam(null);
    setMic(null);
    for (const [id, v] of viewers.current) {
      v.link?.close();
      viewers.current.set(id, { session: v.session, link: null });
      signal.current?.send(id, v.session, 'stopped', {});
    }
  }, []);

  const startShare = useCallback(
    async (source: 'screen' | 'camera') => {
      const m = MODES[modeRef.current];
      const media =
        source === 'screen'
          ? await navigator.mediaDevices.getDisplayMedia({
              video: { frameRate: { ideal: m.fps, max: m.fps }, height: { ideal: m.height } },
              audio: true,
            })
          : await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'environment',
                frameRate: { ideal: 30 },
                height: { ideal: 720 },
              },
              audio: true,
            });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      for (const t of media.getVideoTracks()) t.contentHint = m.contentHint;
      for (const t of media.getAudioTracks()) t.contentHint = m.audioHint;
      streamRef.current = media;
      setStream(media);
      // The browser's own "Stop sharing" button.
      media.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current === media) stopShare();
      });
      for (const [id, v] of viewers.current) connectViewer(id, v.session);
    },
    [connectViewer, stopShare],
  );

  /** Host: turn the camera bubble or the mic on/off while sharing. Viewers reconnect for a second. */
  const toggleExtra = useCallback(
    async (kind: 'cam' | 'mic') => {
      const ref = kind === 'cam' ? camRef : micRef;
      const set = kind === 'cam' ? setCam : setMic;
      if (ref.current) {
        ref.current.getTracks().forEach((t) => t.stop());
        ref.current = null;
        set(null);
      } else {
        const media = await navigator.mediaDevices.getUserMedia(
          kind === 'cam'
            ? { video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } } }
            : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
        );
        for (const t of media.getAudioTracks()) t.contentHint = 'speech';
        ref.current = media;
        set(media);
      }
      if (streamRef.current) {
        for (const [id, v] of viewers.current) connectViewer(id, v.session);
      }
    },
    [connectViewer],
  );

  const setMode = useCallback(
    (next: Mode) => {
      modeRef.current = next;
      setModeState(next);
      const media = streamRef.current;
      if (!media) return;
      const m = MODES[next];
      for (const t of media.getVideoTracks()) {
        t.contentHint = m.contentHint;
        void t
          .applyConstraints({
            frameRate: { ideal: m.fps, max: m.fps },
            height: { ideal: m.height },
          })
          .catch(() => undefined);
      }
      for (const v of viewers.current.values()) if (v.link) void tune(v.link);
    },
    [tune],
  );

  // Viewers: the host closed the tab and didn't come back in time, so the room is over.
  const hostGone = useGoneFor(isHost || hostHere || status !== 'ready');

  const viewerList: Viewer[] = Object.entries(peers)
    .filter(([id]) => id !== selfId)
    .map(([id, p]) => ({ id, name: p.n, quality: qualities[id] ?? 'unknown' }));

  return {
    status: hostGone ? ('closed' as const) : status,
    isHost,
    selfId,
    hostHere,
    viewers: viewerList,
    chat,
    // host
    stream,
    mode,
    setMode,
    startShare,
    stopShare,
    cam,
    mic,
    toggleCam: () => toggleExtra('cam'),
    toggleMic: () => toggleExtra('mic'),
    // viewer
    remote,
    remoteCam,
    remoteMic,
    quality,
    sendChat(text: string) {
      const clean = censorText(text.trim()).slice(0, 200);
      if (clean) signal.current?.sendChat(nickname, clean);
    },
  };
}
