import { MAX_OPTIONS, cleanOptions, optionAt, sliceColour, spinTo } from './wheel';

describe('spin the wheel', () => {
  it('cleans the list: trims, drops blanks and repeats, caps the count', () => {
    expect(cleanOptions([' Mamak ', '', 'mamak', 'Nasi   lemak'])).toEqual(['Mamak', 'Nasi lemak']);
    expect(cleanOptions(Array.from({ length: 40 }, (_, i) => `o${i}`))).toHaveLength(MAX_OPTIONS);
  });

  it('knows which slice is under the pointer', () => {
    // 4 slices of 90 degrees, option 0 at the top going clockwise.
    expect(optionAt(0, 4)).toBe(0);
    expect(optionAt(-45, 4)).toBe(0);
    expect(optionAt(45, 4)).toBe(3); // turned clockwise: the last slice comes to the top
    expect(optionAt(270, 4)).toBe(1);
    expect(optionAt(720 + 270, 4)).toBe(1);
  });

  it('always lands inside the chosen slice, after several full turns', () => {
    for (const count of [2, 3, 7, 24]) {
      let rotation = 0;
      for (let index = 0; index < count; index++) {
        for (const r of [0, 500, 999]) {
          const next = spinTo(rotation, index, count, () => r);
          expect(next - rotation).toBeGreaterThanOrEqual(5 * 360);
          expect(optionAt(next, count)).toBe(index);
          rotation = next;
        }
      }
    }
  });

  it('never gives neighbouring slices the same colour', () => {
    for (let count = 2; count <= 24; count++) {
      for (let i = 0; i < count; i++) {
        expect(sliceColour(i, count)).not.toBe(sliceColour((i + 1) % count, count));
      }
    }
  });
});
