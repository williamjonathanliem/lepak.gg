import { initialTypewriter, stepTypewriter, visibleText, type TypewriterState } from './typewriter';

const words = ['Hi', 'Yo!'];
const timing = { holdTicks: 2, gapTicks: 1 };

function run(state: TypewriterState, ticks: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    state = stepTypewriter(state, words, timing);
    out.push(visibleText(state, words));
  }
  return out;
}

describe('typewriter', () => {
  it('starts with the first word fully shown', () => {
    expect(visibleText(initialTypewriter(words, timing), words)).toBe('Hi');
  });

  it('holds, deletes, gaps, types the next word, then loops', () => {
    const frames = run(initialTypewriter(words, timing), 15);
    // prettier-ignore
    expect(frames).toEqual([
      'Hi', 'Hi', // hold
      'H', '', // delete
      '', // gap
      'Y', 'Yo', 'Yo!', // type
      'Yo!', 'Yo!', // hold
      'Yo', 'Y', '', // delete
      '', // gap
      'H', // loops back to the first word
    ]);
  });

  it('does nothing with an empty list', () => {
    const s = initialTypewriter([], timing);
    expect(stepTypewriter(s, [], timing)).toBe(s);
  });
});
