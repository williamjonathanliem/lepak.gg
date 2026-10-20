// Wordl* rules. Pure functions, no React, no storage.

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type Mark = 'correct' | 'present' | 'absent';

/**
 * Colours a guess against the answer. Repeated letters are handled like the
 * real thing: exact matches first, then "present" only while that letter is
 * still unaccounted for in the answer.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array<Mark>(WORD_LENGTH).fill('absent');
  const left = new Map<string, number>();
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) marks[i] = 'correct';
    else left.set(answer[i]!, (left.get(answer[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] === 'correct') continue;
    const n = left.get(guess[i]!) ?? 0;
    if (n > 0) {
      marks[i] = 'present';
      left.set(guess[i]!, n - 1);
    }
  }
  return marks;
}

export type Status = 'playing' | 'won' | 'lost';

export interface WordlState {
  answer: string;
  guesses: string[];
  status: Status;
}

export type GuessError = 'too-short' | 'not-a-word' | 'finished';

export function newGame(answer: string, guesses: string[] = []): WordlState {
  let state: WordlState = { answer, guesses: [], status: 'playing' };
  for (const g of guesses) state = addGuess(state, g, () => true).state;
  return state;
}

export function addGuess(
  state: WordlState,
  raw: string,
  isWord: (w: string) => boolean,
): { state: WordlState; error?: GuessError } {
  if (state.status !== 'playing') return { state, error: 'finished' };
  const guess = raw.trim().toLowerCase();
  if (guess.length !== WORD_LENGTH) return { state, error: 'too-short' };
  if (!/^[a-z]+$/.test(guess) || !isWord(guess)) return { state, error: 'not-a-word' };
  const guesses = [...state.guesses, guess];
  const status: Status =
    guess === state.answer ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
  return { state: { ...state, guesses, status } };
}

/** Best known mark for each letter, for colouring the keyboard. */
export function letterMarks(state: WordlState): Record<string, Mark> {
  const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
  const out: Record<string, Mark> = {};
  for (const g of state.guesses) {
    scoreGuess(g, state.answer).forEach((m, i) => {
      const ch = g[i]!;
      if (!out[ch] || rank[m] > rank[out[ch]!]) out[ch] = m;
    });
  }
  return out;
}

// ---------- daily puzzle ----------

const EPOCH = Date.UTC(2026, 0, 1); // puzzle #1
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // new puzzle at midnight Malaysia time

/** Puzzle number for a moment in time, starting at 1. */
export function dayNumber(nowMs: number): number {
  return Math.floor((nowMs + MYT_OFFSET_MS - EPOCH) / 86_400_000) + 1;
}

/** Same word for everyone on the same day, in a shuffled order so it's not alphabetical. */
export function dailyAnswer(answers: readonly string[], day: number): string {
  const n = answers.length;
  // Step through the list with a stride that shares no factor with n, so every word comes up once per cycle.
  let stride = 7919 % n || 1;
  while (gcd(stride, n) !== 1) stride++;
  const index = ((((day - 1) * stride) % n) + n) % n;
  return answers[index]!;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Emoji grid for sharing, with no letters so it doesn't spoil the answer. */
export function shareText(state: WordlState, label: string): string {
  const rows = state.guesses.map((g) =>
    scoreGuess(g, state.answer)
      .map((m) => (m === 'correct' ? '🟩' : m === 'present' ? '🟨' : '⬛'))
      .join(''),
  );
  const score =
    state.status === 'won' ? `${state.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  return `${label} ${score}\n\n${rows.join('\n')}`;
}

// ---------- stats ----------

export interface Stats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  /** wins by number of guesses, index 0 = solved in 1 */
  dist: number[];
  lastDay: number | null;
}

export const EMPTY_STATS: Stats = {
  played: 0,
  wins: 0,
  streak: 0,
  maxStreak: 0,
  dist: [0, 0, 0, 0, 0, 0],
  lastDay: null,
};

/** Records a finished daily puzzle. Playing the same day twice changes nothing. */
export function recordResult(stats: Stats, day: number, state: WordlState): Stats {
  if (state.status === 'playing' || stats.lastDay === day) return stats;
  const won = state.status === 'won';
  const continues = stats.lastDay === day - 1;
  const streak = won ? (continues ? stats.streak + 1 : 1) : 0;
  const dist = [...stats.dist];
  if (won) dist[state.guesses.length - 1] = (dist[state.guesses.length - 1] ?? 0) + 1;
  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    dist,
    lastDay: day,
  };
}
