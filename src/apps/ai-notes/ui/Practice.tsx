import { useEffect, useRef, useState } from 'react';
import type { Notes } from '../logic/notes';
import {
  grade,
  learnt,
  nextDue,
  nextInQueue,
  startSession,
  toCsv,
  toTabText,
  type Progress,
} from '../logic/practice';
import { loadProgress, saveProgress } from '../logic/saved';

// Flashcards with practice: flip a card, say "got it" or "again". Missed cards come back
// a few cards later, and each card's box decides when it's due again (logic/practice.ts).
// Progress is kept on this device with the draft.

const ACCENT = '#ffd23f';
/** Button shape without a colour; BTN is the plain white one. */
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase';
const BTN = `${BTN_BASE} bg-paper text-ink`;

function whenText(due: number, now: number): string {
  const days = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
  return days <= 1 ? 'tomorrow' : `in ${days} days`;
}

export function Practice({ draftId, cards }: { draftId: string; cards: Notes['flashcards'] }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress(draftId));
  const [queue, setQueue] = useState<number[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(0);
  const [copied, setCopied] = useState(false);
  // Time for "due" maths, taken when a session starts or ends (never during render).
  const [now, setNow] = useState(() => Date.now());

  const card = queue?.[0];
  const total = cards.length;
  const dueNow = startSession(total, progress, now).length;

  function begin(all: boolean) {
    const t = Date.now();
    setNow(t);
    setQueue(startSession(total, progress, t, all));
    setFlipped(false);
    setSeen(0);
  }

  function answer(gotIt: boolean) {
    if (card === undefined) return;
    const next = grade(progress, card, gotIt, Date.now());
    setProgress(next);
    saveProgress(draftId, next);
    setQueue((q) => (q ? nextInQueue(q, gotIt) : q));
    setFlipped(false);
    setSeen((n) => n + 1);
    setNow(Date.now());
  }

  // Keyboard: Space flips, 1 = again, 2 = got it. One listener; it reads the latest handlers.
  const keys = useRef<{ flip: () => void; answer: (gotIt: boolean) => void; active: boolean }>({
    flip: () => {},
    answer: () => {},
    active: false,
  });
  useEffect(() => {
    keys.current = {
      flip: () => setFlipped((f) => !f),
      answer,
      active: card !== undefined,
    };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = keys.current;
      if (!k.active || e.target instanceof HTMLInputElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        k.flip();
      } else if (e.key === '1') k.answer(false);
      else if (e.key === '2') k.answer(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!total) return <p className="m-0">No flashcards this time.</p>;

  function download() {
    const blob = new Blob([toCsv(cards)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flashcards.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ----- in a session -----
  if (queue && card !== undefined) {
    const c = cards[card]!;
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full max-w-xl items-center justify-between font-mono text-xs uppercase">
          <span>
            {queue.length} left · {seen} done
          </span>
          <button
            type="button"
            onClick={() => setQueue(null)}
            className="min-h-11 cursor-pointer border-0 bg-transparent font-mono text-xs underline"
          >
            End session
          </button>
        </div>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Show the question' : 'Show the answer'}
          className="flex min-h-60 w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-3 border-3 border-ink p-6 text-center shadow-hard"
          style={{ background: flipped ? '#f9fafb' : ACCENT }}
        >
          <span className="font-mono text-xs uppercase">{flipped ? 'Answer' : 'Question'}</span>
          <span
            key={`${card}-${flipped}`}
            className="animate-pop text-[clamp(18px,3vw,26px)] font-bold"
            aria-live="polite"
          >
            {flipped ? c.back : c.front}
          </span>
          <span className="font-mono text-xs text-mute">
            {flipped ? 'Did you know it?' : 'Tap or press Space to flip'}
          </span>
        </button>
        {flipped ? (
          <div className="grid w-full max-w-xl grid-cols-2 gap-3">
            <button type="button" onClick={() => answer(false)} className={`${BTN} min-h-14`}>
              Again <span className="font-normal text-mute">(1)</span>
            </button>
            <button
              type="button"
              onClick={() => answer(true)}
              className={`push ${BTN_BASE} min-h-14 bg-[#7ee081] shadow-hard-sm`}
            >
              Got it <span className="font-normal">(2)</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className={`${BTN} w-full max-w-xl`}
          >
            Show answer
          </button>
        )}
      </div>
    );
  }

  // ----- overview -----
  const done = learnt(total, progress);
  const upcoming = nextDue(total, progress, now);
  const finished = queue !== null; // just finished a session
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 font-mono text-sm">
          <span>
            <b>{done}</b> of {total} learnt
          </span>
          <span>{dueNow > 0 ? `${dueNow} to practise now` : 'Nothing due right now'}</span>
        </div>
        <div className="h-4 border-3 border-ink bg-paper" aria-hidden="true">
          <div className="h-full bg-[#7ee081]" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {finished && (
        <p className="m-0 border-3 border-ink bg-[#7ee081] p-4 font-bold" role="status">
          {dueNow > 0
            ? `Nice. ${seen} cards done.`
            : `All caught up! ${upcoming ? `Next cards come back ${whenText(upcoming, now)}.` : ''}`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={dueNow === 0}
          onClick={() => begin(false)}
          className={`push ${BTN} shadow-hard disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none`}
          style={{ background: ACCENT }}
        >
          {dueNow > 0 ? `Practise ${dueNow} cards` : 'All caught up'}
        </button>
        <button type="button" onClick={() => begin(true)} className={BTN}>
          Go through all {total}
        </button>
      </div>

      <p className="m-0 max-w-[60ch] text-sm text-mute">
        Say “got it” and a card waits longer before it comes back (1, 2, 4, then 7 days). Say
        “again” and you’ll see it again in a few cards. Progress stays on this device with these
        notes.
      </p>

      <details className="border-3 border-ink">
        <summary className="min-h-11 cursor-pointer px-4 py-2.5 font-mono text-sm font-bold uppercase">
          Export or reset
        </summary>
        <div className="flex flex-wrap gap-2 border-t-3 border-ink p-4">
          <button type="button" onClick={download} className={BTN}>
            Download CSV (Anki)
          </button>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(toTabText(cards)).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
            className={BTN}
          >
            {copied ? 'Copied!' : 'Copy for Quizlet'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Start these flashcards from scratch?')) return;
              setProgress({});
              saveProgress(draftId, {});
              setQueue(null);
            }}
            className={BTN}
          >
            Reset progress
          </button>
        </div>
        <p className="m-0 px-4 pb-4 text-xs text-mute">
          Anki: File → Import, pick the CSV. Quizlet: Create → Import, paste, with “Tab” between
          term and definition.
        </p>
      </details>
    </div>
  );
}
