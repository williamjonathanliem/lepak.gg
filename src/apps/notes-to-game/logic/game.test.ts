import type { QuizQuestion } from '../../ai-notes/logic/notes';
import { leaderboard, points, scoreQuestion, tally, toPlayable } from './game';

describe('notes to game', () => {
  it('plays multiple choice and true/false, not short answers', () => {
    const bank: QuizQuestion[] = [
      { question: 'Where?', options: ['A', 'B', 'C', 'D', 'E'], answer: 1, why: 'w' },
      { type: 'tf', question: 'True?', answer: false, why: '' },
      { type: 'short', question: 'Name?', answer: 'x', accept: [], why: '' },
      { question: 'Bad', options: ['A', 'B', 'C', 'D', 'E'], answer: 4, why: '' }, // 5th option is cut
    ];
    expect(toPlayable(bank)).toEqual([
      { q: 'Where?', options: ['A', 'B', 'C', 'D'], answer: 1, why: 'w' },
      { q: 'True?', options: ['True', 'False'], answer: 1, why: '' },
    ]);
  });

  it('gives more points for faster right answers', () => {
    expect(points(true, 0, 20_000)).toBe(1000);
    expect(points(true, 10_000, 20_000)).toBe(750);
    expect(points(true, 99_000, 20_000)).toBe(500);
    expect(points(false, 0, 20_000)).toBe(0);
  });

  it('tallies answers and adds up scores', () => {
    const answers = {
      a: { choice: 1, at: 1000 },
      b: { choice: 0, at: 500 },
      c: { choice: 1, at: 11_000 },
    };
    expect(tally(answers, 3)).toEqual([1, 2, 0]);
    expect(scoreQuestion({ a: 100 }, answers, 1, 1000, 20_000)).toEqual({ a: 1100, b: 0, c: 750 });
  });

  it('ranks players, sharing ranks on ties', () => {
    const board = leaderboard(
      { a: 900, b: 1200, c: 900 },
      { a: 'Ali', b: 'Mei', c: 'Siti', d: 'Zul' },
    );
    expect(board.map((r) => [r.nick, r.rank])).toEqual([
      ['Mei', 1],
      ['Ali', 2],
      ['Siti', 2],
      ['Zul', 4],
    ]);
  });
});
