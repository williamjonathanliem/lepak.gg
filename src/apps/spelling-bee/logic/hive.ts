// Hive Mind rules. Pure. Puzzles come from public/games/hive.json (scripts/build-games.mjs):
// 7 letters with the centre letter first, plus every word that fits.

import { puzzleIndex } from '../../../lib/puzzle';

export interface HivePuzzle {
  letters: string; // centre first
  words: string[];
}

export interface HiveState {
  seed: string;
  found: string[];
  score: number;
  /** Total points available, set once the puzzle has loaded. */
  max: number;
  /** Reached "Lepak Legend" (counts as a win for stats). */
  won: boolean;
}

export const WIN_RANK = 'Lepak Legend';

export const RANKS: { name: string; pct: number }[] = [
  { name: 'Newbie', pct: 0 },
  { name: 'Warming up', pct: 2 },
  { name: 'Getting there', pct: 5 },
  { name: 'Not bad', pct: 10 },
  { name: 'Steady', pct: 20 },
  { name: 'Power', pct: 35 },
  { name: 'Terer', pct: 50 },
  { name: WIN_RANK, pct: 70 },
  { name: 'Ratu Lebah', pct: 100 },
];

export function newHive(seed: string): HiveState {
  return { seed, found: [], score: 0, max: 0, won: false };
}

export { puzzleIndex };

export const isPangram = (word: string, letters: string) =>
  [...letters].every((ch) => word.includes(ch));

export function wordScore(word: string, letters: string): number {
  return (word.length === 4 ? 1 : word.length) + (isPangram(word, letters) ? 7 : 0);
}

export function maxScore(p: HivePuzzle): number {
  return p.words.reduce((sum, w) => sum + wordScore(w, p.letters), 0);
}

export type Reject = 'short' | 'centre' | 'letters' | 'unknown' | 'found';

export const REJECT_TEXT: Record<Reject, string> = {
  short: 'Too short: 4 letters or more',
  centre: 'Missing the middle letter',
  letters: 'Only use the letters in the hive',
  unknown: 'Not in our word list',
  found: 'Already found',
};

export function check(input: string, p: HivePuzzle, found: readonly string[]): Reject | null {
  const w = input.toLowerCase();
  if (w.length < 4) return 'short';
  if (![...w].every((ch) => p.letters.includes(ch))) return 'letters';
  if (!w.includes(p.letters[0]!)) return 'centre';
  if (found.includes(w)) return 'found';
  if (!p.words.includes(w)) return 'unknown';
  return null;
}

/** Add a word (already checked). Updates score and whether the win rank is reached. */
export function addWord(s: HiveState, word: string, p: HivePuzzle): HiveState {
  const w = word.toLowerCase();
  const max = maxScore(p);
  const score = s.score + wordScore(w, p.letters);
  return {
    ...s,
    found: [...s.found, w].sort(),
    score,
    max,
    won: s.won || score >= Math.ceil((max * 70) / 100),
  };
}

export function rankFor(
  score: number,
  max: number,
): { name: string; index: number; next?: { name: string; at: number } } {
  if (!max) return { name: RANKS[0]!.name, index: 0 };
  let index = 0;
  RANKS.forEach((r, i) => {
    if (score >= Math.ceil((max * r.pct) / 100)) index = i;
  });
  const n = RANKS[index + 1];
  return {
    name: RANKS[index]!.name,
    index,
    next: n ? { name: n.name, at: Math.ceil((max * n.pct) / 100) } : undefined,
  };
}
