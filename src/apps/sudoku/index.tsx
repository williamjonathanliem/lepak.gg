import { useCallback, useEffect, useState } from 'react';
import { PuzzleShell } from '../../components/PuzzleShell';
import { clock } from '../../lib/puzzle';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import { useNow } from '../katabomb/ui/useNow';
import {
  box,
  clashes,
  col,
  enter,
  isGiven,
  newSudoku,
  row,
  toggleNote,
  type Difficulty,
  type SudokuState,
} from './logic/sudoku';

// Sudoku: a daily puzzle (easy Mon/Tue, medium midweek, hard at the weekend) plus practice
// at any level. Keyboard: 1-9, Backspace, arrows, N for pencil marks.

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
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const tick = useNow(now, !s.finishedAt, 1000);
  const seconds = ((s.finishedAt ?? tick) - s.startedAt) / 1000;

  const write = useCallback(
    (n: number) => {
      if (selected === null) return;
      g.update((st) =>
        noteMode && n ? toggleNote(st, selected, n) : enter(st, selected, n, Date.now()),
      );
    },
    [g, selected, noteMode],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (/^[1-9]$/.test(e.key)) write(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') write(0);
      else if (e.key === 'n' || e.key === 'N') setNoteMode((v) => !v);
      else if (e.key.startsWith('Arrow')) {
        const at = selected ?? 40;
        const step = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key] ?? 0;
        setSelected(Math.min(80, Math.max(0, at + step)));
      } else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [write, selected]);

  const sel = selected ?? -1;
  const selValue = sel >= 0 ? s.entries[sel] : 0;
  const counts = Array.from(
    { length: 10 },
    (_, n) => s.entries.filter((x, i) => x === n && x === s.solution[i]).length,
  );

  return (
    <PuzzleShell
      name="Sudoku"
      route="/sudoku"
      accent={ACCENT}
      day={g.day}
      mode={g.mode}
      onMode={(m) => {
        g.setMode(m);
        setSelected(null);
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

      <div
        role="grid"
        aria-label="Sudoku board"
        className="grid aspect-square w-[min(92vw,480px)] grid-cols-9 border-3 border-ink bg-ink"
      >
        {s.entries.map((n, i) => {
          const given = isGiven(s, i);
          const wrong = !!n && n !== s.solution[i];
          const isSel = i === sel;
          const peer =
            sel >= 0 && (row(i) === row(sel) || col(i) === col(sel) || box(i) === box(sel));
          const same = !!n && n === selValue;
          const thickR = col(i) % 3 === 2 && col(i) !== 8;
          const thickB = row(i) % 3 === 2 && row(i) !== 8;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={`Row ${row(i) + 1} column ${col(i) + 1}${n ? `, ${n}` : ', empty'}${wrong ? ', wrong' : ''}`}
              aria-selected={isSel}
              onClick={() => setSelected(i)}
              className={`relative flex cursor-pointer items-center justify-center border-0 p-0 text-[clamp(18px,5.4vw,28px)] ${given ? 'font-black' : 'font-bold'}`}
              style={{
                marginRight: thickR ? 3 : 1,
                marginBottom: thickB ? 3 : 1,
                background: isSel ? ACCENT : same ? '#bdeef7' : peer ? '#e9f6f9' : '#f9fafb',
                color:
                  wrong || (clashes(s.entries, i) && !given)
                    ? 'var(--color-hot)'
                    : given
                      ? '#000'
                      : '#1d4ed8',
              }}
            >
              {n ? (
                n
              ) : (
                <span className="grid h-full w-full grid-cols-3 p-[2px] text-[clamp(7px,2vw,11px)] leading-none font-normal text-mute">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
                    <span key={k} className="flex items-center justify-center">
                      {s.notes[i]!.includes(k) ? k : ''}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid w-[min(92vw,480px)] grid-cols-9 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => write(n)}
            disabled={counts[n] === 9}
            className="flex aspect-[3/4] cursor-pointer items-center justify-center border-2 border-ink bg-paper text-2xl font-black disabled:opacity-25"
            aria-label={`${noteMode ? 'Note' : 'Write'} ${n}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex w-[min(92vw,480px)] gap-2">
        <button
          type="button"
          onClick={() => write(0)}
          className="min-h-11 flex-1 cursor-pointer border-2 border-ink bg-paper font-mono text-sm font-bold"
        >
          Erase
        </button>
        <button
          type="button"
          aria-pressed={noteMode}
          onClick={() => setNoteMode((v) => !v)}
          className="min-h-11 flex-1 cursor-pointer border-2 border-ink font-mono text-sm font-bold"
          style={{ background: noteMode ? ACCENT : undefined }}
        >
          Notes {noteMode ? 'on' : 'off'} (N)
        </button>
      </div>
      <p className="mt-3 mb-0 font-mono text-xs text-mute">
        Tap a square, then a number. Blue numbers are yours; red ones clash.
      </p>
    </PuzzleShell>
  );
}
