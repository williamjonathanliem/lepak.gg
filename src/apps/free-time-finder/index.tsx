import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { NicknameGate } from '../katabomb/ui/NicknameGate';
import { firebaseEnabled } from '../../lib/firebase';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import {
  MAX_DAYS,
  TITLE_MAX,
  bestBlocks,
  blockLabel,
  dayLabel,
  emptyFree,
  hourLabel,
  nextDays,
  normaliseFree,
  setSlots,
  slotsPerDay,
  whoIsFree,
  type Person,
  type PollMeta,
} from './logic/free';
import { openPoll, type Poll } from './net/poll';

// Free-Time Finder: /free (make or open a poll) and /free/r/:code (the poll).
// Everyone paints the hours they're free; the heat map and "best times" show the overlap.

const ACCENT = '#4fd1e8';
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const BTN = `${BTN_BASE} bg-paper text-ink`;
const INPUT = 'min-h-11 min-w-0 border-3 border-ink bg-paper px-3 text-base';

export default function FreeTimeFinder() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Free-Time Finder', to: '/free', accent: ACCENT }} />
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
  if (!isValidRoomCode(code)) return <Navigate to="/free" replace />;
  return <NicknameGate>{(nick) => <PollPage key={code} code={code} nick={nick} />}</NicknameGate>;
}

// ---------- home ----------

function Home() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [allDays] = useState(() => nextDays(new Date(), MAX_DAYS));
  const [days, setDays] = useState<string[]>(() => allDays.slice(0, 7));
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(22);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!days.length) return setError('Pick at least one day.');
    if (to <= from) return setError('The end time must be after the start.');
    setBusy(true);
    setError('');
    try {
      for (let tries = 0; tries < 5; tries++) {
        const c = generateRoomCode();
        const poll = await openPoll(c);
        try {
          await poll.create({
            title: title.trim().slice(0, TITLE_MAX) || 'When are we free?',
            days: [...days].sort(),
            from,
            to,
          });
          navigate(`/free/r/${c}`);
          return;
        } catch (err) {
          if (!(err instanceof Error && err.message === 'taken')) throw err;
        } finally {
          poll.close();
        }
      }
      throw new Error('busy');
    } catch {
      setError('Could not make the poll. Check your internet and try again.');
      setBusy(false);
    }
  }

  const hours = Array.from({ length: 25 }, (_, h) => h);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Free-Time Finder · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Free-Time Finder.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          No more “when free ah?” in the group chat. Everyone paints when they’re free, and you see
          the best time to meet.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
        <form
          onSubmit={(e) => void create(e)}
          className="flex flex-col gap-4 border-3 border-ink p-4 shadow-hard"
        >
          <h2 className="m-0 text-xl font-black uppercase">Make a poll</h2>
          <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
            What for
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Group project meeting"
              className={`${INPUT} font-sans font-normal normal-case`}
            />
          </label>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 p-0 font-mono text-xs font-bold uppercase">
              Which days ({days.length})
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {allDays.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays((ds) => (on ? ds.filter((x) => x !== d) : [...ds, d]))}
                    className={`min-h-11 cursor-pointer border-2 border-ink px-2 font-mono text-xs font-bold ${on ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
                  >
                    {dayLabel(d)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
              From
              <select
                value={from}
                onChange={(e) => setFrom(Number(e.target.value))}
                className={`${INPUT} font-sans font-normal`}
              >
                {hours.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
              Until
              <select
                value={to}
                onChange={(e) => setTo(Number(e.target.value))}
                className={`${INPUT} font-sans font-normal`}
              >
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {h === 24 ? '12 am (midnight)' : hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !firebaseEnabled}
            className={`push ${BTN_BASE} shadow-hard-sm`}
            style={{ background: ACCENT }}
          >
            {busy ? 'Making...' : 'Make poll →'}
          </button>
          {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = normalizeRoomCode(code);
            if (isValidRoomCode(c)) navigate(`/free/r/${c}`);
          }}
          className="flex h-fit flex-col gap-3 border-3 border-ink p-4"
        >
          <h2 className="m-0 text-xl font-black uppercase">Got a code?</h2>
          <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
            Poll code
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
            Open poll
          </button>
        </form>
      </div>
    </main>
  );
}

// ---------- the poll ----------

function usePoll(code: string) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [meta, setMeta] = useState<PollMeta | null | undefined>(undefined);
  const [people, setPeople] = useState<Person[]>([]);
  const [failed, setFailed] = useState(!firebaseEnabled);
  useEffect(() => {
    if (!firebaseEnabled) return;
    let p: Poll | null = null;
    let closed = false;
    openPoll(code)
      .then((opened) => {
        if (closed) return opened.close();
        p = opened;
        setPoll(opened);
        opened.onMeta(setMeta, () => setFailed(true));
        opened.onPeople(setPeople);
      })
      .catch(() => setFailed(true));
    return () => {
      closed = true;
      p?.close();
    };
  }, [code]);
  return { poll, meta, people, failed };
}

function PollPage({ code, nick }: { code: string; nick: string }) {
  const { poll, meta, people, failed } = usePoll(code);
  /** My free slots while I'm editing (null = use what's saved). */
  const [draft, setDraft] = useState<string | null>(null);
  const [view, setView] = useState<'mine' | 'all' | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const painting = useRef<boolean | null>(null);
  const draftRef = useRef<string | null>(null);

  if (failed) {
    return (
      <Message>
        Could not open this poll. Check your internet. If it keeps happening, the poll server may
        not be set up yet.
      </Message>
    );
  }
  if (meta === undefined) return <Message>Opening the poll...</Message>;
  if (meta === null) return <Message>No poll with the code {code}. Check the code.</Message>;

  const saved = people.find((p) => p.uid === poll?.selfId);
  const mine = draft ?? normaliseFree(saved?.free ?? emptyFree(meta), meta);
  const mode = view ?? (saved ? 'all' : 'mine');
  const others = people.filter((p) => p.uid !== poll?.selfId);
  const everyone = [...others, { uid: 'me', nick, free: mine }].filter((p) => p.free.includes('1'));
  const who = whoIsFree(everyone, meta);
  const best = bestBlocks(everyone, meta, Math.min(2, everyone.length));
  const per = slotsPerDay(meta);

  async function save(free: string) {
    setSaving(true);
    try {
      await poll?.saveMine(nick, free);
    } finally {
      setSaving(false);
    }
  }

  function paint(slot: number, value: boolean) {
    const next = setSlots(draftRef.current ?? mine, [slot], value);
    draftRef.current = next;
    setDraft(next);
  }

  function slotAt(e: PointerEvent): number | null {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const s = (el as HTMLElement | null)?.closest<HTMLElement>('[data-slot]')?.dataset.slot;
    return s === undefined ? null : Number(s);
  }

  function onDown(e: PointerEvent) {
    if (mode !== 'mine') return;
    const s = slotAt(e);
    if (s === null) return;
    e.preventDefault();
    draftRef.current = mine;
    painting.current = mine[s] !== '1';
    paint(s, painting.current);
  }
  function onMove(e: PointerEvent) {
    if (painting.current === null) return;
    const s = slotAt(e);
    if (s !== null) paint(s, painting.current);
  }
  function onUp() {
    if (painting.current === null) return;
    painting.current = null;
    if (draftRef.current) void save(draftRef.current);
  }

  const share = () =>
    void navigator.clipboard
      ?.writeText(`${meta.title}: tap when you're free ${location.origin}/free/r/${code}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });

  const max = Math.max(1, everyone.length);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>{`${meta.title} · Free-Time Finder`}</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 font-mono text-xs uppercase">
            Poll code <b className="tracking-widest">{code}</b> · {everyone.length}{' '}
            {everyone.length === 1 ? 'person' : 'people'} so far
          </p>
          <h1 className="m-0 mt-1 text-[clamp(28px,5vw,44px)] leading-none font-black break-words uppercase">
            {meta.title}
          </h1>
        </div>
        <button
          type="button"
          onClick={share}
          className={`push ${BTN_BASE} shadow-hard-sm`}
          style={{ background: ACCENT }}
        >
          {copied ? 'Link copied!' : 'Share with the group'}
        </button>
      </div>

      {best.length > 0 && (
        <section
          aria-labelledby="best-h"
          className="flex flex-col gap-2 border-3 border-ink p-4"
          style={{ background: ACCENT }}
        >
          <h2 id="best-h" className="m-0 text-lg font-black uppercase">
            Best times
          </h2>
          <ol className="m-0 flex flex-col gap-1 pl-5">
            {best.map((b) => (
              <li key={`${b.day}-${b.start}`}>
                <b>{blockLabel(b, meta)}</b> · {b.names.length} of {everyone.length} free
                {b.names.length < everyone.length && (
                  <span className="text-sm"> ({b.names.join(', ')})</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="View" className="flex border-3 border-ink">
          {(['mine', 'all'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={mode === v}
              onClick={() => setView(v)}
              className={`min-h-11 cursor-pointer border-0 px-4 font-mono text-sm font-bold uppercase not-last:border-r-3 not-last:border-ink ${mode === v ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
            >
              {v === 'mine' ? 'My free times' : 'Everyone'}
            </button>
          ))}
        </div>
        <p className="m-0 font-mono text-xs" aria-live="polite">
          {mode === 'mine'
            ? saving
              ? 'Saving...'
              : 'Tap or drag over the hours you’re free. Saves by itself.'
            : 'Darker = more people free. Tap a box to see who.'}
        </p>
      </div>

      <div className="overflow-x-auto border-3 border-ink">
        <div
          className="grid min-w-fit touch-none select-none"
          style={{
            gridTemplateColumns: `4.5rem repeat(${meta.days.length}, minmax(3.25rem, 1fr))`,
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        >
          <span className="sticky left-0 border-r-2 border-b-2 border-ink bg-paper" />
          {meta.days.map((d) => (
            <span
              key={d}
              className="border-b-2 border-ink bg-paper px-1 py-2 text-center font-mono text-[11px] leading-tight font-bold"
            >
              {dayLabel(d)}
            </span>
          ))}
          {Array.from({ length: per }, (_, k) => (
            <Row key={k}>
              <span className="sticky left-0 border-r-2 border-ink bg-paper px-2 py-1 text-right font-mono text-[11px]">
                {hourLabel(meta.from + k)}
              </span>
              {meta.days.map((d, di) => {
                const slot = di * per + k;
                const names = who[slot]!;
                const on = mine[slot] === '1';
                const label = `${dayLabel(d)} ${hourLabel(meta.from + k)}`;
                return mode === 'mine' ? (
                  <button
                    key={d}
                    type="button"
                    data-slot={slot}
                    aria-pressed={on}
                    aria-label={`${label}: ${on ? 'free' : 'busy'}`}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      const next = setSlots(mine, [slot], !on);
                      setDraft(next);
                      void save(next);
                    }}
                    className={`min-h-10 cursor-pointer border-0 border-r border-b border-ink/20 ${on ? 'bg-[#7ee081]' : 'bg-paper'}`}
                  />
                ) : (
                  <button
                    key={d}
                    type="button"
                    title={names.length ? names.join(', ') : 'Nobody'}
                    aria-label={`${label}: ${names.length} free${names.length ? `, ${names.join(', ')}` : ''}`}
                    onClick={(e) => (e.currentTarget as HTMLElement).focus()}
                    className="group relative min-h-10 cursor-pointer border-0 border-r border-b border-ink/20 font-mono text-[11px] font-bold"
                    style={{
                      background: names.length
                        ? `color-mix(in srgb, ${ACCENT} ${Math.round((names.length / max) * 100)}%, #f9fafb)`
                        : '#f9fafb',
                    }}
                  >
                    {names.length > 0 ? names.length : ''}
                    {names.length > 0 && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 border-2 border-ink bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-paper group-focus:block group-hover:block">
                        {names.join(', ')}
                      </span>
                    )}
                  </button>
                );
              })}
            </Row>
          ))}
        </div>
      </div>
      <p className="m-0 font-mono text-xs text-mute">
        Polls are deleted 14 days after the last change.
      </p>
    </main>
  );
}

/** A grid row without a wrapper element (the cells sit straight in the grid). */
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-gutter py-16">
      <p className="m-0 border-3 border-ink p-5 font-mono text-sm">{children}</p>
    </main>
  );
}
