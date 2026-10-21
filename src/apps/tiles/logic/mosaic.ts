// Mosaic rules. Pure.
//
// Every tile has three layers: a background colour, a shape and a corner mark. Pick a tile,
// then another: whatever layers they share disappear from both. Keep matching with the
// tile you just used to build a combo. Clear every tile to finish.
//
// Each layer value appears an even number of times, so the board can always be cleared:
// if two tiles were left with nothing in common, some value would be used an odd number of
// times. (The test plays whole boards to prove it.)

import { seededRng, shuffle, type Rng } from '../../../lib/puzzle';

export const LAYERS = ['bg', 'shape', 'mark'] as const;
export type LayerName = (typeof LAYERS)[number];
export type Tile = Record<LayerName, number | null>;

export const COLS = 5;
export const ROWS = 6;
export const VALUES = 5; // options per layer

export interface MosaicState {
  seed: string;
  tiles: Tile[];
  selected: number | null;
  combo: number;
  bestCombo: number;
  moves: number;
  done: boolean;
}

/** A layer's values, in pairs, shuffled across the board. */
function layerValues(n: number, rng: Rng): number[] {
  const pairs: number[] = [];
  for (let i = 0; i < n / 2; i++) {
    const v = Math.floor(rng() * VALUES);
    pairs.push(v, v);
  }
  return shuffle(pairs, rng);
}

export function newMosaic(seed: string): MosaicState {
  const rng = seededRng(seed);
  const n = COLS * ROWS;
  const bg = layerValues(n, rng);
  const shape = layerValues(n, rng);
  const mark = layerValues(n, rng);
  return {
    seed,
    tiles: Array.from({ length: n }, (_, i) => ({ bg: bg[i]!, shape: shape[i]!, mark: mark[i]! })),
    selected: null,
    combo: 0,
    bestCombo: 0,
    moves: 0,
    done: false,
  };
}

export const isEmpty = (t: Tile) => LAYERS.every((l) => t[l] === null);

export function shared(a: Tile, b: Tile): LayerName[] {
  return LAYERS.filter((l) => a[l] !== null && a[l] === b[l]);
}

/** Tap a tile. */
export function tap(s: MosaicState, i: number): MosaicState {
  const t = s.tiles[i];
  if (s.done || !t || isEmpty(t)) return s;
  if (s.selected === null || s.selected === i) {
    return { ...s, selected: s.selected === i ? null : i };
  }
  const a = s.tiles[s.selected]!;
  const common = shared(a, t);
  if (!common.length) {
    // No match: the combo ends and this tile becomes the new pick.
    return { ...s, selected: i, combo: 0 };
  }
  const tiles = s.tiles.map((x, k) => {
    if (k !== i && k !== s.selected) return x;
    const y = { ...x };
    for (const l of common) y[l] = null;
    return y;
  });
  const combo = s.combo + 1;
  const done = tiles.every(isEmpty);
  return {
    ...s,
    tiles,
    // Keep going from the tile you just matched, if it has anything left.
    selected: done || isEmpty(tiles[i]!) ? null : i,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
    moves: s.moves + 1,
    done,
  };
}

/** Any two tiles that still share something (for the hint button). */
export function findPair(tiles: readonly Tile[]): [number, number] | null {
  for (let i = 0; i < tiles.length; i++) {
    if (isEmpty(tiles[i]!)) continue;
    for (let j = i + 1; j < tiles.length; j++) {
      if (!isEmpty(tiles[j]!) && shared(tiles[i]!, tiles[j]!).length) return [i, j];
    }
  }
  return null;
}
