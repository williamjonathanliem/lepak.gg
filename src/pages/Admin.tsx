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
  postTeamNote,
  resetVotes,
  setNoteKind,
  setPinned,
  listPages,
  takePageDown,
  unban,
  watchBans,
  type AdminSession,
  type PageRow,
  type RoomKind,
  type RoomRow,
} from '../lib/admin';
import { Sticker } from '../components/Sticker';
import { firebaseEnabled } from '../lib/firebase';
import { SITE } from '../lib/site';
import { watchVotes, type VoteSnapshot } from '../lib/votes';
import {
  NOTE_KINDS,
  TEAM_COLOR,
  paperOf,
  sortNotes,
  watchWall,
  type NoteKind,
  type WallNote,
} from '../lib/wall';

// /admin: not linked from anywhere, and hidden from search engines. Hiding it isn't the
// lock though: the database rules only obey accounts listed at admins/{uid} (see
// src/lib/admin.ts), so a stranger who finds this page can't do anything.

const TABS = ['overview', 'wall', 'rooms', 'pages', 'votes'] as const;
type Tab = (typeof TABS)[number];

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
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <>
      <div role="tablist" className="flex w-fit flex-wrap border-3 border-ink">
        {TABS.map((t) => (
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
      {tab === 'overview' && <Overview onOpen={setTab} />}
      {tab === 'wall' && <WallAdmin />}
      {tab === 'rooms' && <RoomsAdmin />}
      {tab === 'pages' && <PagesAdmin />}
      {tab === 'votes' && <VotesAdmin />}
    </>
  );
}

/** Counts at a glance, each one a shortcut to its tab. */
function Overview({ onOpen }: { onOpen: (t: Tab) => void }) {
  const [notes, setNotes] = useState<WallNote[] | null>(null);
  const [bans, setBans] = useState<number | null>(null);
  const [votes, setVotes] = useState<VoteSnapshot | null>(null);
  const [rooms, setRooms] = useState<Record<string, number | null>>({});

  useEffect(() => watchWall(setNotes, () => setNotes([])), []);
  useEffect(() => watchBans((b) => setBans(b.length)), []);
  useEffect(() => watchVotes(setVotes), []);
  useEffect(() => {
    let live = true;
    for (const k of ROOM_KINDS) {
      listRooms(k).then(
        (r) => live && setRooms((all) => ({ ...all, [k.id]: r.length })),
        () => live && setRooms((all) => ({ ...all, [k.id]: null })),
      );
    }
    return () => {
      live = false;
    };
  }, []);

  const reported = notes?.filter((n) => n.reports > 0).length;
  const hidden = notes?.filter((n) => n.hidden).length;
  const totalVotes = votes ? Object.values(votes.counts).reduce((a, b) => a + b, 0) : null;
  const card = (label: string, value: number | null | undefined, to: Tab, alert = false) => (
    <button
      type="button"
      onClick={() => onOpen(to)}
      className={`flex min-h-24 cursor-pointer flex-col items-start justify-between gap-2 border-3 border-ink p-4 text-left shadow-hard-sm ${alert && value ? 'bg-[#ff8fd0]' : 'bg-paper'}`}
    >
      <span className="font-mono text-xs font-bold uppercase">{label}</span>
      <span className="text-4xl leading-none font-black">{value ?? '…'}</span>
    </button>
  );

  return (
    <section className="flex flex-col gap-6">
      <h1 className="m-0 text-2xl font-black uppercase">Overview</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {card('Wall notes', notes?.length, 'wall')}
        {card('Reported', reported, 'wall', true)}
        {card('Hidden by reports', hidden, 'wall', true)}
        {card('Banned', bans, 'wall')}
        {card('Votes cast', totalVotes, 'votes')}
      </div>
      <h2 className="m-0 text-lg font-black uppercase">Open rooms (last 100 of each)</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ROOM_KINDS.map((k) => (
          <div key={k.id}>{card(k.label, rooms[k.id], 'rooms')}</div>
        ))}
      </div>
    </section>
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

const KIND_LABEL: Record<NoteKind, string> = { idea: 'Idea', bug: 'Bug', love: 'Love it' };

/** Post a note as the Lepak team: prompts, news, things to vote on. */
function TeamNote() {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<NoteKind>('idea');
  const [pinned, setPinnedNote] = useState(true);
  const { busy, error, run } = useAction();
  const [done, setDone] = useState(false);
  const clean = text.trim().replace(/\s+/g, ' ');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run('team', async () => {
          await postTeamNote({ text: clean, kind, color: 0, pinned });
          setText('');
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        });
      }}
      className="flex flex-col gap-3 border-3 border-ink p-4 shadow-hard"
      style={{ background: TEAM_COLOR }}
    >
      <h2 className="m-0 text-lg font-black uppercase">Post as Lepak team</h2>
      <label htmlFor="team-text" className="sr-only">
        Note
      </label>
      <textarea
        id="team-text"
        value={text}
        maxLength={140}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        placeholder="New game coming: vote for what's next!"
        className="border-3 border-ink bg-paper p-3 text-base font-bold"
      />
      <div className="flex flex-wrap items-center gap-2">
        {NOTE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-xs font-bold uppercase ${kind === k ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
        <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 font-mono text-sm">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinnedNote(e.target.checked)}
            className="size-5"
          />
          Pin to the top
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy !== null || clean.length < 3}
          className={`${DANGER} push shadow-hard-sm`}
        >
          {busy ? 'Posting...' : 'Post note'}
        </button>
        <span className="font-mono text-xs">{clean.length}/140</span>
        {done && <span className="font-mono text-sm font-bold">✓ Posted</span>}
        {error && <span className="font-mono text-sm font-bold">{error}</span>}
      </div>
      <p className="m-0 font-mono text-xs">
        Prints on orange paper (only the team gets orange) with a TEAM badge. Skips the AI check
        (it’s you). The nightly job also keeps at least 3 notes up.
      </p>
    </form>
  );
}

function WallAdmin() {
  const [notes, setNotes] = useState<WallNote[] | null>(null);
  const [bans, setBans] = useState<{ uid: string; at: number }[]>([]);
  const [show, setShow] = useState<'all' | 'reported' | 'team'>('all');
  const { busy, error, run } = useAction();

  useEffect(() => watchWall(setNotes, () => setNotes([])), []);
  useEffect(() => watchBans(setBans), []);

  const all = notes ?? [];
  const flagged = all.filter((n) => n.reports > 0);
  const shown = show === 'reported' ? flagged : show === 'team' ? all.filter((n) => n.team) : all;
  const list =
    show === 'reported'
      ? [...shown].sort((a, b) => b.reports - a.reports || b.at - a.at)
      : sortNotes(shown, 'new');

  return (
    <section className="flex flex-col gap-5">
      <TeamNote />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-2xl font-black uppercase">
          Wall: {notes?.length ?? '...'} notes, {flagged.length} reported
        </h1>
        <div role="group" aria-label="Show" className="flex border-3 border-ink">
          {(['all', 'reported', 'team'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={show === v}
              onClick={() => setShow(v)}
              className={`min-h-11 cursor-pointer border-0 px-3 font-mono text-xs font-bold uppercase not-last:border-r-3 not-last:border-ink ${show === v ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
      {notes && list.length === 0 && (
        <p className="m-0 font-mono text-sm text-mute">Nothing here.</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {list.map((n) => (
          <li
            key={n.id}
            className="flex flex-col gap-3 border-3 border-ink p-3"
            style={{ borderLeft: `14px solid ${paperOf(n)}` }}
          >
            <div className="min-w-0">
              <p className="m-0 font-bold break-words">
                {n.pinned && '📌 '}
                {n.text}
              </p>
              <p className="m-0 mt-1 font-mono text-xs text-mute">
                by {n.team ? <b className="text-ink">Lepak team</b> : n.nick} · {ago(n.at)} · +
                {n.plus} · <b className={n.reports ? 'text-ink' : ''}>{n.reports} reports</b>
                {n.hidden && ' · HIDDEN'}
                {n.approved && ' · kept'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Kind" className="flex border-3 border-ink">
                {NOTE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={busy !== null}
                    aria-pressed={n.kind === k}
                    onClick={() => n.kind !== k && void run(n.id, () => setNoteKind(n.id, k))}
                    className={`min-h-10 cursor-pointer border-0 px-2.5 font-mono text-xs font-bold uppercase not-last:border-r-2 not-last:border-ink ${n.kind === k ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy !== null}
                className={BTN}
                onClick={() => void run(n.id, () => setPinned(n.id, !n.pinned))}
              >
                {n.pinned ? 'Unpin' : 'Pin'}
              </button>
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
                onClick={() =>
                  void run(n.id, () => deleteNote(n.id), `Delete "${n.text.slice(0, 40)}"?`)
                }
              >
                Delete
              </button>
              {!n.team && (
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
                          all.filter((x) => x.uid === n.uid).map((x) => x.id),
                        ),
                      `Ban ${n.nick} for 30 days and delete all their notes?`,
                    )
                  }
                >
                  Ban author
                </button>
              )}
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

/** Lepak Pages: every live page, and takedowns (copyright, abuse). */
function PagesAdmin() {
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState('');
  const [done, setDone] = useState('');
  const { busy, error, run } = useAction();

  const load = () => run('list', async () => setPages(await listPages()));
  useEffect(() => {
    void load();
    // load once when the tab opens; Refresh reloads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function takeDown(target: string) {
    setDone('');
    void run(
      `down:${target}`,
      async () => {
        const { slug, files } = await takePageDown(target);
        setDone(`Removed /n/${slug} and ${files} file${files === 1 ? '' : 's'}.`);
        setPage('');
        setPages((list) => list?.filter((p) => p.slug !== slug) ?? list);
      },
      `Take down ${target} for good? The page and its files can't be brought back.`,
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (page.trim()) takeDown(page.trim());
  }

  const q = filter.trim().toLowerCase();
  const shown = (pages ?? []).filter(
    (p) => !q || p.slug.includes(q) || p.title.toLowerCase().includes(q),
  );

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-2xl font-black uppercase">Take down a page</h1>
        <p className="m-0 max-w-xl text-mute">
          For takedown requests (copyright, abuse) sent to {SITE.contact}. Paste the page link or
          its name, or use the button on a page below. The page and everything uploaded to it are
          deleted for good.
        </p>
        <form onSubmit={onSubmit} className="flex max-w-xl flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 font-mono text-xs font-bold uppercase">
            Page link
            <input
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder={`https://${SITE.domain}/n/...`}
              autoComplete="off"
              className="h-11 border-3 border-ink bg-paper px-3 font-mono text-sm normal-case"
            />
          </label>
          <button type="submit" disabled={busy !== null || !page.trim()} className={DANGER}>
            Take down
          </button>
        </form>
        {error && <p className="m-0 font-mono text-sm font-bold">{error}</p>}
        {done && (
          <p role="status" className="m-0 font-mono text-sm font-bold">
            ✓ {done}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="m-0 text-xl font-black uppercase">
            Live pages {pages && <span className="font-mono text-sm">({pages.length})</span>}
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
              Find
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="name or title"
                className="h-11 border-3 border-ink bg-paper px-3 font-mono text-sm normal-case"
              />
            </label>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void load()}
              className={BTN}
            >
              {busy === 'list' ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        <p className="m-0 font-mono text-xs text-mute">
          Most reported first, then newest. Unlisted pages are only seen by people with the link.
        </p>
        {!pages ? (
          <p className="m-0 font-mono text-sm text-mute">{busy === 'list' ? 'Loading...' : ''}</p>
        ) : shown.length === 0 ? (
          <p className="m-0 font-mono text-sm text-mute">
            {pages.length ? 'Nothing matches.' : 'No pages yet.'}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {shown.map((p) => (
              <li
                key={p.slug}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-3 border-ink px-3 py-2 ${p.reports > 0 ? 'bg-soft' : ''}`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <a
                    href={`/n/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-bold"
                  >
                    {p.title || '(no title)'}
                  </a>
                  <span className="truncate font-mono text-xs text-mute">
                    /n/{p.slug} · {p.kind} · {p.visibility} · made {ago(Date.parse(p.created_at))} ·
                    last seen {ago(Date.parse(p.last_seen_at))}
                  </span>
                </div>
                {p.reports > 0 && (
                  <span className="border-3 border-ink bg-ink px-2 py-1 font-mono text-xs font-bold text-paper">
                    {p.reports} report{p.reports === 1 ? '' : 's'}
                  </span>
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => takeDown(p.slug)}
                  className={DANGER}
                >
                  Take down
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
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
