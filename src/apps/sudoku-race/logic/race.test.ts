import { enter, newSudoku } from '../../sudoku/logic/sudoku';
import {
  COUNTDOWN_MS,
  PENALTY_MS,
  blanks,
  correctFilled,
  endsAt,
  isOut,
  isOver,
  newMeta,
  raceSeed,
  rematch,
  standings,
  startRace,
  type Racer,
} from './race';

const T0 = 1_000_000;
const racing = () => startRace(newMeta('host', 'easy', 'penalty'), T0);
const racer = (over: Partial<Racer>): Racer => ({
  uid: 'u',
  nick: 'a',
  round: 1,
  filled: 0,
  total: 41,
  mistakes: 0,
  finishedAt: 0,
  ...over,
});

describe('sudoku race', () => {
  it('gives everyone in a room the same puzzle, and a new one each rematch', () => {
    const a = newSudoku(raceSeed('KJRW', 1), 'easy', 0);
    const b = newSudoku(raceSeed('KJRW', 1), 'easy', 0);
    const next = newSudoku(raceSeed('KJRW', 2), 'easy', 0);
    expect(a.puzzle).toEqual(b.puzzle);
    expect(next.puzzle).not.toEqual(a.puzzle);
  });

  it('starts after a countdown and rematches into a fresh lobby', () => {
    const m = racing();
    expect(m.phase).toBe('race');
    expect(m.startAt).toBe(T0 + COUNTDOWN_MS);
    const again = rematch(m);
    expect(again).toMatchObject({ phase: 'lobby', startAt: 0, round: 2 });
  });

  it('counts only correct numbers the player wrote', () => {
    let s = newSudoku(raceSeed('ABCD', 1), 'easy', 0);
    const empty = s.puzzle.findIndex((n) => n === 0);
    const other = s.puzzle.findIndex((n, i) => n === 0 && i > empty);
    s = enter(s, empty, s.solution[empty]!, 1);
    s = enter(s, other, (s.solution[other]! % 9) + 1, 2); // wrong
    expect(correctFilled(s)).toBe(1);
    expect(blanks(s)).toBe(81 - 40);
    expect(s.mistakes).toBe(1);
  });

  it('knocks players out only in strikes mode', () => {
    expect(isOut('strikes', 3)).toBe(true);
    expect(isOut('strikes', 2)).toBe(false);
    expect(isOut('penalty', 50)).toBe(false);
  });

  it('ranks finishers by time plus penalties', () => {
    const m = racing();
    const start = m.startAt;
    const rows = standings(m, [
      // 4:00 with 2 mistakes = 5:00
      racer({ uid: 'slowclean', nick: 'b', finishedAt: start + 270_000, filled: 41 }),
      racer({ uid: 'fastsloppy', nick: 'a', finishedAt: start + 240_000, mistakes: 2, filled: 41 }),
    ]);
    expect(rows.map((r) => r.uid)).toEqual(['slowclean', 'fastsloppy']);
    expect(rows[1]!.scoreMs).toBe(240_000 + 2 * PENALTY_MS);
    expect(rows[0]!.place).toBe(1);
  });

  it('puts racers still going after finishers, by progress, and knocked-out ones last', () => {
    const m = { ...racing(), rule: 'strikes' as const };
    const rows = standings(m, [
      racer({ uid: 'out', filled: 40, mistakes: 3 }),
      racer({ uid: 'half', filled: 20 }),
      racer({ uid: 'most', filled: 35, mistakes: 1 }),
      racer({ uid: 'done', filled: 41, finishedAt: m.startAt + 60_000 }),
    ]);
    expect(rows.map((r) => [r.uid, r.status])).toEqual([
      ['done', 'finished'],
      ['most', 'racing'],
      ['half', 'racing'],
      ['out', 'out'],
    ]);
  });

  it('ignores progress from an earlier round', () => {
    const m = rematch(racing());
    expect(standings(m, [racer({ round: 1 }), racer({ uid: 'new', round: 2 })])).toHaveLength(1);
  });

  it('ends at the time limit, or when nobody is still racing', () => {
    const m = racing();
    const going = [racer({ uid: 'a' }), racer({ uid: 'b', finishedAt: m.startAt + 1 })];
    expect(isOver(m, going, m.startAt + 1000)).toBe(false);
    expect(isOver(m, going, endsAt(m))).toBe(true);
    const allDone = going.map((r) => ({ ...r, finishedAt: m.startAt + 5 }));
    expect(isOver(m, allDone, m.startAt + 1000)).toBe(true);
    expect(isOver({ ...m, phase: 'lobby' }, allDone, m.startAt + 1000)).toBe(false);
  });
});
