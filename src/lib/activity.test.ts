import { dailyStatus, recentApps, rememberApp } from './activity';

describe('activity', () => {
  beforeEach(() => localStorage.clear());

  it('keeps recent apps newest first, no repeats, at most 6', () => {
    for (const r of ['/a', '/b', '/c', '/a', '/d', '/e', '/f', '/g']) rememberApp(r);
    expect(recentApps()).toEqual(['/g', '/f', '/e', '/d', '/a', '/c']);
  });

  it('reads today’s daily puzzle state', () => {
    expect(dailyStatus('sudoku', 9)).toBe('new');
    localStorage.setItem('lepak.sudoku.day.9', '{}');
    expect(dailyStatus('sudoku', 9)).toBe('started');
    localStorage.setItem('lepak.sudoku.stats', JSON.stringify({ lastDay: 9 }));
    expect(dailyStatus('sudoku', 9)).toBe('done');
  });
});
