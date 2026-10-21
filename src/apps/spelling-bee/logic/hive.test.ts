import { readFileSync } from 'node:fs';
import {
  addWord,
  check,
  isPangram,
  maxScore,
  newHive,
  puzzleIndex,
  rankFor,
  wordScore,
  type HivePuzzle,
} from './hive';

const p: HivePuzzle = {
  letters: 'tlaecpr',
  words: ['plate', 'pleat', 'tactile', 'receptacle', 'teal'],
};

describe('Hive Mind rules', () => {
  it('scores 1 for four letters, length for longer, +7 for using all letters', () => {
    expect(wordScore('teal', p.letters)).toBe(1);
    expect(wordScore('plate', p.letters)).toBe(5);
    expect(isPangram('receptacle', p.letters)).toBe(true);
    expect(wordScore('receptacle', p.letters)).toBe(17);
    expect(maxScore(p)).toBe(1 + 5 + 5 + 7 + 17);
  });

  it('gives the right reason for a bad word', () => {
    expect(check('pet', p, [])).toBe('short');
    expect(check('plates', p, [])).toBe('letters');
    expect(check('pale', p, [])).toBe('centre'); // no T
    expect(check('tale', p, [])).toBe('unknown');
    expect(check('plate', p, ['plate'])).toBe('found');
    expect(check('PLATE', p, [])).toBeNull();
  });

  it('wins at Lepak Legend (70%)', () => {
    let s = newHive('x');
    s = addWord(s, 'receptacle', p); // 17 of 35
    expect(s.won).toBe(false);
    s = addWord(s, 'tactile', p); // 24 of 35 = 69%
    expect(s.won).toBe(false);
    s = addWord(s, 'teal', p); // 25 >= ceil(24.5)
    expect(s.won).toBe(true);
    expect(rankFor(s.score, s.max).name).toBe('Lepak Legend');
  });

  it('picks the day’s puzzle for daily seeds', () => {
    expect(puzzleIndex('spelling-bee-1', 400)).toBe(0);
    expect(puzzleIndex('spelling-bee-401', 400)).toBe(0);
    const r = puzzleIndex('practice-abc', 400);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(400);
  });

  it('every built puzzle is playable', () => {
    const all = JSON.parse(readFileSync('public/games/hive.json', 'utf8')) as HivePuzzle[];
    expect(all.length).toBeGreaterThan(300);
    for (const q of all.slice(0, 50)) {
      expect(new Set(q.letters).size).toBe(7);
      expect(q.words.some((w) => isPangram(w, q.letters))).toBe(true);
      for (const w of q.words) expect(check(w, q, [])).toBeNull();
    }
  });
});
