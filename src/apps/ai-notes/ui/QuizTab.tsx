import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { aiHeaders } from '../../../lib/aiHeaders';
import {
  MAX_QUESTIONS,
  answerText,
  kindOf,
  notesAsSource,
  type Notes,
  type QuestionKind,
  type QuizQuestion,
} from '../logic/notes';
import {
  ADD_SIZES,
  MoreQuestionsSchema,
  examSeconds,
  isCorrect,
  kindCounts,
  pickRound,
  withoutRepeats,
  type Difficulty,
  type QuizMode,
  type Response,
} from '../logic/quiz';
import { loadSource } from '../logic/saved';

// The quiz tab: every question made for these notes is kept as a bank. Take a round of it
// (practice: answers as you go; exam: timed, answers at the end), or ask the AI to add more
// (10/20/30, easy to hard, multiple choice / true or false / short answer).

const ACCENT = '#ffd23f';
const GOOD = '#7ee081';
/** Button shape without a colour; BTN is the plain white one. */
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const BTN = `${BTN_BASE} bg-paper text-ink`;
const KIND_NAME: Record<QuestionKind, string> = {
  mc: 'Multiple choice',
  tf: 'True or false',
  short: 'Short answer',
};
const KINDS: QuestionKind[] = ['mc', 'tf', 'short'];

type Phase =
  | { at: 'setup' }
  | { at: 'playing'; round: number[]; mode: QuizMode; endsAt: number | null }
  | { at: 'results'; round: number[] };

interface Props {
  notes: Notes;
  draftId: string;
  onChange: (notes: Notes) => void;
}

export function QuizTab({ notes, draftId, onChange }: Props) {
  const bank = notes.quiz;
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ at: 'setup' });
  const [answers, setAnswers] = useState<Record<number, Response>>({});
  /** Short answers you marked right yourself ("I was right"). */
  const [overrides, setOverrides] = useState<Record<number, true>>({});

  const right = (i: number) => overrides[i] === true || isCorrect(bank[i]!, answers[i]);

  function start(round: number[], mode: QuizMode) {
    setAnswers({});
    setOverrides({});
    setPhase({
      at: 'playing',
      round,
      mode,
      endsAt: mode === 'exam' ? Date.now() + examSeconds(round.length) * 1000 : null,
    });
  }

  if (phase.at === 'playing') {
    const finish = () => setPhase({ at: 'results', round: phase.round });
    return phase.mode === 'exam' ? (
      <Exam
        bank={bank}
        round={phase.round}
        endsAt={phase.endsAt!}
        answers={answers}
        setAnswer={(i, r) => setAnswers((a) => ({ ...a, [i]: r }))}
        onFinish={finish}
      />
    ) : (
      <PracticeRound
        bank={bank}
        round={phase.round}
        answers={answers}
        setAnswer={(i, r) => setAnswers((a) => ({ ...a, [i]: r }))}
        overrides={overrides}
        markRight={(i) => setOverrides((o) => ({ ...o, [i]: true }))}
        onFinish={finish}
        onQuit={() => setPhase({ at: 'setup' })}
      />
    );
  }

  if (phase.at === 'results') {
    const wrong = phase.round.filter((i) => !right(i));
    const got = phase.round.length - wrong.length;
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-4">
          <p className="m-0 text-5xl font-black">
            {got} / {phase.round.length}
          </p>
          <p className="m-0 pb-1">
            {wrong.length === 0
              ? 'Perfect! Steady lah.'
              : got / phase.round.length >= 0.7
                ? 'Solid. Fix the few below and you’re set.'
                : 'Not there yet. Go through the answers, then retry the wrong ones.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wrong.length > 0 && (
            <button
              type="button"
              onClick={() => start(wrong, 'practice')}
              className={`push ${BTN} shadow-hard`}
              style={{ background: ACCENT }}
            >
              Retry the {wrong.length} wrong
            </button>
          )}
          <button type="button" onClick={() => setPhase({ at: 'setup' })} className={BTN}>
            New round
          </button>
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {phase.round.map((i, n) => {
            const q = bank[i]!;
            const ok = right(i);
            const given = answers[i];
            return (
              <li
                key={i}
                className="flex flex-col gap-1 border-3 border-ink p-3"
                style={{ borderLeft: `12px solid ${ok ? GOOD : 'var(--color-hot)'}` }}
              >
                <p className="m-0 font-bold">
                  {n + 1}. {q.question}
                </p>
                <p className="m-0 text-sm">
                  {ok ? '✓ ' : '✗ '}
                  Your answer: {given === undefined ? '(none)' : responseText(q, given)}
                  {!ok && (
                    <>
                      {' '}
                      · Right answer: <b>{answerText(q)}</b>
                    </>
                  )}
                </p>
                {q.why && <p className="m-0 text-sm text-mute">{q.why}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <TakeQuiz bank={bank} onStart={start} />
      {bank.some((q) => q.type !== 'short') && (
        <button
          type="button"
          onClick={() => navigate('/notes-game', { state: { draftId } })}
          className="push flex min-h-16 cursor-pointer flex-col items-start justify-center gap-0.5 border-3 border-ink bg-[#ff8fd0] px-4 py-3 text-left shadow-hard"
        >
          <span className="text-lg font-black uppercase">Play it with the class →</span>
          <span className="font-mono text-xs">
            Questions on the big screen, everyone answers on their phone.
          </span>
        </button>
      )}
      <AddQuestions notes={notes} draftId={draftId} onChange={onChange} />
    </div>
  );
}

function responseText(q: QuizQuestion, r: Response): string {
  if (q.type === 'tf') return r === true ? 'True' : 'False';
  if (q.type === 'short') return String(r);
  return typeof r === 'number' ? (q.options[r] ?? '?') : '?';
}

// ---------- settings ----------

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold ${on ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs uppercase">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

function TakeQuiz({
  bank,
  onStart,
}: {
  bank: readonly QuizQuestion[];
  onStart: (round: number[], mode: QuizMode) => void;
}) {
  const counts = kindCounts(bank);
  const present = KINDS.filter((k) => counts[k] > 0);
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>('practice');
  const [kinds, setKinds] = useState<QuestionKind[]>(present);
  const chosen = kinds.filter((k) => counts[k] > 0);
  const available = chosen.reduce((n, k) => n + counts[k], 0);
  const size = count === 0 ? available : Math.min(count, available);

  if (!bank.length) {
    return <p className="m-0">No questions yet. Add some below.</p>;
  }

  return (
    <section className="flex flex-col gap-4 border-3 border-ink p-4 shadow-hard">
      <h2 className="m-0 text-xl font-black uppercase">Take a quiz</h2>
      <p className="m-0 font-mono text-xs">
        {bank.length} questions in this set:{' '}
        {present.map((k) => `${counts[k]} ${KIND_NAME[k].toLowerCase()}`).join(' · ')}
      </p>
      <Row label="How many">
        {[10, 20, 0].map((n) => (
          <Chip key={n} on={count === n} onClick={() => setCount(n)}>
            {n === 0 ? `All ${available}` : n}
          </Chip>
        ))}
      </Row>
      {present.length > 1 && (
        <Row label="Kinds">
          {present.map((k) => (
            <Chip
              key={k}
              on={kinds.includes(k)}
              onClick={() =>
                setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))
              }
            >
              {KIND_NAME[k]}
            </Chip>
          ))}
        </Row>
      )}
      <Row label="Mode">
        <Chip on={mode === 'practice'} onClick={() => setMode('practice')}>
          Practice: answers as you go
        </Chip>
        <Chip on={mode === 'exam'} onClick={() => setMode('exam')}>
          Exam: timed, answers at the end
        </Chip>
      </Row>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={size === 0}
          onClick={() =>
            onStart(pickRound(bank, { count, mode, kinds: chosen }, Math.random), mode)
          }
          className={`push ${BTN} shadow-hard`}
          style={{ background: ACCENT }}
        >
          Start {size} questions
        </button>
        {mode === 'exam' && size > 0 && (
          <span className="font-mono text-xs">{examSeconds(size) / 60} minutes on the clock</span>
        )}
      </div>
    </section>
  );
}

function AddQuestions({ notes, draftId, onChange }: Props) {
  const [size, setSize] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [kinds, setKinds] = useState<QuestionKind[]>(['mc', 'tf', 'short']);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const room = MAX_QUESTIONS - notes.quiz.length;

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      // The original file if it's still on this device, otherwise the notes themselves.
      const source = (await loadSource(draftId)) ?? { text: notesAsSource(notes) };
      const res = await fetch('/api/ai-notes', {
        method: 'POST',
        headers: await aiHeaders(),
        body: JSON.stringify({
          ...source,
          mode: 'quiz',
          count: Math.min(size, room),
          difficulty,
          kinds,
          avoid: notes.quiz.map((q) => q.question).slice(-120),
        }),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        throw new Error((body as { error?: string } | null)?.error ?? 'Could not make questions.');
      }
      const parsed = MoreQuestionsSchema.safeParse(body);
      if (!parsed.success)
        throw new Error('The questions came back in a strange shape. Try again.');
      const fresh = withoutRepeats(notes.quiz, parsed.data.questions).slice(0, room);
      onChange({ ...notes, quiz: [...notes.quiz, ...fresh] });
      setStatus({ ok: true, text: `Added ${fresh.length} questions.` });
    } catch (err) {
      setStatus({
        ok: false,
        text: err instanceof Error ? err.message : 'Could not make questions.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void add(e)} className="flex flex-col gap-4 border-3 border-ink p-4">
      <h2 className="m-0 text-xl font-black uppercase">Add more questions</h2>
      {room <= 0 ? (
        <p className="m-0">
          This set is full ({MAX_QUESTIONS} questions). Make notes from another file.
        </p>
      ) : (
        <>
          <Row label="How many">
            {ADD_SIZES.map((n) => (
              <Chip key={n} on={size === n} onClick={() => setSize(n)}>
                {n}
              </Chip>
            ))}
          </Row>
          <Row label="Difficulty">
            {(['easy', 'mixed', 'hard'] as const).map((d) => (
              <Chip key={d} on={difficulty === d} onClick={() => setDifficulty(d)}>
                {d[0]!.toUpperCase() + d.slice(1)}
              </Chip>
            ))}
          </Row>
          <Row label="Kinds">
            {KINDS.map((k) => (
              <Chip
                key={k}
                on={kinds.includes(k)}
                onClick={() =>
                  setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))
                }
              >
                {KIND_NAME[k]}
              </Chip>
            ))}
          </Row>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || kinds.length === 0}
              className={`${BTN_BASE} bg-ink text-paper`}
            >
              {busy ? 'Writing questions... (about 20 s)' : `Add ${Math.min(size, room)} questions`}
            </button>
            <p role="status" className="m-0 font-mono text-sm font-bold">
              {status && (status.ok ? '✓ ' : '') + status.text}
            </p>
          </div>
          <p className="m-0 text-xs text-mute">
            Made from your original file if it’s still saved here, otherwise from these notes. New
            questions skip ones the set already has.
          </p>
        </>
      )}
    </form>
  );
}

// ---------- answering ----------

function Answer({
  q,
  value,
  onAnswer,
  locked,
  name,
}: {
  q: QuizQuestion;
  value: Response | undefined;
  onAnswer: (r: Response) => void;
  locked: boolean;
  name: string;
}) {
  const [typed, setTyped] = useState(typeof value === 'string' ? value : '');
  const kind = kindOf(q);
  const reveal = locked && value !== undefined;

  if (kind === 'short') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) onAnswer(typed);
        }}
        className="flex flex-wrap gap-2"
      >
        <label htmlFor={name} className="sr-only">
          Your answer
        </label>
        <input
          id={name}
          value={typed}
          disabled={locked}
          onChange={(e) => {
            setTyped(e.target.value);
            if (!locked && name.startsWith('exam')) onAnswer(e.target.value);
          }}
          autoComplete="off"
          placeholder="Type your answer"
          className="min-h-12 min-w-0 flex-1 border-3 border-ink bg-paper px-3 text-base"
        />
        {!name.startsWith('exam') && (
          <button type="submit" disabled={locked || !typed.trim()} className={BTN}>
            Check
          </button>
        )}
      </form>
    );
  }

  const choices: { label: string; r: Response }[] =
    q.type === 'tf'
      ? [
          { label: 'True', r: true },
          { label: 'False', r: false },
        ]
      : (q as { options: string[] }).options.map((o, j) => ({
          label: `${String.fromCharCode(65 + j)}. ${o}`,
          r: j,
        }));

  return (
    <div className={`grid gap-2 ${q.type === 'tf' ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
      {choices.map((c) => {
        const picked = value === c.r;
        const isRight = isCorrect(q, c.r);
        const bg = reveal
          ? isRight
            ? 'bg-[#7ee081]'
            : picked
              ? 'bg-hot'
              : 'bg-paper'
          : picked
            ? 'bg-ink text-paper'
            : 'bg-paper';
        return (
          <button
            key={String(c.r)}
            type="button"
            aria-pressed={picked}
            disabled={locked}
            onClick={() => onAnswer(c.r)}
            className={`min-h-12 cursor-pointer border-3 border-ink px-3 py-2 text-left font-bold disabled:cursor-default ${bg}`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function PracticeRound({
  bank,
  round,
  answers,
  setAnswer,
  overrides,
  markRight,
  onFinish,
  onQuit,
}: {
  bank: readonly QuizQuestion[];
  round: number[];
  answers: Record<number, Response>;
  setAnswer: (i: number, r: Response) => void;
  overrides: Record<number, true>;
  markRight: (i: number) => void;
  onFinish: () => void;
  onQuit: () => void;
}) {
  const [n, setN] = useState(0);
  const i = round[n]!;
  const q = bank[i]!;
  const answered = answers[i] !== undefined;
  const ok = overrides[i] === true || isCorrect(q, answers[i]);
  const score = round
    .slice(0, n + (answered ? 1 : 0))
    .filter((k) => overrides[k] === true || isCorrect(bank[k]!, answers[k])).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between font-mono text-xs uppercase">
        <span>
          Question {n + 1} of {round.length} · score {score}
        </span>
        <button
          type="button"
          onClick={onQuit}
          className="min-h-11 cursor-pointer border-0 bg-transparent font-mono text-xs underline"
        >
          Stop
        </button>
      </div>
      <p className="m-0 text-xl font-bold">{q.question}</p>
      <Answer
        key={i}
        q={q}
        name={`q-${i}`}
        value={answers[i]}
        locked={answered}
        onAnswer={(r) => setAnswer(i, r)}
      />
      {answered && (
        <div className="flex flex-col gap-3" role="status">
          <p className="m-0">
            <b>{ok ? 'Correct! ' : 'Not quite. '}</b>
            {!ok && (
              <>
                Answer: <b>{answerText(q)}</b>.{' '}
              </>
            )}
            {q.why}
          </p>
          <div className="flex flex-wrap gap-2">
            {!ok && q.type === 'short' && (
              <button type="button" onClick={() => markRight(i)} className={BTN}>
                I was right
              </button>
            )}
            <button
              type="button"
              onClick={() => (n + 1 < round.length ? setN(n + 1) : onFinish())}
              className={`push ${BTN_BASE} bg-ink text-paper shadow-hard`}
            >
              {n + 1 < round.length ? 'Next' : 'See score'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Exam({
  bank,
  round,
  endsAt,
  answers,
  setAnswer,
  onFinish,
}: {
  bank: readonly QuizQuestion[];
  round: number[];
  endsAt: number;
  answers: Record<number, Response>;
  setAnswer: (i: number, r: Response) => void;
  onFinish: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= endsAt) onFinish();
    }, 500);
    return () => clearInterval(t);
  }, [endsAt, onFinish]);

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const answered = round.filter((i) => answers[i] !== undefined && answers[i] !== '').length;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-3 border-3 border-ink bg-paper p-3 shadow-hard-sm">
        <span
          className={`font-mono text-2xl font-bold ${left <= 60 ? 'text-hot' : ''}`}
          aria-label={`${clock} left`}
          role="timer"
        >
          {clock}
        </span>
        <span className="font-mono text-sm">
          {answered} of {round.length} answered
        </span>
        <button
          type="button"
          onClick={() => {
            if (answered < round.length && !window.confirm('Hand in with some questions blank?')) {
              return;
            }
            onFinish();
          }}
          className={`push ${BTN_BASE} bg-ink text-paper shadow-hard-sm`}
        >
          Hand in
        </button>
      </div>
      <ol className="m-0 flex list-none flex-col gap-6 p-0">
        {round.map((i, n) => (
          <li key={i} className="flex flex-col gap-2">
            <p className="m-0 font-bold">
              {n + 1}. {bank[i]!.question}
            </p>
            <Answer
              q={bank[i]!}
              name={`exam-${i}`}
              value={answers[i]}
              locked={false}
              onAnswer={(r) => setAnswer(i, r)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
