// Notes → Game: a live quiz round for a class. Pure rules: which questions can be played,
// scoring, tallying answers and the leaderboard.
//
// Only multiple choice and true/false questions are played live (typing on a phone against
// the clock isn't fun). Points: 1000 for a right answer at once, down to 500 for one in the
// last second, nothing for a wrong one.

import type { QuizQuestion } from '../../ai-notes/logic/notes';

export interface LiveQuestion {
  q: string;
  options: string[];
}

export interface Playable extends LiveQuestion {
  answer: number;
  why: string;
}

export const SECONDS_PER_QUESTION = 20;
export const MAX_QUESTIONS = 30;
export const MAX_PLAYERS = 60;

/** The questions from a quiz bank that work live, as option lists with the right index. */
export function toPlayable(bank: readonly QuizQuestion[]): Playable[] {
  return bank
    .flatMap((q): Playable[] => {
      if (q.type === 'tf') {
        return [
          { q: q.question, options: ['True', 'False'], answer: q.answer ? 0 : 1, why: q.why },
        ];
      }
      if (q.type === 'short') return [];
      return [{ q: q.question, options: q.options.slice(0, 4), answer: q.answer, why: q.why }];
    })
    .filter((p) => p.answer < p.options.length)
    .slice(0, MAX_QUESTIONS);
}

/** Points for one answer, by how fast it came (ms after the question opened). */
export function points(correct: boolean, elapsedMs: number, limitMs: number): number {
  if (!correct) return 0;
  const t = Math.min(Math.max(elapsedMs, 0), limitMs) / limitMs;
  return Math.round(1000 - 500 * t);
}

export interface Answer {
  choice: number;
  /** Server time it came in. */
  at: number;
}

/** How many picked each option. */
export function tally(answers: Readonly<Record<string, Answer>>, optionCount: number): number[] {
  const out = Array.from({ length: optionCount }, () => 0);
  for (const a of Object.values(answers))
    if (a.choice >= 0 && a.choice < optionCount) out[a.choice]!++;
  return out;
}

/** Everyone's new totals after a question (the host works this out and saves it). */
export function scoreQuestion(
  scores: Readonly<Record<string, number>>,
  answers: Readonly<Record<string, Answer>>,
  answer: number,
  openedAt: number,
  limitMs: number,
): Record<string, number> {
  const out = { ...scores };
  for (const [uid, a] of Object.entries(answers)) {
    out[uid] = (out[uid] ?? 0) + points(a.choice === answer, a.at - openedAt, limitMs);
  }
  return out;
}

export interface Ranked {
  uid: string;
  nick: string;
  score: number;
  rank: number;
}

/** Highest score first; equal scores share a rank. */
export function leaderboard(
  scores: Readonly<Record<string, number>>,
  players: Readonly<Record<string, string>>,
): Ranked[] {
  const rows = Object.entries(players)
    .map(([uid, nick]) => ({ uid, nick, score: scores[uid] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.nick.localeCompare(b.nick));
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.score !== rows[i - 1]!.score) rank = i + 1;
    return { ...r, rank };
  });
}
