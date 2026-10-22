import { useCallback, useRef, useState } from 'react';
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
import { AppHeader } from '../../components/AppHeader';

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

/** Tile text size: as big as fits, so the longest word stays on one line (never split
 * mid-word). Uses the tile's own width (cqw), capped at 17px. */
function tileFont(word: string): string {
  const longest = Math.max(...word.split(/\s+/).map((part) => part.length));
  // Archivo Black capitals are about 0.72em wide.
  return `min(17px, calc(92cqw / ${(Math.max(4, longest) * 0.72).toFixed(2)}))`;
}

export default function Connections() {
  const [day] = useState(todayNumber);
  const daily = dailyPuzzle(PUZZLES, day);
  const [mode, setMode] = useState<Mode>('daily');
  const [dailyState, setDailyState] = useState<ConnState>(
    () => loadDay(day) ?? newGame(daily, seeded(day)),
  );
  // Practice starts empty: a set is dealt the first time you open the tab.
  const [practicePuzzle, setPracticePuzzle] = useState<Puzzle | null>(null);
  const [practiceState, setPracticeState] = useState<ConnState | null>(null);
  /** Practice sets already dealt this visit, so "New set" doesn't repeat until all are seen. */
  const seen = useRef(new Set<Puzzle>());
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [shakeId, setShakeId] = useState(0);
  const [stats, setStats] = useState<ConnStats>(loadStats);
  const [copied, setCopied] = useState(false);

  const inPractice = mode === 'practice' && practicePuzzle !== null && practiceState !== null;
  const puzzle = inPractice ? practicePuzzle : daily;
  const state = inPractice ? practiceState : dailyState;
  const setState = (next: ConnState | ((s: ConnState) => ConnState)) =>
    inPractice
      ? setPracticeState((s) => (typeof next === 'function' ? next(s!) : next))
      : setDailyState(next);
  const label = !inPractice ? `Groupthink #${day}` : 'Groupthink practice';

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
    if (!inPractice) {
      saveDay(day, r.state);
      setStats((st) => recordResult(st, day, r.state));
    }
  }

  function newPractice() {
    // Event handler, so randomness is fine here. Never today's puzzle or the one just
    // played; once every set has been seen, start over.
    let pool = PUZZLES.filter((p) => p !== daily && !seen.current.has(p));
    if (pool.length === 0) {
      seen.current.clear();
      pool = PUZZLES.filter((p) => p !== daily && p !== practicePuzzle);
    }
    const next = pool[Math.floor(Math.random() * pool.length)]!;
    seen.current.add(next);
    setPracticePuzzle(next);
    setPracticeState(newGame(next, Math.random));
    setSelected([]);
    setMode('practice');
  }

  const done = state.status !== 'playing';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <title>Groupthink · Lepak.gg</title>
      <AppHeader app={{ name: 'Groupthink', to: '/groupthink', accent: '#b9a2ff' }}>
        <div className="flex items-stretch" role="tablist">
          {(['daily', 'practice'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                if (m === 'practice' && practicePuzzle === null) return newPractice();
                setMode(m);
                setSelected([]);
              }}
              className={`min-h-11 cursor-pointer border-0 border-l-3 border-ink px-4 font-mono text-sm font-bold uppercase ${mode === m ? 'bg-[#b9a2ff]' : 'bg-paper'}`}
            >
              {m === 'daily' ? `#${day}` : 'Practice'}
            </button>
          ))}
        </div>
      </AppHeader>

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
        {/* A square board in whatever space is left, so tiles stay square on any screen. */}
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div className="grid aspect-square w-[min(100cqw,100cqh)] grid-rows-4 gap-1.5">
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
                      className={`flex min-h-0 min-w-0 [container-type:inline-size] cursor-pointer items-center justify-center overflow-hidden border-3 border-ink px-1 text-center font-sans leading-tight font-black break-normal uppercase transition-transform active:scale-95 ${
                        on
                          ? `bg-ink text-paper ${shakeId ? 'animate-shake' : ''}`
                          : 'bg-soft text-ink'
                      }`}
                    >
                      {/* Long words shrink to fit on one line instead of breaking mid-word. */}
                      <span style={{ fontSize: tileFont(w) }}>{w}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
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
            {!inPractice && (
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
                    ?.writeText(`${shareText(state, puzzle, label)}\n${SITE.domain}/groupthink`)
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
        {inPractice && !done && (
          <button
            type="button"
            onClick={newPractice}
            className="mx-auto min-h-11 cursor-pointer border-0 bg-transparent px-3 font-mono text-sm font-bold text-ink underline"
          >
            Skip to a new set
          </button>
        )}
      </main>
      {state.status === 'won' && <Confetti />}
    </div>
  );
}
