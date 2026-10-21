import { useCallback, useEffect, useRef, useState } from 'react';
import { PuzzleShell } from '../../components/PuzzleShell';
import { clock, puzzleIndex } from '../../lib/puzzle';
import { usePuzzleData } from '../../lib/usePuzzleData';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import { useNow } from '../katabomb/ui/useNow';
import { Keyboard } from '../wordl/ui/Keyboard';
import {
  BLACK,
  NUMBERS,
  SIZE,
  SLOTS,
  check,
  newCrossword,
  nextCell,
  reveal,
  slotFor,
  solution,
  type,
  type CrosswordPuzzle,
  type CrosswordState,
  type Dir,
} from './logic/crossword';

// Pocket Crossword: a 5 x 5 crossword you can finish before class starts.
// Type to fill, tap a square twice (or Enter) to switch across/down, arrows to move.

const ACCENT = '#b9a2ff';
const now = () => Date.now();

export default function PocketCrossword() {
  const fresh = useCallback((seed: string) => newCrossword(seed, now()), []);
  const outcome = useCallback((s: CrosswordState) => (s.finishedAt ? { won: s.won } : null), []);
  const g = usePuzzleGame({ id: 'mini-crossword', fresh, outcome });
  const all = usePuzzleData<CrosswordPuzzle[]>('/games/crossword.json');
  const p = Array.isArray(all) ? all[puzzleIndex(g.state.seed, all.length)]! : null;
  const tick = useNow(now, !g.state.finishedAt, 1000);
  const seconds = ((g.state.finishedAt ?? tick) - g.state.startedAt) / 1000;

  return (
    <PuzzleShell
      name="Pocket Crossword"
      route="/pocket-crossword"
      accent={ACCENT}
      day={g.day}
      mode={g.mode}
      onMode={g.setMode}
      stats={g.stats}
      onNewPractice={g.newPractice}
      result={
        g.state.finishedAt
          ? {
              won: g.state.won,
              headline: g.state.won ? `Solved in ${clock(seconds)}` : 'Revealed. Try another!',
              detail: g.state.revealed.length
                ? `${g.state.revealed.length} ${g.state.revealed.length === 1 ? 'square' : 'squares'} revealed`
                : 'No help needed!',
              share: `Pocket Crossword ${g.mode === 'daily' ? `#${g.day}` : 'practice'}: ${g.state.won ? `solved in ${clock(seconds)}` : 'revealed'}${g.state.revealed.length ? ` (${g.state.revealed.length} revealed)` : ''} ✏️`,
            }
          : null
      }
    >
      <h1 className="sr-only">Pocket Crossword</h1>
      {all === 'error' && (
        <p className="font-mono">Could not load the puzzle. Check your internet.</p>
      )}
      {!p && all !== 'error' && <p className="font-mono">Loading...</p>}
      {p && <Board key={g.state.seed} p={p} s={g.state} seconds={seconds} update={g.update} />}
    </PuzzleShell>
  );
}

function Board({
  p,
  s,
  seconds,
  update,
}: {
  p: CrosswordPuzzle;
  s: CrosswordState;
  seconds: number;
  update: (fn: (s: CrosswordState) => CrosswordState) => void;
}) {
  const sol = solution(p);
  const [cell, setCell] = useState(0);
  const [dir, setDir] = useState<Dir>('across');
  const slot = slotFor(cell, dir)!;
  const entry = (slot.dir === 'across' ? p.across : p.down)[slot.index]!;

  const move = (to: number) => {
    if (to >= 0 && to < SIZE * SIZE && !BLACK.has(to)) setCell(to);
  };

  function press(key: string) {
    if (s.finishedAt) return;
    if (key === 'enter') return setDir((d) => (d === 'across' ? 'down' : 'across'));
    if (key === 'back') {
      if (s.letters[cell]) return update((st) => type(st, sol, cell, '', now()));
      const at = slot.cells.indexOf(cell);
      const prev = slot.cells[at - 1];
      if (prev !== undefined) {
        setCell(prev);
        update((st) => type(st, sol, prev, '', now()));
      }
      return;
    }
    if (/^[a-z]$/i.test(key)) {
      update((st) => type(st, sol, cell, key, now()));
      setCell(nextCell(slot, cell));
    }
  }

  // Keyboard: latest handler, listener added once.
  const keys = useRef({ press, move, cell, dir });
  useEffect(() => {
    keys.current = { press, move, cell, dir };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      const k = keys.current;
      const step = { ArrowUp: -SIZE, ArrowDown: SIZE, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (step) {
        let to = k.cell + step;
        while (BLACK.has(to)) to += step;
        k.move(to);
      } else if (e.key === 'Enter' || e.key === 'Tab') k.press('enter');
      else if (e.key === 'Backspace') k.press('back');
      else if (/^[a-zA-Z]$/.test(e.key)) k.press(e.key.toLowerCase());
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clueLine = (d: Dir) =>
    SLOTS.filter((x) => x.dir === d).map((x) => {
      const e = (d === 'across' ? p.across : p.down)[x.index]!;
      const active = x === slot;
      return (
        <li key={`${d}${x.number}`}>
          <button
            type="button"
            onClick={() => {
              setDir(d);
              setCell(x.cells.find((c) => !s.letters[c]) ?? x.cells[0]!);
            }}
            className="w-full cursor-pointer border-0 bg-transparent px-2 py-1 text-left text-sm"
            style={{ background: active ? '#e6ddff' : undefined }}
          >
            <b>{x.number}</b> {e.clue}
          </button>
        </li>
      );
    });

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
      <div className="flex w-[min(92vw,360px)] flex-col gap-3">
        <div className="flex justify-between font-mono text-sm">
          <span>{clock(seconds)}</span>
          <span className="flex gap-2">
            <button
              type="button"
              disabled={!!s.finishedAt}
              onClick={() => update((st) => check(st, sol))}
              className="min-h-9 cursor-pointer border-2 border-ink bg-paper px-2 font-mono text-xs font-bold disabled:opacity-40"
            >
              Check
            </button>
            <button
              type="button"
              disabled={!!s.finishedAt}
              onClick={() => update((st) => reveal(st, sol, [cell], now()))}
              className="min-h-9 cursor-pointer border-2 border-ink bg-paper px-2 font-mono text-xs font-bold disabled:opacity-40"
            >
              Reveal square
            </button>
            <button
              type="button"
              disabled={!!s.finishedAt}
              onClick={() => {
                if (window.confirm('Reveal the whole puzzle? It won’t count as a win.')) {
                  update((st) =>
                    reveal(
                      st,
                      sol,
                      sol.flatMap((ch, i) => (ch ? [i] : [])),
                      now(),
                    ),
                  );
                }
              }}
              className="min-h-9 cursor-pointer border-2 border-ink bg-paper px-2 font-mono text-xs font-bold disabled:opacity-40"
            >
              Reveal all
            </button>
          </span>
        </div>

        <p
          className="m-0 border-2 border-ink px-3 py-2 text-[15px]"
          style={{ background: '#e6ddff' }}
          aria-live="polite"
        >
          <b>
            {slot.number} {slot.dir === 'across' ? 'Across' : 'Down'}
          </b>{' '}
          {entry.clue}
        </p>

        <div
          role="grid"
          aria-label="Crossword"
          className="grid aspect-square w-full grid-cols-5 grid-rows-5 border-3 border-ink bg-ink"
          style={{ gap: 2 }}
        >
          {s.letters.map((ch, i) => {
            if (BLACK.has(i)) return <span key={i} className="bg-ink" aria-hidden="true" />;
            const inSlot = slot.cells.includes(i);
            const isCell = i === cell;
            const wrong = s.wrong.includes(i);
            const shown = s.revealed.includes(i);
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                aria-label={`${NUMBERS[i] ? `${NUMBERS[i]}, ` : ''}${ch || 'empty'}`}
                aria-selected={isCell}
                onClick={() => {
                  if (i === cell) setDir((d) => (d === 'across' ? 'down' : 'across'));
                  else setCell(i);
                }}
                className="relative flex min-h-0 min-w-0 cursor-pointer items-center justify-center overflow-hidden border-0 p-0 text-[clamp(24px,8vw,38px)] leading-none font-black uppercase"
                style={{
                  background: isCell ? '#ffd23f' : inSlot ? '#e6ddff' : '#f9fafb',
                  color: wrong ? 'var(--color-hot)' : shown ? '#1d4ed8' : '#000',
                  textDecoration: wrong ? 'line-through' : undefined,
                }}
              >
                {NUMBERS[i] && (
                  <span className="absolute top-0.5 left-1 font-mono text-[11px] font-bold">
                    {NUMBERS[i]}
                  </span>
                )}
                {ch}
              </button>
            );
          })}
        </div>
        <div className="md:hidden">
          <Keyboard marks={{}} onKey={press} />
        </div>
        <p className="m-0 font-mono text-xs text-mute">
          Tap a square twice (or Enter) to switch between across and down.
        </p>
      </div>

      <section aria-label="Clues" className="grid w-[min(92vw,360px)] gap-3 md:w-72">
        <div>
          <h2 className="m-0 mb-1 font-mono text-xs uppercase">Across</h2>
          <ul className="m-0 list-none p-0">{clueLine('across')}</ul>
        </div>
        <div>
          <h2 className="m-0 mb-1 font-mono text-xs uppercase">Down</h2>
          <ul className="m-0 list-none p-0">{clueLine('down')}</ul>
        </div>
      </section>
    </div>
  );
}
