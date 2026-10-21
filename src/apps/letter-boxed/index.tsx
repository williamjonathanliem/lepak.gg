import { useCallback, useEffect, useRef, useState } from 'react';
import { PuzzleShell } from '../../components/PuzzleShell';
import { puzzleIndex } from '../../lib/puzzle';
import { usePuzzleData } from '../../lib/usePuzzleData';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import {
  PAR,
  REJECT_TEXT,
  addWord,
  canFollow,
  check,
  mustStartWith,
  newEdgewise,
  restart,
  undo,
  usedLetters,
  type EdgewisePuzzle,
  type EdgewiseState,
} from './logic/edgewise';

// Edgewise: chain words using the letters round the box. Use them all.

const ACCENT = '#ff8fd0';

/** Where each letter sits on the 300 x 300 board (sides: top, right, bottom, left). */
function spot(side: number, k: number): [number, number] {
  const along = 75 + k * 75;
  return [
    [along, 30],
    [270, along],
    [along, 270],
    [30, along],
  ][side] as [number, number];
}

export default function Edgewise() {
  const outcome = useCallback((s: EdgewiseState) => (s.won ? { won: true } : null), []);
  const g = usePuzzleGame({ id: 'letter-boxed', fresh: newEdgewise, outcome });
  const meta = usePuzzleData<{ count: number }>('/games/edgewise/count.json');
  const index = meta && meta !== 'error' ? puzzleIndex(g.state.seed, meta.count) : null;
  const puzzle = usePuzzleData<EdgewisePuzzle>(
    index === null ? null : `/games/edgewise/${index}.json`,
  );
  const ready = puzzle && puzzle !== 'error' ? puzzle : null;
  const n = g.state.words.length;

  return (
    <PuzzleShell
      name="Edgewise"
      route="/edgewise"
      accent={ACCENT}
      day={g.day}
      mode={g.mode}
      onMode={g.setMode}
      stats={g.stats}
      onNewPractice={g.newPractice}
      result={
        g.state.won && ready
          ? {
              won: true,
              headline: `Solved in ${n} ${n === 1 ? 'word' : 'words'}${n <= 2 ? '. Perfect!' : ''}`,
              detail: (
                <>
                  <p className="m-0">Yours: {g.state.words.join(' → ').toUpperCase()}</p>
                  <p className="m-0 text-mute">
                    One 2-word answer: {ready.answer.join(' → ').toUpperCase()}
                  </p>
                </>
              ),
              share: `Edgewise ${g.mode === 'daily' ? `#${g.day}` : 'practice'} in ${n} words ${'🟪'.repeat(n)}`,
            }
          : null
      }
    >
      <h1 className="sr-only">Edgewise</h1>
      {(meta === 'error' || puzzle === 'error') && (
        <p className="font-mono">Could not load the puzzle. Check your internet.</p>
      )}
      {!ready && meta !== 'error' && puzzle !== 'error' && <p className="font-mono">Loading...</p>}
      {ready && (
        <Board
          key={g.state.seed}
          puzzle={ready}
          state={g.state}
          onWord={(w) => g.update((s) => addWord(s, w, ready))}
          onUndo={() => g.update(undo)}
          onRestart={() => g.update(restart)}
        />
      )}
    </PuzzleShell>
  );
}

function Board({
  puzzle,
  state,
  onWord,
  onUndo,
  onRestart,
}: {
  puzzle: EdgewisePuzzle;
  state: EdgewiseState;
  onWord: (w: string) => void;
  onUndo: () => void;
  onRestart: () => void;
}) {
  const start = mustStartWith(state);
  const [typed, setTyped] = useState('');
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  // Each new word begins with the last letter of the one before.
  const current = state.won ? '' : start && !typed.startsWith(start) ? start + typed : typed;
  const used = usedLetters([...state.words, current]);
  const all = puzzle.sides.join('');

  const say = (text: string) => {
    const id = Date.now();
    setToast({ text, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1800);
  };

  function press(ch: string) {
    if (state.won) return;
    const word = start && !typed ? start : typed;
    if (!canFollow(puzzle, word.at(-1), ch)) return say(REJECT_TEXT.side);
    setTyped(word + ch);
  }

  function submit() {
    const word = current;
    if (!word || word === start) return;
    const bad = check(word, state, puzzle);
    if (bad) return say(REJECT_TEXT[bad]);
    onWord(word);
    setTyped('');
  }

  /** Delete a letter; with nothing typed, take back the last word. */
  function back() {
    // `typed` always begins with the required start letter once you've typed anything.
    const extra = start ? typed.slice(1) : typed;
    if (extra) setTyped(start && extra.length === 1 ? '' : typed.slice(0, -1));
    else if (state.words.length) onUndo();
  }

  // The keyboard listener is added once and always calls the latest handlers.
  const keys = useRef({ submit, back, press, all });
  useEffect(() => {
    keys.current = { submit, back, press, all };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      const k = keys.current;
      if (e.key === 'Enter') k.submit();
      else if (e.key === 'Backspace') k.back();
      else if (/^[a-zA-Z]$/.test(e.key) && k.all.includes(e.key.toLowerCase()))
        k.press(e.key.toLowerCase());
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lines: every word so far, then the one being typed (dashed).
  const pos = (ch: string): [number, number] => {
    const side = puzzle.sides.findIndex((s) => s.includes(ch));
    return spot(side, puzzle.sides[side]!.indexOf(ch));
  };
  const path = (w: string) => [...w].map((ch) => pos(ch).join(',')).join(' ');
  const last = current.at(-1);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between font-mono text-sm">
        <span>
          Words: <b>{state.words.length}</b> · try for {PAR} or fewer
        </span>
        <span>{used.size}/12 letters</span>
      </div>

      <div className="relative flex min-h-12 w-full items-center justify-center border-b-3 border-ink">
        <p aria-live="polite" className="m-0 text-3xl font-black tracking-wider uppercase">
          {current || (
            <span className="text-xl font-normal text-mute">{start ? '' : 'Tap letters'}</span>
          )}
        </p>
        {toast && (
          <span
            key={toast.id}
            role="status"
            className="absolute -top-8 animate-pop border-2 border-ink bg-ink px-3 py-1 font-mono text-xs font-bold text-paper"
          >
            {toast.text}
          </span>
        )}
      </div>

      <svg
        viewBox="0 0 300 300"
        className="w-[min(86vw,340px)]"
        role="group"
        aria-label="Letter box"
      >
        <rect x="55" y="55" width="190" height="190" fill="#f9fafb" stroke="#000" strokeWidth="4" />
        {state.words.map((w, i) => (
          <polyline
            key={i}
            points={path(w)}
            fill="none"
            stroke={ACCENT}
            strokeWidth="5"
            strokeLinejoin="round"
            opacity="0.6"
          />
        ))}
        {current.length > 1 && (
          <polyline
            points={path(current)}
            fill="none"
            stroke="#000"
            strokeWidth="4"
            strokeDasharray="8 6"
            strokeLinejoin="round"
          />
        )}
        {puzzle.sides.map((side, si) =>
          [...side].map((ch, k) => {
            const [x, y] = spot(si, k);
            const isUsed = used.has(ch);
            const isLast = ch === last;
            const blocked = !!last && !canFollow(puzzle, last, ch);
            // dots sit on the box edge, letters outside it
            const [dx, dy] = [
              [0, 25],
              [-25, 0],
              [0, -25],
              [25, 0],
            ][si] as [number, number];
            return (
              <g
                key={ch}
                role="button"
                tabIndex={0}
                aria-label={`${ch}${isUsed ? ', used' : ''}`}
                onClick={() => press(ch)}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    press(ch);
                  }
                }}
                className="cursor-pointer"
                opacity={blocked ? 0.35 : 1}
              >
                <circle
                  cx={x + dx}
                  cy={y + dy}
                  r="9"
                  fill={isLast ? '#000' : isUsed ? ACCENT : '#f9fafb'}
                  stroke="#000"
                  strokeWidth="3"
                />
                <circle cx={x} cy={y} r="22" fill="transparent" />
                <text
                  x={x}
                  y={y + 9}
                  textAnchor="middle"
                  fontSize="28"
                  fontWeight="900"
                  fill={isUsed ? '#000' : '#555'}
                  style={{ textTransform: 'uppercase' }}
                >
                  {ch.toUpperCase()}
                </text>
              </g>
            );
          }),
        )}
      </svg>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRestart}
          disabled={state.won}
          className="min-h-12 cursor-pointer rounded-full border-2 border-ink bg-paper px-4 font-bold disabled:opacity-40"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={back}
          disabled={state.won}
          className="min-h-12 cursor-pointer rounded-full border-2 border-ink bg-paper px-4 font-bold disabled:opacity-40"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={state.won}
          className="min-h-12 cursor-pointer rounded-full border-2 border-ink bg-ink px-5 font-bold text-paper disabled:opacity-40"
        >
          Enter
        </button>
      </div>

      <p className="m-0 text-center font-mono text-sm uppercase">
        {state.words.length
          ? state.words.join(' → ')
          : 'Letters next to each other must be on different sides.'}
      </p>
    </div>
  );
}
