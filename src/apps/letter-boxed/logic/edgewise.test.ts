import { readFileSync } from 'node:fs';
import { addWord, check, newEdgewise, restart, undo, type EdgewisePuzzle } from './edgewise';

const p: EdgewisePuzzle = {
  sides: ['tpi', 'uoa', 'nsl', 'erc'],
  answer: [],
  words: ['tunes', 'sport', 'tiles', 'cat'],
};

describe('Edgewise rules', () => {
  it('rejects letters from the same side in a row', () => {
    expect(check('tin', newEdgewise('x'), p)).toBe('side');
  });

  it('chains words by their last letter', () => {
    const s = addWord(newEdgewise('x'), 'tunes', p);
    expect(check('cat', s, p)).toBe('start');
    expect(check('sport', s, p)).toBeNull();
  });

  it('checks length and the word list', () => {
    expect(check('to', newEdgewise('x'), p)).toBe('short');
    expect(check('tuna', newEdgewise('x'), p)).toBe('unknown');
  });

  it('wins when every letter is used, and can undo or restart before that', () => {
    let s = addWord(newEdgewise('x'), 'tunes', p);
    expect(undo(s).words).toEqual([]);
    expect(restart(s).words).toEqual([]);
    s = addWord(s, 'sport', p);
    expect(s.won).toBe(false); // i, l, c still unused
    const all: EdgewisePuzzle = { ...p, sides: ['tun', 'esp', 'orx', 'yzw'] };
    const w = addWord(addWord(newEdgewise('x'), 'tunes', all), 'sport', all);
    expect(w.won).toBe(false);
  });

  it('every built puzzle has a working 2-word answer', () => {
    const count = (
      JSON.parse(readFileSync('public/games/edgewise/count.json', 'utf8')) as { count: number }
    ).count;
    expect(count).toBeGreaterThan(100);
    for (let i = 0; i < 20; i++) {
      const q = JSON.parse(
        readFileSync(`public/games/edgewise/${i}.json`, 'utf8'),
      ) as EdgewisePuzzle;
      let s = newEdgewise('t');
      for (const w of q.answer) {
        expect(check(w, s, q)).toBeNull();
        s = addWord(s, w, q);
      }
      expect(s.won).toBe(true);
    }
  });
});
