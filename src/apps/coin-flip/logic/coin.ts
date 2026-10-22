// Coin Flip rules. Pure: the random number comes in from outside (crypto in the app).

import type { RandomInt } from '../../../lib/roomCode';

export type Side = 'heads' | 'tails';

export interface CoinState {
  /** Every flip, oldest first. */
  flips: Side[];
  /** 1 for single flips, or 3 / 5 for "best of". */
  bestOf: 1 | 3 | 5;
}

export const newCoin = (bestOf: CoinState['bestOf'] = 1): CoinState => ({ flips: [], bestOf });

export const flipSide = (randomInt: RandomInt): Side => (randomInt(2) === 0 ? 'heads' : 'tails');

export function counts(flips: readonly Side[]): Record<Side, number> {
  return {
    heads: flips.filter((f) => f === 'heads').length,
    tails: flips.filter((f) => f === 'tails').length,
  };
}

/** In best-of mode, the side that has won the round (a majority), or null if still going. */
export function roundWinner(s: CoinState): Side | null {
  if (s.bestOf === 1) return null;
  const need = Math.ceil(s.bestOf / 2);
  const c = counts(s.flips);
  if (c.heads >= need) return 'heads';
  if (c.tails >= need) return 'tails';
  return null;
}

/** Add a flip, unless a best-of round is already decided. */
export function addFlip(s: CoinState, side: Side): CoinState {
  if (roundWinner(s)) return s;
  return { ...s, flips: [...s.flips, side] };
}

/** Longest run of the same side in a row (a fun stat for single flips). */
export function longestStreak(flips: readonly Side[]): { side: Side; length: number } | null {
  let best: { side: Side; length: number } | null = null;
  let run = 0;
  flips.forEach((f, i) => {
    run = i > 0 && flips[i - 1] === f ? run + 1 : 1;
    if (!best || run > best.length) best = { side: f, length: run };
  });
  return best;
}
