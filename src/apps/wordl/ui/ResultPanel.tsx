import { useState } from 'react';
import { SITE } from '../../../lib/site';
import { MAX_GUESSES, type Stats, type WordlState } from '../logic/wordl';

interface ResultPanelProps {
  state: WordlState;
  mode: 'daily' | 'practice';
  stats: Stats;
  share: string;
  onClose: () => void;
  onPractice: () => void;
}

/** Result + stats dialog. Shows the answer, daily stats and a share button. */
export function ResultPanel({ state, mode, stats, share, onClose, onPractice }: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const done = state.status !== 'playing';
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-pop border-3 border-ink bg-paper p-6 shadow-hard"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="result-title" className="heading-lg m-0 text-[clamp(32px,8vw,48px)]">
            {state.status === 'won' ? 'Nice one!' : state.status === 'lost' ? 'Aiyo.' : 'Stats'}
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

        {done && (
          <p className="mt-3 mb-0 font-mono">
            The word was <strong className="bg-[#7ee081] px-1.5 uppercase">{state.answer}</strong>
          </p>
        )}

        {mode === 'daily' && (
          <>
            <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
              {[
                ['Played', stats.played],
                ['Win %', winPct],
                ['Streak', stats.streak],
                ['Best', stats.maxStreak],
              ].map(([label, n]) => (
                <div key={label} className="border-3 border-ink py-2">
                  <dd className="m-0 text-2xl font-black">{n}</dd>
                  <dt className="font-mono text-[11px] uppercase">{label}</dt>
                </div>
              ))}
            </dl>
            <h3 className="mt-5 mb-2 font-mono text-xs uppercase">Guesses</h3>
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {stats.dist.slice(0, MAX_GUESSES).map((n, i) => {
                const mine = state.status === 'won' && state.guesses.length === i + 1;
                return (
                  <li key={i} className="flex items-center gap-2 font-mono text-sm">
                    <span className="w-3">{i + 1}</span>
                    <span
                      className={`px-2 text-right font-bold ${mine ? 'bg-[#7ee081]' : 'bg-ink text-paper'}`}
                      style={{ width: `${Math.max(8, (n / maxDist) * 100)}%` }}
                    >
                      {n}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {done && (
            <button
              type="button"
              onClick={() => {
                const text = `${share}\n${SITE.domain}/wordl`;
                void navigator.clipboard?.writeText(text).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="push min-h-12 cursor-pointer border-3 border-ink bg-[#7ee081] px-5 font-mono font-bold uppercase shadow-hard"
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
          )}
          <button
            type="button"
            onClick={onPractice}
            className="min-h-12 cursor-pointer border-3 border-ink bg-paper px-5 font-mono font-bold uppercase"
          >
            {mode === 'practice' && done ? 'Another one' : 'Practice'}
          </button>
        </div>
        {mode === 'daily' && done && (
          <p className="mt-4 mb-0 font-mono text-xs text-mute">
            New word at midnight, Malaysia time.
          </p>
        )}
      </div>
    </div>
  );
}
