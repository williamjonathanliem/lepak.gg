import { addFlip, counts, flipSide, longestStreak, newCoin, roundWinner } from './coin';

describe('coin flip', () => {
  it('turns a random 0 or 1 into a side', () => {
    expect(flipSide(() => 0)).toBe('heads');
    expect(flipSide(() => 1)).toBe('tails');
  });

  it('counts flips and finds the longest streak', () => {
    const flips = ['heads', 'tails', 'tails', 'tails', 'heads'] as const;
    expect(counts(flips)).toEqual({ heads: 2, tails: 3 });
    expect(longestStreak(flips)).toEqual({ side: 'tails', length: 3 });
    expect(longestStreak([])).toBeNull();
  });

  it('decides a best of 3 at two wins, and stops adding after that', () => {
    let s = newCoin(3);
    s = addFlip(addFlip(s, 'heads'), 'tails');
    expect(roundWinner(s)).toBeNull();
    s = addFlip(s, 'tails');
    expect(roundWinner(s)).toBe('tails');
    expect(addFlip(s, 'heads')).toBe(s);
    expect(roundWinner(newCoin(1))).toBeNull();
  });
});
