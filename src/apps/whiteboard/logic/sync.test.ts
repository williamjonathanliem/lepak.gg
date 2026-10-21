import { changedSince, isNewer, mergeElements } from './sync';

const el = (id: string, version: number, versionNonce = 1) => ({ id, version, versionNonce });

describe('isNewer', () => {
  it('prefers the higher version', () => {
    expect(isNewer(el('a', 3), el('a', 2))).toBe(true);
    expect(isNewer(el('a', 2), el('a', 3))).toBe(false);
  });

  it('breaks ties the same way on every device', () => {
    expect(isNewer(el('a', 2, 5), el('a', 2, 9))).toBe(true);
    expect(isNewer(el('a', 2, 9), el('a', 2, 5))).toBe(false);
  });

  it('treats unknown shapes as new', () => {
    expect(isNewer(el('a', 1), undefined)).toBe(true);
  });
});

describe('mergeElements', () => {
  it('keeps newer local shapes and takes newer remote ones', () => {
    const local = [el('a', 5), el('b', 1)];
    const remote = [el('a', 4), el('b', 2)];
    expect(mergeElements(local, remote)).toEqual([el('a', 5), el('b', 2)]);
  });

  it('adds shapes it has never seen, at the end', () => {
    const merged = mergeElements([el('a', 1)], [el('c', 1), el('b', 1)]);
    expect(merged.map((e) => e.id)).toEqual(['a', 'c', 'b']);
  });

  it('gives the same result whichever side merges', () => {
    const x = [el('a', 2, 3), el('b', 1)];
    const y = [el('a', 2, 7), el('b', 4)];
    const ab = mergeElements(x, y);
    const ba = mergeElements(y, x);
    expect(new Map(ab.map((e) => [e.id, e]))).toEqual(new Map(ba.map((e) => [e.id, e])));
  });
});

describe('changedSince', () => {
  it('finds shapes edited since we last synced them', () => {
    const known = new Map([
      ['a', 3],
      ['b', 1],
    ]);
    expect(changedSince([el('a', 3), el('b', 2), el('c', 1)], known).map((e) => e.id)).toEqual([
      'b',
      'c',
    ]);
  });
});
