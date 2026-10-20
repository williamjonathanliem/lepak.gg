import { dailyPuzzle, newGame, shareText, shuffle, submit, MAX_MISTAKES } from './connections';
import { PUZZLES, type Puzzle } from './puzzles';

const puzzle = PUZZLES[0]!;
const words = (g: number) => [...puzzle.groups[g]!.words];
const fixed = () => 0.42;

describe('puzzle set', () => {
  it.each(PUZZLES.map((p) => [p.id, p] as const))('puzzle %i is well formed', (_, p: Puzzle) => {
    const all = p.groups.flatMap((g) => g.words);
    expect(all).toHaveLength(16);
    expect(new Set(all).size).toBe(16);
    expect(p.groups.map((g) => g.level).sort()).toEqual([0, 1, 2, 3]);
    for (const w of all) expect(w).toMatch(/^[A-Z]+$/);
  });

  it('has unique ids', () => {
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
  });
});

describe('playing', () => {
  it('starts with all 16 words shuffled', () => {
    const s = newGame(puzzle, fixed);
    expect([...s.order].sort()).toEqual(puzzle.groups.flatMap((g) => g.words).sort());
  });

  it('solves a group and removes its words', () => {
    const r = submit(newGame(puzzle, fixed), puzzle, words(2));
    expect(r.result).toBe('correct');
    expect(r.state.solved).toEqual([2]);
    expect(r.state.order).toHaveLength(12);
  });

  it('says "one away" when 3 of 4 are right', () => {
    const pick = [...words(0).slice(0, 3), words(1)[0]!];
    const r = submit(newGame(puzzle, fixed), puzzle, pick);
    expect(r.result).toBe('one-away');
    expect(r.state.mistakes).toBe(1);
  });

  it('does not charge a mistake for repeating a guess', () => {
    const pick = [words(0)[0]!, words(1)[0]!, words(2)[0]!, words(3)[0]!];
    let s = submit(newGame(puzzle, fixed), puzzle, pick).state;
    const r = submit(s, puzzle, [...pick].reverse());
    expect(r.result).toBe('repeat');
    s = r.state;
    expect(s.mistakes).toBe(1);
  });

  it('needs exactly 4 words still on the board', () => {
    const s = newGame(puzzle, fixed);
    expect(submit(s, puzzle, words(0).slice(0, 3)).result).toBe('invalid');
    expect(submit(s, puzzle, ['NOPE', ...words(0).slice(0, 3)]).result).toBe('invalid');
  });

  it('wins after all four groups', () => {
    let s = newGame(puzzle, fixed);
    for (const g of [3, 1, 0, 2]) s = submit(s, puzzle, words(g)).state;
    expect(s.status).toBe('won');
    expect(s.solved).toEqual([3, 1, 0, 2]);
  });

  it('loses after 4 mistakes and reveals the rest', () => {
    let s = submit(newGame(puzzle, fixed), puzzle, words(0)).state;
    const wrongs = [
      [words(1)[0]!, words(2)[0]!, words(3)[0]!, words(1)[1]!],
      [words(1)[0]!, words(2)[0]!, words(3)[0]!, words(1)[2]!],
      [words(1)[0]!, words(2)[0]!, words(3)[0]!, words(1)[3]!],
      [words(1)[0]!, words(2)[1]!, words(3)[0]!, words(1)[3]!],
    ];
    for (const w of wrongs.slice(0, MAX_MISTAKES)) s = submit(s, puzzle, w).state;
    expect(s.status).toBe('lost');
    expect([...s.solved].sort()).toEqual([0, 1, 2, 3]);
    expect(s.order).toEqual([]);
  });
});

describe('extras', () => {
  it('shuffle keeps every item', () => {
    expect(shuffle([1, 2, 3, 4, 5], Math.random).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('cycles daily puzzles', () => {
    expect(dailyPuzzle(PUZZLES, 1)).toBe(PUZZLES[0]);
    expect(dailyPuzzle(PUZZLES, PUZZLES.length + 1)).toBe(PUZZLES[0]);
  });

  it('shares colours, not words', () => {
    const s = submit(newGame(puzzle, fixed), puzzle, words(0)).state;
    const text = shareText(s, puzzle, 'Connecti*ns #1');
    expect(text).toContain('🟨🟨🟨🟨');
    expect(text).not.toContain('MARS');
  });
});
