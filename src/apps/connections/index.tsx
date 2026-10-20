import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { Confetti } from '../../components/Confetti';
import { SITE } from '../../lib/site';
import { todayNumber } from '../wordl/logic/storage';
import {
  MAX_MISTAKES,
  dailyPuzzle,
  newGame,
  shareText,
  shuffle,
  submit,
  type ConnState,
} from './logic/connections';
import { PUZZLES, type Puzzle } from './logic/puzzles';
import { loadDay, loadStats, recordResult, saveDay, type ConnStats } from './logic/storage';

// Working name "Connecti*ns": placeholder until we pick our own name.

/** Group colours by level, easiest first. All keep black text readable. */
const LEVEL_BG = ['#ffd23f', '#7ee081', '#4fd1e8', '#b9a2ff'];

const MESSAGES = {
  'one-away': 'One away...',
  wrong: 'Not quite',
  repeat: 'Already tried that',
  invalid: 'Pick 4',
} as const;

type Mode = 'daily' | 'practice';

/** Pure seed from the puzzle id, so the first shuffle is stable on reload. */
function seeded(seed: number) {
  let x = seed * 9301 + 49297;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

export default function Connections() {
  const [day] = useState(todayNumber);
  const daily = dailyPuzzle(PUZZLES, day);
  const [mode, setMode] = useState<Mode>('daily');
  const [dailyState, setDailyState] = useState<ConnState>(
    () => loadDay(day) ?? newGame(daily, seeded(day)),
  );
  const [practicePuzzle, setPracticePuzzle] = useState<Puzzle>(
    () => PUZZLES[(day + 5) % PUZZLES.length]!,
  );
  const [practiceState, setPracticeState] = useState<ConnState>(() =>
    newGame(PUZZLES[(day + 5) % PUZZLES.length]!, seeded(day + 5)),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [shakeId, setShakeId] = useState(0);
  const [stats, setStats] = useState<ConnStats>(loadStats);
  const [copied, setCopied] = useState(false);

  const puzzle = mode === 'daily' ? daily : practicePuzzle;
  const state = mode === 'daily' ? dailyState : practiceState;
  const setState = mode === 'daily' ? setDailyState : setPracticeState;
  const label = mode === 'daily' ? `Connecti*ns #${day}` : 'Connecti*ns practice';

  const say = useCallback((text: string) => {
    const id = Date.now();
    setToast({ text, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1500);
  }, []);

  function toggle(word: string) {
    if (state.status !== 'playing') return;
    setSelected((s) =>
      s.includes(word) ? s.filter((w) => w !== word) : s.length < 4 ? [...s, word] : s,
    );
  }

  function onSubmit() {
    const r = submit(state, puzzle, selected);
    if (r.result === 'correct') {
      setSelected([]);
    } else {
      setShakeId((n) => n + 1);
      say(MESSAGES[r.result]);
    }
    setState(r.state);
    if (mode === 'daily') {
      saveDay(day, r.state);
      setStats((st) => recordResult(st, day, r.state));
    }
  }

  function newPractice() {
    // Event handler, so randomness is fine here.
    const next = PUZZLES[Math.floor(Math.random() * PUZZLES.length)]!;
    setPracticePuzzle(next);
    setPracticeState(newGame(next, Math.random));
    setSelected([]);
    setMode('practice');
  }

  const done = state.status !== 'playing';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <title>Connecti*ns · Lepak.gg</title>
      <header className="flex h-12 shrink-0 items-stretch justify-between border-b-3 border-ink">
        <Link
          to="/hub"
          className="flex items-center gap-2 px-gutter font-mono text-base font-bold no-underline"
        >
          <span aria-hidden="true" className="inline-block size-3.5 bg-ink" />
          {SITE.wordmark}
        </Link>
        <div className="flex items-stretch" role="tablist">
          {(['daily', 'practice'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setSelected([]);
              }}
              className={`min-h-11 cursor-pointer border-0 border-l-3 border-ink px-4 font-mono text-sm font-bold uppercase ${mode === m ? 'bg-[#b9a2ff]' : 'bg-paper'}`}
            >
              {m === 'daily' ? `#${day}` : 'Practice'}
            </button>
          ))}
        </div>
      </header>

      <main className="relative mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 px-3 py-3">
        <h1 className="m-0 text-center font-mono text-sm font-normal">
          Make 4 groups of 4. <span className="text-mute">{label}</span>
        </h1>

        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute top-10 left-1/2 z-20 -translate-x-1/2"
        >
          {toast && (
            <span
              key={toast.id}
              className="block animate-pop border-3 border-ink bg-ink px-4 py-2 font-mono text-sm font-bold whitespace-nowrap text-paper"
            >
              {toast.text}
            </span>
          )}
        </div>

        {/* board: solved groups on top, then the remaining tiles */}
        <div className="grid min-h-0 flex-1 grid-rows-4 gap-1.5">
          {state.solved.map((g) => {
            const group = puzzle.groups[g]!;
            return (
              <div
                key={g}
                className="flex animate-pop flex-col items-center justify-center border-3 border-ink px-2 text-center"
                style={{ background: LEVEL_BG[group.level] }}
              >
                <strong className="font-sans text-[clamp(14px,3.6vw,20px)] font-black uppercase">
                  {group.title}
                </strong>
                <span className="font-mono text-[clamp(11px,2.8vw,14px)]">
                  {group.words.join(', ')}
                </span>
              </div>
            );
          })}
          {Array.from({ length: 4 - state.solved.length }, (_, row) => (
            <div key={`row-${row}`} className="grid grid-cols-4 gap-1.5">
              {state.order.slice(row * 4, row * 4 + 4).map((w) => {
                const on = selected.includes(w);
                return (
                  <button
                    key={`${w}-${on ? shakeId : 0}`}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(w)}
                    className={`flex min-h-0 cursor-pointer items-center justify-center border-3 border-ink px-1 font-sans text-[clamp(10px,3.1vw,17px)] leading-tight font-black break-all uppercase transition-transform active:scale-95 ${
                      on
                        ? `bg-ink text-paper ${shakeId ? 'animate-shake' : ''}`
                        : 'bg-soft text-ink'
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* mistakes left */}
        <p className="m-0 flex items-center justify-center gap-2 font-mono text-sm">
          Mistakes left:
          <span className="flex gap-1" aria-label={`${MAX_MISTAKES - state.mistakes} left`}>
            {Array.from({ length: MAX_MISTAKES }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`inline-block size-3.5 rounded-full border-2 border-ink ${i < MAX_MISTAKES - state.mistakes ? 'bg-ink' : 'bg-paper'}`}
              />
            ))}
          </span>
        </p>

        {done ? (
          <div className="flex flex-col items-center gap-3">
            <p className="m-0 text-center text-xl font-black">
              {state.status === 'won'
                ? state.mistakes === 0
                  ? 'Perfect! Zero mistakes.'
                  : 'Solved!'
                : 'Aiyo, next time.'}
            </p>
            {mode === 'daily' && (
              <p className="m-0 font-mono text-xs text-mute">
                Played {stats.played} · Won {stats.wins} · Perfect {stats.perfect} · Streak{' '}
                {stats.streak}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(`${shareText(state, puzzle, label)}\n${SITE.domain}/connections`)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                }}
                className="push min-h-12 cursor-pointer border-3 border-ink bg-[#b9a2ff] px-5 font-mono font-bold uppercase shadow-hard"
              >
                {copied ? 'Copied!' : 'Share'}
              </button>
              <button
                type="button"
                onClick={newPractice}
                className="min-h-12 cursor-pointer border-3 border-ink bg-paper px-5 font-mono font-bold uppercase"
              >
                {mode === 'practice' ? 'Another one' : 'Practice'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, order: shuffle(s.order, Math.random) }))}
              className="min-h-12 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
            >
              Shuffle
            </button>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => setSelected([])}
              className="min-h-12 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={selected.length !== 4}
              onClick={onSubmit}
              className="push min-h-12 cursor-pointer border-3 border-ink bg-ink px-5 font-mono text-sm font-bold text-paper uppercase shadow-hard disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Submit
            </button>
          </div>
        )}
      </main>
      {state.status === 'won' && <Confetti />}
    </div>
  );
}
