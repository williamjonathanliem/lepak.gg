// Domino Logic rules and puzzle maker. Pure.
//
// The board is split into regions, each with a rule (sum, all equal, all different, less
// than, more than, or free). Place every domino on two neighbouring squares so every rule
// holds. Puzzles are made from a real solution, so one always exists; any placement that
// satisfies every rule counts.

import { seededRng, shuffle, type Rng } from '../../../lib/puzzle';

export const ROWS = 4;
export const COLS = 5;

export type Rule =
  | { kind: 'sum'; n: number }
  | { kind: 'less'; n: number }
  | { kind: 'more'; n: number }
  | { kind: 'equal' }
  | { kind: 'different' }
  | { kind: 'free' };

export interface Region {
  cells: number[];
  rule: Rule;
}

export interface DominoPuzzle {
  /** Squares that are part of the board (cell index = row * COLS + col). */
  cells: number[];
  regions: Region[];
  /** Pips on each domino [a, b]. */
  dominoes: [number, number][];
}

export interface Placement {
  domino: number;
  /** Square for the domino's first half, and for its second half. */
  a: number;
  b: number;
}

export interface DominoState {
  seed: string;
  placed: Placement[];
  won: boolean;
}

const rowOf = (i: number) => Math.floor(i / COLS);
const colOf = (i: number) => i % COLS;

export function neighbours(i: number): number[] {
  const out: number[] = [];
  if (rowOf(i) > 0) out.push(i - COLS);
  if (rowOf(i) < ROWS - 1) out.push(i + COLS);
  if (colOf(i) > 0) out.push(i - 1);
  if (colOf(i) < COLS - 1) out.push(i + 1);
  return out;
}

export const adjacent = (a: number, b: number) => neighbours(a).includes(b);

/** Pair every board square with a neighbour (a random domino tiling), or null. */
function tile(cells: number[], rng: Rng): [number, number][] | null {
  const on = new Set(cells);
  const used = new Set<number>();
  const pairs: [number, number][] = [];
  const order = [...cells].sort((x, y) => x - y);
  const go = (): boolean => {
    const first = order.find((c) => !used.has(c));
    if (first === undefined) return true;
    for (const n of shuffle(neighbours(first), rng)) {
      if (!on.has(n) || used.has(n)) continue;
      used.add(first);
      used.add(n);
      pairs.push([first, n]);
      if (go()) return true;
      pairs.pop();
      used.delete(first);
      used.delete(n);
    }
    return false;
  };
  return go() ? pairs : null;
}

/** Split the board into small connected regions (1 to 4 squares). */
function splitRegions(cells: number[], rng: Rng): number[][] {
  const left = new Set(cells);
  const out: number[][] = [];
  for (const start of shuffle(cells, rng)) {
    if (!left.has(start)) continue;
    const size = 1 + Math.floor(rng() * 4);
    const region = [start];
    left.delete(start);
    while (region.length < size) {
      const options = region.flatMap(neighbours).filter((n) => left.has(n));
      if (!options.length) break;
      const next = options[Math.floor(rng() * options.length)]!;
      region.push(next);
      left.delete(next);
    }
    out.push(region.sort((x, y) => x - y));
  }
  return out;
}

function ruleFor(values: number[], rng: Rng): Rule {
  const sum = values.reduce((a, b) => a + b, 0);
  const options: Rule[] = [{ kind: 'sum', n: sum }];
  if (values.length > 1 && values.every((v) => v === values[0])) options.push({ kind: 'equal' });
  if (values.length > 1 && new Set(values).size === values.length)
    options.push({ kind: 'different' });
  if (sum < 12) options.push({ kind: 'less', n: sum + 1 + Math.floor(rng() * 3) });
  if (sum > 0) options.push({ kind: 'more', n: Math.max(0, sum - 1 - Math.floor(rng() * 3)) });
  if (rng() < 0.12) return { kind: 'free' };
  return options[Math.floor(rng() * options.length)]!;
}

export function makePuzzle(seed: string): DominoPuzzle {
  const rng = seededRng(`pips:${seed}`);
  for (;;) {
    // A 4 x 5 board with two squares knocked out, so shapes vary day to day.
    const all = Array.from({ length: ROWS * COLS }, (_, i) => i);
    const holes = new Set(shuffle(all, rng).slice(0, 2));
    const cells = all.filter((c) => !holes.has(c));
    const pairs = tile(cells, rng);
    if (!pairs) continue;
    const value = new Map<number, number>();
    const dominoes: [number, number][] = pairs.map(([a, b]) => {
      const pa = Math.floor(rng() * 7);
      const pb = Math.floor(rng() * 7);
      value.set(a, pa);
      value.set(b, pb);
      return [pa, pb];
    });
    const regions = splitRegions(cells, rng).map((rc) => ({
      cells: rc,
      rule: ruleFor(
        rc.map((c) => value.get(c)!),
        rng,
      ),
    }));
    return { cells, regions, dominoes: shuffle(dominoes, rng) };
  }
}

export function newDominoes(seed: string): DominoState {
  return { seed, placed: [], won: false };
}

/** Pips on each covered square, from the placements. */
export function boardValues(p: DominoPuzzle, placed: readonly Placement[]): Map<number, number> {
  const v = new Map<number, number>();
  for (const pl of placed) {
    const [x, y] = p.dominoes[pl.domino]!;
    v.set(pl.a, x);
    v.set(pl.b, y);
  }
  return v;
}

/** Does this region's rule hold? null while some of its squares are still empty. */
export function regionOk(r: Region, values: Map<number, number>): boolean | null {
  const vs = r.cells.map((c) => values.get(c));
  if (vs.some((v) => v === undefined)) return null;
  const n = vs as number[];
  const sum = n.reduce((a, b) => a + b, 0);
  switch (r.rule.kind) {
    case 'sum':
      return sum === r.rule.n;
    case 'less':
      return sum < r.rule.n;
    case 'more':
      return sum > r.rule.n;
    case 'equal':
      return n.every((x) => x === n[0]);
    case 'different':
      return new Set(n).size === n.length;
    case 'free':
      return true;
  }
}

export function place(s: DominoState, p: DominoPuzzle, pl: Placement): DominoState {
  if (s.won || !adjacent(pl.a, pl.b)) return s;
  if (!p.cells.includes(pl.a) || !p.cells.includes(pl.b)) return s;
  const taken = new Set(s.placed.flatMap((x) => [x.a, x.b]));
  if (taken.has(pl.a) || taken.has(pl.b) || s.placed.some((x) => x.domino === pl.domino)) return s;
  const placed = [...s.placed, pl];
  const values = boardValues(p, placed);
  const won =
    placed.length === p.dominoes.length && p.regions.every((r) => regionOk(r, values) === true);
  return { ...s, placed, won };
}

/** Take a domino back off the board. */
export function lift(s: DominoState, domino: number): DominoState {
  return s.won ? s : { ...s, placed: s.placed.filter((x) => x.domino !== domino) };
}

export function ruleLabel(r: Rule): string {
  switch (r.kind) {
    case 'sum':
      return String(r.n);
    case 'less':
      return `<${r.n}`;
    case 'more':
      return `>${r.n}`;
    case 'equal':
      return '=';
    case 'different':
      return '≠';
    case 'free':
      return '';
  }
}

export function ruleText(r: Rule): string {
  switch (r.kind) {
    case 'sum':
      return `adds up to ${r.n}`;
    case 'less':
      return `adds up to less than ${r.n}`;
    case 'more':
      return `adds up to more than ${r.n}`;
    case 'equal':
      return 'all the same';
    case 'different':
      return 'all different';
    case 'free':
      return 'anything';
  }
}
