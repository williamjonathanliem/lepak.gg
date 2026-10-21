import {
  BASE_POINTS,
  answer,
  correctCount,
  isFinished,
  newQuiz,
  next,
  pointsFor,
  toQuestion,
  type Question,
} from './trivia';

const q = (correct: string, ...wrong: string[]): Question => ({
  category: 'Science',
  difficulty: 'easy',
  question: 'Q?',
  correct,
  answers: [correct, ...wrong],
});

describe('toQuestion', () => {
  it('decodes url-encoded text and keeps all four answers', () => {
    const out = toQuestion(
      {
        category: 'Science%3A%20Computers',
        difficulty: 'hard',
        question: 'What%20does%20%22CPU%22%20stand%20for%3F',
        correct_answer: 'Central%20Processing%20Unit',
        incorrect_answers: ['A', 'B', 'C'],
      },
      () => 0.5,
    );
    expect(out.question).toBe('What does "CPU" stand for?');
    expect(out.category).toBe('Science: Computers');
    expect(out.difficulty).toBe('hard');
    expect(out.answers).toHaveLength(4);
    expect(out.answers).toContain('Central Processing Unit');
  });

  it('falls back to medium for an unknown difficulty', () => {
    const out = toQuestion(
      {
        category: 'x',
        difficulty: 'weird',
        question: 'q',
        correct_answer: 'a',
        incorrect_answers: [],
      },
      Math.random,
    );
    expect(out.difficulty).toBe('medium');
  });
});

describe('scoring', () => {
  it('rewards speed and streaks, capped at +50%', () => {
    expect(pointsFor(0, 0)).toBe(BASE_POINTS);
    expect(pointsFor(10, 0)).toBe(150);
    expect(pointsFor(0, 2)).toBe(120);
    expect(pointsFor(0, 99)).toBe(150);
  });

  it('scores right answers, zero for wrong or timed out', () => {
    let s = newQuiz([q('a', 'b'), q('c', 'd'), q('e', 'f')]);
    s = next(answer(s, 'a', 10));
    s = next(answer(s, 'x', 10));
    s = answer(s, null, 0);
    expect(s.answers.map((a) => a.correct)).toEqual([true, false, false]);
    expect(s.score).toBe(150);
    expect(correctCount(s)).toBe(1);
    expect(isFinished(s)).toBe(true);
  });

  it('tracks the best streak', () => {
    let s = newQuiz([q('a'), q('a'), q('a'), q('a')]);
    s = next(answer(s, 'a', 0));
    s = next(answer(s, 'a', 0));
    s = next(answer(s, 'x', 0));
    s = answer(s, 'a', 0);
    expect(s.bestStreak).toBe(2);
    expect(s.streak).toBe(1);
  });

  it('ignores a second answer to the same question', () => {
    let s = newQuiz([q('a', 'b')]);
    s = answer(s, 'b', 5);
    expect(answer(s, 'a', 5)).toBe(s);
  });
});
