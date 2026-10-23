import { useCallback, useState } from 'react';
import { PuzzleShell } from '../../components/PuzzleShell';
import { clock } from '../../lib/puzzle';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import { useNow } from '../katabomb/ui/useNow';
import { newSudoku, type Difficulty, type SudokuState } from './logic/sudoku';
import { SudokuPlay } from './ui/Play';

// Sudoku: a daily puzzle (easy Mon/Tue, medium midweek, hard at the weekend) plus practice
// at any level. The board itself is ui/Play.tsx (shared with Sudoku Race).

const ACCENT = '#4fd1e8';
const now = () => Date.now();

/** The daily level follows the week, like a newspaper. */
function dailyLevel(day: number): Difficulty {
  const weekday = (day + 3) % 7; // day 1 = Thu 1 Jan 2026
  return weekday <= 1 ? 'easy' : weekday >= 5 ? 'hard' : 'medium';
}

export default function Sudoku() {
  const [level, setLevel] = useState<Difficulty>('medium');
  const fresh = useCallback(
    (seed: string) => {
      const daily = /^sudoku-(\d+)$/.exec(seed);
      return newSudoku(seed, daily ? dailyLevel(Number(daily[1])) : level, now());
    },
    [level],
  );
  const outcome = useCallback((s: SudokuState) => (s.finishedAt ? { won: true } : null), []);
  const g = usePuzzleGame({ id: 'sudoku', fresh, outcome });
  const s = g.state;
  const tick = useNow(now, !s.finishedAt, 1000);
  const seconds = ((s.finishedAt ?? tick) - s.startedAt) / 1000;

  return (
    <PuzzleShell
      name="Sudoku"
      route="/sudoku"
      accent={ACCENT}
      day={g.day}
      mode={g.mode}
      onMode={(m) => {
        g.setMode(m);
      }}
      stats={g.stats}
      onNewPractice={g.newPractice}
      result={
        s.finishedAt
          ? {
              won: true,
              headline: `Solved in ${clock(seconds)}`,
              detail: `${s.difficulty[0]!.toUpperCase()}${s.difficulty.slice(1)} · ${s.mistakes} ${s.mistakes === 1 ? 'mistake' : 'mistakes'}`,
              share: `Sudoku ${g.mode === 'daily' ? `#${g.day}` : 'practice'} (${s.difficulty}) solved in ${clock(seconds)} with ${s.mistakes} ${s.mistakes === 1 ? 'mistake' : 'mistakes'} 🧩`,
            }
          : null
      }
      tools={
        g.mode === 'practice' ? (
          <div role="radiogroup" aria-label="Level" className="flex gap-1">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={level === d}
                onClick={() => {
                  setLevel(d);
                  // a new puzzle at this level
                  setTimeout(() => g.newPractice(), 0);
                }}
                className={`min-h-11 cursor-pointer border-2 border-ink px-3 font-mono text-xs font-bold ${level === d ? 'bg-ink text-paper' : 'bg-paper'}`}
              >
                {d}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <h1 className="sr-only">Sudoku</h1>
      <div className="mb-3 flex w-full max-w-[min(92vw,480px)] items-center justify-between font-mono text-sm">
        <span className="font-bold uppercase">{s.difficulty}</span>
        <span>Mistakes: {s.mistakes}</span>
        <span aria-label="Time">{clock(seconds)}</span>
      </div>

      {/* remounting per mode clears the selected square */}
      <SudokuPlay key={g.mode} state={s} onChange={g.update} accent={ACCENT} />
      <p className="mt-3 mb-0 font-mono text-xs text-mute">
        Tap a square, then a number. Blue numbers are yours; red ones clash.
      </p>
    </PuzzleShell>
  );
}
