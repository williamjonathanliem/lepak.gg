import { EMPTY_PUZZLE_STATS, clock, dayNumber, recordResult, seededRng, shuffle } from './puzzle';

describe('puzzle helpers', () => {
  it('numbers days from 1 Jan 2026, Malaysia time', () => {
    expect(dayNumber(Date.UTC(2026, 0, 1))).toBe(1);
    // 23:59 UTC on 1 Jan is already 2 Jan in Malaysia
    expect(dayNumber(Date.UTC(2026, 0, 1, 23, 59))).toBe(2);
  });

  it('gives the same shuffle for the same seed', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], seededRng('day-9'));
    expect(shuffle([1, 2, 3, 4, 5, 6], seededRng('day-9'))).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('counts streaks across days, once per day', () => {
    let s = recordResult(EMPTY_PUZZLE_STATS, 10, true);
    s = recordResult(s, 11, true);
    expect(s).toMatchObject({ played: 2, won: 2, streak: 2, maxStreak: 2 });
    expect(recordResult(s, 11, false)).toBe(s); // same day again: ignored
    s = recordResult(s, 13, true); // missed day 12
    expect(s.streak).toBe(1);
    s = recordResult(s, 14, false);
    expect(s).toMatchObject({ streak: 0, maxStreak: 2, played: 4, won: 3 });
  });

  it('formats a timer', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(75)).toBe('1:15');
  });
});
