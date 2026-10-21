import { shiftPosition, textDiff } from './textDiff';

describe('textDiff', () => {
  it('finds typing, deleting and replacing', () => {
    expect(textDiff('abc', 'abc')).toBeNull();
    expect(textDiff('hllo', 'hello')).toEqual({ index: 1, remove: 0, insert: 'e' });
    expect(textDiff('hello', 'helo')).toEqual({ index: 3, remove: 1, insert: '' });
    expect(textDiff('the cat', 'the dog')).toEqual({ index: 4, remove: 3, insert: 'dog' });
    expect(textDiff('', 'hi')).toEqual({ index: 0, remove: 0, insert: 'hi' });
  });

  it('handles repeated letters', () => {
    // typing a second "l" in "hello": any valid single edit is fine, it must rebuild the text
    const before = 'hello';
    const after = 'helllo';
    const d = textDiff(before, after)!;
    expect(before.slice(0, d.index) + d.insert + before.slice(d.index + d.remove)).toBe(after);
  });
});

describe('shiftPosition', () => {
  it('moves my cursor when someone types or deletes before it', () => {
    expect(shiftPosition(5, [{ insert: 'ab' }])).toBe(7);
    expect(shiftPosition(5, [{ retain: 2 }, { insert: 'xyz' }])).toBe(8);
    expect(shiftPosition(5, [{ retain: 1 }, { delete: 2 }])).toBe(3);
  });

  it('leaves it alone for edits after it', () => {
    expect(shiftPosition(2, [{ retain: 4 }, { insert: 'zz' }])).toBe(2);
    expect(shiftPosition(2, [{ retain: 3 }, { delete: 5 }])).toBe(2);
  });

  it('clamps when the text under the cursor is deleted', () => {
    expect(shiftPosition(4, [{ retain: 2 }, { delete: 5 }])).toBe(2);
  });
});
