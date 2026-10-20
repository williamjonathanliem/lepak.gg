import { LIMITS, type Difficulty, type PromptEntry, type RejectReason, type Rng } from './types';

export function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Checks a submitted word. Returns null when it's good. */
export function checkWord(
  raw: string,
  prompt: string,
  usedWords: readonly string[],
  isWord: (word: string) => boolean,
): RejectReason | null {
  const word = normalizeWord(raw);
  if (word.length < LIMITS.minWordLength) return 'too-short';
  if (word.length > LIMITS.maxWordLength) return 'too-long';
  if (!/^[a-z]+$/.test(word)) return 'not-letters';
  if (!word.includes(prompt)) return 'missing-prompt';
  if (usedWords.includes(word)) return 'already-used';
  if (!isWord(word)) return 'not-a-word';
  return null;
}

/**
 * How many dictionary words a prompt needs for each difficulty.
 * Hard prompts are rare chunks, easy ones are everywhere.
 */
export const DIFFICULTY_RANGE: Record<Difficulty, readonly [number, number]> = {
  easy: [1000, Infinity],
  normal: [300, 1000],
  hard: [50, 300],
};

export function promptsFor(prompts: readonly PromptEntry[], difficulty: Difficulty): string[] {
  const [min, max] = DIFFICULTY_RANGE[difficulty];
  return prompts.filter(([, n]) => n >= min && n < max).map(([p]) => p);
}

/** Picks a prompt for the difficulty, avoiding a repeat of the last one. */
export function pickPrompt(
  prompts: readonly PromptEntry[],
  difficulty: Difficulty,
  rng: Rng,
  avoid?: string,
): string {
  let pool = promptsFor(prompts, difficulty);
  if (pool.length === 0) pool = prompts.map(([p]) => p);
  if (pool.length > 1 && avoid) pool = pool.filter((p) => p !== avoid);
  return pool[Math.floor(rng() * pool.length)] ?? 'ing';
}

/** Turns a dictionary file (one word per line) into a lookup set. */
export function parseDictionary(text: string): Set<string> {
  const set = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (w) set.add(w);
  }
  return set;
}
