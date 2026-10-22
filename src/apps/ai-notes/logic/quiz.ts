// Quizzes from a set of notes. Pure: grading, picking questions, scoring, and checking what
// the server sends back when you ask for more questions (api/_lib/aiNotes.ts).

import { z } from 'zod';
import { shuffle, type Rng } from '../../../lib/puzzle';
import { QuizQuestionSchema, kindOf, type QuestionKind, type QuizQuestion } from './notes';

/** What you typed or tapped: an option index, true/false, or typed text. */
export type Response = number | boolean | string;

/** Lowercase, no punctuation or extra spaces, no "the/a/an" in front. */
export function normaliseAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '');
}

/** Edit distance, stopping early once it's past `max` (only small typos matter here). */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

/** A typed answer counts if it matches the answer or an accepted one, allowing a small typo
 * in longer words (one slip from 5 letters, two from 10). */
export function checkShort(typed: string, answer: string, accept: readonly string[] = []): boolean {
  const t = normaliseAnswer(typed);
  if (!t) return false;
  return [answer, ...accept].some((a) => {
    const n = normaliseAnswer(a);
    if (!n) return false;
    if (t === n) return true;
    const slips = n.length >= 10 ? 2 : n.length >= 5 ? 1 : 0;
    return slips > 0 && within(t, n, slips);
  });
}

export function isCorrect(q: QuizQuestion, r: Response | undefined): boolean {
  if (r === undefined) return false;
  if (q.type === 'tf') return r === q.answer;
  if (q.type === 'short') return typeof r === 'string' && checkShort(r, q.answer, q.accept);
  return r === q.answer;
}

export type QuizMode = 'practice' | 'exam';

export interface QuizSettings {
  /** How many questions this round (0 = all). */
  count: number;
  mode: QuizMode;
  kinds: readonly QuestionKind[];
}

/** Question indexes for one round: only the chosen kinds, shuffled, up to `count`. */
export function pickRound(bank: readonly QuizQuestion[], s: QuizSettings, rng: Rng): number[] {
  const ok = bank.flatMap((q, i) => (s.kinds.includes(kindOf(q)) ? [i] : []));
  const mixed = shuffle(ok, rng);
  return s.count > 0 ? mixed.slice(0, s.count) : mixed;
}

/** Seconds an exam gives you: a minute per question (short answers need typing time too). */
export const examSeconds = (questions: number) => questions * 60;

export function score(
  bank: readonly QuizQuestion[],
  round: readonly number[],
  answers: Readonly<Record<number, Response>>,
): { right: number; total: number } {
  const right = round.filter((i) => isCorrect(bank[i]!, answers[i])).length;
  return { right, total: round.length };
}

/** How many of each kind a set has, for the settings screen. */
export function kindCounts(bank: readonly QuizQuestion[]): Record<QuestionKind, number> {
  const out: Record<QuestionKind, number> = { mc: 0, tf: 0, short: 0 };
  for (const q of bank) out[kindOf(q)]++;
  return out;
}

// ---------- asking the server for more ----------

export type Difficulty = 'easy' | 'mixed' | 'hard';
export const ADD_SIZES = [10, 20, 30] as const;

export const MoreQuestionsSchema = z.object({ questions: z.array(QuizQuestionSchema).max(30) });

/** Drops new questions that repeat ones already in the set (same words, ignoring case). */
export function withoutRepeats(
  bank: readonly QuizQuestion[],
  extra: readonly QuizQuestion[],
): QuizQuestion[] {
  const seen = new Set(bank.map((q) => normaliseAnswer(q.question)));
  return extra.filter((q) => {
    const key = normaliseAnswer(q.question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
