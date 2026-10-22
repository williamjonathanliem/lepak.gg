import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { NicknameGate } from '../katabomb/ui/NicknameGate';
import { firebaseEnabled } from '../../lib/firebase';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import { readStorage, writeStorage } from '../../lib/storage';
import {
  BREAK_CHOICES,
  FOCUS_CHOICES,
  LONG_BREAK_EVERY,
  clock,
  newTimer,
  next,
  pause,
  phaseLength,
  remaining,
  setLengths,
  start,
  type Timer,
} from './logic/timer';
import { openStudyRoom, type Member, type StudyRoom } from './net/room';

// Study Room: /study (make or join) and /study/r/:code (the room). One shared focus timer,
// everyone sees the same countdown, and you can see what everyone's working on.

const ACCENT = '#b9a2ff';
const BREAK_BG = '#7ee081';
const SOUND_KEY = 'lepak.study.sound';
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const BTN = `${BTN_BASE} bg-paper text-ink`;
const INPUT = 'min-h-11 min-w-0 border-3 border-ink bg-paper px-3 text-base';

export default function StudyRoomApp() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Study Room', to: '/study', accent: ACCENT }} />
      <Routes>
        <Route index element={<Home />} />
        <Route path="r/:code" element={<CodeRoute />} />
      </Routes>
    </div>
  );
}

function CodeRoute() {
  const { code: raw = '' } = useParams();
  const code = normalizeRoomCode(raw);
  if (!isValidRoomCode(code)) return <Navigate to="/study" replace />;
  return <NicknameGate>{(nick) => <Room key={code} code={code} nick={nick} />}</NicknameGate>;
}

// ---------- home ----------

function Chips<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs font-bold uppercase">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`min-h-11 min-w-14 cursor-pointer border-3 border-ink px-2 font-mono text-sm font-bold ${value === o ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
          >
            {o} min
          </button>
        ))}
      </div>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [focusMin, setFocusMin] = useState<number>(25);
  const [breakMin, setBreakMin] = useState<number>(5);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      for (let tries = 0; tries < 5; tries++) {
        const c = generateRoomCode();
        const room = await openStudyRoom(c);
        try {
          await room.create(newTimer(focusMin, breakMin));
          navigate(`/study/r/${c}`);
          return;
        } catch (err) {
          if (!(err instanceof Error && err.message === 'taken')) throw err;
        } finally {
          room.close();
        }
      }
      throw new Error('busy');
    } catch {
      setError('Could not make the room. Check your internet and try again.');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Study Room · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Study Room.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          One focus timer for the whole group. Study apart, feel together: everyone sees the same
          countdown and what everyone else is working on.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
        <form
          onSubmit={(e) => void create(e)}
          className="flex flex-col gap-4 border-3 border-ink p-4 shadow-hard"
        >
          <h2 className="m-0 text-xl font-black uppercase">Open a room</h2>
          <Chips
            label="Focus"
            options={FOCUS_CHOICES}
            value={focusMin as (typeof FOCUS_CHOICES)[number]}
            onChange={setFocusMin}
          />
          <Chips
            label="Break"
            options={BREAK_CHOICES}
            value={breakMin as (typeof BREAK_CHOICES)[number]}
            onChange={setBreakMin}
          />
          <p className="m-0 font-mono text-xs text-mute">
            Every {LONG_BREAK_EVERY}th break is three times longer.
          </p>
          <button
            type="submit"
            disabled={busy || !firebaseEnabled}
            className={`push ${BTN_BASE} shadow-hard-sm`}
            style={{ background: ACCENT }}
          >
            {busy ? 'Opening...' : 'Open room →'}
          </button>
          {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = normalizeRoomCode(code);
            if (isValidRoomCode(c)) navigate(`/study/r/${c}`);
          }}
          className="flex h-fit flex-col gap-3 border-3 border-ink p-4"
        >
          <h2 className="m-0 text-xl font-black uppercase">Got a code?</h2>
          <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
            Room code
            <input
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value)}
              placeholder="KJRW"
              autoCapitalize="characters"
              className={`${INPUT} font-mono text-lg tracking-widest uppercase`}
            />
          </label>
          <button
            type="submit"
            disabled={!isValidRoomCode(normalizeRoomCode(code))}
            className={BTN}
          >
            Join
          </button>
        </form>
      </div>
    </main>
  );
}

// ---------- the room ----------

/** A short two-tone chime when a phase ends (no sound files to load). */
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // no sound available
  }
}

function sinceText(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just joined';
  if (min < 60) return `here ${min} min`;
  return `here ${Math.floor(min / 60)} h ${min % 60} min`;
}

function Room({ code, nick }: { code: string; nick: string }) {
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [timer, setTimer] = useState<Timer | null | undefined>(undefined);
  const [people, setPeople] = useState<Member[]>([]);
  const [failed, setFailed] = useState(!firebaseEnabled);
  const [now, setNow] = useState(() => Date.now());
  const [task, setTask] = useState('');
  const [sound, setSound] = useState(() => readStorage(SOUND_KEY) !== 'off');
  const [copied, setCopied] = useState(false);
  const lastPhase = useRef<string | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) return;
    let r: StudyRoom | null = null;
    let closed = false;
    openStudyRoom(code)
      .then((opened) => {
        if (closed) return opened.close();
        r = opened;
        setRoom(opened);
        opened.onTimer(setTimer, () => setFailed(true));
        opened.onPeople(setPeople);
        void opened.join(nick, '');
      })
      .catch(() => setFailed(true));
    return () => {
      closed = true;
      r?.close();
    };
  }, [code, nick]);

  // Tick, and move the timer on when a phase runs out.
  useEffect(() => {
    if (!room) return;
    const t = setInterval(() => setNow(room.now()), 250);
    return () => clearInterval(t);
  }, [room]);
  const left = timer ? remaining(timer, now) : 0;
  const ended = !!timer?.running && left === 0;
  useEffect(() => {
    if (ended) void room?.advanceIfDone();
  }, [ended, room]);

  // Chime when the phase changes (not on first load).
  const phaseKey = timer ? `${timer.phase}-${timer.rounds}` : null;
  useEffect(() => {
    if (phaseKey && lastPhase.current && lastPhase.current !== phaseKey && sound) chime();
    lastPhase.current = phaseKey;
  }, [phaseKey, sound]);

  if (failed) {
    return (
      <Message>
        Could not open this room. Check your internet. If it keeps happening, the room server may
        not be set up yet.
      </Message>
    );
  }
  if (timer === undefined) return <Message>Opening the room...</Message>;
  if (timer === null) return <Message>No study room with the code {code}. Check the code.</Message>;

  const onBreak = timer.phase === 'break';
  const longBreak = onBreak && timer.rounds > 0 && timer.rounds % LONG_BREAK_EVERY === 0;
  const total = phaseLength(timer, timer.phase);
  const progress = total ? 1 - left / total : 0;
  const label = onBreak ? (longBreak ? 'Long break' : 'Break') : 'Focus';
  const me = people.find((p) => p.uid === room?.selfId);

  const share = () =>
    void navigator.clipboard
      ?.writeText(`Study with me on Lepak: ${location.origin}/study/r/${code}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });

  return (
    <main
      className="flex flex-1 flex-col transition-colors duration-700"
      style={{ background: onBreak ? BREAK_BG : 'var(--color-paper)' }}
    >
      <title>{`${clock(left)} ${label} · Study Room`}</title>
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-gutter py-[clamp(24px,5vw,56px)] lg:grid-cols-[1.4fr_1fr]">
        <section aria-label="Timer" className="flex flex-col items-center gap-6">
          <div className="flex w-full flex-wrap items-center justify-between gap-3 font-mono text-xs uppercase">
            <span>
              Room <b className="tracking-widest">{code}</b> · round{' '}
              {timer.rounds + (onBreak ? 0 : 1)}
            </span>
            <button type="button" onClick={share} className={`${BTN} min-h-10`}>
              {copied ? 'Link copied!' : 'Invite friends'}
            </button>
          </div>

          <div className="relative grid aspect-square w-full max-w-[340px] place-items-center rounded-full border-[6px] border-ink bg-paper shadow-hard">
            {/* progress ring */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={onBreak ? BREAK_BG : ACCENT}
                strokeWidth="8"
                strokeDasharray={`${progress * 276.5} 276.5`}
              />
            </svg>
            <div className="relative text-center">
              <p className="m-0 font-mono text-sm font-bold tracking-widest uppercase">{label}</p>
              <p
                className="m-0 text-[clamp(56px,14vw,88px)] leading-none font-black tabular-nums"
                role="timer"
                aria-live="off"
              >
                {clock(left)}
              </p>
              <p className="m-0 mt-1 font-mono text-xs">
                {timer.running ? (onBreak ? 'Stretch. Drink water.' : 'Phones down.') : 'Paused'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                void room?.setTimer(
                  timer.running ? pause(timer, room.now()) : start(timer, room.now()),
                )
              }
              className={`push ${BTN_BASE} min-w-32 bg-ink text-paper shadow-hard`}
            >
              {timer.running ? 'Pause' : left < total ? 'Resume' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => void room?.setTimer(next(timer, room.now()))}
              className={BTN}
            >
              Skip to {onBreak ? 'focus' : 'break'}
            </button>
          </div>

          <details className="w-full max-w-md border-3 border-ink bg-paper">
            <summary className="min-h-11 cursor-pointer px-4 py-2.5 font-mono text-sm font-bold uppercase">
              Timer lengths and sound
            </summary>
            <div className="flex flex-col gap-4 border-t-3 border-ink p-4">
              <Chips
                label="Focus"
                options={FOCUS_CHOICES}
                value={timer.focusMin as (typeof FOCUS_CHOICES)[number]}
                onChange={(f) => void room?.setTimer(setLengths(timer, f, timer.breakMin))}
              />
              <Chips
                label="Break"
                options={BREAK_CHOICES}
                value={timer.breakMin as (typeof BREAK_CHOICES)[number]}
                onChange={(b) => void room?.setTimer(setLengths(timer, timer.focusMin, b))}
              />
              <p className="m-0 font-mono text-xs text-mute">
                Changing a length pauses the timer for everyone.
              </p>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 font-mono text-sm">
                <input
                  type="checkbox"
                  checked={sound}
                  onChange={(e) => {
                    setSound(e.target.checked);
                    writeStorage(SOUND_KEY, e.target.checked ? 'on' : 'off');
                  }}
                  className="size-5"
                />
                Chime when a focus or break ends
              </label>
            </div>
          </details>
        </section>

        <section aria-labelledby="people-h" className="flex flex-col gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void room?.setTask(task.trim());
            }}
            className="flex flex-col gap-1.5"
          >
            <label htmlFor="study-task" className="font-mono text-xs font-bold uppercase">
              What are you working on?
            </label>
            <div className="flex gap-2">
              <input
                id="study-task"
                value={task}
                maxLength={60}
                onChange={(e) => setTask(e.target.value)}
                onBlur={() => void room?.setTask(task.trim())}
                placeholder={me?.task || 'Chapter 4 notes'}
                className={`${INPUT} flex-1`}
              />
              <button type="submit" className={BTN}>
                Set
              </button>
            </div>
          </form>

          <h2 id="people-h" className="m-0 text-xl font-black uppercase">
            Studying now ({people.length})
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {people
              .slice()
              .sort((a, b) => a.since - b.since)
              .map((p) => (
                <li
                  key={p.uid}
                  className="flex items-center gap-3 border-3 border-ink bg-paper p-3"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink font-mono font-bold uppercase"
                    style={{ background: p.uid === room?.selfId ? ACCENT : '#f9fafb' }}
                  >
                    {[...p.nick][0] ?? '?'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {p.nick}
                      {p.uid === room?.selfId && ' (you)'}
                    </span>
                    <span className="block truncate text-sm text-mute">
                      {p.task || 'Just vibing'}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px]">
                    {p.since ? sinceText(now - p.since) : ''}
                  </span>
                </li>
              ))}
          </ul>
          <p className="m-0 font-mono text-xs text-mute">
            Rooms close a day after the last person leaves.
          </p>
        </section>
      </div>
    </main>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-gutter py-16">
      <p className="m-0 border-3 border-ink p-5 font-mono text-sm">{children}</p>
    </main>
  );
}
