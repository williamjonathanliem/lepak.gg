import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { DateTimePicker } from '../../components/DateTimePicker';
import { firebaseEnabled } from '../../lib/firebase';
import { getNickname } from '../../lib/identity';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import { readStorage, writeStorage } from '../../lib/storage';
import {
  LIMITS,
  checkDraft,
  countdown,
  sortDeadlines,
  toIcs,
  urgency,
  type BoardMeta,
  type Deadline,
  type Urgency,
} from './logic/deadlines';
import { openBoard, type Board } from './net/board';

// Deadlines: /deadlines (make or open a board) and /deadlines/r/:code (the board).
// The class rep makes a board and adds deadlines once; everyone with the code sees live
// countdowns. Ticking "done" is personal and stays on your device.

const ACCENT = '#ff8fd0';
const RECENT_KEY = 'lepak.deadlines.recent';
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const BTN = `${BTN_BASE} bg-paper text-ink`;
const INPUT = 'min-h-11 min-w-0 border-3 border-ink bg-paper px-3 text-base';

const URGENCY_COLOUR: Record<Urgency, string> = {
  overdue: 'var(--color-mute)',
  today: 'var(--color-hot)',
  soon: '#ffd23f',
  later: '#7ee081',
};
const URGENCY_LABEL: Record<Urgency, string> = {
  overdue: 'Past',
  today: 'Due today',
  soon: 'Soon',
  later: 'Coming up',
};

interface Recent {
  code: string;
  title: string;
}

function loadRecent(): Recent[] {
  try {
    const v = JSON.parse(readStorage(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as Recent[]).filter((r) => isValidRoomCode(r.code)) : [];
  } catch {
    return [];
  }
}

function remember(code: string, title: string) {
  const rest = loadRecent().filter((r) => r.code !== code);
  writeStorage(RECENT_KEY, JSON.stringify([{ code, title }, ...rest].slice(0, 6)));
}

export default function Deadlines() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Deadlines', to: '/deadlines', accent: ACCENT }} />
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
  if (!isValidRoomCode(code)) return <Navigate to="/deadlines" replace />;
  return <BoardPage key={code} code={code} />;
}

// ---------- home ----------

function Home() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent] = useState(loadRecent);

  async function create(e: FormEvent) {
    e.preventDefault();
    const name = title.trim().slice(0, LIMITS.boardTitle);
    if (!name) return setError('Give the board a name, like your course code.');
    setBusy(true);
    setError('');
    try {
      for (let tries = 0; tries < 5; tries++) {
        const c = generateRoomCode();
        const board = await openBoard(c);
        try {
          await board.create(name);
          remember(c, name);
          navigate(`/deadlines/r/${c}`);
          return;
        } catch (err) {
          if (!(err instanceof Error && err.message === 'taken')) throw err;
        } finally {
          board.close();
        }
      }
      throw new Error('busy');
    } catch {
      setError('Could not make the board. Check your internet and try again.');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Deadlines · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Deadlines.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          The class rep adds each due date once. Everyone with the code sees the countdown, ticks
          off their own, and can add it to their calendar.
        </p>
      </div>
      {!firebaseEnabled && (
        <p className="m-0 border-3 border-ink p-4 font-mono text-sm">
          Boards need the Lepak server, which this copy is not set up for.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <form
          onSubmit={(e) => void create(e)}
          className="flex flex-col gap-3 border-3 border-ink p-4 shadow-hard"
          style={{ background: ACCENT }}
        >
          <h2 className="m-0 text-xl font-black uppercase">Make a board</h2>
          <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
            Board name
            <input
              value={title}
              maxLength={LIMITS.boardTitle}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="BIO1001, Sem 2"
              className={`${INPUT} font-sans font-normal normal-case`}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !firebaseEnabled}
            className={`push ${BTN_BASE} bg-ink text-paper shadow-hard-sm`}
          >
            {busy ? 'Making...' : 'Make board →'}
          </button>
          {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = normalizeRoomCode(code);
            if (isValidRoomCode(c)) navigate(`/deadlines/r/${c}`);
          }}
          className="flex flex-col gap-3 border-3 border-ink p-4"
        >
          <h2 className="m-0 text-xl font-black uppercase">Got a code?</h2>
          <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
            Board code
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
            Open board
          </button>
        </form>
      </div>
      {recent.length > 0 && (
        <section aria-labelledby="recent-h" className="flex flex-col gap-2">
          <h2 id="recent-h" className="m-0 font-mono text-sm font-bold uppercase">
            Your boards
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {recent.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  onClick={() => navigate(`/deadlines/r/${r.code}`)}
                  className={BTN}
                >
                  {r.title} · {r.code}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// ---------- the board ----------

function useBoard(code: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [meta, setMeta] = useState<BoardMeta | null | undefined>(undefined);
  const [items, setItems] = useState<Deadline[]>([]);
  const [failed, setFailed] = useState(!firebaseEnabled);
  useEffect(() => {
    if (!firebaseEnabled) return;
    let b: Board | null = null;
    let closed = false;
    openBoard(code)
      .then((opened) => {
        if (closed) return opened.close();
        b = opened;
        setBoard(opened);
        opened.onMeta(setMeta, () => setFailed(true));
        opened.onItems(setItems);
      })
      .catch(() => setFailed(true));
    return () => {
      closed = true;
      b?.close();
    };
  }, [code]);
  return { board, meta, items, failed };
}

/** Your own "done" ticks for a board, kept on this device. */
function useDone(code: string) {
  const key = `lepak.deadlines.done.${code}`;
  const [done, setDone] = useState<string[]>(() => {
    try {
      const v = JSON.parse(readStorage(key) ?? '[]') as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const toggle = (id: string) =>
    setDone((d) => {
      const next = d.includes(id) ? d.filter((x) => x !== id) : [...d, id];
      writeStorage(key, JSON.stringify(next));
      return next;
    });
  return { done, toggle };
}

function BoardPage({ code }: { code: string }) {
  const { board, meta, items, failed } = useBoard(code);
  const { done, toggle } = useDone(code);
  const [now, setNow] = useState(() => Date.now());
  const [hideDone, setHideDone] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (meta) remember(code, meta.title);
  }, [code, meta]);

  if (failed) {
    return (
      <Message>
        Could not open this board. Check your internet. If it keeps happening, the board server may
        not be set up yet.
      </Message>
    );
  }
  if (meta === undefined) return <Message>Opening the board...</Message>;
  if (meta === null) {
    return <Message>No board with the code {code}. Check the code with your class rep.</Message>;
  }

  const isRep = board?.selfId === meta.owner;
  const canAdd = isRep || meta.open;
  const canEdit = (d: Deadline) => isRep || (meta.open && d.byUid === board?.selfId);
  const list = sortDeadlines(items, now).filter((d) => !(hideDone && done.includes(d.id)));
  const upcoming = items.filter((d) => d.due >= now && !done.includes(d.id)).length;

  function share() {
    void navigator.clipboard
      ?.writeText(`${meta!.title} deadlines on Lepak: ${location.origin}/deadlines/r/${code}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
  }

  function calendar(d: Deadline) {
    const blob = new Blob([toIcs(d, Date.now())], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(d.course || 'deadline').replace(/[^\w-]+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const when = (ms: number) =>
    new Date(ms).toLocaleString('en-MY', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>{`${meta.title} · Deadlines`}</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 font-mono text-xs uppercase">
            {isRep ? 'Your board (class rep)' : 'Class board'} · code{' '}
            <b className="tracking-widest">{code}</b>
          </p>
          <h1 className="m-0 mt-1 text-[clamp(30px,5vw,48px)] leading-none font-black break-words uppercase">
            {meta.title}
          </h1>
          <p className="m-0 mt-2 font-mono text-sm">
            {upcoming === 0 ? 'Nothing coming up. Lepak.' : `${upcoming} still to do`}
          </p>
        </div>
        <button
          type="button"
          onClick={share}
          className={`push ${BTN_BASE} shadow-hard-sm`}
          style={{ background: ACCENT }}
        >
          {copied ? 'Link copied!' : 'Share with class'}
        </button>
      </div>

      {isRep && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 border-3 border-ink p-3 font-mono text-sm">
          <input
            type="checkbox"
            checked={meta.open}
            onChange={(e) => void board?.saveMeta({ ...meta, open: e.target.checked })}
            className="size-5"
          />
          Let anyone with the code add deadlines (they can only change their own)
        </label>
      )}

      {canAdd && (
        <DeadlineForm
          key={editing?.id ?? 'new'}
          editing={editing}
          now={now}
          onCancel={() => setEditing(null)}
          onSave={async (d) => {
            if (editing) await board!.update({ ...editing, ...d });
            else await board!.add({ ...d, by: getNickname() ?? 'Someone' });
            setEditing(null);
          }}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-black uppercase">Due dates</h2>
        {done.length > 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 font-mono text-sm">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
              className="size-5"
            />
            Hide ones I’ve done
          </label>
        )}
      </div>

      {list.length === 0 ? (
        <p className="m-0 border-3 border-dashed border-ink p-6 text-center">
          {items.length
            ? 'All done. Steady!'
            : isRep
              ? 'No deadlines yet. Add the first one above.'
              : 'The class rep hasn’t added any deadlines yet.'}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {list.map((d) => {
            const u = urgency(d.due, now);
            const mine = done.includes(d.id);
            return (
              <li
                key={d.id}
                className={`flex flex-col gap-2 border-3 border-ink bg-paper p-4 ${mine || u === 'overdue' ? 'opacity-60' : ''}`}
                style={{ borderLeft: `14px solid ${URGENCY_COLOUR[u]}` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 font-mono text-xs uppercase">
                      {d.course && <b>{d.course} · </b>}
                      {URGENCY_LABEL[u]}
                    </p>
                    <p
                      className={`m-0 text-xl font-black break-words ${mine ? 'line-through' : ''}`}
                    >
                      {d.title}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="m-0 text-lg font-black">{countdown(d.due, now)}</p>
                    <p className="m-0 font-mono text-xs">{when(d.due)}</p>
                  </div>
                </div>
                {d.note && <p className="m-0 text-sm break-words">{d.note}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 border-3 border-ink px-3 font-mono text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={mine}
                      onChange={() => toggle(d.id)}
                      className="size-5"
                    />
                    Done
                  </label>
                  <button type="button" onClick={() => calendar(d)} className={BTN}>
                    Add to calendar
                  </button>
                  {canEdit(d) && (
                    <>
                      <button type="button" onClick={() => setEditing(d)} className={BTN}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete "${d.title}" for everyone?`)) {
                            void board?.remove(d.id);
                          }
                        }}
                        className={BTN}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <span className="ml-auto font-mono text-xs text-mute">added by {d.by}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="m-0 font-mono text-xs text-mute">
        Boards are deleted 30 days after the last change and the last due date.
      </p>
    </main>
  );
}

function DeadlineForm({
  editing,
  now,
  onSave,
  onCancel,
}: {
  editing: Deadline | null;
  now: number;
  onSave: (d: Omit<Deadline, 'id' | 'by' | 'byUid'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [course, setCourse] = useState(editing?.course ?? '');
  const [due, setDue] = useState<number | null>(editing ? editing.due : null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const dueMs = due;
    const problem = checkDraft({ title, due: dueMs }, now);
    if (problem) {
      return setError(
        problem === 'title'
          ? 'What is it? Add a title.'
          : problem === 'due'
            ? 'Pick the due date and time.'
            : 'That date is in the past. Check the year?',
      );
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        title: title.trim().slice(0, LIMITS.title),
        course: course.trim().slice(0, LIMITS.course),
        due: dueMs!,
        note: note.trim().slice(0, LIMITS.note),
      });
      if (!editing) {
        setTitle('');
        setNote('');
        setDue(null);
      }
    } catch {
      setError('Could not save. Check your internet.');
    } finally {
      setBusy(false);
    }
  }

  const label = 'flex flex-col gap-1 font-mono text-xs font-bold uppercase';
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 border-3 border-ink p-4">
      <h2 className="m-0 text-xl font-black uppercase">
        {editing ? 'Edit deadline' : 'Add a deadline'}
      </h2>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className={label}>
          What’s due
          <input
            value={title}
            maxLength={LIMITS.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lab report 3"
            className={`${INPUT} font-sans font-normal normal-case`}
          />
        </label>
        <label className={label}>
          Course
          <input
            value={course}
            maxLength={LIMITS.course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="BIO1001"
            className={`${INPUT} font-sans font-normal`}
          />
        </label>
        <DateTimePicker label="Due" value={due} onChange={setDue} accent={ACCENT} />
        <label className={label}>
          Note (optional)
          <input
            value={note}
            maxLength={LIMITS.note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Submit on the portal"
            className={`${INPUT} font-sans font-normal normal-case`}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className={`push ${BTN_BASE} bg-ink text-paper shadow-hard-sm`}
        >
          {busy ? 'Saving...' : editing ? 'Save' : 'Add deadline'}
        </button>
        {editing && (
          <button type="button" onClick={onCancel} className={BTN}>
            Cancel
          </button>
        )}
        {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
      </div>
    </form>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-gutter py-16">
      <p className="m-0 border-3 border-ink p-5 font-mono text-sm">{children}</p>
    </main>
  );
}
