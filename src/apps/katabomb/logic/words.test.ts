import { checkWord, parseDictionary, pickPrompt, promptsFor } from './words';
import type { PromptEntry } from './types';

const dict = new Set(['nation', 'station', 'ratio', 'cat']);
const isWord = (w: string) => dict.has(w);

describe('checkWord', () => {
  it('accepts a real word containing the prompt', () => {
    expect(checkWord('nation', 'tio', [], isWord)).toBeNull();
  });

  it('ignores case and surrounding spaces', () => {
    expect(checkWord('  NaTion ', 'tio', [], isWord)).toBeNull();
  });

  it('accepts the prompt anywhere in the word', () => {
    expect(checkWord('ratio', 'tio', [], isWord)).toBeNull();
  });

  it('rejects words shorter than 3 letters', () => {
    expect(checkWord('ti', 'ti', [], isWord)).toBe('too-short');
  });

  it('rejects very long input', () => {
    expect(checkWord('a'.repeat(31), 'aa', [], isWord)).toBe('too-long');
  });

  it('rejects anything that is not letters', () => {
    expect(checkWord('na-tion', 'tio', [], isWord)).toBe('not-letters');
    expect(checkWord('nation1', 'tio', [], isWord)).toBe('not-letters');
  });

  it('rejects words missing the prompt', () => {
    expect(checkWord('cat', 'tio', [], isWord)).toBe('missing-prompt');
  });

  it('rejects words already used this match', () => {
    expect(checkWord('Nation', 'tio', ['nation'], isWord)).toBe('already-used');
  });

  it('rejects words not in the dictionary', () => {
    expect(checkWord('zzztiozz', 'tio', [], isWord)).toBe('not-a-word');
  });
});

describe('prompts', () => {
  const prompts: PromptEntry[] = [
    ['in', 5000],
    ['er', 1200],
    ['tio', 600],
    ['ang', 400],
    ['xyl', 120],
    ['qu', 60],
    ['zzz', 10],
  ];

  it('groups prompts by difficulty', () => {
    expect(promptsFor(prompts, 'easy')).toEqual(['in', 'er']);
    expect(promptsFor(prompts, 'normal')).toEqual(['tio', 'ang']);
    expect(promptsFor(prompts, 'hard')).toEqual(['xyl', 'qu']);
  });

  it('never picks a prompt outside the difficulty', () => {
    for (let i = 0; i < 200; i++) {
      expect(['xyl', 'qu']).toContain(pickPrompt(prompts, 'hard', Math.random));
    }
  });

  it('avoids repeating the previous prompt', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickPrompt(prompts, 'normal', Math.random, 'tio')).toBe('ang');
    }
  });

  it('uses the random source', () => {
    expect(pickPrompt(prompts, 'easy', () => 0)).toBe('in');
    expect(pickPrompt(prompts, 'easy', () => 0.99)).toBe('er');
  });
});

describe('parseDictionary', () => {
  it('handles Windows line endings and blanks', () => {
    expect(parseDictionary('Cat\r\ndog\n\n')).toEqual(new Set(['cat', 'dog']));
  });
});
