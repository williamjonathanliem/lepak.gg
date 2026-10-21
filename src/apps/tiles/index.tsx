import { useCallback, useState } from 'react';
import { PuzzleShell } from '../../components/PuzzleShell';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import {
  COLS,
  findPair,
  isEmpty,
  newMosaic,
  shared,
  tap,
  type MosaicState,
  type Tile,
} from './logic/mosaic';

// Mosaic: tap two tiles; whatever they share (colour, shape, corner mark) disappears.
// Keep matching from the tile you just used to grow your combo. Clear the board to finish.

const ACCENT = '#ffd23f';
const BG = ['#ffd23f', '#ff8fd0', '#4fd1e8', '#7ee081', '#b9a2ff'];
const BG_NAME = ['yellow', 'pink', 'blue', 'green', 'purple'];
const SHAPE_NAME = ['circle', 'square', 'triangle', 'diamond', 'star'];
const MARK = ['#000000', '#ff3b00', '#1d4ed8', '#047857', '#7e22ce'];
const MARK_NAME = ['black', 'red', 'navy', 'emerald', 'violet'];

function Shape({ kind }: { kind: number }) {
  const common = { fill: '#f9fafb', stroke: '#000', strokeWidth: 5 };
  switch (kind) {
    case 0:
      return <circle cx="50" cy="50" r="22" {...common} />;
    case 1:
      return <rect x="29" y="29" width="42" height="42" {...common} />;
    case 2:
      return <polygon points="50,24 76,72 24,72" {...common} />;
    case 3:
      return <polygon points="50,22 78,50 50,78 22,50" {...common} />;
    default:
      return (
        <polygon points="50,22 57,41 78,41 61,53 67,74 50,61 33,74 39,53 22,41 43,41" {...common} />
      );
  }
}

function describe(t: Tile): string {
  if (isEmpty(t)) return 'cleared';
  return [
    t.bg !== null ? `${BG_NAME[t.bg]} background` : null,
    t.shape !== null ? SHAPE_NAME[t.shape] : null,
    t.mark !== null ? `${MARK_NAME[t.mark]} corner` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

export default function Mosaic() {
  const outcome = useCallback((s: MosaicState) => (s.done ? { won: true } : null), []);
  const g = usePuzzleGame({ id: 'tiles', fresh: newMosaic, outcome });
  const s = g.state;
  const [hint, setHint] = useState<[number, number] | null>(null);
  const left = s.tiles.filter((t) => !isEmpty(t)).length;
  const sel = s.selected !== null ? s.tiles[s.selected] : null;

  return (
    <PuzzleShell
      name="Mosaic"
      route="/mosaic"
      accent={ACCENT}
      day={g.day}
      mode={g.mode}
      onMode={(m) => {
        g.setMode(m);
        setHint(null);
      }}
      stats={g.stats}
      onNewPractice={g.newPractice}
      result={
        s.done
          ? {
              won: true,
              headline: `Cleared in ${s.moves} moves`,
              detail: `Best combo: ${s.bestCombo} in a row`,
              share: `Mosaic ${g.mode === 'daily' ? `#${g.day}` : 'practice'}: cleared in ${s.moves} moves, best combo ${s.bestCombo} 🟨🟪🟦`,
            }
          : null
      }
      tools={
        <button
          type="button"
          disabled={s.done}
          onClick={() => setHint(findPair(s.tiles))}
          className="min-h-11 cursor-pointer border-2 border-ink bg-paper px-3 font-mono text-xs font-bold disabled:opacity-40"
        >
          Hint
        </button>
      }
    >
      <h1 className="sr-only">Mosaic</h1>
      <div className="mb-3 flex w-[min(92vw,440px)] justify-between font-mono text-sm">
        <span>Moves: {s.moves}</span>
        <span>
          Combo: <b>{s.combo}</b> (best {s.bestCombo})
        </span>
        <span>{left} left</span>
      </div>
      <div
        role="grid"
        aria-label="Tiles"
        className="grid w-[min(92vw,440px)] gap-1.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {s.tiles.map((t, i) => {
          const empty = isEmpty(t);
          const isSel = s.selected === i;
          const matches = sel && !isSel && !empty ? shared(sel, t).length > 0 : false;
          const hinted = hint?.includes(i);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={describe(t)}
              aria-selected={isSel}
              disabled={empty}
              onClick={() => {
                setHint(null);
                g.update((st) => tap(st, i));
              }}
              className={`aspect-square cursor-pointer border-0 p-0 transition-transform disabled:cursor-default ${isSel ? 'scale-95' : ''} ${hinted ? 'animate-bounce-y' : ''}`}
              style={{
                outline: isSel ? '4px solid #000' : hinted ? '3px dashed #000' : undefined,
                outlineOffset: 2,
                opacity: empty ? 0.12 : 1,
              }}
            >
              <svg viewBox="0 0 100 100" className="block size-full" aria-hidden="true">
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="96"
                  fill={t.bg !== null ? BG[t.bg] : '#f9fafb'}
                  stroke="#000"
                  strokeWidth={matches ? 6 : 3}
                  strokeDasharray={t.bg === null && !empty ? '6 5' : undefined}
                />
                {t.shape !== null && <Shape kind={t.shape} />}
                {t.mark !== null && (
                  <circle cx="82" cy="18" r="9" fill={MARK[t.mark]} stroke="#000" strokeWidth="2" />
                )}
              </svg>
            </button>
          );
        })}
      </div>
      <p className="mt-4 mb-0 max-w-sm text-center font-mono text-xs text-mute">
        Tap a tile, then another. Matching colours, shapes or corner dots disappear. Thick borders
        show tiles that match your pick.
      </p>
    </PuzzleShell>
  );
}
