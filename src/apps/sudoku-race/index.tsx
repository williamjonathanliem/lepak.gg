import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { firebaseEnabled } from '../../lib/firebase';
import { clock } from '../../lib/puzzle';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import { NicknameGate } from '../katabomb/ui/NicknameGate';
import { newSudoku, type Difficulty, type SudokuState } from '../sudoku/logic/sudoku';
import { SudokuPlay } from '../sudoku/ui/Play';
import {
  LIMIT_CHOICES,
  PENALTY_MS,
  STRIKES,
  blanks,
  correctFilled,
  endsAt,
  isOut,
  isOver,
  newMeta,
  penaltyMs,
  raceSeed,
  rematch,
  standings,
  startRace,
  type MistakeRule,
  type RaceMeta,
  type Racer,
  type Standing,
} from './logic/race';
import { openRaceRoom, type RaceRoom, type Seat } from './net/room';

// Sudoku Race: /sudoku-race (make or join) and /sudoku-race/r/:code (the room). Everyone gets
// the same puzzle and races. Wrong numbers cost 30 seconds (or 3 strikes and you're out).
// Class mode: the host only watches, e.g. on the projector.

const ACCENT = '#4fd1e8';
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const BTN = `${BTN_BASE} bg-paper text-ink`;
const INPUT = 'min-h-11 min-w-0 border-3 border-ink bg-paper px-3 text-base';
const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];
const RULES: { id: MistakeRule; label: string; hint: string }[] = [
  { id: 'penalty', label: '+30s per mistake', hint: 'Wrong numbers add 30 seconds to your time.' },
  { id: 'strikes', label: '3 strikes', hint: 'Three wrong numbers and you are out.' },
];

export default function SudokuRaceApp() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Sudoku Race', to: '/sudoku-race', accent: ACCENT }} />
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
  if (!isValidRoomCode(code)) return <Navigate to="/sudoku-race" replace />;
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

// ---------- home ----------

function Home() {
  const navigate = useNavigate();
  const [level, setLevel] = useState<Difficulty>('easy');
  const [rule, setRule] = useState<MistakeRule>('penalty');
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
        const room = await openRaceRoom(c);
        try {
          await room.create(newMeta(room.selfId, level, rule));
          navigate(`/sudoku-race/r/${c}`);
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
      <title>Sudoku Race · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Sudoku Race.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          Same puzzle, everyone at once. First to finish wins, but every wrong number costs you.
          Watch everyone&apos;s progress bars climb while you race.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
        <form
          onSubmit={(e) => void create(e)}
          className="flex flex-col gap-4 border-3 border-ink p-4 shadow-hard"
        >
          <h2 className="m-0 text-xl font-black uppercase">Start a race</h2>
          <Choice label="Level" options={LEVELS} value={level} onChange={setLevel} />
          <Choice
            label="Wrong numbers"
            options={RULES.map((r) => r.id)}
            value={rule}
            onChange={setRule}
            show={(id) => RULES.find((r) => r.id === id)!.label}
          />
          <p className="m-0 font-mono text-xs text-mute">
            {RULES.find((r) => r.id === rule)!.hint} You can change this in the lobby.
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
            if (isValidRoomCode(c)) navigate(`/sudoku-race/r/${c}`);
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
      <section aria-labelledby="how-h" className="flex flex-col gap-2">
        <h2 id="how-h" className="m-0 text-xl font-black uppercase">
          How it works
        </h2>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0 font-mono text-sm">
          <li>01 Open a room and send the code to the group chat.</li>
          <li>02 Everyone gets the same puzzle. 3, 2, 1, go.</li>
          <li>03 Wrong numbers cost 30 seconds, or 3 strikes and you are out.</li>
          <li>
            04 Fastest time wins. Teaching? Turn on class mode and put the race on the projector.
          </li>
        </ol>
      </section>
    </main>
  );
}

// ---------- the room ----------

/** Keeps your board through a refresh (this tab only). */
const boardKey = (code: string, round: number) => `lepak.sudokuRace.${code}.${round}`;

function loadBoard(code: string, meta: RaceMeta): SudokuState {
  const fresh = newSudoku(raceSeed(code, meta.round), meta.level, meta.startAt);
  try {
    const saved = JSON.parse(sessionStorage.getItem(boardKey(code, meta.round)) ?? 'null') as {
      entries?: number[];
      notes?: number[][];
      mistakes?: number;
      finishedAt?: number | null;
    } | null;
    if (saved?.entries?.length === 81 && saved.notes?.length === 81) {
      return {
        ...fresh,
        entries: saved.entries,
        notes: saved.notes,
        mistakes: saved.mistakes ?? 0,
        finishedAt: saved.finishedAt ?? null,
      };
    }
  } catch {
    // nothing saved, or storage is blocked: start clean
  }
  return fresh;
}

function saveBoard(code: string, round: number, s: SudokuState) {
  try {
    const { entries, notes, mistakes, finishedAt } = s;
    sessionStorage.setItem(
      boardKey(code, round),
      JSON.stringify({ entries, notes, mistakes, finishedAt }),
    );
  } catch {
    // storage blocked: the race still works, it just won't survive a refresh
  }
}

function Room({ code, nick }: { code: string; nick: string }) {
  const [room, setRoom] = useState<RaceRoom | null>(null);
  const [meta, setMeta] = useState<RaceMeta | null | undefined>(undefined);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [failed, setFailed] = useState(!firebaseEnabled);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!firebaseEnabled) return;
    let r: RaceRoom | null = null;
    let closed = false;
    openRaceRoom(code)
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
      // a new round (rematch) or level starts a fresh board
      key={`${meta.round}-${meta.level}`}
      code={code}
      nick={nick}
      room={room}
      meta={meta}
      racers={racers}
      now={now}
    />
  );
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
  room: RaceRoom;
  meta: RaceMeta;
  racers: Racer[];
  now: number;
}) {
  const isHost = meta.host === room.selfId;
  const playing = !isHost || meta.hostPlays;
  const [board, setBoard] = useState(() => loadBoard(code, meta));
  const mine = racers.find((r) => r.uid === room.selfId && r.round === meta.round);

  const seat = useCallback(
    (s: SudokuState): Seat => ({
      round: meta.round,
      filled: correctFilled(s),
      total: blanks(s),
      mistakes: s.mistakes,
      finishedAt: 0,
    }),
    [meta.round],
  );

  // Sit in (or out, for a host in class mode). Re-seats on a rematch.
  const finishedAt = mine?.finishedAt ?? 0;
  const finishedRef = useRef(finishedAt);
  useEffect(() => {
    finishedRef.current = finishedAt;
  }, [finishedAt]);
  useEffect(() => {
    if (playing) void room.join(nick, { ...seat(board), finishedAt: finishedRef.current });
    else void room.leave();
    // only when seating changes, not on every move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, room, nick, meta.round]);

  const started = meta.phase === 'race' && now >= meta.startAt;
  const over = isOver(meta, racers, now);
  const out = isOut(meta.rule, board.mistakes);
  const locked = !started || over || out || !!board.finishedAt;

  const update = useCallback(
    (fn: (s: SudokuState) => SudokuState) => {
      setBoard((prev) => {
        const next = fn(prev);
        if (next === prev) return prev;
        saveBoard(code, meta.round, next);
        const progress = seat(next);
        if (next.finishedAt && !prev.finishedAt) void room.finish(progress);
        else void room.report(progress);
        return next;
      });
    },
    [code, meta.round, room, seat],
  );

  const rows = useMemo(() => standings(meta, racers), [meta, racers]);

  if (meta.phase === 'lobby') {
    return <Lobby code={code} room={room} meta={meta} rows={rows} isHost={isHost} />;
  }
  if (over) {
    return <Results meta={meta} rows={rows} isHost={isHost} room={room} selfId={room.selfId} />;
  }

  const countdown = Math.ceil((meta.startAt - now) / 1000);
  const elapsed = Math.max(0, (board.finishedAt ? finishedAt || now : now) - meta.startAt);
  const myScore = elapsed + penaltyMs(meta.rule, board.mistakes);
  const left = Math.max(0, endsAt(meta) - now);

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-gutter py-6 lg:grid-cols-[auto_1fr]">
      <title>{`${clock(left / 1000)} left · Sudoku Race`}</title>
      {playing ? (
        <section aria-label="Your board" className="relative flex flex-col items-center">
          <div className="mb-3 flex w-full max-w-[min(92vw,480px)] flex-wrap items-center justify-between gap-2 font-mono text-sm">
            <span className="font-bold uppercase">{meta.level}</span>
            <span>
              {meta.rule === 'strikes'
                ? `Strikes ${board.mistakes}/${STRIKES}`
                : `Mistakes ${board.mistakes} (+${(board.mistakes * PENALTY_MS) / 1000}s)`}
            </span>
            <span aria-label="Your time">{clock(myScore / 1000)}</span>
          </div>
          <SudokuPlay state={board} onChange={update} accent={ACCENT} locked={locked} />
          {!started && <Countdown n={countdown} />}
          <p className="mt-3 mb-0 font-mono text-sm font-bold" role="status">
            {board.finishedAt
              ? `Done! ${clock(myScore / 1000)} with penalties. Watch the others finish.`
              : out
                ? 'Three strikes, you are out. Cheer the others on.'
                : started
                  ? `${clock(left / 1000)} left`
                  : 'Get ready...'}
          </p>
        </section>
      ) : (
        !started && (
          <section className="relative grid min-h-40 place-items-center">
            <Countdown n={countdown} />
          </section>
        )
      )}
      <RaceBars
        rows={rows}
        meta={meta}
        selfId={room.selfId}
        big={!playing}
        left={left}
        code={code}
      />
    </main>
  );
}

function Countdown({ n }: { n: number }) {
  return (
    <div
      aria-live="assertive"
      className="absolute inset-0 z-10 grid place-items-center bg-paper/80 text-[clamp(96px,30vw,200px)] font-black"
    >
      {n > 0 ? n : 'GO'}
    </div>
  );
}

/** Everyone's progress, live. Big in class mode (the host's projector screen). */
function RaceBars({
  rows,
  meta,
  selfId,
  big,
  left,
  code,
}: {
  rows: Standing[];
  meta: RaceMeta;
  selfId: string;
  big: boolean;
  left: number;
  code: string;
}) {
  return (
    <section aria-labelledby="race-h" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="race-h"
          className={`m-0 font-black uppercase ${big ? 'text-[clamp(32px,5vw,64px)]' : 'text-xl'}`}
        >
          The race
        </h2>
        <span className={`font-mono font-bold ${big ? 'text-3xl' : 'text-sm'}`}>
          {clock(left / 1000)} left · room <span className="tracking-widest">{code}</span>
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((r) => (
          <li
            key={r.uid}
            className={`flex flex-col gap-1 border-3 border-ink bg-paper px-3 py-2 ${big ? 'py-3' : ''}`}
          >
            <div
              className={`flex items-center justify-between gap-3 ${big ? 'text-2xl' : 'text-sm'}`}
            >
              <span className="min-w-0 truncate font-bold">
                {r.place}. {r.nick}
                {r.uid === selfId && ' (you)'}
              </span>
              <span className="shrink-0 font-mono">
                {r.status === 'finished'
                  ? `✓ ${clock((r.scoreMs ?? 0) / 1000)}`
                  : r.status === 'out'
                    ? 'out'
                    : `${Math.round(r.progress * 100)}%`}
                {meta.rule === 'penalty' && r.mistakes > 0 && ` · ${r.mistakes}✗`}
              </span>
            </div>
            <div
              className={`w-full border-2 border-ink bg-soft ${big ? 'h-6' : 'h-3'}`}
              role="progressbar"
              aria-label={`${r.nick} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(r.progress * 100)}
            >
              <div
                className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{
                  width: `${r.progress * 100}%`,
                  background: r.status === 'out' ? 'var(--color-mute)' : ACCENT,
                }}
              />
            </div>
          </li>
        ))}
      </ol>
      {rows.length === 0 && (
        <p className="m-0 font-mono text-sm text-mute">Nobody is racing yet.</p>
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
}: {
  code: string;
  room: RaceRoom;
  meta: RaceMeta;
  rows: Standing[];
  isHost: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/sudoku-race/r/${code}`;
  const set = (patch: Partial<RaceMeta>) => void room.setMeta({ ...meta, ...patch });

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-gutter py-[clamp(24px,5vw,56px)] lg:grid-cols-[1.2fr_1fr]">
      <title>{`Room ${code} · Sudoku Race`}</title>
      <section className="flex flex-col gap-5">
        <div>
          <p className="m-0 font-mono text-xs font-bold uppercase">Room code</p>
          <p className="m-0 text-[clamp(56px,12vw,96px)] leading-none font-black tracking-widest">
            {code}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN}
            onClick={() =>
              void navigator.clipboard
                ?.writeText(`Race me at Sudoku on Lepak: ${link}`)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
            }
          >
            {copied ? 'Link copied!' : 'Copy invite link'}
          </button>
        </div>
        <p className="m-0 font-mono text-sm break-all text-mute">{link}</p>

        {isHost ? (
          <div className="flex flex-col gap-4 border-3 border-ink p-4">
            <h2 className="m-0 text-xl font-black uppercase">Settings</h2>
            <Choice
              label="Level"
              options={LEVELS}
              value={meta.level}
              onChange={(level) => set({ level })}
            />
            <Choice
              label="Wrong numbers"
              options={RULES.map((r) => r.id)}
              value={meta.rule}
              onChange={(rule) => set({ rule })}
              show={(id) => RULES.find((r) => r.id === id)!.label}
            />
            <Choice
              label="Time limit"
              options={LIMIT_CHOICES}
              value={meta.limitMin as (typeof LIMIT_CHOICES)[number]}
              onChange={(limitMin) => set({ limitMin })}
              show={(m) => `${m} min`}
            />
            <label className="flex min-h-11 cursor-pointer items-center gap-3 font-mono text-sm">
              <input
                type="checkbox"
                checked={!meta.hostPlays}
                onChange={(e) => set({ hostPlays: !e.target.checked })}
                className="size-5"
              />
              Class mode: I only watch (put this screen on the projector)
            </label>
            <button
              type="button"
              disabled={rows.length === 0}
              onClick={() => void room.setMeta(startRace(meta, room.now()))}
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
            {meta.level[0]!.toUpperCase() + meta.level.slice(1)} ·{' '}
            {RULES.find((r) => r.id === meta.rule)!.label} · {meta.limitMin} min. Waiting for the
            host to start.
          </p>
        )}
      </section>

      <section aria-labelledby="racers-h" className="flex flex-col gap-3">
        <h2 id="racers-h" className="m-0 text-xl font-black uppercase">
          Racers ({rows.length})
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => (
            <li key={r.uid} className="flex items-center gap-3 border-3 border-ink bg-paper p-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink font-mono font-bold uppercase"
                style={{ background: r.uid === room.selfId ? ACCENT : '#f9fafb' }}
              >
                {[...r.nick][0] ?? '?'}
              </span>
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
  selfId,
}: {
  meta: RaceMeta;
  rows: Standing[];
  isHost: boolean;
  room: RaceRoom;
  selfId: string;
}) {
  const winner = rows.find((r) => r.status === 'finished');
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Results · Sudoku Race</title>
      <div>
        <p className="m-0 font-mono text-xs font-bold uppercase">Race over</p>
        <h1 className="heading-lg m-0">
          {winner ? `${winner.nick} wins.` : 'Nobody finished. Rematch?'}
        </h1>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((r) => (
          <li
            key={r.uid}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-3 border-ink px-3 py-3"
            style={{ background: r.place === 1 && r.status === 'finished' ? ACCENT : undefined }}
          >
            <span className="w-8 text-2xl font-black">{r.place}</span>
            <span className="min-w-0 flex-1 truncate text-lg font-bold">
              {r.nick}
              {r.uid === selfId && ' (you)'}
            </span>
            <span className="font-mono text-sm">
              {r.status === 'finished'
                ? `${clock((r.scoreMs ?? 0) / 1000)}${meta.rule === 'penalty' && r.mistakes ? ` (incl. +${(r.mistakes * PENALTY_MS) / 1000}s)` : ''}`
                : r.status === 'out'
                  ? `Out at ${Math.round(r.progress * 100)}%`
                  : `${Math.round(r.progress * 100)}% done`}
              {' · '}
              {r.mistakes} {r.mistakes === 1 ? 'mistake' : 'mistakes'}
            </span>
          </li>
        ))}
      </ol>
      {isHost ? (
        <button
          type="button"
          onClick={() => void room.setMeta(rematch(meta))}
          className={`push ${BTN_BASE} self-start bg-ink text-paper shadow-hard`}
        >
          Rematch, new puzzle →
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
