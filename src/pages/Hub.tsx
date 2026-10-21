import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { groupedApps, playersLabel } from '../apps/groups';
import { APPS, ROUTED_APPS } from '../apps/registry';
import type { AppManifest, RoutedAppManifest } from '../apps/types';
import { AppHeader } from '../components/AppHeader';
import { InputError } from '../components/Input';
import { HUB } from '../copy/hub';
import { NICKNAME_ERRORS } from '../copy/landing';
import { dailyStatus, recentApps, type DailyStatus } from '../lib/activity';
import { firebaseEnabled } from '../lib/firebase';
import { findRoom, type RoomMatch } from '../lib/findRoom';
import { getNickname, saveNickname } from '../lib/identity';
import { today } from '../lib/puzzle';
import { isValidRoomCode, normalizeRoomCode } from '../lib/roomCode';
import { setVote, votesEnabled, watchVotes, type VoteSnapshot } from '../lib/votes';

// The app launcher after "Jom masuk": a hello with today's progress and your recent apps,
// a join-with-code box, today's daily puzzles, the apps in groups, and the vote list.

/** Playable daily puzzle games, in hub order. */
function dailyGames(): RoutedAppManifest[] {
  const group = groupedApps(ROUTED_APPS).find((g) => g.id === 'daily');
  return (group?.apps ?? []).filter(
    (a): a is RoutedAppManifest => a.status !== 'planned' && a.id !== 'trivia',
  );
}

export default function Hub() {
  const [nickname, setNickname] = useState(getNickname);
  const [day] = useState(today);
  const [recent] = useState(recentApps);
  if (!nickname) return <Navigate to="/#nickname" replace />;

  const daily = dailyGames();
  const statuses = daily.map((a) => dailyStatus(a.id, day));
  const doneCount = statuses.filter((s) => s === 'done').length;
  const lastUsed = recent
    .map((route) => ROUTED_APPS.find((a) => a.route === route))
    .filter((a): a is RoutedAppManifest => !!a)
    .slice(0, 4);
  const groups = groupedApps(ROUTED_APPS).filter((g) => g.id !== 'daily');

  return (
    <div className="min-h-dvh">
      <title>Hub · Lepak.gg</title>
      <AppHeader>
        <div className="flex items-center border-l-3 border-ink px-3">
          <NicknameEditor nickname={nickname} onSaved={setNickname} />
        </div>
      </AppHeader>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-gutter py-[clamp(24px,5vw,56px)]">
        {/* hello + join */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex min-w-0 flex-col justify-between gap-6 border-3 border-ink bg-ink p-6 text-paper">
            <div>
              <h1 className="m-0 text-[clamp(34px,5vw,56px)] leading-none font-black tracking-[-0.04em] uppercase">
                {HUB.hello(nickname)}
              </h1>
              <p className="mt-3 mb-0 text-paper/70">{HUB.sub}</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="m-0 font-mono text-xs uppercase">
                {HUB.todayLine(day, doneCount, daily.length)}
              </p>
              <div className="flex gap-1" aria-hidden="true">
                {statuses.map((st, i) => (
                  <span
                    key={daily[i]!.id}
                    className="h-2 flex-1 border border-paper/40"
                    style={{
                      background:
                        st === 'done'
                          ? daily[i]!.accent
                          : st === 'started'
                            ? 'rgb(249 250 251 / 0.35)'
                            : 'transparent',
                    }}
                  />
                ))}
              </div>
              {lastUsed.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-paper/60 uppercase">{HUB.jumpBack}</span>
                  {lastUsed.map((a) => (
                    <Link
                      key={a.id}
                      to={a.route}
                      className="inline-flex min-h-11 items-center gap-2 border-2 border-paper/60 px-3 font-mono text-sm text-paper no-underline hover:bg-paper hover:text-ink"
                    >
                      <span
                        aria-hidden="true"
                        className="size-2.5"
                        style={{ background: a.accent }}
                      />
                      {a.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
          <JoinBox />
        </section>

        {/* today's puzzles */}
        <section aria-labelledby="daily-h">
          <SectionHead
            id="daily-h"
            title={HUB.dailyTitle(day)}
            blurb={HUB.dailyBlurb}
            count={daily.length}
          />
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0">
            {daily.map((app, i) => (
              <li key={app.id} className="flex">
                <DailyTile app={app} status={statuses[i]!} />
              </li>
            ))}
          </ul>
        </section>

        {groups.map((g) =>
          g.apps.length ? (
            <section key={g.id} aria-labelledby={`${g.id}-h`}>
              <SectionHead id={`${g.id}-h`} title={g.title} blurb={g.blurb} count={g.apps.length} />
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3 p-0">
                {g.apps.map((app) => (
                  <li key={app.id} className="flex">
                    <AppCard app={app as RoutedAppManifest} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}

        <ComingSoon apps={APPS.filter((a) => a.status === 'planned')} />
      </main>
    </div>
  );
}

function SectionHead({
  id,
  title,
  blurb,
  count,
}: {
  id: string;
  title: string;
  blurb: string;
  count: number;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-3 border-ink pb-2">
      <h2
        id={id}
        className="m-0 text-[clamp(22px,3vw,30px)] leading-none font-black tracking-[-0.02em] uppercase"
      >
        {title}{' '}
        <span className="align-middle font-mono text-sm font-normal text-mute">{count}</span>
      </h2>
      <p className="m-0 font-mono text-xs text-mute">{blurb}</p>
    </div>
  );
}

/** A daily puzzle: name and today's state. Done ones go quiet so the rest stand out. */
function DailyTile({ app, status }: { app: RoutedAppManifest; status: DailyStatus }) {
  const label =
    status === 'done' ? HUB.statusDone : status === 'started' ? HUB.statusStarted : HUB.statusNew;
  return (
    <Link
      to={app.route}
      aria-label={`${app.name}: ${label}`}
      className="push flex min-h-24 w-full flex-col justify-between gap-3 border-3 border-ink p-3 text-ink no-underline shadow-hard-sm"
      style={{ background: status === 'done' ? '#f9fafb' : app.accent }}
    >
      <span className="text-[18px] leading-tight font-black uppercase">{app.name}</span>
      <span className="flex items-center gap-1.5 font-mono text-xs font-bold">
        <span
          aria-hidden="true"
          className={`inline-flex size-4 items-center justify-center border-2 border-ink text-[10px] ${status === 'done' ? 'bg-ink text-paper' : 'bg-paper'}`}
        >
          {status === 'done' ? '✓' : status === 'started' ? '•' : ''}
        </span>
        {label}
      </span>
    </Link>
  );
}

/** A playable app: colour block with its number, name, one line, who it's for. */
function AppCard({ app }: { app: RoutedAppManifest }) {
  return (
    <Link
      to={app.route}
      className="push flex w-full gap-3 border-3 border-ink bg-paper p-3 text-ink no-underline shadow-hard-sm"
    >
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center border-2 border-ink font-mono text-xs font-bold"
        style={{ background: app.accent }}
      >
        {app.number}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[19px] leading-tight font-black uppercase">{app.name}</span>
        <span className="line-clamp-2 text-sm text-mute">
          {app.tagline.replace(/ Inspired by .*$/, '')}
        </span>
        <span className="font-mono text-[11px] font-bold uppercase">{playersLabel(app)}</span>
      </span>
    </Link>
  );
}

/** Planned apps as small chips you can vote on. Most-wanted first. */
function ComingSoon({ apps }: { apps: AppManifest[] }) {
  const [votes, setVotes] = useState<VoteSnapshot | null>(null);
  useEffect(() => (votesEnabled ? watchVotes(setVotes) : undefined), []);

  const sorted = [...apps].sort((a, b) => (votes?.counts[b.id] ?? 0) - (votes?.counts[a.id] ?? 0));

  return (
    <section aria-labelledby="soon-h">
      <SectionHead
        id="soon-h"
        title={HUB.comingSoon}
        blurb={HUB.comingSoonBlurb}
        count={apps.length}
      />
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {sorted.map((app) => {
          const voted = votes?.mine.has(app.id) ?? false;
          const count = votes?.counts[app.id] ?? 0;
          return (
            <li key={app.id}>
              <button
                type="button"
                disabled={!votes}
                aria-pressed={voted}
                aria-label={`${app.name}: ${app.tagline} ${voted ? 'You voted.' : 'Vote for this.'} ${count} votes.`}
                title={app.tagline}
                onClick={() => void setVote(app.id, !voted)}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 border-2 border-ink px-3 font-mono text-sm disabled:cursor-default ${
                  voted ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-soft'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 border border-ink"
                  style={{ background: app.accent }}
                />
                {app.name}
                {votes && (
                  <span className={voted ? 'text-mute-dark' : 'text-mute'}>
                    {voted ? '✓' : '▲'} {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Type a room code; we find which app it belongs to and take you there. */
function JoinBox() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<RoomMatch[]>([]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setChoices([]);
    if (!isValidRoomCode(code)) return setError(HUB.badCode);
    const clean = normalizeRoomCode(code);
    // Without the Lepak server (local test copies), rooms are KataBomb tabs on this device.
    if (!firebaseEnabled) return navigate(`/katabomb/r/${clean}`);
    setBusy(true);
    setError(null);
    try {
      const found = await findRoom(clean);
      if (found.length === 1) navigate(found[0]!.path);
      else if (found.length > 1) setChoices(found);
      else setError(HUB.noRoom);
    } catch {
      setError(HUB.lookupFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex min-w-0 flex-col gap-3 border-3 border-ink p-5"
    >
      <h2 className="m-0 text-2xl font-black uppercase">{HUB.joinTitle}</h2>
      <p className="m-0 text-sm text-mute">{HUB.joinBlurb}</p>
      <label htmlFor="hub-code" className="font-mono text-xs uppercase">
        {HUB.joinLabel}
      </label>
      <div className="flex">
        <input
          id="hub-code"
          value={code}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="KJRW"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'hub-code-error' : undefined}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
            setChoices([]);
          }}
          className="h-12 min-w-0 flex-1 border-3 border-ink bg-paper px-3 font-mono text-xl tracking-[0.25em] uppercase"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-12 cursor-pointer border-3 border-l-0 border-ink bg-ink px-5 font-mono text-sm font-bold text-paper uppercase disabled:opacity-60"
        >
          {busy ? HUB.looking : HUB.join}
        </button>
      </div>
      {error && <InputError id="hub-code" error={error} />}
      {choices.length > 1 && (
        <div className="flex flex-col gap-2" role="status">
          <p className="m-0 font-mono text-xs uppercase">{HUB.whichOne}</p>
          <div className="flex flex-wrap gap-2">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(c.path)}
                className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-3 font-mono text-sm font-bold"
              >
                {c.name} →
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

/** Nickname in the header, editable in place. */
function NicknameEditor({
  nickname,
  onSaved,
}: {
  nickname: string;
  onSaved: (nick: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(nickname);
          setEditing(true);
        }}
        aria-label={`${HUB.nicknameLabel}: ${nickname}. ${HUB.edit}`}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 border-0 bg-transparent px-1 font-mono text-sm"
      >
        <strong>{nickname}</strong>
        <span className="text-mute underline">{HUB.edit}</span>
      </button>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = saveNickname(draft);
    if (!result.ok) return setError(NICKNAME_ERRORS[result.error]);
    onSaved(result.value);
    setEditing(false);
    setError(null);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor="hub-nick" className="sr-only">
          {HUB.nicknameLabel}
        </label>
        <input
          id="hub-nick"
          autoFocus
          value={draft}
          maxLength={32}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'hub-nick-error' : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          className="h-11 w-40 border-3 border-ink bg-paper px-3 font-mono text-sm"
        />
        <button
          type="submit"
          className="min-h-11 cursor-pointer border-3 border-ink bg-ink px-3 font-mono text-sm font-bold text-paper uppercase"
        >
          {HUB.save}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-11 cursor-pointer border-0 bg-transparent px-1 font-mono text-sm underline"
        >
          {HUB.cancel}
        </button>
      </div>
      {error && <InputError id="hub-nick" error={error} />}
    </form>
  );
}
