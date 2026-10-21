import {
  box,
  clashes,
  countSolutions,
  enter,
  isSolved,
  makePuzzle,
  newSudoku,
  toggleNote,
} from './sudoku';

describe('sudoku maker', () => {
  it('makes a valid full solution and a puzzle with exactly one answer', () => {
    const { puzzle, solution } = makePuzzle('day-1', 'medium');
    for (let i = 0; i < 81; i++) {
      expect(solution[i]).toBeGreaterThan(0);
      expect(clashes(solution, i)).toBe(false);
      if (puzzle[i]) expect(puzzle[i]).toBe(solution[i]);
    }
    expect(countSolutions(puzzle)).toBe(1);
  });

  it('is the same for the same seed, and harder means fewer numbers', () => {
    expect(makePuzzle('x', 'easy')).toEqual(makePuzzle('x', 'easy'));
    const given = (d: 'easy' | 'hard') => makePuzzle('y', d).puzzle.filter(Boolean).length;
    expect(given('easy')).toBeGreaterThan(given('hard'));
  });

  it('numbers the boxes 0 to 8', () => {
    expect(box(0)).toBe(0);
    expect(box(80)).toBe(8);
    expect(box(40)).toBe(4);
  });
});

describe('playing', () => {
  const s0 = newSudoku('play', 'easy', 1000);
  const empty = s0.puzzle.indexOf(0);
  const right = s0.solution[empty]!;
  const wrong = right === 9 ? 1 : right + 1;

  it('counts mistakes and ignores the given numbers', () => {
    const s = enter(s0, empty, wrong, 1);
    expect(s.mistakes).toBe(1);
    expect(enter(s0, s0.puzzle.findIndex(Boolean), 5, 1)).toBe(s0);
  });

  it('clears matching pencil marks from neighbours', () => {
    let s = toggleNote(s0, empty, right);
    const otherEmpty = s0.puzzle.findIndex((n, i) => !n && i !== empty);
    s = toggleNote(s, otherEmpty, 3);
    expect(s.notes[empty]).toEqual([right]);
    s = enter(s, empty, right, 1);
    expect(s.notes[empty]).toEqual([]);
  });

  it('finishes when every cell is right', () => {
    let s = s0;
    s0.puzzle.forEach((n, i) => {
      if (!n) s = enter(s, i, s0.solution[i]!, 5000);
    });
    expect(isSolved(s)).toBe(true);
    expect(s.finishedAt).toBe(5000);
  });
});
