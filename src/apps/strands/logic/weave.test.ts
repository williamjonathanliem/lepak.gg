import { readFileSync } from 'node:fs';
import {
  addFound,
  canExtend,
  judge,
  newWeave,
  pathWord,
  touching,
  takeHint,
  type WeavePuzzle,
} from './weave';

const all = JSON.parse(readFileSync('public/games/weave.json', 'utf8')) as WeavePuzzle[];

describe('Word Weave puzzles', () => {
  it('fill every square, and every word can be traced', () => {
    expect(all.length).toBeGreaterThanOrEqual(60);
    for (const p of all) {
      const cells = p.words.flatMap((w) => w.cells).sort((a, b) => a - b);
      expect(cells).toEqual(Array.from({ length: p.cols * p.rows }, (_, i) => i));
      for (const w of p.words) {
        expect(pathWord(p, w.cells)).toBe(w.word);
        w.cells.slice(1).forEach((c, i) => expect(touching(p, w.cells[i]!, c)).toBe(true));
      }
      expect(p.words.some((w) => w.word === p.spangram)).toBe(true);
    }
  });
});

describe('Word Weave rules', () => {
  const p = all[0]!;
  const target = p.words.find((w) => w.word !== p.spangram)!;

  it('only accepts a word on its own squares, in order', () => {
    const s = newWeave('x');
    expect(judge(p, s, target.cells)).toMatchObject({ kind: 'found', word: target.word });
    expect(judge(p, s, [...target.cells].reverse()).kind).toBe('no');
    const found = addFound(s, p, target.word);
    expect(judge(p, found, target.cells).kind).toBe('again');
  });

  it('traces through touching squares only', () => {
    expect(canExtend(p, [0], 1)).toBe(true);
    expect(canExtend(p, [0], p.cols + 1)).toBe(true); // diagonal
    expect(canExtend(p, [0], 2)).toBe(false);
    expect(canExtend(p, [0, 1], 0)).toBe(false); // no repeats
  });

  it('wins when everything is found, and hints point at a theme word first', () => {
    let s = takeHint(newWeave('x'), p);
    expect(s.hints).toBe(1);
    expect(s.hinted).not.toBe(p.spangram);
    expect(takeHint(s, p)).toBe(s); // one hint at a time
    for (const w of p.words) s = addFound(s, p, w.word);
    expect(s.won).toBe(true);
  });
});
