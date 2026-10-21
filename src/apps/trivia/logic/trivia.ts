// Trivia rules. Pure functions, no React, no network.

export const QUESTION_SECONDS = 15;
export const BASE_POINTS = 100;
export const SPEED_BONUS_PER_SECOND = 5; // answer fast, score more

export interface Question {
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  correct: string;
  /** All four answers in display order (shuffled once). */
  answers: string[];
}

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Raw question from Open Trivia DB (requested with encode=url3986). */
export interface RawQuestion {
  category: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function toQuestion(raw: RawQuestion, rng: Rng): Question {
  const correct = decode(raw.correct_answer);
  const difficulty =
    (['easy', 'medium', 'hard'] as const).find((d) => d === raw.difficulty) ?? 'medium';
  return {
    category: decode(raw.category),
    difficulty,
    question: decode(raw.question),
    correct,
    answers: shuffle([correct, ...raw.incorrect_answers.map(decode)], rng),
  };
}

export interface Answer {
  picked: string | null; // null = ran out of time
  correct: boolean;
  points: number;
}

export interface QuizState {
  questions: Question[];
  index: number;
  answers: Answer[];
  score: number;
  streak: number;
  bestStreak: number;
}

export function newQuiz(questions: Question[]): QuizState {
  return { questions, index: 0, answers: [], score: 0, streak: 0, bestStreak: 0 };
}

export function current(state: QuizState): Question | null {
  return state.questions[state.index] ?? null;
}

export function isAnswered(state: QuizState): boolean {
  return state.answers.length > state.index;
}

export function isFinished(state: QuizState): boolean {
  return state.answers.length >= state.questions.length;
}

/** Points for a right answer: base + speed bonus + 10% per answer in the current streak (up to +50%). */
export function pointsFor(secondsLeft: number, streak: number): number {
  const speed = Math.max(0, Math.round(secondsLeft)) * SPEED_BONUS_PER_SECOND;
  const boost = 1 + Math.min(streak, 5) * 0.1;
  return Math.round((BASE_POINTS + speed) * boost);
}

/** Answer the current question (picked = null when the timer ran out). */
export function answer(state: QuizState, picked: string | null, secondsLeft: number): QuizState {
  const q = current(state);
  if (!q || isAnswered(state)) return state;
  const correct = picked !== null && picked === q.correct;
  const points = correct ? pointsFor(secondsLeft, state.streak) : 0;
  const streak = correct ? state.streak + 1 : 0;
  return {
    ...state,
    answers: [...state.answers, { picked, correct, points }],
    score: state.score + points,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
  };
}

export function next(state: QuizState): QuizState {
  if (!isAnswered(state)) return state;
  return { ...state, index: state.index + 1 };
}

export function correctCount(state: QuizState): number {
  return state.answers.filter((a) => a.correct).length;
}
