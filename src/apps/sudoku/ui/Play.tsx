import { useCallback, useEffect, useState } from 'react';
import {
  box,
  clashes,
  col,
  enter,
  isGiven,
  row,
  toggleNote,
  type SudokuState,
} from '../logic/sudoku';

// The Sudoku board, number pad and keyboard controls. Shared by the daily Sudoku and
// Sudoku Race. Keyboard: 1-9, Backspace, arrows, N for pencil marks.

const DEFAULT_ACCENT = '#4fd1e8';

export function SudokuPlay({
  state: s,
  onChange,
  accent = DEFAULT_ACCENT,
  locked = false,
}: {
  state: SudokuState;
  /** Called with how to change the board; the parent owns the state. */
  onChange: (update: (s: SudokuState) => SudokuState) => void;
  accent?: string;
  /** No more writing (e.g. knocked out of a race, or time's up). */
  locked?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);

  const write = useCallback(
    (n: number) => {
      if (selected === null || locked) return;
      onChange((st) =>
        noteMode && n ? toggleNote(st, selected, n) : enter(st, selected, n, Date.now()),
      );
    },
    [onChange, selected, noteMode, locked],
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
    <>
      <div
        role="grid"
        aria-label="Sudoku board"
        className={`grid aspect-square w-[min(92vw,480px)] grid-cols-9 border-3 border-ink bg-ink ${locked ? 'opacity-60' : ''}`}
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
                background: isSel ? accent : same ? '#bdeef7' : peer ? '#e9f6f9' : '#f9fafb',
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
            disabled={locked || counts[n] === 9}
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
          disabled={locked}
          className="min-h-11 flex-1 cursor-pointer border-2 border-ink bg-paper font-mono text-sm font-bold disabled:opacity-50"
        >
          Erase
        </button>
        <button
          type="button"
          aria-pressed={noteMode}
          onClick={() => setNoteMode((v) => !v)}
          disabled={locked}
          className="min-h-11 flex-1 cursor-pointer border-2 border-ink font-mono text-sm font-bold disabled:opacity-50"
          style={{ background: noteMode ? accent : undefined }}
        >
          Notes {noteMode ? 'on' : 'off'} (N)
        </button>
      </div>
    </>
  );
}
