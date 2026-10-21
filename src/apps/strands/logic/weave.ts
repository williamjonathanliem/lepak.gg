// Word Weave rules. Pure. Puzzles come from public/games/weave.json (scripts/build-games.mjs):
// a 6 x 8 grid where the theme words and the spangram use every letter exactly once.
// Trace a word by moving to any touching square (diagonals too). Find them all to win.

export interface WeaveWord {
  word: string;
  cells: number[];
}

export interface WeavePuzzle {
  hint: string;
  cols: number;
  rows: number;
  grid: string;
  spangram: string;
  words: WeaveWord[];
}

export interface WeaveState {
  seed: string;
  found: string[];
  hints: number;
  /** The word the last hint pointed at (its squares get outlined). */
  hinted: string | null;
  won: boolean;
}

export function newWeave(seed: string): WeaveState {
  return { seed, found: [], hints: 0, hinted: null, won: false };
}

/** Squares touch, diagonals included. */
export function touching(p: Pick<WeavePuzzle, 'cols'>, a: number, b: number): boolean {
  const dr = Math.abs(Math.floor(a / p.cols) - Math.floor(b / p.cols));
  const dc = Math.abs((a % p.cols) - (b % p.cols));
  return a !== b && dr <= 1 && dc <= 1;
}

/** Can this square be added to the path being traced? */
export function canExtend(p: WeavePuzzle, path: readonly number[], cell: number): boolean {
  if (path.includes(cell)) return false;
  const last = path.at(-1);
  return last === undefined || touching(p, last, cell);
}

export const pathWord = (p: WeavePuzzle, path: readonly number[]) =>
  path.map((c) => p.grid[c]).join('');

export type Verdict =
  { kind: 'found'; word: string; spangram: boolean } | { kind: 'again' } | { kind: 'no' };

/** Is this traced path one of the hidden words (exactly those squares, in order)? */
export function judge(p: WeavePuzzle, s: WeaveState, path: readonly number[]): Verdict {
  const hit = p.words.find(
    (w) => w.cells.length === path.length && w.cells.every((c, i) => c === path[i]),
  );
  if (!hit) return { kind: 'no' };
  if (s.found.includes(hit.word)) return { kind: 'again' };
  return { kind: 'found', word: hit.word, spangram: hit.word === p.spangram };
}

export function addFound(s: WeaveState, p: WeavePuzzle, word: string): WeaveState {
  const found = [...s.found, word];
  return {
    ...s,
    found,
    hinted: s.hinted === word ? null : s.hinted,
    won: found.length === p.words.length,
  };
}

/** Point at a word you haven't found (theme words before the spangram). */
export function takeHint(s: WeaveState, p: WeavePuzzle): WeaveState {
  if (s.won || (s.hinted && !s.found.includes(s.hinted))) return s;
  const next =
    p.words.find((w) => w.word !== p.spangram && !s.found.includes(w.word)) ??
    p.words.find((w) => !s.found.includes(w.word));
  return next ? { ...s, hints: s.hints + 1, hinted: next.word } : s;
}
