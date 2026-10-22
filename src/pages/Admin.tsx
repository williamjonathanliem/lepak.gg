import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { APPS } from '../apps/registry';
import {
  ROOM_KINDS,
  adminSession,
  adminSignIn,
  adminSignOut,
  approveNote,
  banAuthor,
  closeRoom,
  deleteNote,
  listRooms,
  resetVotes,
  unban,
  watchBans,
  type AdminSession,
  type RoomKind,
  type RoomRow,
} from '../lib/admin';
import { Sticker } from '../components/Sticker';
import { firebaseEnabled } from '../lib/firebase';
import { SITE } from '../lib/site';
import { watchVotes, type VoteSnapshot } from '../lib/votes';
import { NOTE_COLORS, watchWall, type WallNote } from '../lib/wall';

// /admin: not linked from anywhere, and hidden from search engines. Hiding it isn't the
// lock though: the database rules only obey accounts listed at admins/{uid} (see
// src/lib/admin.ts), so a stranger who finds this page can't do anything.

type Tab = 'wall' | 'rooms' | 'votes';

const BASE =
  'min-h-11 min-w-20 cursor-pointer border-3 border-ink px-3 font-mono text-xs font-bold uppercase disabled:cursor-wait disabled:opacity-50';
const BTN = `${BASE} bg-paper text-ink hover:bg-soft`;
/** Destructive actions: solid black. */
const DANGER = `${BASE} bg-ink text-paper hover:bg-[#333]`;

function ago(ms: number): string {
  if (!ms) return 'never';
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export default function Admin() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [failed, setFailed] = useState<string | null>(
    firebaseEnabled ? null : 'Firebase is not set up (.env.local).',
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!firebaseEnabled) return;
    adminSession().then(
      (s) => {
        setSession(s);
        setFailed(null);
      },
      (e: unknown) => setFailed(e instanceof Error ? e.message : String(e)),
    );
  }, [attempt]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <title>Admin · Lepak.gg</title>
      <meta name="robots" content="noindex, nofollow" />
      <header className="flex items-center justify-between gap-3 border-b-3 border-ink px-gutter py-3">
        <Link to="/hub" className="font-mono text-sm font-bold text-ink no-underline">
          ■ LEPAK.GG / ADMIN
        </Link>
        {session && !session.guest && (
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="max-sm:hidden">{session.email}</span>
            <button type="button" className={BTN} onClick={() => void adminSignOut()}>
              Sign out
            </button>
          </div>
        )}
      </header>
      {session?.guest && !failed ? (
        <SignIn />
      ) : (
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-gutter py-8">
          {failed ? (
            <div className="flex flex-col items-start gap-3">
              <p className="m-0 font-mono text-sm">Could not reach Firebase.</p>
              <code className="border-3 border-ink bg-soft px-3 py-2 font-mono text-xs break-all">
                {failed}
              </code>
              <button type="button" className={BTN} onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : !session ? (
            <p className="font-mono text-sm text-mute">Loading...</p>
          ) : !session.admin ? (
            <NotAdmin uid={session.uid} />
          ) : (
            <Panel />
          )}
        </main>
      )}
    </div>
  );
}

// The sign-in page is an easter egg: anyone curious enough to type /admin gets a joke.
// Wrong passwords make the left side more and more suspicious.
const SUSPICION = [
  'This is the back room. Staff only. The kopi here isn’t free.',
  'Hmm. That wasn’t it. Close though. (It wasn’t close.)',
  'Two tries. The makcik at the canteen is watching you now.',
  'Three tries. We’ve told your lecturer. Just kidding. Or are we?',
  'Okay okay, you win at persistence. You still don’t get in. Go play KataBomb.',
];

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminSignIn(email.trim(), password);
    } catch {
      setError('Wrong email or password.');
      setTries((n) => n + 1);
      setBusy(false);
    }
  }

  return (
    <main className="grid flex-1 md:grid-cols-2">
      <section
        aria-labelledby="egg-heading"
        className="relative flex flex-col justify-between gap-10 overflow-hidden bg-ink px-gutter py-[clamp(40px,6vw,80px)] text-paper"
      >
        <p className="m-0 font-mono text-sm text-mute-dark">// ??? :: STAFF ONLY</p>
        <div className="flex flex-col gap-6">
          <h1
            id="egg-heading"
            className="m-0 text-[clamp(48px,7.5vw,112px)] leading-[0.9] font-black tracking-[-0.045em] uppercase"
          >
            You found us.
          </h1>
          <p className="m-0 max-w-[30ch] text-[clamp(22px,2.4vw,32px)] leading-tight font-black">
            Are you sure you’re supposed to be here?
          </p>
          <p aria-live="polite" className="m-0 max-w-[44ch] font-mono text-sm text-mute-dark">
            {SUSPICION[Math.min(tries, SUSPICION.length - 1)]}
          </p>
        </div>
        <Link
          to="/hub"
          className="w-fit font-mono text-sm font-bold text-paper underline underline-offset-4"
        >
          ← Take me back to lepak
        </Link>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-8 right-6 max-sm:hidden"
        >
          <Sticker variant="light" rotate={8} bob className="text-ink">
            {tries >= 2 ? 'SUS' : 'NO ENTRY'}
          </Sticker>
        </div>
        {/* tape across the corner, like a "do not cross" strip */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-24 w-[30rem] rotate-[-28deg] overflow-hidden border-y-3 border-ink bg-[#ffd23f] py-1 text-center font-mono text-xs font-bold tracking-widest whitespace-nowrap text-ink max-md:hidden"
        >
          DO NOT CROSS · DO NOT CROSS · DO NOT CROSS
        </div>
      </section>

      <section className="flex flex-col items-center justify-center gap-6 px-gutter py-[clamp(40px,6vw,80px)]">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex w-full max-w-sm flex-col gap-4 border-3 border-ink p-5 shadow-hard"
        >
          <h2 className="m-0 text-2xl font-black uppercase">Admin sign in</h2>
          <label className="flex flex-col gap-1.5 font-mono text-sm font-bold">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 border-3 border-ink bg-paper px-3 font-sans text-base font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 font-mono text-sm font-bold">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-12 border-3 border-ink bg-paper px-3 font-sans text-base font-normal"
            />
          </label>
          <button type="submit" disabled={busy} className={`${DANGER} push shadow-hard-sm`}>
            {busy ? 'Checking your ID...' : 'Let me in →'}
          </button>
          <p role="alert" className="m-0 min-h-5 font-mono text-sm font-bold">
            {error}
          </p>
        </form>
        <p className="m-0 max-w-sm text-center font-mono text-sm">
          Want to be an admin? Contact{' '}
          <a href={`mailto:${SITE.contact}`} className="font-bold text-ink underline">
            {SITE.contact}
          </a>
        </p>
      </section>
    </main>
  );
}

function NotAdmin({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="flex max-w-xl flex-col gap-4 border-3 border-ink p-5">
      <h1 className="m-0 text-2xl font-black uppercase">Signed in, not an admin yet</h1>
      <p className="m-0">To make this account an admin:</p>
      <ol className="m-0 flex flex-col gap-1.5 pl-5">
        <li>Firebase console → Realtime Database → Data.</li>
        <li>
          Add a child <code>admins</code>, and inside it your ID below with the value{' '}
          <code>true</code>.
        </li>
        <li>Reload this page.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <code className="border-3 border-ink bg-soft px-3 py-2 font-mono text-sm break-all">
          {uid}
        </code>
        <button
          type="button"
          className={BTN}
          onClick={() => {
            void navigator.clipboard?.writeText(uid).then(() => setCopied(true));
          }}
        >
          {copied ? 'Copied' : 'Copy ID'}
        </button>
      </div>
    </section>
  );
}

function Panel() {
  const [tab, setTab] = useState<Tab>('wall');
  return (
    <>
      <div role="tablist" className="flex w-fit border-3 border-ink">
        {(['wall', 'rooms', 'votes'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 cursor-pointer border-0 px-4 font-mono text-sm font-bold uppercase not-last:border-r-3 not-last:border-ink ${tab === t ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'wall' && <WallAdmin />}
      {tab === 'rooms' && <RoomsAdmin />}
      {tab === 'votes' && <VotesAdmin />}
      <p className="m-0 font-mono text-xs text-mute">
        Lepak Pages takedowns aren’t here yet: they need the Supabase admin key set up on the
        server.
      </p>
    </>
  );
}

/** Runs an admin action with a busy flag and a visible error. */
function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function run(key: string, fn: () => Promise<void>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, run };
}

function WallAdmin() {
  const [notes, setNotes] = useState<WallNote[] | null>(null);
  const [bans, setBans] = useState<{ uid: string; at: number }[]>([]);
  const [onlyFlagged, setOnlyFlagged] = useState(true);
  const { busy, error, run } = useAction();

  useEffect(() => watchWall(setNotes, () => setNotes([])), []);
  useEffect(() => watchBans(setBans), []);

  const flagged = (notes ?? []).filter((n) => n.reports > 0);
  const list = [...(onlyFlagged ? flagged : (notes ?? []))].sort(
    (a, b) => b.reports - a.reports || b.at - a.at,
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-2xl font-black uppercase">
          Wall: {notes?.length ?? '...'} notes, {flagged.length} reported
        </h1>
        <label className="flex min-h-11 items-center gap-2 font-mono text-sm">
          <input
            type="checkbox"
            checked={onlyFlagged}
            onChange={(e) => setOnlyFlagged(e.target.checked)}
            className="size-5"
          />
          Reported only
        </label>
      </div>
      {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
      {notes && list.length === 0 && (
        <p className="m-0 font-mono text-sm text-mute">Nothing to review.</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {list.map((n) => (
          <li
            key={n.id}
            className="flex flex-wrap items-start gap-4 border-3 border-ink p-3"
            style={{ borderLeft: `14px solid ${NOTE_COLORS[n.color]}` }}
          >
            <div className="min-w-0 flex-[1_1_280px]">
              <p className="m-0 font-bold break-words">{n.text}</p>
              <p className="m-0 mt-1 font-mono text-xs text-mute">
                {n.kind} · by {n.nick} · {ago(n.at)} · +{n.plus} ·{' '}
                <b className={n.reports ? 'text-ink' : ''}>{n.reports} reports</b>
                {n.hidden && ' · HIDDEN'}
                {n.approved && ' · approved'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {n.reports > 0 && (
                <button
                  type="button"
                  disabled={busy !== null}
                  className={BTN}
                  onClick={() => void run(n.id, () => approveNote(n.id))}
                >
                  Keep
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                className={BTN}
                onClick={() => void run(n.id, () => deleteNote(n.id))}
              >
                Delete
              </button>
              <button
                type="button"
                disabled={busy !== null || !n.uid}
                className={DANGER}
                onClick={() =>
                  void run(
                    n.id,
                    () =>
                      banAuthor(
                        n.uid,
                        (notes ?? []).filter((x) => x.uid === n.uid).map((x) => x.id),
                      ),
                    `Ban ${n.nick} for 30 days and delete all their notes?`,
                  )
                }
              >
                Ban author
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="m-0 mt-4 text-lg font-black uppercase">Banned ({bans.length})</h2>
      {bans.length === 0 ? (
        <p className="m-0 font-mono text-sm text-mute">Nobody.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {bans.map((b) => (
            <li key={b.uid} className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <code className="break-all">{b.uid}</code>
              <span className="text-mute">{ago(b.at)}</span>
              <button
                type="button"
                disabled={busy !== null}
                className={BTN}
                onClick={() => void run(b.uid, () => unban(b.uid))}
              >
                Unban
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoomsAdmin() {
  return (
    <section className="flex flex-col gap-8">
      {ROOM_KINDS.map((k) => (
        <RoomList key={k.id} kind={k} />
      ))}
    </section>
  );
}

function RoomList({ kind }: { kind: RoomKind }) {
  const [rows, setRows] = useState<RoomRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [version, setVersion] = useState(0);
  const { busy, error, run } = useAction();

  useEffect(() => {
    let live = true;
    listRooms(kind).then(
      (r) => live && setRows(r),
      () => live && setLoadError(true),
    );
    return () => {
      live = false;
    };
  }, [kind, version]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-black uppercase">
          {kind.label} {rows && `(${rows.length})`}
        </h2>
        <button type="button" className={BTN} onClick={() => setVersion((v) => v + 1)}>
          Refresh
        </button>
      </div>
      {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
      {loadError ? (
        <p className="m-0 font-mono text-sm">Could not load. Are the new rules published?</p>
      ) : !rows ? (
        <p className="m-0 font-mono text-sm text-mute">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="m-0 font-mono text-sm text-mute">No rooms.</p>
      ) : (
        <div className="overflow-x-auto border-3 border-ink">
          <table className="w-full border-collapse font-mono text-xs">
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b-2 border-ink/15 last:border-b-0">
                  <td className="px-3 py-2 font-bold">
                    {r.code.length > 8 ? `${r.code.slice(0, 8)}…` : r.code}
                    {r.note && <span className="ml-2 font-normal text-mute">{r.note}</span>}
                  </td>
                  <td className="px-3 py-2">{ago(r.updatedAt)}</td>
                  <td className="px-3 py-2">{r.people} in</td>
                  <td className="px-3 py-2">
                    {r.href && (
                      <Link to={r.href} className="text-ink">
                        Open
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-1 text-right">
                    <button
                      type="button"
                      disabled={busy !== null}
                      className={DANGER}
                      onClick={() =>
                        void run(
                          r.code,
                          async () => {
                            await closeRoom(kind, r.code);
                            setRows((cur) => cur?.filter((x) => x.code !== r.code) ?? null);
                          },
                          `Close ${kind.label} room ${r.code} for everyone?`,
                        )
                      }
                    >
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VotesAdmin() {
  const [votes, setVotes] = useState<VoteSnapshot | null>(null);
  const { busy, error, run } = useAction();
  useEffect(() => watchVotes(setVotes), []);

  const rows = APPS.filter((a) => (votes?.counts[a.id] ?? 0) > 0).sort(
    (a, b) => (votes?.counts[b.id] ?? 0) - (votes?.counts[a.id] ?? 0),
  );

  return (
    <section className="flex flex-col gap-3">
      <h1 className="m-0 text-2xl font-black uppercase">Votes for the next app</h1>
      {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
      {!votes ? (
        <p className="m-0 font-mono text-sm text-mute">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="m-0 font-mono text-sm text-mute">No votes yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center gap-3 border-3 border-ink px-3 py-2">
              <span className="flex-1 font-bold">{a.name}</span>
              <span className="font-mono text-sm">{votes.counts[a.id]}</span>
              <button
                type="button"
                disabled={busy !== null}
                className={BTN}
                onClick={() =>
                  void run(a.id, () => resetVotes(a.id), `Reset all votes for ${a.name}?`)
                }
              >
                Reset
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
