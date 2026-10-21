import { useState, type ReactNode } from 'react';
import { SITE } from '../lib/site';
import type { PuzzleStats } from '../lib/puzzle';
import { AppHeader } from './AppHeader';
import { Confetti } from './Confetti';

// The frame every daily puzzle game shares: top bar with Daily #N / Practice / Stats tabs,
// and the end-of-puzzle card with stats, share and "another one".

export type PuzzleMode = 'daily' | 'practice';

export interface PuzzleResult {
  won: boolean;
  /** Big line, e.g. "Solved in 4:12". */
  headline: string;
  /** Extra lines under it (answers, score...). */
  detail?: ReactNode;
  /** Text copied by Share. */
  share: string;
}

interface Props {
  name: string;
  route: string;
  accent: string;
  day: number;
  mode: PuzzleMode;
  onMode: (m: PuzzleMode) => void;
  stats: PuzzleStats;
  /** Finished? Then show the result card (it can be closed and reopened with Stats). */
  result: PuzzleResult | null;
  onNewPractice: () => void;
  /** Extra buttons in the top bar (e.g. a hint). */
  tools?: ReactNode;
  children: ReactNode;
}

export function PuzzleShell({
  name,
  route,
  accent,
  day,
  mode,
  onMode,
  stats,
  result,
  onNewPractice,
  tools,
  children,
}: Props) {
  const [open, setOpen] = useState<'auto' | 'open' | 'closed'>('auto');
  const showCard = open === 'open' || (open === 'auto' && !!result);
  const tab =
    'min-h-11 cursor-pointer border-0 border-l-2 border-ink px-3 font-mono text-sm font-bold sm:px-4';

  return (
    <div className="flex min-h-dvh flex-col">
      <title>{`${name} · Lepak.gg`}</title>
      <AppHeader app={{ name, to: route, accent }}>
        <div className="flex items-stretch" role="tablist" aria-label="Puzzle">
          {(['daily', 'practice'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                onMode(m);
                setOpen('auto');
              }}
              className={tab}
              style={{ background: mode === m ? accent : undefined }}
            >
              {m === 'daily' ? `#${day}` : 'Practice'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen('open')}
            className={`${tab} bg-ink text-paper`}
          >
            Stats
          </button>
        </div>
      </AppHeader>
      {tools && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-gutter pt-3">
          {tools}
        </div>
      )}
      <main className="flex flex-1 flex-col items-center px-gutter py-4">{children}</main>

      {showCard && (
        <ResultCard
          name={name}
          mode={mode}
          day={day}
          accent={accent}
          stats={stats}
          result={result}
          onClose={() => setOpen('closed')}
          onNewPractice={() => {
            onNewPractice();
            setOpen('auto');
          }}
        />
      )}
      {result?.won && open !== 'closed' && <Confetti />}
    </div>
  );
}

function ResultCard({
  name,
  mode,
  day,
  accent,
  stats,
  result,
  onClose,
  onNewPractice,
}: {
  name: string;
  mode: PuzzleMode;
  day: number;
  accent: string;
  stats: PuzzleStats;
  result: PuzzleResult | null;
  onClose: () => void;
  onNewPractice: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="puzzle-result"
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-pop border-3 border-ink bg-paper p-6 shadow-hard"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="puzzle-result"
            className="m-0 text-[clamp(28px,7vw,40px)] leading-none font-black"
          >
            {result ? (result.won ? 'Steady!' : 'Next time!') : `${name} stats`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-11 cursor-pointer border-3 border-ink bg-paper font-mono text-xl font-bold"
          >
            ✕
          </button>
        </div>
        {result && (
          <>
            <p className="mt-3 mb-0 text-lg font-bold">{result.headline}</p>
            {result.detail && <div className="mt-2 text-sm">{result.detail}</div>}
          </>
        )}
        <p className="mt-4 mb-1 font-mono text-xs uppercase">Daily puzzles</p>
        <dl className="m-0 grid grid-cols-4 gap-2 text-center">
          {[
            ['Played', stats.played],
            ['Win %', winPct],
            ['Streak', stats.streak],
            ['Best', stats.maxStreak],
          ].map(([k, v]) => (
            <div key={k as string} className="border-2 border-ink py-2">
              <dd className="m-0 text-2xl font-black">{v}</dd>
              <dt className="font-mono text-[11px] uppercase">{k}</dt>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {result && (
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(`${result.share}\n${SITE.domain}`)
                  .then(() => setCopied(true))
              }
              className="push min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold shadow-hard"
              style={{ background: accent }}
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
          )}
          <button
            type="button"
            onClick={onNewPractice}
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold"
          >
            {mode === 'practice' ? 'Another one' : 'Play practice'}
          </button>
        </div>
        {mode === 'daily' && result && (
          <p className="mt-4 mb-0 font-mono text-xs text-mute">
            New #{day + 1} at midnight Malaysia time.
          </p>
        )}
      </div>
    </div>
  );
}
