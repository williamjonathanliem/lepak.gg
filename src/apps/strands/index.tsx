import { useCallback, useRef, useState, type PointerEvent } from 'react';
import { PuzzleShell } from '../../components/PuzzleShell';
import { puzzleIndex } from '../../lib/puzzle';
import { usePuzzleData } from '../../lib/usePuzzleData';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import {
  addFound,
  canExtend,
  judge,
  newWeave,
  pathWord,
  takeHint,
  type WeavePuzzle,
  type WeaveState,
} from './logic/weave';

// Word Weave: find the theme words in the grid. Trace by dragging, or tap letters one by one
// (tap the last letter again to check). The spangram, in yellow, sums up the theme.

const ACCENT = '#4fd1e8';
const SPAN = '#ffd23f';

export default function WordWeave() {
  const outcome = useCallback((s: WeaveState) => (s.won ? { won: true } : null), []);
  const g = usePuzzleGame({ id: 'strands', fresh: newWeave, outcome });
  const all = usePuzzleData<WeavePuzzle[]>('/games/weave.json');
  const p = Array.isArray(all) ? all[puzzleIndex(g.state.seed, all.length)]! : null;

  return (
    <PuzzleShell
      name="Word Weave"
      route="/word-weave"
      accent={ACCENT}
      day={g.day}
      mode={g.mode}
      onMode={g.setMode}
      stats={g.stats}
      onNewPractice={g.newPractice}
      result={
        g.state.won && p
          ? {
              won: true,
              headline: `Found them all${g.state.hints ? ` with ${g.state.hints} ${g.state.hints === 1 ? 'hint' : 'hints'}` : ', no hints'}!`,
              detail: `Theme: ${p.hint}. Spangram: ${p.spangram}`,
              share: `Word Weave ${g.mode === 'daily' ? `#${g.day}` : 'practice'}: "${p.hint}" ${'🔵'.repeat(p.words.length - 1)}🟡${g.state.hints ? ` 💡${g.state.hints}` : ''}`,
            }
          : null
      }
      tools={
        p && (
          <button
            type="button"
            disabled={g.state.won}
            onClick={() => g.update((s) => takeHint(s, p))}
            className="min-h-11 cursor-pointer border-2 border-ink bg-paper px-3 font-mono text-xs font-bold disabled:opacity-40"
          >
            Hint ({g.state.hints})
          </button>
        )
      }
    >
      <h1 className="sr-only">Word Weave</h1>
      {all === 'error' && (
        <p className="font-mono">Could not load the puzzle. Check your internet.</p>
      )}
      {!p && all !== 'error' && <p className="font-mono">Loading...</p>}
      {p && (
        <Grid
          key={g.state.seed}
          p={p}
          s={g.state}
          onFound={(w) => g.update((st) => addFound(st, p, w))}
        />
      )}
    </PuzzleShell>
  );
}

function Grid({ p, s, onFound }: { p: WeavePuzzle; s: WeaveState; onFound: (w: string) => void }) {
  const [path, setPath] = useState<number[]>([]);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const dragging = useRef(false);
  const ownerOf = new Map<number, { word: string; span: boolean }>();
  for (const w of p.words) {
    if (s.found.includes(w.word)) {
      for (const c of w.cells) ownerOf.set(c, { word: w.word, span: w.word === p.spangram });
    }
  }
  const hintCells = new Set(p.words.find((w) => w.word === s.hinted)?.cells ?? []);

  const toastCount = useRef(0);
  const say = (text: string) => {
    const id = ++toastCount.current;
    setToast({ text, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1500);
  };

  function check(cells: number[]) {
    if (cells.length < 3) return setPath([]);
    const v = judge(p, s, cells);
    if (v.kind === 'found') {
      onFound(v.word);
      say(v.spangram ? 'Spangram!' : 'Nice!');
    } else if (v.kind === 'again') say('Already found');
    else say('Not a theme word');
    setPath([]);
  }

  function tap(c: number) {
    if (s.won || ownerOf.has(c)) return;
    if (path.at(-1) === c) return check(path); // tap the last letter again to check
    const at = path.indexOf(c);
    if (at >= 0) return setPath(path.slice(0, at + 1)); // go back to that letter
    setPath(canExtend(p, path, c) ? [...path, c] : [c]);
  }

  // Drag to trace (mouse or finger).
  const cellAt = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cell]');
    return el ? Number(el.getAttribute('data-cell')) : null;
  };
  function onDown(e: PointerEvent) {
    const c = cellAt(e);
    if (c === null || ownerOf.has(c) || s.won) return;
    dragging.current = true;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setPath([c]);
  }
  function onMove(e: PointerEvent) {
    if (!dragging.current) return;
    const c = cellAt(e);
    if (c === null || ownerOf.has(c)) return;
    setPath((cur) => {
      if (cur.at(-2) === c) return cur.slice(0, -1); // dragged back one
      return canExtend(p, cur, c) ? [...cur, c] : cur;
    });
  }
  function onUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (path.length >= 3) check(path);
  }

  const center = (c: number) => [(c % p.cols) * 50 + 25, Math.floor(c / p.cols) * 50 + 25];
  const line = (cells: number[]) => cells.map((c) => center(c).join(',')).join(' ');

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <div className="w-full border-2 border-ink p-3 text-center">
        <p className="m-0 font-mono text-xs uppercase">Today’s theme</p>
        <p className="m-0 text-xl font-black">{p.hint}</p>
        <p className="m-0 font-mono text-xs">
          {s.found.length} of {p.words.length} theme words found
        </p>
      </div>
      <div className="relative flex h-10 items-center justify-center">
        <p className="m-0 text-2xl font-black tracking-wider" aria-live="polite">
          {pathWord(p, path)}
        </p>
        {toast && (
          <span
            key={toast.id}
            role="status"
            className="absolute -top-2 animate-pop border-2 border-ink bg-ink px-3 py-1 font-mono text-xs font-bold text-paper"
          >
            {toast.text}
          </span>
        )}
      </div>
      <div
        className="relative w-[min(88vw,330px)] touch-none select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <svg
          viewBox={`0 0 ${p.cols * 50} ${p.rows * 50}`}
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden="true"
        >
          {p.words
            .filter((w) => s.found.includes(w.word))
            .map((w) => (
              <polyline
                key={w.word}
                points={line(w.cells)}
                fill="none"
                stroke={w.word === p.spangram ? SPAN : ACCENT}
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          {path.length > 1 && (
            <polyline
              points={line(path)}
              fill="none"
              stroke="#d1d5db"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        <div
          role="grid"
          aria-label="Letters"
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${p.cols}, 1fr)` }}
        >
          {[...p.grid].map((ch, c) => {
            const own = ownerOf.get(c);
            const inPath = path.includes(c);
            return (
              <button
                key={c}
                type="button"
                data-cell={c}
                role="gridcell"
                aria-label={`${ch}${own ? `, part of ${own.word}` : ''}`}
                aria-selected={inPath}
                onClick={() => tap(c)}
                className="flex aspect-square cursor-pointer items-center justify-center border-0 bg-transparent p-[10%]"
              >
                <span
                  className="flex size-full items-center justify-center rounded-full text-[clamp(16px,5vw,22px)] font-black"
                  style={{
                    background: own
                      ? own.span
                        ? SPAN
                        : ACCENT
                      : inPath
                        ? '#d1d5db'
                        : 'transparent',
                    outline: hintCells.has(c) && !own ? '2px dashed #000' : undefined,
                  }}
                >
                  {ch}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPath([])}
          className="min-h-11 cursor-pointer rounded-full border-2 border-ink bg-paper px-4 font-bold"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => check(path)}
          disabled={path.length < 3}
          className="min-h-11 cursor-pointer rounded-full border-2 border-ink bg-ink px-5 font-bold text-paper disabled:opacity-40"
        >
          Check
        </button>
      </div>
      <p className="m-0 text-center font-mono text-xs text-mute">
        Drag across letters, or tap them one by one. Diagonals count. Every letter belongs to a
        word.
      </p>
    </div>
  );
}
