// Spin the Wheel. Pure: picking, where the wheel stops, and the option lists.
//
// The wheel is drawn with option 0 starting at the top (12 o'clock) and going clockwise.
// The pointer is fixed at the top. Turning the wheel clockwise by `r` degrees puts the
// point that was at angle (360 - r) under the pointer.

import type { RandomInt } from '../../../lib/roomCode';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 24;
export const MAX_LABEL = 40;

/** Full turns added to every spin, so it looks like a proper spin. */
const EXTRA_TURNS = 5;

/** Clean up a list: trim, drop blanks and repeats (ignoring case), cap the length. */
export function cleanOptions(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const o = r.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL);
    const key = o.toLowerCase();
    if (!o || seen.has(key)) continue;
    seen.add(key);
    out.push(o);
    if (out.length === MAX_OPTIONS) break;
  }
  return out;
}

/** Which option is under the pointer when the wheel has turned `rotation` degrees. */
export function optionAt(rotation: number, count: number): number {
  const angle = (((360 - rotation) % 360) + 360) % 360;
  return Math.floor(angle / (360 / count)) % count;
}

/**
 * The next total rotation: from `current`, several full turns plus however far it takes to
 * land somewhere inside slice `index` (not on an edge, so nobody argues about it).
 */
export function spinTo(current: number, index: number, count: number, randomInt: RandomInt) {
  const slice = 360 / count;
  // A point inside the slice, kept away from both edges.
  const within = slice * (0.15 + (randomInt(1000) / 1000) * 0.7);
  const target = index * slice + within; // where on the wheel should end up at the top
  const needed = (((360 - target - current) % 360) + 360) % 360;
  return current + EXTRA_TURNS * 360 + needed;
}

export const pickIndex = (count: number, randomInt: RandomInt) => randomInt(count);

/** Ready-made lists to start from. */
export const PRESETS: { name: string; options: string[] }[] = [
  {
    name: 'Makan mana?',
    options: [
      'Mamak',
      'Nasi lemak',
      'Chicken rice',
      'Economy rice',
      'Ramen',
      'Korean BBQ',
      'Thai',
      'Burger',
      'Pizza',
      'Dim sum',
    ],
  },
  { name: 'Yes or no', options: ['Yes', 'No'] },
  { name: 'Who pays?', options: ['Ali', 'Mei Ling', 'Ravi', 'Sarah'] },
  { name: '1 to 6', options: ['1', '2', '3', '4', '5', '6'] },
  { name: 'Truth or dare', options: ['Truth', 'Dare'] },
];

/** Colours for the slices, cycled. All keep black text readable. */
export const SLICE_COLOURS = [
  '#ffd23f',
  '#ff8fd0',
  '#7ee081',
  '#4fd1e8',
  '#b9a2ff',
  '#ff9f5a',
  '#f9fafb',
];

/** A colour for slice i that never matches its neighbours, even where the wheel wraps. */
export function sliceColour(i: number, count: number): string {
  const n = SLICE_COLOURS.length;
  // With a count one more than a multiple of the palette, the last slice would match the first.
  if (i === count - 1 && count > 1 && (count - 1) % n === 0) return SLICE_COLOURS[1]!;
  return SLICE_COLOURS[i % n]!;
}
