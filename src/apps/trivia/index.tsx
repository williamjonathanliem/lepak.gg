import { useCallback, useEffect, useRef, useState } from 'react';
import { Confetti } from '../../components/Confetti';
import {
  QUESTION_SECONDS,
  answer,
  correctCount,
  current,
  isAnswered,
  isFinished,
  newQuiz,
  next,
  toQuestion,
  type QuizState,
  type RawQuestion,
} from './logic/trivia';
import { AppHeader } from '../../components/AppHeader';

// Trivia: 10 quick questions from Open Trivia DB. Their questions are licensed CC BY-SA 4.0,
// which asks us to credit them, so the credit line is on every screen.

const CATEGORIES = [
  { id: 9, name: 'General knowledge' },
  { id: 17, name: 'Science & nature' },
  { id: 18, name: 'Computers' },
  { id: 19, name: 'Maths' },
  { id: 22, name: 'Geography' },
  { id: 23, name: 'History' },
  { id: 21, name: 'Sports' },
  { id: 11, name: 'Film' },
  { id: 12, name: 'Music' },
  { id: 15, name: 'Video games' },
  { id: 31, name: 'Anime & manga' },
] as const;

type Difficulty = 'any' | 'easy' | 'medium' | 'hard';

const ACCENT = '#ff8fd0';

async function fetchQuestions(category: number | null, difficulty: Difficulty) {
  const params = new URLSearchParams({ amount: '10', type: 'multiple', encode: 'url3986' });
  if (category) params.set('category', String(category));
  if (difficulty !== 'any') params.set('difficulty', difficulty);
  const res = await fetch(`https://opentdb.com/api.php?${params}`);
  if (!res.ok) throw new Error(String(res.status));
  const body = (await res.json()) as { response_code: number; results: RawQuestion[] };
  // 5 = asked too fast (they allow one request every 5 seconds)
  if (body.response_code === 5) throw new Error('slow-down');
  if (body.response_code !== 0 || body.results.length === 0) throw new Error('empty');
  return body.results.map((r) => toQuestion(r, Math.random));
}

function Credit() {
  return (
    <p className="m-0 font-mono text-xs text-mute">
      Questions from{' '}
      <a href="https://opentdb.com" target="_blank" rel="noopener noreferrer" className="underline">
        Open Trivia Database
      </a>
      , licensed{' '}
      <a
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        CC BY-SA 4.0
      </a>
      .
    </p>
  );
}

export default function Trivia() {
  const [category, setCategory] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('any');
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      setQuiz(newQuiz(await fetchQuestions(category, difficulty)));
    } catch (e) {
      setError(
        (e as Error).message === 'slow-down'
          ? 'Too fast! Wait 5 seconds and try again.'
          : (e as Error).message === 'empty'
            ? 'Not enough questions for that mix. Try "Any" difficulty.'
            : 'Could not load questions. Check your connection.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <title>Trivia · Lepak.gg</title>
      <AppHeader app={{ name: 'Trivia', to: '/trivia', accent: '#ff8fd0' }}>
        {quiz && (
          <span className="flex items-center px-4 font-mono text-sm font-bold">
            {quiz.score} pts
          </span>
        )}
      </AppHeader>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-gutter py-[clamp(24px,5vw,48px)]">
        {!quiz ? (
          <Setup
            category={category}
            setCategory={setCategory}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            onStart={() => void start()}
            loading={loading}
            error={error}
          />
        ) : isFinished(quiz) ? (
          <Results quiz={quiz} onAgain={() => setQuiz(null)} />
        ) : (
          <Play key={quiz.index} quiz={quiz} setQuiz={setQuiz} />
        )}
        <div className="mt-auto">
          <Credit />
        </div>
      </main>
    </div>
  );
}

function Setup(props: {
  category: number | null;
  setCategory: (c: number | null) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onStart: () => void;
  loading: boolean;
  error: string | null;
}) {
  const chip = (on: boolean) =>
    `min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold uppercase ${on ? 'bg-ink text-paper' : 'bg-paper'}`;
  return (
    <>
      <div>
        <h1 className="heading-lg m-0">Trivia.</h1>
        <p className="mt-3 mb-0 text-lg text-mute">
          10 questions, {QUESTION_SECONDS} seconds each. Fast answers and streaks score more.
        </p>
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 font-mono text-xs uppercase">Category</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={props.category === null}
            onClick={() => props.setCategory(null)}
            className={chip(props.category === null)}
          >
            Mix
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={props.category === c.id}
              onClick={() => props.setCategory(c.id)}
              className={chip(props.category === c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 font-mono text-xs uppercase">Difficulty</legend>
        <div className="flex flex-wrap gap-2">
          {(['any', 'easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={props.difficulty === d}
              onClick={() => props.setDifficulty(d)}
              className={chip(props.difficulty === d)}
            >
              {d}
            </button>
          ))}
        </div>
      </fieldset>
      <p role="alert" className="m-0 min-h-6 font-mono text-sm font-bold">
        {props.error ? `! ${props.error}` : ''}
      </p>
      <button
        type="button"
        onClick={props.onStart}
        disabled={props.loading}
        className="push h-16 self-start cursor-pointer border-3 border-ink px-8 font-mono text-lg font-bold uppercase shadow-hard disabled:cursor-wait disabled:opacity-60"
        style={{ background: ACCENT }}
      >
        {props.loading ? 'Loading...' : 'Start'}
      </button>
    </>
  );
}

/** When the current question's time runs out (ms epoch). */
function deadlineFromNow(): number {
  return Date.now() + QUESTION_SECONDS * 1000;
}

function Play({ quiz, setQuiz }: { quiz: QuizState; setQuiz: (q: QuizState) => void }) {
  const q = current(quiz)!;
  const answered = isAnswered(quiz);
  const result = quiz.answers[quiz.index];
  const [left, setLeft] = useState(QUESTION_SECONDS);
  const [deadline] = useState(deadlineFromNow); // fixed when this question appears
  const nextRef = useRef<HTMLButtonElement>(null);

  const pick = useCallback(
    (choice: string | null) => {
      const secondsLeft = Math.max(0, (deadline - Date.now()) / 1000);
      setQuiz(answer(quiz, choice, secondsLeft));
    },
    [quiz, setQuiz, deadline],
  );

  // Countdown for this question; runs out = answered with nothing.
  useEffect(() => {
    if (answered) return;
    const id = setInterval(() => {
      const s = Math.max(0, (deadline - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) pick(null);
    }, 100);
    return () => clearInterval(id);
  }, [answered, pick, deadline]);

  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  return (
    <section aria-labelledby="q-text" className="flex flex-col gap-5">
      <div className="flex items-center justify-between font-mono text-xs uppercase">
        <span>
          Question {quiz.index + 1} of {quiz.questions.length}
        </span>
        <span className="text-mute">
          {q.category} · {q.difficulty}
          {quiz.streak >= 2 && <b className="ml-2 text-ink">{quiz.streak}x streak</b>}
        </span>
      </div>
      <div
        className="h-3 border-2 border-ink bg-paper"
        role="progressbar"
        aria-label="Time left"
        aria-valuemin={0}
        aria-valuemax={QUESTION_SECONDS}
        aria-valuenow={Math.ceil(left)}
      >
        <div
          className="h-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${(left / QUESTION_SECONDS) * 100}%`,
            background: left < 5 ? 'var(--color-hot)' : ACCENT,
          }}
        />
      </div>
      <h1 id="q-text" className="m-0 text-[clamp(22px,4vw,32px)] leading-tight font-black">
        {q.question}
      </h1>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {q.answers.map((a) => {
          const isRight = answered && a === q.correct;
          const isWrongPick = answered && result?.picked === a && !result.correct;
          return (
            <li key={a}>
              <button
                type="button"
                disabled={answered}
                onClick={() => pick(a)}
                className={`flex min-h-16 w-full cursor-pointer items-center border-3 border-ink px-4 py-3 text-left text-lg font-bold disabled:cursor-default ${
                  isRight
                    ? 'bg-[#7ee081]'
                    : isWrongPick
                      ? 'animate-shake bg-hot'
                      : answered
                        ? 'bg-paper opacity-50'
                        : 'push bg-paper shadow-hard'
                }`}
              >
                {isRight && <span aria-hidden="true">✓&nbsp;</span>}
                {isWrongPick && <span aria-hidden="true">✕&nbsp;</span>}
                {a}
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" className="m-0 min-h-6 font-mono text-sm font-bold">
        {answered &&
          (result?.correct
            ? `Betul! +${result.points}`
            : result?.picked === null
              ? `Time's up. It was ${q.correct}.`
              : `Not quite. It was ${q.correct}.`)}
      </p>
      {answered && (
        <button
          ref={nextRef}
          type="button"
          onClick={() => setQuiz(next(quiz))}
          className="h-14 self-start cursor-pointer border-3 border-ink bg-ink px-6 font-mono font-bold text-paper uppercase"
        >
          {quiz.index + 1 === quiz.questions.length ? 'See results' : 'Next →'}
        </button>
      )}
    </section>
  );
}

function Results({ quiz, onAgain }: { quiz: QuizState; onAgain: () => void }) {
  const right = correctCount(quiz);
  return (
    <section className="flex flex-col gap-5">
      {right >= 7 && <Confetti />}
      <h1 className="heading-lg m-0">
        {right >= 9 ? 'Genius lah!' : right >= 7 ? 'Solid!' : right >= 4 ? 'Not bad.' : 'Aiyo.'}
      </h1>
      <dl className="m-0 grid grid-cols-3 gap-3 text-center">
        {[
          ['Score', quiz.score],
          ['Correct', `${right}/${quiz.questions.length}`],
          ['Best streak', quiz.bestStreak],
        ].map(([label, value]) => (
          <div key={label} className="border-3 border-ink py-3">
            <dd className="m-0 text-3xl font-black">{value}</dd>
            <dt className="font-mono text-xs uppercase">{label}</dt>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onAgain}
        className="push h-14 self-start cursor-pointer border-3 border-ink px-6 font-mono font-bold uppercase shadow-hard"
        style={{ background: ACCENT }}
      >
        Play again
      </button>
    </section>
  );
}
