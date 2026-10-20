import { readFileSync } from 'node:fs';
import { ANSWERS } from './answers';
import {
  EMPTY_STATS,
  addGuess,
  dailyAnswer,
  dayNumber,
  letterMarks,
  newGame,
  recordResult,
  scoreGuess,
  shareText,
} from './wordl';

const yes = () => true;

describe('scoreGuess', () => {
  it('marks exact, present and absent letters', () => {
    expect(scoreGuess('crane', 'caper')).toEqual([
      'correct',
      'present',
      'present',
      'absent',
      'present',
    ]);
  });

  it('does not over-count repeated letters in the guess', () => {
    // answer has one L, already matched exactly at position 4, so the other Ls are grey
    expect(scoreGuess('lolly', 'world')).toEqual([
      'absent',
      'correct',
      'absent',
      'correct',
      'absent',
    ]);
  });

  it('prefers the exact match when a letter repeats', () => {
    expect(scoreGuess('sheep', 'steep')).toEqual([
      'correct',
      'absent',
      'correct',
      'correct',
      'correct',
    ]);
  });

  it('is all correct for the answer', () => {
    expect(scoreGuess('mango', 'mango').every((m) => m === 'correct')).toBe(true);
  });
});

describe('guessing', () => {
  it('rejects short words and non-words', () => {
    const s = newGame('mango');
    expect(addGuess(s, 'abc', yes).error).toBe('too-short');
    expect(addGuess(s, 'zzzzz', () => false).error).toBe('not-a-word');
  });

  it('wins on the answer, case-insensitive', () => {
    const r = addGuess(newGame('mango'), 'MANGO', yes);
    expect(r.state.status).toBe('won');
  });

  it('loses after six misses and then refuses more guesses', () => {
    const s = newGame('mango', ['apple', 'apple', 'apple', 'apple', 'apple', 'apple']);
    expect(s.status).toBe('lost');
    expect(addGuess(s, 'mango', yes).error).toBe('finished');
  });

  it('keeps the best mark per letter for the keyboard', () => {
    const s = newGame('mango', ['amber', 'manga']);
    const marks = letterMarks(s);
    expect(marks.m).toBe('correct');
    expect(marks.a).toBe('correct');
    expect(marks.b).toBe('absent');
  });
});

describe('daily puzzle', () => {
  it('starts at #1 on 1 Jan 2026 Malaysia time', () => {
    expect(dayNumber(Date.UTC(2025, 11, 31, 16, 0))).toBe(1); // 00:00 MYT
    expect(dayNumber(Date.UTC(2025, 11, 31, 15, 59))).toBe(0);
  });

  it('gives everyone the same word on the same day', () => {
    expect(dailyAnswer(ANSWERS, 42)).toBe(dailyAnswer(ANSWERS, 42));
  });

  it('uses every answer once before repeating', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= ANSWERS.length; d++) seen.add(dailyAnswer(ANSWERS, d));
    expect(seen.size).toBe(ANSWERS.length);
  });

  it('shares an emoji grid without letters', () => {
    const s = newGame('mango', ['manga', 'mango']);
    const text = shareText(s, 'Wordl* #9');
    expect(text).toContain('Wordl* #9 2/6');
    expect(text).toContain('🟩🟩🟩🟩⬛');
    expect(text).not.toMatch(/mango/i);
  });
});

describe('stats', () => {
  it('counts wins, streaks and the guess distribution', () => {
    let st = recordResult(EMPTY_STATS, 10, newGame('mango', ['mango']));
    st = recordResult(st, 11, newGame('mango', ['apple', 'mango']));
    expect(st).toMatchObject({ played: 2, wins: 2, streak: 2, maxStreak: 2 });
    expect(st.dist.slice(0, 2)).toEqual([1, 1]);
  });

  it('resets the streak on a loss or a skipped day', () => {
    let st = recordResult(EMPTY_STATS, 10, newGame('mango', ['mango']));
    st = recordResult(st, 12, newGame('mango', ['mango']));
    expect(st.streak).toBe(1);
    st = recordResult(st, 13, newGame('mango', Array(6).fill('apple')));
    expect(st.streak).toBe(0);
    expect(st.maxStreak).toBe(1);
  });

  it('ignores replaying the same day', () => {
    const st = recordResult(EMPTY_STATS, 10, newGame('mango', ['mango']));
    expect(recordResult(st, 10, newGame('mango', ['mango']))).toBe(st);
  });
});

describe('answer list', () => {
  const guesses = new Set(
    readFileSync('public/words/en-5.txt', 'utf8').split(/\r?\n/).filter(Boolean),
  );

  it('only has unique 5 letter lowercase words', () => {
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
    for (const w of ANSWERS) expect(w).toMatch(/^[a-z]{5}$/);
  });

  it('only has words players are allowed to guess', () => {
    const missing = ANSWERS.filter((w) => !guesses.has(w));
    expect(missing).toEqual([]);
  });
});
