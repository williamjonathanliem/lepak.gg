import { seededRng } from '../../../lib/puzzle';
import { NotesSchema, answerText, type QuizQuestion } from './notes';
import {
  checkShort,
  isCorrect,
  kindCounts,
  normaliseAnswer,
  pickRound,
  score,
  withoutRepeats,
} from './quiz';

const mc: QuizQuestion = {
  question: 'Where?',
  options: ['Chloroplast', 'Nucleus'],
  answer: 0,
  why: '',
};
const tf: QuizQuestion = { type: 'tf', question: 'Plants make sugar.', answer: true, why: '' };
const short: QuizQuestion = {
  type: 'short',
  question: 'Green pigment?',
  answer: 'Chlorophyll',
  accept: ['chlorophyll a'],
  why: '',
};
const bank = [mc, tf, short];

describe('quiz', () => {
  it('still reads old drafts (multiple choice without a type)', () => {
    const old = {
      title: 't',
      summary: 's',
      keyPoints: [],
      terms: [],
      flashcards: [],
      quiz: [{ question: 'q', options: ['a', 'b'], answer: 1, why: 'w' }],
    };
    expect(NotesSchema.safeParse(old).success).toBe(true);
    expect(NotesSchema.safeParse({ ...old, quiz: [tf, short] }).success).toBe(true);
  });

  it('marks each kind of answer', () => {
    expect(isCorrect(mc, 0)).toBe(true);
    expect(isCorrect(mc, 1)).toBe(false);
    expect(isCorrect(tf, true)).toBe(true);
    expect(isCorrect(tf, false)).toBe(false);
    expect(isCorrect(short, ' the CHLOROPHYLL. ')).toBe(true);
    expect(isCorrect(short, undefined)).toBe(false);
  });

  it('forgives small typos in longer short answers, not in short ones', () => {
    expect(checkShort('chlorophyl', 'Chlorophyll')).toBe(true);
    expect(checkShort('chlrophyl', 'Chlorophyll')).toBe(true); // two slips, 11 letters
    expect(checkShort('mitochondria', 'Chlorophyll')).toBe(false);
    expect(checkShort('cat', 'car')).toBe(false);
    expect(checkShort('Chlorophyll A', 'x', ['chlorophyll a'])).toBe(true);
    expect(checkShort('', 'x')).toBe(false);
    expect(normaliseAnswer('  An Énzyme! ')).toBe('enzyme');
  });

  it('picks a round of the chosen kinds, and scores it', () => {
    const round = pickRound(
      bank,
      { count: 0, mode: 'practice', kinds: ['mc', 'tf'] },
      seededRng('x'),
    );
    expect([...round].sort()).toEqual([0, 1]);
    expect(
      pickRound(bank, { count: 1, mode: 'exam', kinds: ['mc', 'tf', 'short'] }, seededRng('y')),
    ).toHaveLength(1);
    expect(score(bank, [0, 1, 2], { 0: 0, 1: false, 2: 'chlorophyll' })).toEqual({
      right: 2,
      total: 3,
    });
    expect(kindCounts(bank)).toEqual({ mc: 1, tf: 1, short: 1 });
  });

  it('drops repeated questions when adding more', () => {
    const again = { ...tf, question: 'plants make SUGAR' };
    const fresh = { ...tf, question: 'Roots need air.' };
    expect(withoutRepeats(bank, [again, fresh, fresh])).toEqual([fresh]);
  });

  it('writes out the answer for every kind', () => {
    expect(bank.map(answerText)).toEqual(['Chloroplast', 'True', 'Chlorophyll']);
  });
});
