import {
  FREE,
  LINES,
  NUMBERS,
  callLabel,
  makeCard,
  nextCall,
  parseWords,
  seededRng,
  winningLine,
} from './bingo';

describe('cards', () => {
  it('gives the same card for the same seed, different for another', () => {
    expect(makeCard(NUMBERS, 'KJRW:abc')).toEqual(makeCard(NUMBERS, 'KJRW:abc'));
    expect(makeCard(NUMBERS, 'KJRW:abc')).not.toEqual(makeCard(NUMBERS, 'KJRW:xyz'));
  });

  it('builds classic number cards with B-I-N-G-O columns and a free centre', () => {
    const card = makeCard(NUMBERS, 'seed');
    expect(card).toHaveLength(25);
    expect(card[12]).toBe(FREE);
    for (let i = 0; i < 25; i++) {
      if (i === 12) continue;
      const col = i % 5;
      const n = Number(card[i]);
      expect(n).toBeGreaterThanOrEqual(col * 15 + 1);
      expect(n).toBeLessThanOrEqual(col * 15 + 15);
    }
    expect(new Set(card).size).toBe(25);
  });

  it('builds word cards from a list', () => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`);
    const card = makeCard(words, 's');
    expect(card[12]).toBe(FREE);
    expect(new Set(card).size).toBe(25);
    for (const c of card) if (c !== FREE) expect(words).toContain(c);
  });
});

describe('winning', () => {
  const card = makeCard(NUMBERS, 'win');

  it('has 12 lines', () => {
    expect(LINES).toHaveLength(12);
  });

  it('finds a full row, counting the free centre', () => {
    const middleRow = [10, 11, 13, 14].map((i) => card[i]!);
    expect(winningLine(card, new Set(middleRow))).toEqual([10, 11, 12, 13, 14]);
  });

  it('finds a diagonal', () => {
    const diag = [0, 6, 18, 24].map((i) => card[i]!);
    expect(winningLine(card, new Set(diag))).toEqual([0, 6, 12, 18, 24]);
  });

  it('says no when a line is not complete', () => {
    expect(winningLine(card, new Set([card[0]!, card[1]!, card[2]!]))).toBeNull();
  });
});

describe('calling', () => {
  it('never repeats and ends when everything is called', () => {
    const items = ['a', 'b', 'c'];
    const called: string[] = [];
    const rng = seededRng('x');
    for (let i = 0; i < 3; i++) called.push(nextCall(items, called, rng)!);
    expect([...called].sort()).toEqual(items);
    expect(nextCall(items, called, rng)).toBeNull();
  });

  it('labels numbers with their letter', () => {
    expect(callLabel('1', true)).toBe('B 1');
    expect(callLabel('45', true)).toBe('N 45');
    expect(callLabel('75', true)).toBe('O 75');
    expect(callLabel('photosynthesis', false)).toBe('photosynthesis');
  });
});

describe('parseWords', () => {
  it('splits on lines and commas, trims and removes duplicates', () => {
    expect(parseWords('Cell, nucleus\n  mitochondria \nCELL\n\n')).toEqual([
      'Cell',
      'nucleus',
      'mitochondria',
    ]);
  });
});
