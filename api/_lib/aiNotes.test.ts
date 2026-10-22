import { QuizQuestionSchema } from '../../src/apps/ai-notes/logic/notes';
import { toQuestions } from './aiNotes';

const blank = { options: [], answerIndex: 0, answerTrue: false, answerText: '', accept: [] };

describe('turning Gemini questions into quiz questions', () => {
  it('keeps good ones of every kind, in the shape the page reads', () => {
    const out = toQuestions([
      {
        ...blank,
        type: 'mc',
        question: 'Where?',
        options: ['A', 'B', 'C', 'D'],
        answerIndex: 2,
        why: 'w',
      },
      { ...blank, type: 'tf', question: 'True?', answerTrue: true, why: 'w' },
      {
        ...blank,
        type: 'short',
        question: 'Name?',
        answerText: ' RuBisCO ',
        accept: ['rubisco enzyme', ''],
        why: 'w',
      },
    ]);
    expect(out).toEqual([
      { type: 'mc', question: 'Where?', options: ['A', 'B', 'C', 'D'], answer: 2, why: 'w' },
      { type: 'tf', question: 'True?', answer: true, why: 'w' },
      { type: 'short', question: 'Name?', answer: 'RuBisCO', accept: ['rubisco enzyme'], why: 'w' },
    ]);
    for (const q of out) expect(QuizQuestionSchema.safeParse(q).success).toBe(true);
  });

  it('drops ones that do not add up', () => {
    expect(
      toQuestions([
        {
          ...blank,
          type: 'mc',
          question: 'Bad index',
          options: ['A', 'B'],
          answerIndex: 5,
          why: '',
        },
        { ...blank, type: 'mc', question: 'One option', options: ['A'], why: '' },
        { ...blank, type: 'short', question: 'No answer', answerText: ' ', why: '' },
        { ...blank, type: 'tf', question: '  ', why: '' },
      ]),
    ).toEqual([]);
  });
});
