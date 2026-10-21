import { LAYERS, findPair, isEmpty, newMosaic, tap } from './mosaic';

describe('Mosaic', () => {
  it('uses every value an even number of times on each layer', () => {
    const s = newMosaic('day-3');
    for (const l of LAYERS) {
      const counts = new Map<number, number>();
      for (const t of s.tiles) counts.set(t[l]!, (counts.get(t[l]!) ?? 0) + 1);
      for (const c of counts.values()) expect(c % 2).toBe(0);
    }
    expect(newMosaic('day-3')).toEqual(s);
  });

  it('clears shared layers, builds a combo and breaks it on a miss', () => {
    const s0 = newMosaic('combo');
    const [a, b] = findPair(s0.tiles)!;
    let s = tap(tap(s0, a), b);
    expect(s.combo).toBe(1);
    expect(s.moves).toBe(1);
    // find a tile sharing nothing with the selected one
    if (s.selected !== null) {
      const sel = s.tiles[s.selected]!;
      const miss = s.tiles.findIndex(
        (t, k) =>
          k !== s.selected && !isEmpty(t) && LAYERS.every((l) => t[l] === null || t[l] !== sel[l]),
      );
      if (miss >= 0) {
        s = tap(s, miss);
        expect(s.combo).toBe(0);
        expect(s.selected).toBe(miss);
      }
    }
  });

  it('can always be cleared (plays 30 random boards to the end)', () => {
    for (let k = 0; k < 30; k++) {
      let s = newMosaic(`board-${k}`);
      for (let step = 0; step < 200 && !s.done; step++) {
        const pair = findPair(s.tiles);
        expect(pair).not.toBeNull();
        s = { ...s, selected: null };
        s = tap(tap(s, pair![0]), pair![1]);
      }
      expect(s.done).toBe(true);
    }
  });
});
