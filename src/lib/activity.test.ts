import { dailyStatus, flashcardsDue, recentApps, rememberApp } from './activity';

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

  it('finds AI Notes flashcards due, only for sets you have started', () => {
    const cards = [1, 2, 3].map((n) => ({ front: `q${n}`, back: 'a' }));
    localStorage.setItem(
      'lepak.ainotes.drafts',
      JSON.stringify([
        { id: 'a', savedAt: 100, data: { title: 'Bio', flashcards: cards } },
        { id: 'b', savedAt: 100, data: { title: 'Untouched', flashcards: cards } },
      ]),
    );
    localStorage.setItem(
      'lepak.ainotes.progress',
      JSON.stringify({ a: { 0: { box: 1, due: 5000 }, 1: { box: 0, due: 200 } } }),
    );
    expect(flashcardsDue(1000)).toEqual([{ draftId: 'a', title: 'Bio', due: 2, total: 3 }]);
    expect(flashcardsDue(6000)[0]!.due).toBe(3);
    expect(flashcardsDue(100 + 8 * 24 * 60 * 60 * 1000)).toEqual([]); // draft expired
  });
});
