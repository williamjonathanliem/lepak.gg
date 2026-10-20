// Connecti*ns rules. Pure functions, no React, no storage.
import type { Puzzle } from './puzzles';

export const MAX_MISTAKES = 4;

export type Status = 'playing' | 'won' | 'lost';

export interface ConnState {
  puzzleId: number;
  /** Unsolved words in display order. */
  order: string[];
  /** Group indexes, in the order they were found (or revealed after a loss). */
  solved: number[];
  mistakes: number;
  /** Every submitted set, for the share grid and repeat checks. */
  history: string[][];
  status: Status;
}

export type SubmitResult = 'correct' | 'one-away' | 'wrong' | 'repeat' | 'invalid';

/** Random number in [0, 1). Injected so tests are predictable. */
export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function newGame(puzzle: Puzzle, rng: Rng): ConnState {
  return {
    puzzleId: puzzle.id,
    order: shuffle(
      puzzle.groups.flatMap((g) => g.words),
      rng,
    ),
    solved: [],
    mistakes: 0,
    history: [],
    status: 'playing',
  };
}

/** Which group a word belongs to. */
export function groupOf(puzzle: Puzzle, word: string): number {
  return puzzle.groups.findIndex((g) => g.words.includes(word));
}

const key = (words: readonly string[]) => [...words].sort().join('|');

export function submit(
  state: ConnState,
  puzzle: Puzzle,
  selection: readonly string[],
): { state: ConnState; result: SubmitResult } {
  if (state.status !== 'playing' || selection.length !== 4) return { state, result: 'invalid' };
  if (!selection.every((w) => state.order.includes(w))) return { state, result: 'invalid' };
  if (state.history.some((h) => key(h) === key(selection))) return { state, result: 'repeat' };

  const history = [...state.history, [...selection]];
  const groups = selection.map((w) => groupOf(puzzle, w));
  const counts = new Map<number, number>();
  for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + 1);
  const best = Math.max(...counts.values());

  if (best === 4) {
    const g = groups[0]!;
    const solved = [...state.solved, g];
    const order = state.order.filter((w) => !selection.includes(w));
    return {
      state: { ...state, solved, order, history, status: solved.length === 4 ? 'won' : 'playing' },
      result: 'correct',
    };
  }

  const mistakes = state.mistakes + 1;
  if (mistakes >= MAX_MISTAKES) {
    // Out of tries: reveal everything that's left.
    const rest = [0, 1, 2, 3].filter((g) => !state.solved.includes(g));
    return {
      state: {
        ...state,
        mistakes,
        history,
        order: [],
        solved: [...state.solved, ...rest],
        status: 'lost',
      },
      result: best === 3 ? 'one-away' : 'wrong',
    };
  }
  return {
    state: { ...state, mistakes, history },
    result: best === 3 ? 'one-away' : 'wrong',
  };
}

const SQUARES = ['🟨', '🟩', '🟦', '🟪'];

/** Emoji grid of every guess, coloured by each word's real group level. */
export function shareText(state: ConnState, puzzle: Puzzle, label: string): string {
  const rows = state.history.map((h) =>
    h.map((w) => SQUARES[puzzle.groups[groupOf(puzzle, w)]!.level]).join(''),
  );
  return `${label}\n${rows.join('\n')}`;
}

/** Same puzzle for everyone on the same day. */
export function dailyPuzzle(puzzles: readonly Puzzle[], day: number): Puzzle {
  const n = puzzles.length;
  return puzzles[(((day - 1) % n) + n) % n]!;
}
