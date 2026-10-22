import {
  BOX_DAYS,
  grade,
  learnt,
  nextDue,
  nextInQueue,
  startSession,
  toCsv,
  toTabText,
  type Progress,
} from './practice';

const DAY = 24 * 60 * 60 * 1000;

describe('flashcard practice', () => {
  it('starts with every new card, lowest box first', () => {
    expect(startSession(3, {}, 0)).toEqual([0, 1, 2]);
    const p: Progress = { 0: { box: 2, due: 0 }, 2: { box: 1, due: 0 } };
    expect(startSession(3, p, 0)).toEqual([1, 2, 0]);
  });

  it('moves a card up a box on "got it", and back to the start on "again"', () => {
    let p = grade({}, 0, true, 0);
    expect(p[0]).toEqual({ box: 1, due: BOX_DAYS[1] * DAY });
    p = grade(p, 0, true, 0);
    expect(p[0]!.box).toBe(2);
    p = grade(p, 0, false, 5);
    expect(p[0]).toEqual({ box: 0, due: 5 });
  });

  it('only brings back cards that are due, unless you ask for all', () => {
    const p = grade(grade({}, 0, true, 0), 1, false, 0);
    expect(startSession(3, p, 1000)).toEqual([1, 2]); // card 0 waits a day
    expect(startSession(3, p, 1000, true)).toEqual([1, 2, 0]);
    expect(startSession(3, p, 2 * DAY)).toEqual([1, 2, 0]);
    expect(nextDue(3, { 0: { box: 1, due: DAY } }, 0)).toBe(DAY);
    expect(nextDue(1, {}, 0)).toBeNull();
  });

  it('shows a missed card again a few cards later', () => {
    expect(nextInQueue([7, 1, 2, 3, 4], false)).toEqual([1, 2, 3, 7, 4]);
    expect(nextInQueue([7, 1], false)).toEqual([1, 7]);
    expect(nextInQueue([7, 1], true)).toEqual([1]);
    expect(nextInQueue([], true)).toEqual([]);
  });

  it('counts cards in the top boxes as learnt, and stops at the top box', () => {
    let p: Progress = {};
    for (let k = 0; k < 9; k++) p = grade(p, 0, true, 0);
    expect(p[0]!.box).toBe(BOX_DAYS.length - 1);
    expect(learnt(2, p)).toBe(1);
  });

  it('exports for Anki (CSV) and Quizlet (tabs)', () => {
    const cards = [{ front: 'Say "hi"', back: 'line one\nline two' }];
    expect(toCsv(cards)).toBe('"Say ""hi""","line one line two"');
    expect(toTabText([{ front: 'a\tb', back: 'c' }])).toBe('a b\tc');
  });
});
