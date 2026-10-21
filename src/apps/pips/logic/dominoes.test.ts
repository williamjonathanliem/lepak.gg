import {
  adjacent,
  boardValues,
  lift,
  makePuzzle,
  newDominoes,
  place,
  regionOk,
  type DominoPuzzle,
  type Placement,
} from './dominoes';

/** Brute-force: try every way to lay the dominoes. Proves the puzzle can be solved. */
function solve(p: DominoPuzzle): Placement[] | null {
  const order = [...p.cells].sort((a, b) => a - b);
  const go = (placed: Placement[], used: Set<number>): Placement[] | null => {
    const free = order.find((c) => !placed.some((x) => x.a === c || x.b === c));
    if (free === undefined) {
      const v = boardValues(p, placed);
      return p.regions.every((r) => regionOk(r, v) === true) ? placed : null;
    }
    for (const n of order) {
      if (!adjacent(free, n) || placed.some((x) => x.a === n || x.b === n)) continue;
      for (let d = 0; d < p.dominoes.length; d++) {
        if (used.has(d)) continue;
        for (const [a, b] of [
          [free, n],
          [n, free],
        ] as const) {
          const next = [...placed, { domino: d, a, b }];
          const v = boardValues(p, next);
          if (p.regions.some((r) => regionOk(r, v) === false)) continue;
          used.add(d);
          const found = go(next, used);
          used.delete(d);
          if (found) return found;
        }
      }
    }
    return null;
  };
  return go([], new Set());
}

describe('Domino Logic', () => {
  it('makes the same puzzle for the same seed, with every square in one region', () => {
    const p = makePuzzle('day-5');
    expect(makePuzzle('day-5')).toEqual(p);
    expect(p.cells).toHaveLength(18);
    expect(p.dominoes).toHaveLength(9);
    expect(p.regions.flatMap((r) => r.cells).sort((a, b) => a - b)).toEqual(p.cells);
  });

  it('always has a solution', () => {
    for (let k = 0; k < 8; k++) expect(solve(makePuzzle(`seed-${k}`))).not.toBeNull();
  }, 60_000); // a brute-force solver: slow when every test runs at once

  it('places, refuses bad spots, lifts, and wins with a full correct board', () => {
    const p = makePuzzle('play');
    const answer = solve(p)!;
    let s = newDominoes('play');
    expect(place(s, p, { domino: 0, a: 0, b: 7 }).placed).toHaveLength(0); // not next to each other
    s = place(s, p, answer[0]!);
    expect(place(s, p, answer[0]!)).toBe(s); // same domino twice
    expect(lift(s, answer[0]!.domino).placed).toHaveLength(0);
    for (const pl of answer.slice(1)) s = place(s, p, pl);
    expect(s.won).toBe(true);
  }, 60_000);
});
