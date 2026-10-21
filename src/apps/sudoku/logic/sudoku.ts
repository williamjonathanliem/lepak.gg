// Sudoku rules and puzzle maker. Pure: state in, state out.
// Cells are numbered 0..80, row by row. 0 means empty.

import { seededRng, shuffle, type Rng } from '../../../lib/puzzle';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** How many numbers stay on the board. */
const CLUES: Record<Difficulty, number> = { easy: 40, medium: 32, hard: 26 };

export const row = (i: number) => Math.floor(i / 9);
export const col = (i: number) => i % 9;
export const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

/** Cells that can't share a number with cell i (same row, column or box). */
export function peers(i: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) out.push(j);
  }
  return out;
}
const PEERS = Array.from({ length: 81 }, (_, i) => peers(i));

function canPlace(grid: number[], i: number, n: number): boolean {
  return PEERS[i]!.every((j) => grid[j] !== n);
}

/** Fill the grid (in place). With rng: a random full grid. Returns false if impossible. */
function fill(grid: number[], rng?: Rng): boolean {
  const i = grid.indexOf(0);
  if (i < 0) return true;
  const digits = rng ? shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const n of digits) {
    if (canPlace(grid, i, n)) {
      grid[i] = n;
      if (fill(grid, rng)) return true;
      grid[i] = 0;
    }
  }
  return false;
}

/** How many ways the puzzle can be finished, stopping at `limit`. */
export function countSolutions(puzzle: readonly number[], limit = 2): number {
  const grid = [...puzzle];
  let count = 0;
  const go = (): void => {
    if (count >= limit) return;
    // Pick the empty cell with the fewest options: much faster than the first empty cell.
    let best = -1;
    let options: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => canPlace(grid, i, n));
      if (best < 0 || opts.length < options.length) {
        best = i;
        options = opts;
        if (opts.length <= 1) break;
      }
    }
    if (best < 0) {
      count++;
      return;
    }
    for (const n of options) {
      grid[best] = n;
      go();
      grid[best] = 0;
    }
  };
  go();
  return count;
}

export interface SudokuPuzzle {
  puzzle: number[];
  solution: number[];
}

/** A puzzle with exactly one solution. Same seed and difficulty, same puzzle. */
export function makePuzzle(seed: string, difficulty: Difficulty): SudokuPuzzle {
  const rng = seededRng(`${seed}:${difficulty}`);
  const solution = new Array<number>(81).fill(0);
  fill(solution, rng);
  const puzzle = [...solution];
  let filled = 81;
  for (const i of shuffle(
    Array.from({ length: 81 }, (_, k) => k),
    rng,
  )) {
    if (filled <= CLUES[difficulty]) break;
    const keep = puzzle[i]!;
    puzzle[i] = 0;
    if (countSolutions(puzzle) !== 1) puzzle[i] = keep;
    else filled--;
  }
  return { puzzle, solution };
}

// ---------- playing ----------

export interface SudokuState extends SudokuPuzzle {
  difficulty: Difficulty;
  /** What the player has written (givens included). */
  entries: number[];
  /** Pencil marks per cell. */
  notes: number[][];
  mistakes: number;
  startedAt: number;
  finishedAt: number | null;
}

export function newSudoku(seed: string, difficulty: Difficulty, now: number): SudokuState {
  const p = makePuzzle(seed, difficulty);
  return {
    ...p,
    difficulty,
    entries: [...p.puzzle],
    notes: Array.from({ length: 81 }, () => []),
    mistakes: 0,
    startedAt: now,
    finishedAt: null,
  };
}

export const isGiven = (s: SudokuState, i: number) => s.puzzle[i] !== 0;
export const isSolved = (s: SudokuState) => s.entries.every((n, i) => n === s.solution[i]);

/** Write a number (0 = clear). Wrong numbers stay, shown in red, and count as a mistake. */
export function enter(s: SudokuState, i: number, n: number, now: number): SudokuState {
  if (s.finishedAt || isGiven(s, i) || s.entries[i] === n) return s;
  const entries = [...s.entries];
  entries[i] = n;
  const notes = s.notes.map((ns, j) =>
    j === i ? [] : n && PEERS[i]!.includes(j) ? ns.filter((x) => x !== n) : ns,
  );
  const wrong = n !== 0 && n !== s.solution[i];
  const next = { ...s, entries, notes, mistakes: s.mistakes + (wrong ? 1 : 0) };
  return isSolved(next) ? { ...next, finishedAt: now } : next;
}

/** Toggle a pencil mark. */
export function toggleNote(s: SudokuState, i: number, n: number): SudokuState {
  if (s.finishedAt || isGiven(s, i) || s.entries[i]) return s;
  const notes = s.notes.map((ns, j) =>
    j !== i ? ns : ns.includes(n) ? ns.filter((x) => x !== n) : [...ns, n].sort(),
  );
  return { ...s, notes };
}

/** Is the number in this cell clashing with another in its row, column or box? */
export function clashes(entries: readonly number[], i: number): boolean {
  const n = entries[i];
  return !!n && PEERS[i]!.some((j) => entries[j] === n);
}
