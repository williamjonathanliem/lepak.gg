import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { firebaseEnabled } from '../../lib/firebase';
import { clock } from '../../lib/puzzle';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import { NicknameGate } from '../katabomb/ui/NicknameGate';
import {
  LIMIT_CHOICES,
  endsAt,
  isOver,
  newMeta,
  raceSeed,
  rematch,
  setMode,
  standings,
  startRace,
  type Mode,
  type RaceMeta,
  type Racer,
  type Standing,
} from './logic/race';
import { cleanCustom, raceText, type TextLength, type TextSource } from './logic/text';
import { accuracy, backspace, newTyping, typeChar, wpm, type TypingState } from './logic/typing';
import { LIVES, TARGET_CHOICES } from './logic/waves';
import { openKetikRoom, type KetikRoom, type Progress } from './net/room';
import {
  ANIMALS,
  RACE,
  SPACE,
  animalName,
  avatarSrc,
  play,
  saveAvatar,
  savedAvatar,
  setSoundOn,
  soundOn,
} from './ui/assets';
import { SentencePlay } from './ui/SentencePlay';
import { Space, type SpaceResult } from './ui/Space';
import { Track } from './ui/Track';

// Ketik Race ("ketik" is Malay for "type"): /ketik (make or join) and /ketik/r/:code (the room).
//   Sentence mode: everyone types the same text, cars race down the track.
//   Word mode: words fly at your ship in space; zap them before they hit you.
// Class mode: the host only watches, e.g. on the projector.

const ACCENT = '#ff9f5a';
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const BTN = `${BTN_BASE} bg-paper text-ink`;
const INPUT = 'min-h-11 min-w-0 border-3 border-ink bg-paper px-3 text-base';

const MODES: { id: Mode; label: string; blurb: string; art: string }[] = [
  {
    id: 'sentence',
    label: 'Sentence race',
    blurb: 'Same text for everyone. Your car moves as you type. First to the line wins.',
    art: RACE.road,
  },
  {
    id: 'words',
    label: 'Word blaster',
    blurb: 'Words fly at your ship. Type them to zap them. It keeps getting faster. 3 lives.',
    art: SPACE.ship,
  },
];
const SOURCES: { id: TextSource; label: string }[] = [
  { id: 'sentences', label: 'Sentences' },
  { id: 'words', label: 'Random words' },
  { id: 'custom', label: 'My own text' },
];
const LENGTHS: TextLength[] = ['short', 'medium', 'long'];

export default function KetikRaceApp() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Ketik Race', to: '/ketik', accent: ACCENT }} />
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
  if (!isValidRoomCode(code)) return <Navigate to="/ketik" replace />;
  return <NicknameGate>{(nick) => <Room key={code} code={code} nick={nick} />}</NicknameGate>;
}

/** A row of choice buttons (one picked). */
function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  show = String,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  show?: (v: T) => string;
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
            className={`min-h-11 min-w-14 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold ${value === o ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
          >
            {show(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModePicker({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="radiogroup" aria-label="Mode" className="grid gap-2 sm:grid-cols-2">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          onClick={() => onChange(m.id)}
          className={`flex cursor-pointer items-center gap-3 border-3 border-ink p-3 text-left ${value === m.id ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
        >
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center border-2 border-ink bg-cover"
            style={{
              backgroundImage: m.id === 'sentence' ? `url(${m.art})` : `url(${SPACE.bg})`,
            }}
          >
            <img
              src={m.id === 'sentence' ? '/games/ketik/race/car-red.png' : m.art}
              alt=""
              className={m.id === 'sentence' ? 'h-7 rotate-90' : 'w-10'}
            />
          </span>
          <span>
            <span className="block font-black uppercase">{m.label}</span>
            <span className="block text-sm opacity-80">{m.blurb}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------- home ----------

function Home() {
  const navigate = useNavigate();
  const [mode, setModeState] = useState<Mode>('sentence');
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
        const room = await openKetikRoom(c);
        try {
          await room.create(newMeta(room.selfId, mode));
          navigate(`/ketik/r/${c}`);
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
      <title>Ketik Race · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Ketik Race.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          A typing race for the whole group chat. Race cars down the track by typing the same text,
          or blast words out of the sky before they hit your ship.
        </p>
      </div>
      <form
        onSubmit={(e) => void create(e)}
        className="flex flex-col gap-4 border-3 border-ink p-4 shadow-hard"
      >
        <h2 className="m-0 text-xl font-black uppercase">Start a race</h2>
        <ModePicker value={mode} onChange={setModeState} />
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
          if (isValidRoomCode(c)) navigate(`/ketik/r/${c}`);
        }}
        className="flex flex-wrap items-end gap-3 border-3 border-ink p-4"
      >
        <label className="flex flex-1 flex-col gap-1 font-mono text-xs font-bold uppercase">
          Got a code?
          <input
            value={code}
            maxLength={4}
            onChange={(e) => setCode(e.target.value)}
            placeholder="KJRW"
            autoCapitalize="characters"
            className={`${INPUT} font-mono text-lg tracking-widest uppercase`}
          />
        </label>
        <button type="submit" disabled={!isValidRoomCode(normalizeRoomCode(code))} className={BTN}>
          Join
        </button>
      </form>
      <p className="m-0 font-mono text-xs text-mute">
        Teaching? Paste your own vocab as the race text, turn on class mode and put the race on the
        projector.
      </p>
    </main>
  );
}

// ---------- the room ----------

function Room({ code, nick }: { code: string; nick: string }) {
  const [room, setRoom] = useState<KetikRoom | null>(null);
  const [meta, setMeta] = useState<RaceMeta | null | undefined>(undefined);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [failed, setFailed] = useState(!firebaseEnabled);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!firebaseEnabled) return;
    let r: KetikRoom | null = null;
    let closed = false;
    openKetikRoom(code)
      .then((opened) => {
        if (closed) return opened.close();
        r = opened;
        setRoom(opened);
        opened.onMeta(setMeta, () => setFailed(true));
        opened.onRacers(setRacers);
      })
      .catch(() => setFailed(true));
    return () => {
      closed = true;
      r?.close();
    };
  }, [code]);

  useEffect(() => {
    if (!room) return;
    const t = setInterval(() => setNow(room.now()), 200);
    return () => clearInterval(t);
  }, [room]);

  if (failed) {
    return (
      <Message>
        Could not open this room. Check your internet. If it keeps happening, the room server may
        not be set up yet.
      </Message>
    );
  }
  if (meta === undefined || !room) return <Message>Opening the room...</Message>;
  if (meta === null) return <Message>No race with the code {code}. Check the code.</Message>;

  return (
    <RaceScreen
      // a rematch, or a new mode or text from the host, starts a fresh race
      key={`${meta.round}-${meta.mode}-${meta.source}-${meta.length}-${meta.custom}`}
      code={code}
      nick={nick}
      room={room}
      meta={meta}
      racers={racers}
      now={now}
    />
  );
}

/** Keeps your sentence-mode progress through a refresh (this tab only). */
const typingKey = (code: string, round: number) => `lepak.ketik.${code}.${round}`;

function loadTyping(code: string, round: number, text: string): TypingState {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(typingKey(code, round)) ?? 'null',
    ) as TypingState | null;
    if (saved?.text === text) return saved;
  } catch {
    // nothing saved, or storage blocked
  }
  return newTyping(text);
}

function RaceScreen({
  code,
  nick,
  room,
  meta,
  racers,
  now,
}: {
  code: string;
  nick: string;
  room: KetikRoom;
  meta: RaceMeta;
  racers: Racer[];
  now: number;
}) {
  const isHost = meta.host === room.selfId;
  const playing = !isHost || meta.hostPlays;
  const seed = raceSeed(code, meta.round);
  const text = useMemo(
    () =>
      meta.source === 'custom' && meta.custom
        ? meta.custom
        : raceText(seed, meta.source === 'custom' ? 'sentences' : meta.source, meta.length),
    [seed, meta.source, meta.custom, meta.length],
  );
  const [avatar, setAvatar] = useState(savedAvatar);
  const [typing, setTyping] = useState(() => loadTyping(code, meta.round, text));
  const [space, setSpace] = useState<SpaceResult>({
    score: 0,
    lives: LIVES,
    errors: 0,
    correct: 0,
    outAt: 0,
    wonAt: 0,
  });
  const spaceRules = useMemo(
    () => ({
      seed,
      goal: meta.goal,
      limitMs: meta.limitSec * 1000,
      targetScore: meta.targetScore,
    }),
    [seed, meta.goal, meta.limitSec, meta.targetScore],
  );
  const mine = racers.find((r) => r.uid === room.selfId && r.round === meta.round);

  const progressOf = useCallback(
    (t: TypingState, sp: SpaceResult, av: number): Progress => ({
      av,
      round: meta.round,
      pos: t.pos,
      total: t.text.length,
      correct: meta.mode === 'sentence' ? t.correct : sp.correct,
      errors: meta.mode === 'sentence' ? t.errors : sp.errors,
      score: sp.score,
      lives: sp.lives,
      outAt: sp.outAt,
    }),
    [meta.round, meta.mode],
  );

  // Sit in (or out, for a host in class mode). Re-seats on a rematch or avatar change.
  const finishedRef = useRef(mine?.finishedAt ?? 0);
  useEffect(() => {
    finishedRef.current = mine?.finishedAt ?? 0;
  }, [mine?.finishedAt]);
  const latest = useRef({ typing, space });
  useEffect(() => {
    latest.current = { typing, space };
  }, [typing, space]);
  useEffect(() => {
    if (playing) {
      const { typing: t, space: sp } = latest.current;
      void room.join(nick, progressOf(t, sp, avatar), finishedRef.current);
    } else void room.leave();
  }, [playing, room, nick, avatar, progressOf]);

  // Progress goes out at most every 150ms, so fast typists don't flood the room.
  const pending = useRef<Partial<Progress> | null>(null);
  const flush = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = useCallback(
    (p: Partial<Progress>) => {
      pending.current = { ...pending.current, ...p };
      if (flush.current) return;
      flush.current = setTimeout(() => {
        flush.current = null;
        const out = pending.current;
        pending.current = null;
        if (out) void room.report(out);
      }, 150);
    },
    [room],
  );

  const started = meta.phase === 'race' && now >= meta.startAt;
  const over = isOver(meta, racers, now);
  const rows = useMemo(() => standings(meta, racers, now), [meta, racers, now]);
  const laneOrder = useMemo(
    () =>
      racers
        .filter((r) => r.round === meta.round)
        .sort((a, b) => a.nick.localeCompare(b.nick) || a.uid.localeCompare(b.uid))
        .map((r) => r.uid),
    [racers, meta.round],
  );

  // Countdown beeps.
  const countdown = Math.ceil((meta.startAt - now) / 1000);
  const lastBeep = useRef(0);
  useEffect(() => {
    if (meta.phase !== 'race' || countdown > 3 || countdown === lastBeep.current) return;
    lastBeep.current = countdown;
    if (countdown > 0) play('tick', 0.5);
    else if (countdown === 0) play('go', 0.5);
  }, [countdown, meta.phase]);

  if (meta.phase === 'lobby') {
    return (
      <Lobby
        code={code}
        room={room}
        meta={meta}
        rows={rows}
        isHost={isHost}
        avatar={avatar}
        onAvatar={(av) => {
          setAvatar(av);
          saveAvatar(av);
        }}
      />
    );
  }
  if (over) return <Results meta={meta} rows={rows} isHost={isHost} room={room} />;

  const left = Math.max(0, endsAt(meta) - now);
  const elapsed = Math.max(0, (typing.finishedAt ?? now) - meta.startAt);

  const onChar = (ch: string) => {
    if (!started || over) return;
    setTyping((prev) => {
      const next = typeChar(prev, ch, room.now());
      if (next === prev) return prev;
      try {
        sessionStorage.setItem(typingKey(code, meta.round), JSON.stringify(next));
      } catch {
        // storage blocked
      }
      if (next.errors > prev.errors) play('error', 0.2);
      const p = {
        pos: next.pos,
        total: next.text.length,
        correct: next.correct,
        errors: next.errors,
      };
      if (next.finishedAt && !prev.finishedAt) void room.finish(p);
      else send(p);
      return next;
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-gutter py-5">
      <title>{`${clock(left / 1000)} left · Ketik Race`}</title>
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-sm">
        <span>
          Room <b className="tracking-widest">{code}</b> ·{' '}
          {meta.mode === 'sentence' ? 'Sentence race' : 'Word blaster'}
        </span>
        <span className={`font-bold ${!playing ? 'text-3xl' : ''}`}>
          {started ? `${clock(left / 1000)} left` : 'Get ready...'}
        </span>
        <SoundToggle />
      </div>

      {meta.mode === 'sentence' ? (
        <>
          <div className="relative">
            <Track rows={rows} laneOrder={laneOrder} selfId={room.selfId} big={!playing} />
            {!started && <Countdown n={countdown} />}
          </div>
          {playing &&
            (typing.finishedAt ? (
              <p className="m-0 border-3 border-ink bg-paper p-4 font-mono font-bold" role="status">
                Done! {wpm(typing.pos, elapsed)} wpm, {accuracy(typing.correct, typing.errors)}%
                accuracy. Watch the others cross the line.
              </p>
            ) : (
              <SentencePlay
                state={typing}
                onChar={onChar}
                onBackspace={() => setTyping((t) => backspace(t))}
                locked={!started}
                elapsedMs={elapsed}
              />
            ))}
        </>
      ) : (
        <div className={playing ? 'grid gap-5 lg:grid-cols-[1fr_260px]' : ''}>
          {playing && (
            <Space
              rules={spaceRules}
              startAt={meta.startAt}
              now={room.now}
              // the game ignores keys during the countdown and ends with the results screen
              locked={false}
              onChange={(r) => {
                const p = {
                  score: r.score,
                  lives: r.lives,
                  errors: r.errors,
                  correct: r.correct,
                  outAt: r.outAt,
                };
                // reaching the target in a points game is a finish, stamped at server time
                if (r.wonAt && !space.wonAt) void room.finish(p);
                else send(p);
                setSpace(r);
              }}
            />
          )}
          <Scoreboard rows={rows} selfId={room.selfId} big={!playing} />
          {!playing && !started && (
            <div className="relative h-40">
              <Countdown n={countdown} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(soundOn);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        setSoundOn(!on);
        setOn(!on);
      }}
      className={`${BTN} min-h-9 px-3 text-xs`}
    >
      Sound {on ? 'on' : 'off'}
    </button>
  );
}

function Countdown({ n }: { n: number }) {
  return (
    <div
      aria-live="assertive"
      className="absolute inset-0 z-10 grid place-items-center bg-paper/75 text-[clamp(80px,22vw,160px)] font-black"
    >
      {n > 0 ? n : 'GO'}
    </div>
  );
}

/** Word mode: everyone's score and lives, live. */
function Scoreboard({ rows, selfId, big }: { rows: Standing[]; selfId: string; big: boolean }) {
  return (
    <section aria-labelledby="score-h" className="flex flex-col gap-2">
      <h2
        id="score-h"
        className={`m-0 font-black uppercase ${big ? 'text-[clamp(32px,5vw,64px)]' : 'text-xl'}`}
      >
        Scores
      </h2>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((r) => (
          <li
            key={r.uid}
            className={`flex items-center gap-2 border-3 border-ink px-2 py-1.5 ${r.uid === selfId ? 'bg-ink text-paper' : 'bg-paper'} ${big ? 'text-2xl' : 'text-sm'}`}
          >
            <span className="w-6 font-black">{r.place}</span>
            <img src={avatarSrc(r.av)} alt="" className={big ? 'h-10' : 'h-7'} />
            <span className="min-w-0 flex-1 truncate font-bold">{r.nick}</span>
            <span className="font-mono">
              {r.lives > 0 && r.outAt === 0 ? '♥'.repeat(r.lives) : 'out'}
            </span>
            <span className="font-mono font-bold">{r.score}</span>
          </li>
        ))}
      </ol>
      {rows.length === 0 && (
        <p className="m-0 font-mono text-sm text-mute">Nobody is playing yet.</p>
      )}
    </section>
  );
}

function Lobby({
  code,
  room,
  meta,
  rows,
  isHost,
  avatar,
  onAvatar,
}: {
  code: string;
  room: KetikRoom;
  meta: RaceMeta;
  rows: Standing[];
  isHost: boolean;
  avatar: number;
  onAvatar: (av: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(meta.custom);
  const [customError, setCustomError] = useState('');
  const link = `${location.origin}/ketik/r/${code}`;
  const set = (next: RaceMeta) => void room.setMeta(next);
  const modeInfo = MODES.find((m) => m.id === meta.mode)!;

  function saveCustom() {
    const clean = cleanCustom(draft);
    if (!clean) return setCustomError('Paste at least a sentence of plain, kind text.');
    setCustomError('');
    setDraft(clean);
    set({ ...meta, source: 'custom', custom: clean });
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-gutter py-[clamp(24px,5vw,56px)] lg:grid-cols-[1.2fr_1fr]">
      <title>{`Room ${code} · Ketik Race`}</title>
      <section className="flex flex-col gap-5">
        <div>
          <p className="m-0 font-mono text-xs font-bold uppercase">Room code</p>
          <p className="m-0 text-[clamp(56px,12vw,96px)] leading-none font-black tracking-widest">
            {code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BTN}
            onClick={() =>
              void navigator.clipboard
                ?.writeText(`Race me in Ketik Race on Lepak: ${link}`)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
            }
          >
            {copied ? 'Link copied!' : 'Copy invite link'}
          </button>
          <SoundToggle />
        </div>

        {isHost ? (
          <div className="flex flex-col gap-4 border-3 border-ink p-4">
            <h2 className="m-0 text-xl font-black uppercase">Settings</h2>
            <ModePicker value={meta.mode} onChange={(m) => set(setMode(meta, m))} />
            {meta.mode === 'sentence' && (
              <>
                <Choice
                  label="Text"
                  options={SOURCES.map((s) => s.id)}
                  value={meta.source}
                  onChange={(source) => set({ ...meta, source })}
                  show={(id) => SOURCES.find((s) => s.id === id)!.label}
                />
                {meta.source === 'custom' ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="ketik-custom" className="font-mono text-xs font-bold uppercase">
                      Your text (up to 400 letters)
                    </label>
                    <textarea
                      id="ketik-custom"
                      value={draft}
                      maxLength={600}
                      rows={4}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Photosynthesis turns light, water and carbon dioxide into glucose and oxygen."
                      className="border-3 border-ink bg-paper p-3 font-mono text-sm"
                    />
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={saveCustom} className={BTN}>
                        Use this text
                      </button>
                      {meta.custom && !customError && (
                        <span className="font-mono text-xs text-mute">Saved.</span>
                      )}
                    </div>
                    {customError && (
                      <p className="m-0 font-mono text-xs font-bold">{customError}</p>
                    )}
                  </div>
                ) : (
                  <Choice
                    label="Length"
                    options={LENGTHS}
                    value={meta.length}
                    onChange={(length) => set({ ...meta, length })}
                  />
                )}
              </>
            )}
            {meta.mode === 'words' && (
              <>
                <Choice
                  label="Win by"
                  options={['time', 'points'] as const}
                  value={meta.goal}
                  onChange={(goal) => set({ ...meta, goal })}
                  show={(g) => (g === 'time' ? 'Best score at the end' : 'First to the target')}
                />
                {meta.goal === 'points' && (
                  <Choice
                    label="Target score"
                    options={TARGET_CHOICES}
                    value={meta.targetScore as (typeof TARGET_CHOICES)[number]}
                    onChange={(targetScore) => set({ ...meta, targetScore })}
                    show={(n) => `${n} pts`}
                  />
                )}
                <p className="m-0 font-mono text-xs text-mute">
                  It speeds up and the words get longer the closer everyone gets to{' '}
                  {meta.goal === 'time' ? 'the end of the clock' : 'the target'}.
                </p>
              </>
            )}
            <Choice
              label={
                meta.mode === 'words' && meta.goal === 'points' ? 'Time limit (max)' : 'Time limit'
              }
              options={LIMIT_CHOICES[meta.mode]}
              value={meta.limitSec}
              onChange={(limitSec) => set({ ...meta, limitSec })}
              show={(s) => `${s / 60} min`}
            />
            <label className="flex min-h-11 cursor-pointer items-center gap-3 font-mono text-sm">
              <input
                type="checkbox"
                checked={!meta.hostPlays}
                onChange={(e) => set({ ...meta, hostPlays: !e.target.checked })}
                className="size-5"
              />
              Class mode: I only watch (put this screen on the projector)
            </label>
            <button
              type="button"
              disabled={
                rows.length === 0 ||
                (meta.source === 'custom' && !meta.custom && meta.mode === 'sentence')
              }
              onClick={() => set(startRace(meta, room.now()))}
              className={`push ${BTN_BASE} bg-ink text-paper shadow-hard`}
            >
              Start the race →
            </button>
            {rows.length === 0 && (
              <p className="m-0 font-mono text-xs text-mute">Waiting for someone to join.</p>
            )}
          </div>
        ) : (
          <p className="m-0 border-3 border-ink p-4 font-mono text-sm">
            <b>{modeInfo.label}.</b> {modeInfo.blurb}{' '}
            {meta.mode === 'words' &&
              (meta.goal === 'points'
                ? `First to ${meta.targetScore} points wins. `
                : 'Best score when the clock runs out wins. ')}
            Waiting for the host to start.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-xl font-black uppercase">Your racer</h2>
          <div role="radiogroup" aria-label="Your racer" className="flex flex-wrap gap-1.5">
            {ANIMALS.map((a, i) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={avatar === i}
                aria-label={a}
                onClick={() => onAvatar(i)}
                className={`grid size-12 cursor-pointer place-items-center border-3 ${avatar === i ? 'border-ink bg-[#ffd23f]' : 'border-transparent bg-paper'}`}
              >
                <img src={avatarSrc(i)} alt="" className="h-9" />
              </button>
            ))}
          </div>
        </div>
        <h2 className="m-0 text-xl font-black uppercase">Racers ({rows.length})</h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => (
            <li key={r.uid} className="flex items-center gap-3 border-3 border-ink bg-paper p-2.5">
              <img src={avatarSrc(r.av)} alt={animalName(r.av)} className="h-9" />
              <span className="min-w-0 flex-1 truncate font-bold">
                {r.nick}
                {r.uid === room.selfId && ' (you)'}
                {r.uid === meta.host && ' · host'}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 font-mono text-xs text-mute">Rooms close a day after the last race.</p>
      </section>
    </main>
  );
}

function Results({
  meta,
  rows,
  isHost,
  room,
}: {
  meta: RaceMeta;
  rows: Standing[];
  isHost: boolean;
  room: KetikRoom;
}) {
  const winner = rows[0];
  const sentence = meta.mode === 'sentence';
  const someoneWon = sentence ? rows.some((r) => r.timeMs !== null) : !!winner && winner.score > 0;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Results · Ketik Race</title>
      <div>
        <p className="m-0 font-mono text-xs font-bold uppercase">Race over</p>
        <h1 className="heading-lg m-0">
          {someoneWon && winner ? `${winner.nick} wins.` : 'Nobody made it. Rematch?'}
        </h1>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((r) => {
          const ms = r.timeMs ?? meta.limitSec * 1000;
          return (
            <li
              key={r.uid}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-3 border-ink px-3 py-3"
              style={{ background: r.place === 1 && someoneWon ? ACCENT : undefined }}
            >
              <span className="w-8 text-2xl font-black">{r.place}</span>
              <img src={avatarSrc(r.av)} alt="" className="h-10" />
              <span className="min-w-0 flex-1 truncate text-lg font-bold">
                {r.nick}
                {r.uid === room.selfId && ' (you)'}
              </span>
              <span className="font-mono text-sm">
                {sentence
                  ? `${r.timeMs !== null ? clock(r.timeMs / 1000) : `${Math.round(r.progress * 100)}% done`} · ${wpm(r.pos, ms)} wpm`
                  : `${r.score} pts · ${
                      r.timeMs !== null
                        ? `target in ${clock(r.timeMs / 1000)}`
                        : r.outAt
                          ? `out at ${clock(r.outAt / 1000)}`
                          : 'survived'
                    }`}
                {` · ${accuracy(r.correct, r.errors)}% accuracy`}
              </span>
            </li>
          );
        })}
      </ol>
      {isHost ? (
        <button
          type="button"
          onClick={() => void room.setMeta(rematch(meta))}
          className={`push ${BTN_BASE} self-start bg-ink text-paper shadow-hard`}
        >
          Rematch →
        </button>
      ) : (
        <p className="m-0 font-mono text-sm text-mute">Waiting for the host to start a rematch.</p>
      )}
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
