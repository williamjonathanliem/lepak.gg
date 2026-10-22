import {
  bestBlocks,
  blockLabel,
  emptyFree,
  hourLabel,
  nextDays,
  normaliseFree,
  setSlots,
  slotCount,
  whoIsFree,
  type PollMeta,
} from './free';

// 2 days, 9 am to 1 pm: 4 slots a day, 8 in all.
const meta: PollMeta = {
  owner: 'o',
  title: 'Meet',
  days: ['2026-10-29', '2026-10-30'],
  from: 9,
  to: 13,
};

describe('free-time finder', () => {
  it('sizes a poll and fixes up stored answers', () => {
    expect(slotCount(meta)).toBe(8);
    expect(emptyFree(meta)).toBe('00000000');
    expect(normaliseFree('11', meta)).toBe('11000000');
    expect(normaliseFree('1x1111111111', meta)).toBe('10111111');
  });

  it('paints slots on and off', () => {
    expect(setSlots('0000', [1, 2, 9], true)).toBe('0110');
    expect(setSlots('1111', [0], false)).toBe('0111');
  });

  it('finds who is free in each slot', () => {
    const who = whoIsFree(
      [
        { uid: 'a', nick: 'Ali', free: '11000000' },
        { uid: 'b', nick: 'Mei', free: '01100000' },
      ],
      meta,
    );
    expect(who.slice(0, 3)).toEqual([['Ali'], ['Ali', 'Mei'], ['Mei']]);
  });

  it('ranks the best times: most people, then longest', () => {
    const people = [
      { uid: 'a', nick: 'Ali', free: '01110111' },
      { uid: 'b', nick: 'Mei', free: '01100110' },
      { uid: 'c', nick: 'Ravi', free: '00100111' },
    ];
    const best = bestBlocks(people, meta);
    // Both have all three; the longer one comes first.
    expect(best[0]).toEqual({ day: 1, start: 1, length: 2, names: ['Ali', 'Mei', 'Ravi'] });
    expect(best[1]).toEqual({ day: 0, start: 2, length: 1, names: ['Ali', 'Mei', 'Ravi'] });
    expect(blockLabel(best[0]!, meta)).toMatch(/30 Oct, 10 am to 12 pm$/);
    expect(bestBlocks(people, meta, 4)).toEqual([]);
  });

  it('writes hours and days', () => {
    expect([0, 9, 12, 15, 23].map(hourLabel)).toEqual(['12 am', '9 am', '12 pm', '3 pm', '11 pm']);
    expect(nextDays(new Date(2026, 9, 30), 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
});
