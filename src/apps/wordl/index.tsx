import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Confetti } from '../../components/Confetti';
import { SITE } from '../../lib/site';
import { ANSWERS } from './logic/answers';
import {
  loadDayGuesses,
  loadGuessList,
  loadStats,
  saveDayGuesses,
  saveStats,
  todayNumber,
} from './logic/storage';
import {
  MAX_GUESSES,
  WORD_LENGTH,
  addGuess,
  dailyAnswer,
  letterMarks,
  newGame,
  recordResult,
  shareText,
  type GuessError,
  type Stats,
  type WordlState,
} from './logic/wordl';
import { Board } from './ui/Board';
import { Keyboard } from './ui/Keyboard';
import { ResultPanel } from './ui/ResultPanel';

type Mode = 'daily' | 'practice';

const ERRORS: Record<GuessError, string> = {
  'too-short': 'Need 5 letters',
  'not-a-word': 'Not in the word list',
  finished: 'Done for today. Try practice!',
};

function randomAnswer(avoid?: string): string {
  let w = ANSWERS[Math.floor(Math.random() * ANSWERS.length)]!;
  if (w === avoid) w = ANSWERS[(ANSWERS.indexOf(w) + 1) % ANSWERS.length]!;
  return w;
}

// Working name "Wordl*": placeholder until we pick our own name.
export default function Wordl() {
  // Fixed for this visit; a new day's puzzle shows up on the next page load.
  const [day] = useState(todayNumber);
  const [mode, setMode] = useState<Mode>('daily');
  const [daily, setDaily] = useState(() => newGame(dailyAnswer(ANSWERS, day), loadDayGuesses(day)));
  // First practice word comes from the date (pure); later ones are random on click.
  const [practice, setPractice] = useState(() => newGame(dailyAnswer(ANSWERS, day + 500)));
  const [stats, setStats] = useState<Stats>(loadStats);
  const [typed, setTyped] = useState('');
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [shakeId, setShakeId] = useState(0);
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [showResult, setShowResult] = useState(daily.status !== 'playing');

  const game = mode === 'daily' ? daily : practice;
  const setGame = mode === 'daily' ? setDaily : setPractice;

  useEffect(() => {
    let alive = true;
    void loadGuessList().then((d) => alive && setDict(d));
    return () => {
      alive = false;
    };
  }, []);

  const say = useCallback((text: string) => {
    const id = Date.now();
    setToast({ text, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1600);
  }, []);

  const submit = useCallback(() => {
    if (!dict) return say('Loading words...');
    const result = addGuess(game, typed, (w) => dict.has(w));
    if (result.error) {
      setShakeId((n) => n + 1);
      return say(ERRORS[result.error]);
    }
    const next: WordlState = result.state;
    setGame(next);
    setTyped('');
    if (mode === 'daily') {
      saveDayGuesses(day, next.guesses);
      if (next.status !== 'playing') {
        const s = recordResult(stats, day, next);
        setStats(s);
        saveStats(s);
      }
    }
    if (next.status !== 'playing') setTimeout(() => setShowResult(true), 1400);
  }, [dict, game, typed, setGame, mode, day, stats, say]);

  const press = useCallback(
    (key: string) => {
      if (game.status !== 'playing') return;
      if (key === 'enter') return submit();
      if (key === 'back') return setTyped((t) => t.slice(0, -1));
      if (/^[a-z]$/.test(key)) setTyped((t) => (t.length < WORD_LENGTH ? t + key : t));
    },
    [game.status, submit],
  );

  // Physical keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target instanceof Element && target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'Enter') press('enter');
      else if (e.key === 'Backspace') press('back');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  function switchMode(m: Mode) {
    setMode(m);
    setTyped('');
    setShowResult(m === 'daily' && daily.status !== 'playing');
  }

  function newPractice() {
    setPractice(newGame(randomAnswer(practice.answer)));
    setTyped('');
    setShowResult(false);
    setMode('practice');
  }

  const label = mode === 'daily' ? `Wordl* #${day}` : 'Wordl* practice';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <title>Wordl* · Lepak.gg</title>
      <header className="flex h-12 shrink-0 items-stretch justify-between border-b-3 border-ink">
        <Link
          to="/hub"
          className="flex items-center gap-2 px-gutter font-mono text-base font-bold no-underline"
        >
          <span aria-hidden="true" className="inline-block size-3.5 bg-ink" />
          {SITE.wordmark}
        </Link>
        <div className="flex items-stretch font-mono text-sm font-bold uppercase" role="tablist">
          {(['daily', 'practice'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`min-h-11 cursor-pointer border-0 border-l-3 border-ink px-4 font-mono font-bold uppercase ${mode === m ? 'bg-[#7ee081]' : 'bg-paper'}`}
            >
              {m === 'daily' ? `#${day}` : 'Practice'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowResult(true)}
            className="min-h-11 cursor-pointer border-0 border-l-3 border-ink bg-ink px-4 font-mono font-bold text-paper uppercase"
          >
            Stats
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-between gap-3 px-3 py-3">
        <h1 className="sr-only">{label}</h1>
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2"
        >
          {toast && (
            <span
              key={toast.id}
              className="block animate-pop border-3 border-ink bg-ink px-4 py-2 font-mono text-sm font-bold text-paper"
            >
              {toast.text}
            </span>
          )}
        </div>

        <Board state={game} typed={typed} shakeId={shakeId} />
        <Keyboard marks={letterMarks(game)} onKey={press} />
      </main>

      {showResult && (
        <ResultPanel
          state={game}
          mode={mode}
          stats={stats}
          share={shareText(game, label)}
          onClose={() => setShowResult(false)}
          onPractice={newPractice}
        />
      )}
      {showResult && game.status === 'won' && <Confetti />}
      <span className="sr-only" aria-live="polite">
        {game.status === 'won'
          ? 'You got it!'
          : game.status === 'lost'
            ? `The word was ${game.answer}`
            : ''}
      </span>
      {/* how many guesses are left, for screen readers */}
      <span className="sr-only">{MAX_GUESSES - game.guesses.length} guesses left</span>
    </div>
  );
}
