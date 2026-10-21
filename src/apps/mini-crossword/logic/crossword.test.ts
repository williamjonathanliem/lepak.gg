import { readFileSync } from 'node:fs';
import {
  BLACK,
  SLOTS,
  check,
  newCrossword,
  nextCell,
  reveal,
  slotFor,
  solution,
  type,
  type CrosswordPuzzle,
} from './crossword';

const all = JSON.parse(readFileSync('public/games/crossword.json', 'utf8')) as CrosswordPuzzle[];

describe('Pocket Crossword puzzles', () => {
  it('cross correctly and every word has a clue', () => {
    expect(all.length).toBeGreaterThan(60);
    for (const p of all) {
      const sol = solution(p);
      // Each square agrees between its across and down word.
      for (const slot of SLOTS) {
        const w = (slot.dir === 'across' ? p.across : p.down)[slot.index]!;
        expect(slot.cells.map((c) => sol[c]).join('')).toBe(w.word.toUpperCase());
        expect(w.clue.length).toBeGreaterThan(2);
        expect(w.clue.toLowerCase()).not.toContain(w.word);
      }
      for (const b of BLACK) expect(sol[b]).toBe('');
    }
  });
});

describe('Pocket Crossword rules', () => {
  const p = all[0]!;
  const sol = solution(p);
  const open = sol.flatMap((ch, i) => (ch ? [i] : []));

  it('wins when every square is right', () => {
    let s = newCrossword('x', 0);
    for (const c of open) s = type(s, sol, c, sol[c]!.toLowerCase(), 99);
    expect(s.won).toBe(true);
    expect(s.finishedAt).toBe(99);
  });

  it('marks wrong letters on check, and revealing everything is not a win', () => {
    let s = type(newCrossword('x', 0), sol, 0, sol[0] === 'A' ? 'B' : 'A', 1);
    s = check(s, sol);
    expect(s.wrong).toEqual([0]);
    s = reveal(s, sol, open, 5);
    expect(s.finishedAt).toBe(5);
    expect(s.won).toBe(false);
  });

  it('moves along a word and finds the right slot', () => {
    expect(slotFor(12, 'down')!.number).toBe(2);
    expect(slotFor(7, 'across')!.dir).toBe('down'); // no across word through square 7
    const across1 = SLOTS[0]!;
    expect(nextCell(across1, 0)).toBe(1);
    expect(nextCell(across1, 4)).toBe(4);
  });
});
