// Pocket Crossword rules. Pure. Puzzles come from public/games/crossword.json
// (scripts/build-crossword.mjs): a 5 x 5 grid with black squares at the four inner corners,
// three words across (rows 1, 3, 5) and three down (columns 1, 3, 5).

export const SIZE = 5;
export const BLACK = new Set([6, 8, 16, 18]);

export interface Entry {
  word: string;
  clue: string;
}

export interface CrosswordPuzzle {
  across: Entry[];
  down: Entry[];
}

export type Dir = 'across' | 'down';

export interface Slot {
  dir: Dir;
  /** Clue number shown on the grid. */
  number: number;
  /** Index into puzzle.across / puzzle.down. */
  index: number;
  cells: number[];
}

/** The six answers: across rows 0, 2, 4 and down columns 0, 2, 4. Numbered like a newspaper. */
export const SLOTS: Slot[] = [
  { dir: 'across', number: 1, index: 0, cells: [0, 1, 2, 3, 4] },
  { dir: 'across', number: 4, index: 1, cells: [10, 11, 12, 13, 14] },
  { dir: 'across', number: 5, index: 2, cells: [20, 21, 22, 23, 24] },
  { dir: 'down', number: 1, index: 0, cells: [0, 5, 10, 15, 20] },
  { dir: 'down', number: 2, index: 1, cells: [2, 7, 12, 17, 22] },
  { dir: 'down', number: 3, index: 2, cells: [4, 9, 14, 19, 24] },
];

/** Small numbers in the corner of a square. */
export const NUMBERS: Record<number, number> = { 0: 1, 2: 2, 4: 3, 10: 4, 20: 5 };

export function solution(p: CrosswordPuzzle): string[] {
  const out = new Array<string>(SIZE * SIZE).fill('');
  for (const s of SLOTS) {
    const word = (s.dir === 'across' ? p.across : p.down)[s.index]!.word.toUpperCase();
    s.cells.forEach((c, k) => (out[c] = word[k]!));
  }
  return out;
}

/** The answer slot through a square in a direction (falls back to the other direction). */
export function slotFor(cell: number, dir: Dir): Slot | null {
  return (
    SLOTS.find((s) => s.dir === dir && s.cells.includes(cell)) ??
    SLOTS.find((s) => s.cells.includes(cell)) ??
    null
  );
}

export interface CrosswordState {
  seed: string;
  letters: string[];
  /** Squares the player asked to see. */
  revealed: number[];
  /** Squares marked wrong by Check. */
  wrong: number[];
  startedAt: number;
  finishedAt: number | null;
  /** Solved without revealing everything. */
  won: boolean;
}

export function newCrossword(seed: string, now: number): CrosswordState {
  return {
    seed,
    letters: new Array<string>(SIZE * SIZE).fill(''),
    revealed: [],
    wrong: [],
    startedAt: now,
    finishedAt: null,
    won: false,
  };
}

function finish(s: CrosswordState, sol: string[], now: number): CrosswordState {
  const full = sol.every((ch, i) => !ch || s.letters[i] === ch);
  if (!full) return s;
  // Revealing every square isn't a win.
  const playable = sol.filter(Boolean).length;
  return { ...s, finishedAt: now, won: s.revealed.length < playable };
}

export function type(
  s: CrosswordState,
  sol: string[],
  cell: number,
  ch: string,
  now: number,
): CrosswordState {
  if (s.finishedAt || BLACK.has(cell) || s.revealed.includes(cell)) return s;
  const letters = [...s.letters];
  letters[cell] = ch.toUpperCase();
  return finish({ ...s, letters, wrong: s.wrong.filter((c) => c !== cell) }, sol, now);
}

/** Mark wrong letters (empty squares aren't marked). */
export function check(s: CrosswordState, sol: string[]): CrosswordState {
  return { ...s, wrong: s.letters.flatMap((ch, i) => (ch && ch !== sol[i] ? [i] : [])) };
}

export function reveal(
  s: CrosswordState,
  sol: string[],
  cells: number[],
  now: number,
): CrosswordState {
  if (s.finishedAt) return s;
  const letters = [...s.letters];
  const revealed = new Set(s.revealed);
  for (const c of cells) {
    if (BLACK.has(c)) continue;
    if (letters[c] !== sol[c]) revealed.add(c);
    letters[c] = sol[c]!;
  }
  return finish(
    { ...s, letters, revealed: [...revealed], wrong: s.wrong.filter((c) => !cells.includes(c)) },
    sol,
    now,
  );
}

/** Next square after `cell` in this slot (stays on the last square at the end). Moving one
 * square at a time means typing a whole word always lands in the right squares. */
export function nextCell(slot: Slot, cell: number): number {
  const at = slot.cells.indexOf(cell);
  return slot.cells[at + 1] ?? cell;
}
