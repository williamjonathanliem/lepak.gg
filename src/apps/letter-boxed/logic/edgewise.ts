// Edgewise rules. Pure. Puzzles come from public/games/edgewise/<n>.json
// (scripts/build-games.mjs): 4 sides of 3 letters, a 2-word answer, and every valid word.
//
// Make words with the letters round the box. Next letter can't be on the same side as the
// one before it. Each new word starts with the last letter of the previous word.
// Use every letter to win. Try to do it in as few words as you can.

export interface EdgewisePuzzle {
  sides: string[];
  answer: string[];
  words: string[];
}

export interface EdgewiseState {
  seed: string;
  words: string[];
  won: boolean;
}

export const PAR = 5;

export function newEdgewise(seed: string): EdgewiseState {
  return { seed, words: [], won: false };
}

export function sideOf(p: EdgewisePuzzle, ch: string): number {
  return p.sides.findIndex((s) => s.includes(ch));
}

/** Can this letter come next after `prev`? */
export function canFollow(p: EdgewisePuzzle, prev: string | undefined, ch: string): boolean {
  const s = sideOf(p, ch);
  return s >= 0 && (prev === undefined || sideOf(p, prev) !== s);
}

/** The letter the next word must start with (last letter of the last word), if any. */
export function mustStartWith(s: EdgewiseState): string | undefined {
  const last = s.words.at(-1);
  return last?.at(-1);
}

export type Reject = 'short' | 'start' | 'side' | 'unknown';

export const REJECT_TEXT: Record<Reject, string> = {
  short: 'Words need 3 letters or more',
  start: 'Start with the last letter of your last word',
  side: 'Letters next to each other must be on different sides',
  unknown: 'Not in our word list',
};

export function check(word: string, s: EdgewiseState, p: EdgewisePuzzle): Reject | null {
  const w = word.toLowerCase();
  if (w.length < 3) return 'short';
  const start = mustStartWith(s);
  if (start && w[0] !== start) return 'start';
  for (let i = 0; i < w.length; i++) if (!canFollow(p, w[i - 1], w[i]!)) return 'side';
  if (!p.words.includes(w)) return 'unknown';
  return null;
}

export function usedLetters(words: readonly string[]): Set<string> {
  return new Set(words.join(''));
}

export function addWord(s: EdgewiseState, word: string, p: EdgewisePuzzle): EdgewiseState {
  const words = [...s.words, word.toLowerCase()];
  const used = usedLetters(words);
  const won = p.sides
    .join('')
    .split('')
    .every((ch) => used.has(ch));
  return { ...s, words, won };
}

export function undo(s: EdgewiseState): EdgewiseState {
  return s.won ? s : { ...s, words: s.words.slice(0, -1) };
}

export function restart(s: EdgewiseState): EdgewiseState {
  return s.won ? s : { ...s, words: [] };
}
