import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CATEGORY_LABEL, type AppCategory, type AppManifest } from '../apps/types';
import { setVote, votesEnabled, watchVotes, type VoteSnapshot } from '../lib/votes';
import { IndexCard } from './IndexCard';

// Tabs in this order; empty categories are hidden.
const ORDER: AppCategory[] = ['games', 'study', 'tools', 'social', 'group-work'];

interface AppGridProps {
  apps: readonly AppManifest[];
  /** Where each card links. undefined = not clickable. */
  hrefFor: (app: AppManifest) => string | undefined;
  doodleFor?: (app: AppManifest) => ReactNode;
  /** Unique per page, so tab ids don't clash. */
  idPrefix: string;
}

/**
 * Apps grouped into category tabs, as brutalist cards. Planned apps get a
 * "Want this" vote button (counts load only when the grid scrolls into view).
 */
export function AppGrid({ apps, hrefFor, doodleFor, idPrefix }: AppGridProps) {
  const tabs = ORDER.filter((c) => apps.some((a) => a.category === c));
  const [active, setActive] = useState<AppCategory>(tabs[0] ?? 'games');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [votes, setVotes] = useState<VoteSnapshot | null>(null);
  const shown = apps.filter((a) => a.category === active);

  useEffect(() => {
    const el = rootRef.current;
    if (!votesEnabled || !el) return;
    let off: (() => void) | null = null;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !off) {
        off = watchVotes(setVotes);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      off?.();
    };
  }, []);

  // Arrow keys move between tabs, as screen reader users expect.
  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + tabs.length) % tabs.length;
    setActive(tabs[next]!);
    tabRefs.current[next]?.focus();
  }

  return (
    <div ref={rootRef}>
      <div
        role="tablist"
        aria-label="App categories"
        className="flex overflow-x-auto border-t-3 border-ink font-mono text-sm uppercase"
      >
        {tabs.map((c, i) => {
          const selected = c === active;
          const count = apps.filter((a) => a.category === c).length;
          return (
            <button
              key={c}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`${idPrefix}-tab-${c}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(c)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`flex min-h-12 shrink-0 cursor-pointer items-center gap-2 border-0 border-r-3 border-ink px-5 font-bold uppercase ${
                selected ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-soft'
              }`}
            >
              {CATEGORY_LABEL[c]}
              <span className={`text-xs ${selected ? 'text-mute-dark' : 'text-mute'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`${idPrefix}-panel`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${active}`}
        // Lines come from each card's outline, so a half-empty last row stays white.
        className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-[3px] overflow-hidden border-t-3 border-ink bg-paper [&>*]:shadow-[0_0_0_1.5px_var(--color-ink)]"
      >
        {shown.map((app) => (
          <IndexCard
            key={app.id}
            app={app}
            href={hrefFor(app)}
            doodle={doodleFor?.(app)}
            action={
              app.status === 'planned' && votes ? (
                <VoteButton
                  appId={app.id}
                  name={app.name}
                  count={votes.counts[app.id] ?? 0}
                  voted={votes.mine.has(app.id)}
                />
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

/** "I want this" toggle for a planned app. One vote per guest, counted live. */
function VoteButton({
  appId,
  name,
  count,
  voted,
}: {
  appId: string;
  name: string;
  count: number;
  voted: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={voted}
      aria-label={`${voted ? 'Remove vote for' : 'Vote for'} ${name}. ${count} votes.`}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void setVote(appId, !voted).finally(() => setBusy(false));
      }}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 border-2 border-current px-3 font-mono text-xs font-bold uppercase ${
        voted ? 'bg-ink text-paper' : 'bg-transparent text-current'
      }`}
    >
      {voted ? '✓ Voted' : '▲ Want this'}
      <span className="opacity-70">{count}</span>
    </button>
  );
}
