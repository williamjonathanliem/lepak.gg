import { useCallback, useEffect, useMemo, useState } from 'react';
import { PuzzleShell } from '../../components/PuzzleShell';
import { seededRng, shuffle } from '../../lib/puzzle';
import { usePuzzleData } from '../../lib/usePuzzleData';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import {
  REJECT_TEXT,
  RANKS,
  WIN_RANK,
  addWord,
  check,
  isPangram,
  maxScore,
  newHive,
  puzzleIndex,
  rankFor,
  wordScore,
  type HivePuzzle,
  type HiveState,
} from './logic/hive';

// Hive Mind: make words from 7 letters; every word must use the middle one.

const ACCENT = '#ffd23f';

// Hex positions around the centre, as % of the hive box.
const SPOTS = [
  [50, 50],
  [50, 17],
  [79, 33.5],
  [79, 66.5],
  [50, 83],
  [21, 66.5],
  [21, 33.5],
] as const;

export default function HiveMind() {
  const outcome = useCallback((s: HiveState) => (s.won ? { won: true } : null), []);
  const g = usePuzzleGame({ id: 'spelling-bee', fresh: newHive, outcome });
  const all = usePuzzleData<HivePuzzle[]>('/games/hive.json');
  const puzzle = Array.isArray(all) ? all[puzzleIndex(g.state.seed, all.length)]! : null;

  return (
    <PuzzleShell
      name="Hive Mind"
      route="/hive-mind"
      accent={ACCENT}
      day={g.day}
      mode={g.mode}
      onMode={g.setMode}
      stats={g.stats}
      onNewPractice={g.newPractice}
      result={
        g.state.won && puzzle
          ? {
              won: true,
              headline: `${WIN_RANK}! ${g.state.score} points`,
              detail: `${g.state.found.length} of ${puzzle.words.length} words. Keep going for Ratu Lebah (every word).`,
              share: `Hive Mind ${g.mode === 'daily' ? `#${g.day}` : 'practice'}: ${rankFor(g.state.score, maxScore(puzzle)).name}, ${g.state.score} points, ${g.state.found.length} words 🐝`,
            }
          : null
      }
    >
      <h1 className="sr-only">Hive Mind</h1>
      {all === 'error' && (
        <p className="font-mono">Could not load the puzzle. Check your internet.</p>
      )}
      {!puzzle && all !== 'error' && <p className="font-mono">Loading...</p>}
      {puzzle && (
        <Hive
          key={g.state.seed}
          puzzle={puzzle}
          state={g.state}
          onWord={(w) => g.update((s) => addWord(s, w, puzzle))}
        />
      )}
    </PuzzleShell>
  );
}

function Hive({
  puzzle,
  state,
  onWord,
}: {
  puzzle: HivePuzzle;
  state: HiveState;
  onWord: (w: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const [toast, setToast] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const [order, setOrder] = useState(() => [...puzzle.letters.slice(1)]);
  const max = useMemo(() => maxScore(puzzle), [puzzle]);
  const rank = rankFor(state.score, max);
  const centre = puzzle.letters[0]!;

  const say = (text: string, good = false) => {
    const id = Date.now();
    setToast({ text, good, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1600);
  };

  const submit = useCallback(() => {
    if (!typed) return;
    const bad = check(typed, puzzle, state.found);
    if (bad) say(REJECT_TEXT[bad]);
    else {
      const pts = wordScore(typed.toLowerCase(), puzzle.letters);
      say(isPangram(typed.toLowerCase(), puzzle.letters) ? `Pangram! +${pts}` : `+${pts}`, true);
      onWord(typed);
    }
    setTyped('');
  }, [typed, puzzle, state.found, onWord]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (e.key === 'Enter') submit();
      else if (e.key === 'Backspace') setTyped((t) => t.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key) && puzzle.letters.includes(e.key.toLowerCase()))
        setTyped((t) => (t + e.key.toLowerCase()).slice(0, 20));
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, puzzle.letters]);

  const progress = max ? Math.min(100, (state.score / max) * 100) : 0;

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-5 md:flex-row md:items-start md:justify-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        {/* rank */}
        <div className="w-full">
          <div className="flex items-baseline justify-between font-mono text-sm">
            <b>{rank.name}</b>
            <span>{state.score} pts</span>
          </div>
          <div className="relative mt-1 h-3 border-2 border-ink" aria-hidden="true">
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${progress}%`, background: ACCENT }}
            />
            {RANKS.slice(1, -1).map((r) => (
              <span
                key={r.name}
                className="absolute top-0 h-full w-px bg-ink/40"
                style={{ left: `${r.pct}%` }}
              />
            ))}
          </div>
          {rank.next && (
            <p className="m-0 mt-1 font-mono text-xs text-mute">
              {rank.next.at - state.score} to {rank.next.name}
            </p>
          )}
        </div>

        {/* typed word + toast */}
        <div className="relative flex h-14 w-full items-center justify-center">
          <p aria-live="polite" className="m-0 text-3xl font-black tracking-wide uppercase">
            {[...typed].map((ch, i) => (
              <span
                key={i}
                className={
                  ch === centre ? 'text-[#b38600]' : puzzle.letters.includes(ch) ? '' : 'text-mute'
                }
              >
                {ch}
              </span>
            ))}
            <span className="animate-pulse text-mute">|</span>
          </p>
          {toast && (
            <span
              key={toast.id}
              role="status"
              className={`absolute -top-3 animate-pop border-2 border-ink px-3 py-1 font-mono text-sm font-bold ${toast.good ? '' : 'bg-ink text-paper'}`}
              style={{ background: toast.good ? ACCENT : undefined }}
            >
              {toast.text}
            </span>
          )}
        </div>

        {/* the hive */}
        <div
          className="relative aspect-square w-[min(80vw,300px)]"
          role="group"
          aria-label="Letters"
        >
          {[centre, ...order].map((ch, i) => (
            <button
              key={`${ch}-${i}`}
              type="button"
              onClick={() => setTyped((t) => (t + ch).slice(0, 20))}
              aria-label={i === 0 ? `${ch}, the middle letter` : ch}
              className="absolute flex h-[31%] w-[35%] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center border-0 text-[clamp(22px,7vw,32px)] font-black uppercase transition-transform active:scale-90"
              style={{
                left: `${SPOTS[i]![0]}%`,
                top: `${SPOTS[i]![1]}%`,
                background: i === 0 ? ACCENT : '#e5e7eb',
                clipPath: 'polygon(25% 2%, 75% 2%, 100% 50%, 75% 98%, 25% 98%, 0 50%)',
              }}
            >
              {ch}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTyped((t) => t.slice(0, -1))}
            className="min-h-12 cursor-pointer rounded-full border-2 border-ink bg-paper px-5 font-bold"
          >
            Delete
          </button>
          <button
            type="button"
            aria-label="Shuffle letters"
            onClick={() => setOrder((o) => shuffle(o, seededRng(String(Date.now()))))}
            className="min-h-12 min-w-12 cursor-pointer rounded-full border-2 border-ink bg-paper text-xl"
          >
            ⟳
          </button>
          <button
            type="button"
            onClick={submit}
            className="min-h-12 cursor-pointer rounded-full border-2 border-ink bg-ink px-5 font-bold text-paper"
          >
            Enter
          </button>
        </div>
      </div>

      {/* found words */}
      <section aria-label="Words you found" className="w-full max-w-sm border-2 border-ink p-3">
        <p className="m-0 mb-2 font-mono text-sm">
          You found <b>{state.found.length}</b> of {puzzle.words.length} words
        </p>
        <ul className="m-0 grid max-h-72 list-none grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto p-0 text-sm capitalize">
          {state.found.map((w) => (
            <li key={w} className={isPangram(w, puzzle.letters) ? 'font-black' : ''}>
              {w}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
