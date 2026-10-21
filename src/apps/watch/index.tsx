import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { firebaseEnabled } from '../../lib/firebase';
import { QUALITY_LABEL, type Quality } from '../../lib/rtc/link';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import { NicknameGate } from '../katabomb/ui/NicknameGate';
import { MAX_VIEWERS, MODES, type Mode } from './logic/modes';
import { useWatch } from './net/useWatch';
import { AppHeader } from '../../components/AppHeader';

// Watch Together: /watch (home), /watch/r/:code (room). The host shares a screen, tab or
// camera; up to MAX_VIEWERS friends watch live with about half a second of delay.

const ACCENT = '#ff8fd0';

export default function Watch() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Watch Together', to: '/watch', accent: ACCENT }} />
      <Routes>
        <Route index element={<Home />} />
        <Route path="r/:code" element={<RoomRoute />} />
      </Routes>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function join(e: FormEvent) {
    e.preventDefault();
    if (!isValidRoomCode(code)) return setError('Codes are 4 letters or numbers.');
    navigate(`/watch/r/${normalizeRoomCode(code)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Watch Together · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Watch Together.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          Share your screen, a tab or your camera with up to {MAX_VIEWERS} friends. Games, movie
          nights, going through notes. They watch in the browser, no app needed.
        </p>
      </div>
      {!firebaseEnabled && (
        <p className="m-0 font-mono text-sm">
          Watch Together needs the Lepak server, which this copy is not set up for.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <section
          className="flex flex-col gap-3 border-3 border-ink p-5 shadow-hard"
          style={{ background: ACCENT }}
        >
          <h2 className="m-0 text-2xl font-black uppercase">Share something</h2>
          <p className="m-0">Open a room, send the code, then pick what to share.</p>
          <button
            type="button"
            disabled={!firebaseEnabled}
            onClick={() => navigate(`/watch/r/${generateRoomCode()}`, { state: { create: true } })}
            className="push mt-auto h-14 cursor-pointer self-start border-3 border-ink bg-ink px-6 font-mono font-bold text-paper uppercase shadow-hard disabled:opacity-40"
          >
            Open a room
          </button>
        </section>
        <form noValidate onSubmit={join} className="flex flex-col gap-3 border-3 border-ink p-5">
          <h2 className="m-0 text-2xl font-black uppercase">Watch</h2>
          <label htmlFor="w-code" className="font-mono text-xs uppercase">
            Code from your friend
          </label>
          <div className="flex">
            <input
              id="w-code"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="KJRW"
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              className="h-14 w-32 border-3 border-ink bg-paper px-3 font-mono text-xl tracking-[0.25em] uppercase"
            />
            <button
              type="submit"
              className="h-14 cursor-pointer border-3 border-l-0 border-ink bg-ink px-5 font-mono font-bold text-paper uppercase"
            >
              Join
            </button>
          </div>
          <p role="alert" className="m-0 min-h-6 font-mono text-sm font-bold">
            {error ? `! ${error}` : ''}
          </p>
        </form>
      </div>
      <p className="m-0 font-mono text-xs text-mute">
        Sharing your screen works on computers (Chrome, Edge, Firefox, Safari). On phones you can
        share your camera. Some school networks block direct connections; mobile data usually works.
      </p>
    </main>
  );
}

function RoomRoute() {
  const { code: raw = '' } = useParams();
  const code = normalizeRoomCode(raw);
  const create = (useLocation().state as { create?: boolean } | null)?.create === true;
  if (!isValidRoomCode(code)) return <Navigate to="/watch" replace />;
  if (code !== raw) return <Navigate to={`/watch/r/${code}`} replace />;
  return (
    <NicknameGate>
      {(nick) => <Room key={code} code={code} create={create} nickname={nick} />}
    </NicknameGate>
  );
}

type WatchRoom = ReturnType<typeof useWatch>;

function Room({ code, create, nickname }: { code: string; create: boolean; nickname: string }) {
  const w = useWatch(code, create, nickname);

  const problem: Partial<Record<WatchRoom['status'], string>> = {
    connecting: 'Connecting...',
    'not-found': `No room with code ${code}. It may have closed.`,
    full: `This room is full (${MAX_VIEWERS} watching).`,
    closed: 'The host left, so the room closed. Thanks for watching!',
    blocked:
      "The Lepak server isn't set up for Watch Together yet (database rules missing). Ask whoever runs this site to publish them.",
    error: 'Could not reach the server. Check your internet and try again.',
  };
  const text = problem[w.status];
  if (text) {
    return (
      <main className="flex flex-1 flex-col items-start gap-6 px-gutter py-16">
        <p role="status" className="m-0 font-mono text-lg">
          {text}
        </p>
        {w.status !== 'connecting' && (
          <Link to="/watch" className="inline-flex min-h-11 items-center font-mono underline">
            Back to Watch Together
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="grid flex-1 gap-[3px] bg-ink lg:grid-cols-[1fr_340px]">
      <title>{`Watch ${code} · Lepak.gg`}</title>
      <section className="flex min-w-0 flex-col bg-night text-paper">
        {w.isHost ? <HostStage w={w} code={code} /> : <ViewerStage w={w} />}
      </section>
      <aside className="flex min-h-80 flex-col bg-paper">
        <People w={w} code={code} />
        <ChatPanel w={w} />
      </aside>
    </main>
  );
}

// ---------- shared bits ----------

/** Plays a stream in a <video> or <audio>, keeping srcObject in sync. */
function useStream<T extends HTMLMediaElement>(stream: MediaStream | null) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);
  return ref;
}

/** Press F to go fullscreen (and again to leave), unless you're typing. */
function useFullscreenKey(box: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      toggleFullscreen(box.current);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [box]);
}

function toggleFullscreen(el: HTMLElement | null) {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el?.requestFullscreen?.();
}

/** The host's face, small, in the corner of the screen share. */
function CamBubble({ stream, mirror }: { stream: MediaStream; mirror?: boolean }) {
  const ref = useStream<HTMLVideoElement>(stream);
  return (
    <video
      ref={ref}
      autoPlay
      muted
      playsInline
      aria-label="Host camera"
      className={`absolute right-3 bottom-3 z-10 aspect-[4/3] w-[clamp(110px,22%,260px)] border-3 border-paper bg-ink object-cover shadow-[5px_5px_0_rgb(0_0_0/0.5)] ${mirror ? '-scale-x-100' : ''}`}
    />
  );
}

const DARK_BUTTON =
  'min-h-11 cursor-pointer border-2 border-paper bg-transparent px-3 font-mono text-sm font-bold text-paper uppercase';

// ---------- host ----------

function HostStage({ w, code }: { w: WatchRoom; code: string }) {
  const video = useStream<HTMLVideoElement>(w.stream);
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const canScreen = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  useFullscreenKey(box);

  async function share(source: 'screen' | 'camera') {
    setError(null);
    try {
      await w.startShare(source);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name !== 'NotAllowedError' && name !== 'AbortError') setError('Could not start sharing.');
    }
  }

  async function toggle(kind: 'cam' | 'mic') {
    setError(null);
    try {
      await (kind === 'cam' ? w.toggleCam() : w.toggleMic());
    } catch {
      setError(
        kind === 'cam'
          ? 'Could not turn on the camera. Check the browser allowed it.'
          : 'Could not turn on the mic. Check the browser allowed it.',
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div ref={box} className="relative flex flex-1 items-center justify-center bg-black">
        {w.stream ? (
          <>
            <video
              ref={video}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 size-full object-contain"
            />
            {w.cam && <CamBubble stream={w.cam} mirror />}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <p className="m-0 text-2xl font-black uppercase">Pick what to share</p>
            <p className="m-0 font-mono text-sm text-paper/60">
              Room code <b className="tracking-[0.2em] text-paper">{code}</b>
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {canScreen && (
                <button
                  type="button"
                  onClick={() => void share('screen')}
                  className="push h-14 cursor-pointer border-3 border-paper px-6 font-mono font-bold text-ink uppercase"
                  style={{ background: ACCENT }}
                >
                  Share screen
                </button>
              )}
              <button
                type="button"
                onClick={() => void share('camera')}
                className="h-14 cursor-pointer border-3 border-paper bg-transparent px-6 font-mono font-bold text-paper uppercase"
              >
                Share camera
              </button>
            </div>
            <p className="m-0 max-w-sm font-mono text-xs text-paper/60">
              Tip: to share sound from a video, share a browser tab and tick "Share tab audio".
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-paper/15 px-4 py-3">
        <ModePicker mode={w.mode} onChange={w.setMode} />
        {w.stream && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={!!w.mic}
              onClick={() => void toggle('mic')}
              className={`${DARK_BUTTON} ${w.mic ? 'bg-paper! text-ink!' : ''}`}
            >
              {w.mic ? '🎙 Mic on' : '🎙 Mic off'}
            </button>
            <button
              type="button"
              aria-pressed={!!w.cam}
              onClick={() => void toggle('cam')}
              className={`${DARK_BUTTON} ${w.cam ? 'bg-paper! text-ink!' : ''}`}
            >
              {w.cam ? '📷 Cam on' : '📷 Cam off'}
            </button>
            <button
              type="button"
              onClick={() => toggleFullscreen(box.current)}
              title="Fullscreen (F)"
              className={DARK_BUTTON}
            >
              Fullscreen
            </button>
            <button
              type="button"
              onClick={w.stopShare}
              className="min-h-11 cursor-pointer border-2 border-paper bg-hot px-4 font-mono text-sm font-bold text-ink uppercase"
            >
              Stop sharing
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="m-0 w-full font-mono text-sm text-hot">
            ! {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ModePicker({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="radiogroup" aria-label="Sharing mode" className="flex flex-wrap items-center gap-2">
      {(Object.keys(MODES) as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          title={MODES[m].hint}
          onClick={() => onChange(m)}
          className={`min-h-11 cursor-pointer border-2 border-paper px-3 font-mono text-sm font-bold uppercase ${mode === m ? 'bg-paper text-ink' : 'bg-transparent text-paper'}`}
        >
          {MODES[m].label}
        </button>
      ))}
      <span className="font-mono text-xs text-paper/60 max-sm:w-full">{MODES[mode].hint}</span>
    </div>
  );
}

// ---------- viewer ----------

function ViewerStage({ w }: { w: WatchRoom }) {
  const video = useStream<HTMLVideoElement>(w.remote);
  const voice = useStream<HTMLAudioElement>(w.remoteMic);
  const box = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  useFullscreenKey(box);

  const waiting = !w.hostHere
    ? 'The host dropped off. Waiting a few seconds for them to come back...'
    : !w.remote
      ? 'Waiting for the host to share...'
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <div ref={box} className="relative flex flex-1 items-center justify-center bg-black">
        <video
          ref={video}
          autoPlay
          playsInline
          muted={muted}
          className={`absolute inset-0 size-full object-contain ${w.remote ? '' : 'hidden'}`}
        />
        {/* the host's voice plays separately so it mixes with the screen's sound */}
        <audio ref={voice} autoPlay muted={muted} />
        {w.remote && w.remoteCam && <CamBubble stream={w.remoteCam} />}
        {waiting && (
          <p role="status" className="m-0 animate-pulse p-6 text-center font-mono text-paper/70">
            {waiting}
          </p>
        )}
        {w.remote && muted && (
          <button
            type="button"
            onClick={() => setMuted(false)}
            className="absolute top-3 left-3 z-20 min-h-11 cursor-pointer border-2 border-ink px-4 font-mono text-sm font-bold text-ink uppercase"
            style={{ background: ACCENT }}
          >
            🔇 Tap for sound
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-paper/15 px-4 py-3 font-mono text-sm">
        <QualityBadge quality={w.remote ? w.quality : 'unknown'} />
        {w.remote && !muted && (
          <button type="button" onClick={() => setMuted(true)} className={DARK_BUTTON}>
            Mute
          </button>
        )}
        {w.remote && (
          <button
            type="button"
            onClick={() => toggleFullscreen(box.current)}
            title="Fullscreen (F)"
            className={`${DARK_BUTTON} ml-auto`}
          >
            Fullscreen <span className="text-paper/50">(F)</span>
          </button>
        )}
      </div>
    </div>
  );
}

function QualityBadge({ quality }: { quality: Quality }) {
  const colour: Record<Quality, string> = {
    good: '#7ee081',
    ok: '#ffd23f',
    slow: 'var(--color-hot)',
    relay: '#4fd1e8',
    unknown: 'rgb(255 255 255 / 0.4)',
  };
  return (
    <span className="flex items-center gap-2 uppercase">
      <span
        aria-hidden="true"
        className="inline-block size-2.5"
        style={{ background: colour[quality] }}
      />
      {QUALITY_LABEL[quality]}
    </span>
  );
}

// ---------- side panel ----------

function People({ w, code }: { w: WatchRoom; code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/watch/r/${code}`;
  return (
    <div className="flex flex-col gap-3 border-b-3 border-ink p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-xl font-black uppercase">
          Here <span className="font-mono text-sm font-normal">{w.viewers.length + 1}</span>
        </h2>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold tracking-[0.15em] uppercase"
          style={{ background: ACCENT }}
          aria-label={`Copy room link, code ${code}`}
        >
          {copied ? 'Copied!' : code}
        </button>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-sm">
        <li>
          <b>You</b> {w.isHost && '· host'}
        </li>
        {w.viewers.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2">
            <span className="truncate">{v.name}</span>
            {w.isHost && w.stream && (
              <span className="text-xs text-mute">{QUALITY_LABEL[v.quality]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatPanel({ w }: { w: WatchRoom }) {
  const [text, setText] = useState('');
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [w.chat]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul
        ref={list}
        aria-label="Chat"
        aria-live="polite"
        className="m-0 flex min-h-40 flex-1 list-none flex-col gap-1.5 overflow-y-auto p-4"
      >
        {w.chat.length === 0 && <li className="font-mono text-sm text-mute">Say hi 👋</li>}
        {w.chat.map((l) => (
          <li key={l.id} className="text-sm break-words">
            <b>{l.n}</b> {l.text}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          w.sendChat(text);
          setText('');
        }}
        className="flex border-t-3 border-ink"
      >
        <label htmlFor="w-chat" className="sr-only">
          Chat message
        </label>
        <input
          id="w-chat"
          value={text}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          placeholder="Type here to chat..."
          className="h-12 min-w-0 flex-1 border-0 bg-paper px-3 text-sm"
        />
        <button
          type="submit"
          className="h-12 cursor-pointer border-0 border-l-3 border-ink bg-ink px-4 font-mono text-sm font-bold text-paper uppercase"
        >
          Send
        </button>
      </form>
    </div>
  );
}
