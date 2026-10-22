import {
  checkDraft,
  countdown,
  parseLocalDateTime,
  sortDeadlines,
  toIcs,
  toLocalInput,
  urgency,
} from './deadlines';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('deadlines', () => {
  it('says how soon something is due', () => {
    expect(urgency(-1, 0)).toBe('overdue');
    expect(urgency(5 * HOUR, 0)).toBe('today');
    expect(urgency(2 * DAY, 0)).toBe('soon');
    expect(urgency(5 * DAY, 0)).toBe('later');
  });

  it('writes friendly countdowns', () => {
    expect(countdown(3 * DAY + 4 * HOUR, 0)).toBe('in 3 days 4 h');
    expect(countdown(10 * DAY + 4 * HOUR, 0)).toBe('in 10 days');
    expect(countdown(2 * HOUR + 15 * MIN, 0)).toBe('in 2 h 15 min');
    expect(countdown(20 * 1000, 0)).toBe('in 1 min');
    expect(countdown(-5 * MIN, 0)).toBe('5 min ago');
    expect(countdown(-DAY, 0)).toBe('1 day ago');
  });

  it('puts upcoming first, soonest on top, then overdue', () => {
    const items = [{ due: 50 }, { due: -10 }, { due: 20 }, { due: -1 }];
    expect(sortDeadlines(items, 0).map((i) => i.due)).toEqual([20, 50, -1, -10]);
  });

  it('checks new deadlines', () => {
    expect(checkDraft({ title: ' ', due: DAY }, 0)).toBe('title');
    expect(checkDraft({ title: 'Lab report', due: null }, 0)).toBe('due');
    expect(checkDraft({ title: 'Lab report', due: -2 * DAY }, 0)).toBe('past');
    expect(checkDraft({ title: 'Lab report', due: -HOUR }, 0)).toBeNull(); // just now is fine
  });

  it('reads and writes date inputs in local time', () => {
    const ms = parseLocalDateTime('2026-11-03T23:59')!;
    expect(new Date(ms).getHours()).toBe(23);
    expect(toLocalInput(ms)).toBe('2026-11-03T23:59');
    expect(parseLocalDateTime('tomorrow')).toBeNull();
  });

  it('makes a calendar file with a reminder the day before', () => {
    const ics = toIcs(
      {
        id: 'a1',
        title: 'Essay, part 2',
        course: 'ENG101',
        due: Date.UTC(2026, 10, 3, 15, 59),
        note: '',
      },
      0,
    );
    expect(ics).toContain('DTSTART:20261103T155900Z');
    expect(ics).toContain('SUMMARY:Due: ENG101: Essay\\, part 2');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
