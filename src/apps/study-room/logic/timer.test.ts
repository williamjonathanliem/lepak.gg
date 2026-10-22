import {
  catchUp,
  clock,
  newTimer,
  next,
  pause,
  phaseLength,
  remaining,
  setLengths,
  start,
} from './timer';

const MIN = 60_000;

describe('study room timer', () => {
  it('starts, counts down and pauses with the time kept', () => {
    let t = newTimer(25, 5);
    expect(remaining(t, 0)).toBe(25 * MIN);
    t = start(t, 1000);
    expect(remaining(t, 1000 + 10 * MIN)).toBe(15 * MIN);
    t = pause(t, 1000 + 10 * MIN);
    expect(t.running).toBe(false);
    expect(remaining(t, 999_999_999)).toBe(15 * MIN);
    expect(start(t, 0).endsAt).toBe(15 * MIN);
  });

  it('goes focus → break → focus, counting rounds', () => {
    let t = start(newTimer(25, 5), 0);
    t = next(t, 100);
    expect(t).toMatchObject({ phase: 'break', rounds: 1, running: true, endsAt: 100 + 5 * MIN });
    t = next(t, 200);
    expect(t).toMatchObject({ phase: 'focus', rounds: 1, leftMs: 25 * MIN });
  });

  it('makes every fourth break a long one', () => {
    expect(phaseLength({ focusMin: 25, breakMin: 5, rounds: 4 }, 'break')).toBe(15 * MIN);
    expect(phaseLength({ focusMin: 25, breakMin: 5, rounds: 3 }, 'break')).toBe(5 * MIN);
  });

  it('moves on by itself when time runs out, from when it ended', () => {
    const t = start(newTimer(25, 5), 0);
    expect(catchUp(t, 10 * MIN)).toBe(t);
    const after = catchUp(t, 30 * MIN);
    expect(after).toMatchObject({ phase: 'break', endsAt: 25 * MIN + 5 * MIN });
  });

  it('changes lengths and shows a clock', () => {
    expect(setLengths(newTimer(), 50, 10).leftMs).toBe(50 * MIN);
    expect(clock(25 * MIN)).toBe('25:00');
    expect(clock(59_001)).toBe('1:00');
    expect(clock(90 * MIN)).toBe('1:30:00');
    expect(clock(0)).toBe('0:00');
  });
});
