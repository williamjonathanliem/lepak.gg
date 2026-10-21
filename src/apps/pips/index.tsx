import { useCallback, useMemo, useState } from 'react';
import { PuzzleShell } from '../../components/PuzzleShell';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import {
  COLS,
  ROWS,
  adjacent,
  boardValues,
  lift,
  makePuzzle,
  newDominoes,
  place,
  regionOk,
  ruleLabel,
  ruleText,
  type DominoState,
} from './logic/dominoes';

// Domino Logic: put every domino on the board so each coloured region's rule holds.
// Tap a domino, then two squares next to each other. Tap a placed domino to lift it.

const ACCENT = '#7ee081';
const REGION_BG = ['#fff1b8', '#ffd9ef', '#ccf3fa', '#d8f5d9', '#e6ddff', '#ffe3cc', '#e5e7eb'];

// Where the dots go for 0..6 on a 3 x 3 grid (0 = top-left .. 8 = bottom-right).
const DOTS: number[][] = [
  [],
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

function Pips({ n, small }: { n: number; small?: boolean }) {
  return (
    <span
      aria-label={`${n}`}
      className={`grid grid-cols-3 grid-rows-3 ${small ? 'size-6 gap-px' : 'size-[70%] gap-[2px]'}`}
    >
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} className="flex items-center justify-center">
          {DOTS[n]!.includes(k) && <span className="block size-[70%] rounded-full bg-ink" />}
        </span>
      ))}
    </span>
  );
}

export default function DominoLogic() {
  const outcome = useCallback((s: DominoState) => (s.won ? { won: true } : null), []);
  const g = usePuzzleGame({ id: 'pips', fresh: newDominoes, outcome });
  const p = useMemo(() => makePuzzle(g.state.seed), [g.state.seed]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [first, setFirst] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const s = g.state;

  const values = boardValues(p, s.placed);
  const owner = new Map<number, number>();
  for (const pl of s.placed) {
    owner.set(pl.a, pl.domino);
    owner.set(pl.b, pl.domino);
  }
  const regionOf = new Map<number, number>();
  p.regions.forEach((r, k) => r.cells.forEach((c) => regionOf.set(c, k)));
  const placedSet = new Set(s.placed.map((x) => x.domino));

  function tapCell(c: number) {
    if (s.won) return;
    const d = owner.get(c);
    if (d !== undefined) {
      g.update((st) => lift(st, d));
      setFirst(null);
      return;
    }
    if (chosen === null) return;
    if (first === null || !adjacent(first, c)) {
      setFirst(c);
      return;
    }
    const pl = flipped ? { domino: chosen, a: c, b: first } : { domino: chosen, a: first, b: c };
    g.update((st) => place(st, p, pl));
    setChosen(null);
    setFirst(null);
    setFlipped(false);
  }

  const reset = () => {
    setChosen(null);
    setFirst(null);
    setFlipped(false);
  };

  return (
    <PuzzleShell
      name="Domino Logic"
      route="/domino-logic"
      accent={ACCENT}
      day={g.day}
      mode={g.mode}
      onMode={(m) => {
        g.setMode(m);
        reset();
      }}
      stats={g.stats}
      onNewPractice={() => {
        g.newPractice();
        reset();
      }}
      result={
        s.won
          ? {
              won: true,
              headline: 'Every rule holds. Solved!',
              share: `Domino Logic ${g.mode === 'daily' ? `#${g.day}` : 'practice'} solved 🁫`,
            }
          : null
      }
    >
      <h1 className="sr-only">Domino Logic</h1>
      <div
        role="grid"
        aria-label="Board"
        className="grid w-[min(92vw,420px)] gap-1"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {Array.from({ length: ROWS * COLS }, (_, c) => {
          if (!p.cells.includes(c)) return <span key={c} aria-hidden="true" />;
          const k = regionOf.get(c)!;
          const r = p.regions[k]!;
          const ok = regionOk(r, values);
          const v = values.get(c);
          const isFirst = first === c;
          const labelHere = r.cells[0] === c && r.rule.kind !== 'free';
          return (
            <button
              key={c}
              type="button"
              role="gridcell"
              onClick={() => tapCell(c)}
              aria-label={`Square in a region that is ${ruleText(r.rule)}${v !== undefined ? `, has ${v}` : ', empty'}`}
              className="relative flex aspect-square cursor-pointer items-center justify-center border-2 p-0"
              style={{
                background: v !== undefined ? '#f9fafb' : REGION_BG[k % REGION_BG.length],
                borderColor: isFirst ? '#000' : ok === false ? 'var(--color-hot)' : '#00000030',
                borderWidth: isFirst || ok === false ? 3 : 2,
                boxShadow:
                  v !== undefined
                    ? `inset 0 0 0 4px ${REGION_BG[k % REGION_BG.length]}`
                    : undefined,
              }}
            >
              {v !== undefined && <Pips n={v} />}
              {labelHere && (
                <span
                  className={`absolute -top-2 -left-2 z-10 min-w-7 border-2 border-ink px-1 text-center font-mono text-xs font-black ${ok === true ? 'bg-[#7ee081]' : ok === false ? 'bg-hot' : 'bg-paper'}`}
                  title={ruleText(r.rule)}
                >
                  {ruleLabel(r.rule)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 mb-2 font-mono text-xs text-mute">
        {chosen === null
          ? 'Pick a domino below.'
          : first === null
            ? 'Now tap a square for the first half.'
            : 'Tap a square next to it for the second half.'}
      </p>

      <div
        className="flex w-[min(92vw,420px)] flex-wrap justify-center gap-2"
        aria-label="Your dominoes"
      >
        {p.dominoes.map(([x, y], d) =>
          placedSet.has(d) ? null : (
            <button
              key={d}
              type="button"
              aria-pressed={chosen === d}
              aria-label={`Domino ${x} and ${y}`}
              onClick={() => {
                setChosen(chosen === d ? null : d);
                setFirst(null);
                setFlipped(false);
              }}
              className="flex cursor-pointer items-center gap-1 border-2 border-ink bg-paper p-1"
              style={{ background: chosen === d ? ACCENT : undefined }}
            >
              <span className="flex size-9 items-center justify-center border border-ink/30 bg-paper">
                <Pips n={chosen === d && flipped ? y : x} small />
              </span>
              <span className="flex size-9 items-center justify-center border border-ink/30 bg-paper">
                <Pips n={chosen === d && flipped ? x : y} small />
              </span>
            </button>
          ),
        )}
      </div>
      {chosen !== null && (
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="mt-2 min-h-11 cursor-pointer border-2 border-ink bg-paper px-3 font-mono text-xs font-bold"
        >
          ⇄ Flip domino
        </button>
      )}

      <details className="mt-4 w-[min(92vw,420px)] font-mono text-xs">
        <summary className="cursor-pointer">What the labels mean</summary>
        <ul className="mt-2 pl-5">
          <li>A number: the region adds up to that.</li>
          <li>&lt; or &gt;: adds up to less or more than that.</li>
          <li>=: all the same. ≠: all different. No label: anything goes.</li>
        </ul>
      </details>
    </PuzzleShell>
  );
}
