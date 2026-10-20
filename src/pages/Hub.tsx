import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { loadStats as connectionsStats } from '../apps/connections/logic/storage';
import { APPS, ROUTED_APPS } from '../apps/registry';
import type { AppManifest, RoutedAppManifest } from '../apps/types';
import { loadStats as wordlStats, todayNumber } from '../apps/wordl/logic/storage';
import { InputError } from '../components/Input';
import { HUB } from '../copy/hub';
import { NICKNAME_ERRORS } from '../copy/landing';
import { getNickname, saveNickname } from '../lib/identity';
import { isValidRoomCode, normalizeRoomCode } from '../lib/roomCode';
import { SITE } from '../lib/site';
import { setVote, votesEnabled, watchVotes, type VoteSnapshot } from '../lib/votes';

// The app launcher after "Jom masuk". Kept deliberately calm: one column,
// a greeting with the join box, the playable games, and a short "coming soon" list.

/** Today's status for the daily games, read from this browser's saved progress. */
function dailyStatus(app: RoutedAppManifest, day: number): string | null {
  const stats =
    app.id === 'wordl' ? wordlStats() : app.id === 'connections' ? connectionsStats() : null;
  if (!stats) return null;
  return stats.lastDay === day ? HUB.dailyDone(day) : HUB.dailyWaiting(day);
}

export default function Hub() {
  const [nickname, setNickname] = useState(getNickname);
  const [day] = useState(todayNumber);
  if (!nickname) return <Navigate to="/#nickname" replace />;

  return (
    <div className="min-h-dvh">
      <title>Hub · Lepak.gg</title>
      <header className="border-b-3 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-gutter py-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-mono text-lg font-bold tracking-[0.02em] no-underline"
          >
            <span aria-hidden="true" className="inline-block size-4 bg-ink" />
            {SITE.wordmark}
          </Link>
          <NicknameEditor nickname={nickname} onSaved={setNickname} />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-gutter py-[clamp(32px,6vw,64px)]">
        {/* greeting + join */}
        <section className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="m-0 text-[clamp(36px,5vw,56px)] leading-none font-black tracking-[-0.04em] uppercase">
              {HUB.hello(nickname)}
            </h1>
            <p className="mt-3 mb-0 text-mute">{HUB.sub}</p>
          </div>
          <JoinBox />
        </section>

        {/* play now */}
        <section aria-labelledby="play-h">
          <h2 id="play-h" className="m-0 mb-4 font-mono text-sm font-bold tracking-wide uppercase">
            {HUB.playNow}
          </h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4 p-0">
            {ROUTED_APPS.map((app) => (
              <li key={app.id} className="flex">
                <PlayCard app={app} status={dailyStatus(app, day)} />
              </li>
            ))}
          </ul>
        </section>

        {/* coming soon */}
        <ComingSoon apps={APPS.filter((a) => a.status === 'planned')} />
      </main>
    </div>
  );
}

/** A playable app: colour bar, name, one line, status. The whole card is the link. */
function PlayCard({ app, status }: { app: RoutedAppManifest; status: string | null }) {
  return (
    <Link
      to={app.route}
      className="push flex w-full flex-col border-3 border-ink bg-paper text-ink no-underline shadow-hard"
      style={{ '--accent': app.accent } as CSSProperties}
    >
      <span aria-hidden="true" className="h-3 border-b-3 border-ink bg-(--accent)" />
      <span className="flex flex-1 flex-col gap-2 p-5">
        <span className="text-[28px] leading-none font-black tracking-[-0.03em] uppercase">
          {app.name}
        </span>
        <span className="text-[15px] text-mute">{app.tagline}</span>
        <span className="mt-auto pt-3 font-mono text-xs font-bold uppercase">
          {status ?? HUB.players(app.minPlayers, app.maxPlayers)}
        </span>
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
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="soon-h" className="m-0 font-mono text-sm font-bold tracking-wide uppercase">
          {HUB.comingSoon} <span className="font-normal text-mute">({apps.length})</span>
        </h2>
        <p className="m-0 font-mono text-xs text-mute">{HUB.comingSoonBlurb}</p>
      </div>
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

/** Type a room code, land in that room. Compact, sits beside the greeting. */
function JoinBox() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidRoomCode(code)) return setError(HUB.badCode);
    navigate(`/katabomb/r/${normalizeRoomCode(code)}`);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <label htmlFor="hub-code" className="font-mono text-xs uppercase">
        {HUB.joinTitle}
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
          aria-describedby={error ? 'hub-code-error' : 'hub-code-hint'}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          className="h-12 w-32 border-3 border-ink bg-paper px-3 font-mono text-xl tracking-[0.25em] uppercase"
        />
        <button
          type="submit"
          className="h-12 cursor-pointer border-3 border-l-0 border-ink bg-ink px-4 font-mono text-sm font-bold text-paper uppercase"
        >
          {HUB.join}
        </button>
      </div>
      {error ? (
        <InputError id="hub-code" error={error} />
      ) : (
        <p id="hub-code-hint" className="m-0 font-mono text-xs text-mute">
          {HUB.joinHint}
        </p>
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
