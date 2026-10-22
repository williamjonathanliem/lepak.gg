import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { Confetti } from '../../components/Confetti';
import { NicknameGate } from '../katabomb/ui/NicknameGate';
import { aiHeaders } from '../../lib/aiHeaders';
import { firebaseEnabled } from '../../lib/firebase';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import { useGoneFor } from '../../lib/useGoneFor';
import { loadDrafts } from '../ai-notes/logic/drafts';
import { aiFileChecks } from '../ai-notes/logic/notes';
import { readFile } from '../ai-notes/logic/readFile';
import { formatBytes } from '../device-drop/logic/transfer';
import { DropZone } from '../notes/ui/DropZone';
import { MoreQuestionsSchema } from '../ai-notes/logic/quiz';
import {
  MAX_PLAYERS,
  SECONDS_PER_QUESTION,
  leaderboard,
  scoreQuestion,
  tally,
  toPlayable,
  type Answer,
  type Playable,
} from './logic/game';
import {
  openQuizRoom,
  type QuizGame,
  type QuizRoom,
  type QuizState,
  type Reveal,
  type Secret,
} from './net/quizRoom';

// Notes → Game: /notes-game (pick or make questions), /notes-game/host/:code (the big
// screen) and /notes-game/r/:code (players' phones). The host's screen runs the game:
// it opens each question, then scores and reveals it.

const ACCENT = '#ff8fd0';
const OPTION_COLOURS = ['#ff8fd0', '#4fd1e8', '#ffd23f', '#7ee081'];
const OPTION_SHAPES = ['▲', '◆', '●', '■'];
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const BTN = `${BTN_BASE} bg-paper text-ink`;

export default function NotesToGame() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Notes → Game', to: '/notes-game', accent: ACCENT }} />
      <Routes>
        <Route index element={<Setup />} />
        <Route path="host/:code" element={<CodeRoute screen="host" />} />
        <Route path="r/:code" element={<CodeRoute screen="player" />} />
      </Routes>
    </div>
  );
}

function CodeRoute({ screen }: { screen: 'host' | 'player' }) {
  const { code: raw = '' } = useParams();
  const code = normalizeRoomCode(raw);
  if (!isValidRoomCode(code)) return <Navigate to="/notes-game" replace />;
  return screen === 'host' ? (
    <Host key={code} code={code} />
  ) : (
    <NicknameGate>{(nick) => <Player key={code} code={code} nick={nick} />}</NicknameGate>
  );
}

/** Opens the room and keeps everything in state. */
function useQuiz(code: string) {
  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [game, setGame] = useState<QuizGame | null | undefined>(undefined);
  const [state, setState] = useState<QuizState>({ phase: 'lobby', index: 0, openedAt: 0 });
  const [players, setPlayers] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hostHere, setHostHere] = useState(true);
  const [failed, setFailed] = useState(!firebaseEnabled);
  useEffect(() => {
    if (!firebaseEnabled) return;
    let r: QuizRoom | null = null;
    let closed = false;
    openQuizRoom(code)
      .then((opened) => {
        if (closed) return opened.close();
        r = opened;
        setRoom(opened);
        opened.onGame(setGame, () => setFailed(true));
        opened.onState(setState);
        opened.onPlayers(setPlayers);
        opened.onScores(setScores);
        opened.onHostHere(setHostHere);
      })
      .catch(() => setFailed(true));
    return () => {
      closed = true;
      r?.close();
    };
  }, [code]);
  return { room, game, state, players, scores, hostHere, failed };
}

/** Live answers (or the reveal) for the current question. */
function useQuestion(room: QuizRoom | null, index: number) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [reveal, setReveal] = useState<Reveal | null>(null);
  useEffect(() => {
    if (!room) return;
    const offA = room.onAnswers(index, setAnswers);
    const offR = room.onReveal(index, setReveal);
    return () => {
      offA();
      offR();
      setAnswers({});
      setReveal(null);
    };
  }, [room, index]);
  return { answers, reveal };
}

// ---------- setup ----------

function Setup() {
  const navigate = useNavigate();
  const handedDraft = (useLocation().state as { draftId?: string } | null)?.draftId;
  const [drafts] = useState(() =>
    loadDrafts()
      .map((d) => ({ id: d.id, title: d.data.title, questions: toPlayable(d.data.quiz) }))
      .filter((d) => d.questions.length >= 3),
  );
  const [picked, setPicked] = useState<{ title: string; questions: Playable[] } | null>(() => {
    const d = drafts.find((x) => x.id === handedDraft);
    return d ? { title: d.title, questions: d.questions } : null;
  });
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState(10);
  const [seconds, setSeconds] = useState(SECONDS_PER_QUESTION);
  const [busy, setBusy] = useState<'ai' | 'room' | null>(null);
  const [error, setError] = useState('');

  async function makeQuestions() {
    setBusy('ai');
    setError('');
    try {
      // A dropped file is read the same way as AI Notes: PDFs go as they are, slides and
      // Word files are turned into text on this device first.
      const source = file ? await readFile(file) : { text };
      if (source.text !== undefined) source.text = source.text.slice(0, 60_000);
      const res = await fetch('/api/ai-notes', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          ...source,
          fileName: file?.name,
          mode: 'quiz',
          count,
          difficulty: 'mixed',
          kinds: ['mc', 'tf'],
          avoid: [],
        }),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? '');
      const parsed = MoreQuestionsSchema.safeParse(body);
      const questions = parsed.success ? toPlayable(parsed.data.questions) : [];
      if (questions.length < 3) throw new Error('Not enough questions came back. Try again.');
      const title = file
        ? file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
        : text.trim().split('\n')[0]!;
      setPicked({ title: title.slice(0, 50) || 'Quiz', questions });
    } catch (e) {
      setError((e instanceof Error && e.message) || 'Could not make questions. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function openRoom() {
    if (!picked) return;
    setBusy('room');
    setError('');
    try {
      for (let tries = 0; tries < 5; tries++) {
        const c = generateRoomCode();
        const room = await openQuizRoom(c);
        try {
          await room.create(
            {
              hostId: room.selfId,
              title: picked.title.slice(0, 60),
              questions: picked.questions.map(({ q, options }) => ({ q, options })),
              limitSec: seconds,
            },
            {
              answers: picked.questions.map((q) => q.answer),
              whys: picked.questions.map((q) => q.why.slice(0, 300)),
            },
          );
          navigate(`/notes-game/host/${c}`);
          return;
        } catch (err) {
          if (!(err instanceof Error && err.message === 'taken')) throw err;
        } finally {
          room.close();
        }
      }
      throw new Error('busy');
    } catch {
      setError('Could not open a room. Check your internet and try again.');
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Notes → Game · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Notes → Game.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          Turn your slides, PDF or notes into a live quiz. AI writes the questions, they go on the
          big screen, everyone answers on their phone, fastest right answers win.
        </p>
      </div>

      {picked ? (
        <section
          className="flex flex-col gap-4 border-3 border-ink p-4 shadow-hard"
          style={{ background: ACCENT }}
        >
          <h2 className="m-0 text-xl font-black uppercase">Ready: {picked.title}</h2>
          <p className="m-0 font-mono text-sm">{picked.questions.length} questions</p>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-bold uppercase">Seconds per question</span>
            <div role="group" aria-label="Seconds per question" className="flex gap-1.5">
              {[10, 20, 30].map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={seconds === s}
                  onClick={() => setSeconds(s)}
                  className={`min-h-11 min-w-14 cursor-pointer border-3 border-ink font-mono text-sm font-bold ${seconds === s ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null || !firebaseEnabled}
              onClick={() => void openRoom()}
              className={`push ${BTN_BASE} bg-ink text-paper shadow-hard-sm`}
            >
              {busy === 'room' ? 'Opening...' : 'Open the room →'}
            </button>
            <button type="button" onClick={() => setPicked(null)} className={BTN}>
              Pick other questions
            </button>
          </div>
        </section>
      ) : (
        <>
          {drafts.length > 0 && (
            <section aria-labelledby="from-notes" className="flex flex-col gap-2">
              <h2 id="from-notes" className="m-0 text-xl font-black uppercase">
                From your AI Notes
              </h2>
              <ul className="m-0 flex list-none flex-col border-3 border-ink p-0">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-ink px-4 py-2 not-last:border-b-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{d.title}</span>
                      <span className="font-mono text-xs">{d.questions.length} questions</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicked({ title: d.title, questions: d.questions })}
                      className={`${BTN_BASE} bg-[#ff8fd0]`}
                    >
                      Use these
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="from-text" className="flex flex-col gap-2">
            <h2 id="from-text" className="m-0 text-xl font-black uppercase">
              {drafts.length ? 'Or make a quiz from a file' : 'Make a quiz from a file'}
            </h2>
            <DropZone
              onFile={async (f) => {
                const failed = aiFileChecks(
                  f,
                  'Questions are made, then the file is forgotten',
                ).find((c) => !c.ok);
                setFile(failed ? null : f);
                return failed ? failed.label : null;
              }}
              picked={file ? `${file.name} (${formatBytes(file.size)})` : null}
              checksFor={(f) => aiFileChecks(f, 'Questions are made, then the file is forgotten')}
              accept=".pdf,.pptx,.docx,.txt,.md"
              title="Drop slides, a PDF or notes"
              hint=".pdf up to 3 MB, .pptx / .docx / .txt up to 30 MB"
              extra={
                file && (
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-xs underline"
                  >
                    Paste text instead
                  </button>
                )
              }
            />
            {!file && (
              <>
                <label htmlFor="game-text" className="font-mono text-xs uppercase">
                  Or paste your notes
                </label>
                <textarea
                  id="game-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Paste a chapter or your lecture notes."
                  className="border-3 border-ink bg-paper p-3 text-base"
                />
              </>
            )}
            <div role="group" aria-label="How many questions" className="flex items-center gap-1.5">
              <span className="mr-1 font-mono text-xs font-bold uppercase">Questions</span>
              {[10, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={count === n}
                  onClick={() => setCount(n)}
                  className={`min-h-11 min-w-12 cursor-pointer border-3 border-ink font-mono text-sm font-bold ${count === n ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy !== null || (!file && text.trim().length < 80)}
              onClick={() => void makeQuestions()}
              className={`push ${BTN_BASE} w-fit shadow-hard-sm`}
              style={{ background: ACCENT }}
            >
              {busy === 'ai' ? 'Writing questions... (about 20 s)' : `Make ${count} questions`}
            </button>
            {!drafts.length && (
              <p className="m-0 font-mono text-xs text-mute">
                Tip: notes made in AI Notes show up here with their quiz ready to play.
              </p>
            )}
          </section>
        </>
      )}
      {error && <p className="m-0 font-mono text-sm font-bold">! {error}</p>}
    </main>
  );
}

// ---------- the big screen ----------

function Host({ code }: { code: string }) {
  const { room, game, state, players, scores, failed } = useQuiz(code);
  const { answers, reveal } = useQuestion(room, state.index);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [qr, setQr] = useState<string | null>(null);
  const finishing = useRef(-1);
  /** The question the host chose to end early. */
  const [endedEarly, setEndedEarly] = useState(-1);
  const joinUrl = `${location.origin}/notes-game/r/${code}`;

  useEffect(() => {
    if (!room) return;
    room.markHostHere();
    void room.readSecret().then(setSecret);
    const t = setInterval(() => setNow(room.now()), 250);
    return () => clearInterval(t);
  }, [room]);
  useEffect(() => {
    let alive = true;
    void import('qrcode').then((QR) =>
      QR.toDataURL(joinUrl, { margin: 1, width: 360 }).then((url) => alive && setQr(url)),
    );
    return () => {
      alive = false;
    };
  }, [joinUrl]);

  const limitMs = (game?.limitSec ?? 20) * 1000;
  const playerCount = Object.keys(players).length;
  const answered = Object.keys(answers).length;
  const left = Math.max(0, state.openedAt + limitMs - now);
  const timeUp = state.phase === 'question' && state.openedAt > 0 && left === 0;
  const allIn = state.phase === 'question' && playerCount > 0 && answered >= playerCount;

  // Close the question when time's up or everyone has answered (once per question).
  useEffect(() => {
    const early = endedEarly === state.index && state.phase === 'question';
    if (!(timeUp || allIn || early) || !room || !secret || !game) return;
    if (finishing.current === state.index) return;
    finishing.current = state.index;
    const answer = secret.answers[state.index] ?? 0;
    void room.finishQuestion(
      state.index,
      {
        answer,
        why: secret.whys[state.index] ?? '',
        tally: tally(answers, game.questions[state.index]?.options.length ?? 4),
      },
      scoreQuestion(scores, answers, answer, state.openedAt, limitMs),
    );
  }, [timeUp, allIn, endedEarly, room, secret, game, state, answers, scores, limitMs]);

  if (failed) return <Message>Could not open this room. Check your internet.</Message>;
  if (game === undefined) return <Message>Opening the room...</Message>;
  if (game === null) return <Message>No game with the code {code}.</Message>;
  if (room && game.hostId !== room.selfId) {
    return <Navigate to={`/notes-game/r/${code}`} replace />;
  }

  const q = game.questions[state.index];
  const last = state.index >= game.questions.length - 1;
  const board = leaderboard(scores, players);

  // Lobby
  if (state.phase === 'lobby') {
    return (
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-gutter py-10 lg:grid-cols-[1fr_1fr]">
        <title>{`${code} · Notes → Game`}</title>
        <div className="flex flex-col gap-4">
          <p className="m-0 font-mono text-lg uppercase">Join on your phone</p>
          <p className="m-0 font-mono text-xl break-all">{joinUrl.replace(/^https?:\/\//, '')}</p>
          <p className="m-0 text-[clamp(72px,14vw,160px)] leading-none font-black tracking-[0.08em]">
            {code}
          </p>
          {qr && <img src={qr} alt="QR code to join" className="w-56 border-3 border-ink" />}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="m-0 text-[clamp(28px,4vw,44px)] leading-tight font-black uppercase">
            {game.title}
          </h1>
          <p className="m-0 font-mono">
            {game.questions.length} questions · {game.limitSec}s each · {playerCount} joined
          </p>
          <ul className="m-0 flex min-h-24 list-none flex-wrap content-start gap-2 border-3 border-dashed border-ink p-3">
            {Object.entries(players).map(([uid, nick]) => (
              <li
                key={uid}
                className="animate-pop border-3 border-ink bg-paper px-3 py-1 font-bold"
              >
                {nick}
              </li>
            ))}
            {playerCount === 0 && (
              <li className="font-mono text-sm text-mute">Waiting for players...</li>
            )}
          </ul>
          <button
            type="button"
            disabled={playerCount === 0 || !secret}
            onClick={() => void room?.setState({ phase: 'question', index: 0, stamp: true })}
            className={`push ${BTN_BASE} min-h-14 w-fit text-lg shadow-hard`}
            style={{ background: ACCENT }}
          >
            Start the game →
          </button>
        </div>
      </main>
    );
  }

  // Final results
  if (state.phase === 'end') {
    const podium = board.slice(0, 3);
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-8 px-gutter py-10">
        <title>Results · Notes → Game</title>
        <h1 className="m-0 text-[clamp(36px,6vw,64px)] font-black uppercase">Results</h1>
        <ol className="m-0 flex list-none items-end justify-center gap-3 p-0">
          {[1, 0, 2].map((i) =>
            podium[i] ? (
              <li key={podium[i].uid} className="flex flex-col items-center gap-2">
                <span className="text-xl font-black">{podium[i].nick}</span>
                <span className="font-mono text-sm">{podium[i].score} pts</span>
                <span
                  className="grid w-28 place-items-center border-3 border-ink text-4xl font-black"
                  style={{ height: [180, 130, 100][i], background: OPTION_COLOURS[i] }}
                >
                  {podium[i].rank}
                </span>
              </li>
            ) : null,
          )}
        </ol>
        <Board board={board.slice(3, 10)} />
        <Confetti />
      </main>
    );
  }

  // Question or reveal
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-gutter py-8">
      <title>{`Q${state.index + 1} · Notes → Game`}</title>
      <div className="flex items-center justify-between font-mono text-sm uppercase">
        <span>
          Question {state.index + 1} of {game.questions.length} · code {code}
        </span>
        <span>
          {answered} / {playerCount} answered
        </span>
      </div>
      <h1 className="m-0 text-center text-[clamp(26px,4vw,48px)] leading-tight font-black">
        {q?.q}
      </h1>
      {state.phase === 'question' && (
        <p className="m-0 text-center text-6xl font-black tabular-nums">{Math.ceil(left / 1000)}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {q?.options.map((o, i) => {
          const right = reveal && reveal.answer === i;
          const dim = reveal && !right;
          return (
            <div
              key={i}
              className={`flex min-h-20 items-center gap-4 border-3 border-ink px-5 py-3 text-[clamp(18px,2.4vw,28px)] font-bold ${dim ? 'opacity-35' : ''}`}
              style={{ background: OPTION_COLOURS[i] }}
            >
              <span aria-hidden="true">{OPTION_SHAPES[i]}</span>
              <span className="flex-1">{o}</span>
              {reveal && (
                <span className="font-mono text-base">
                  {reveal.tally[i] ?? 0} {right ? '✓' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {state.phase === 'reveal' && reveal && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-3">
            {reveal.why && (
              <p className="m-0 border-3 border-ink bg-paper p-4 text-lg">{reveal.why}</p>
            )}
            <button
              type="button"
              onClick={() =>
                void room?.setState(
                  last
                    ? { phase: 'end', index: state.index }
                    : { phase: 'question', index: state.index + 1, stamp: true },
                )
              }
              className={`push ${BTN_BASE} min-h-14 w-fit bg-ink text-lg text-paper shadow-hard`}
            >
              {last ? 'See the results →' : 'Next question →'}
            </button>
          </div>
          <Board board={board.slice(0, 5)} />
        </div>
      )}
      {state.phase === 'question' && (
        <button
          type="button"
          onClick={() => setEndedEarly(state.index)}
          className={`${BTN} w-fit self-center`}
        >
          End question now
        </button>
      )}
    </main>
  );
}

function Board({ board }: { board: ReturnType<typeof leaderboard> }) {
  if (!board.length) return null;
  return (
    <ol className="m-0 flex w-full max-w-xl list-none flex-col border-3 border-ink p-0">
      {board.map((r) => (
        <li
          key={r.uid}
          className="flex items-center gap-3 border-ink bg-paper px-4 py-2 not-last:border-b-2"
        >
          <span className="w-8 font-mono font-bold">{r.rank}</span>
          <span className="flex-1 truncate font-bold">{r.nick}</span>
          <span className="font-mono">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------- players' phones ----------

function Player({ code, nick }: { code: string; nick: string }) {
  const { room, game, state, players, scores, hostHere, failed } = useQuiz(code);
  const { answers, reveal } = useQuestion(room, state.index);
  const hostGone = useGoneFor(hostHere);
  const joined = useRef(false);

  useEffect(() => {
    if (!room || !game || joined.current) return;
    if (Object.keys(players).length >= MAX_PLAYERS && !players[room.selfId]) return;
    joined.current = true;
    void room.join(nick);
  }, [room, game, players, nick]);

  if (failed) return <Message>Could not join. Check your internet.</Message>;
  if (game === undefined) return <Message>Joining...</Message>;
  if (game === null)
    return <Message>No game with the code {code}. Check the code on the screen.</Message>;
  if (hostGone && state.phase !== 'end') {
    return <Message>The host closed the game. Thanks for playing!</Message>;
  }

  const me = room?.selfId ?? '';
  const mine = answers[me];
  const q = game.questions[state.index];
  const board = leaderboard(scores, players);
  const myRow = board.find((r) => r.uid === me);

  if (state.phase === 'lobby') {
    return (
      <Center>
        <p className="m-0 font-mono text-sm uppercase">You’re in, {nick}!</p>
        <p className="m-0 text-3xl font-black uppercase">{game.title}</p>
        <p className="m-0">Look at the big screen. The game starts soon.</p>
        <p className="m-0 font-mono text-sm">{Object.keys(players).length} players</p>
      </Center>
    );
  }

  if (state.phase === 'end') {
    return (
      <Center>
        <p className="m-0 font-mono text-sm uppercase">Final</p>
        <p className="m-0 text-6xl font-black">#{myRow?.rank ?? '-'}</p>
        <p className="m-0 font-mono">{myRow?.score ?? 0} points</p>
        {myRow?.rank === 1 && <Confetti />}
      </Center>
    );
  }

  if (state.phase === 'reveal') {
    const right = reveal ? mine?.choice === reveal.answer : false;
    return (
      <Center bg={mine ? (right ? '#7ee081' : 'var(--color-hot)') : undefined}>
        <p className="m-0 text-4xl font-black uppercase">
          {!mine ? 'Too slow!' : right ? 'Correct!' : 'Not quite'}
        </p>
        {reveal && q && (
          <p className="m-0">
            Answer: <b>{q.options[reveal.answer]}</b>
          </p>
        )}
        <p className="m-0 font-mono">
          {myRow?.score ?? 0} points · #{myRow?.rank ?? '-'}
        </p>
      </Center>
    );
  }

  // question
  return (
    <main className="flex flex-1 flex-col gap-4 px-gutter py-6">
      <title>{`Q${state.index + 1} · Notes → Game`}</title>
      <p className="m-0 font-mono text-xs uppercase">
        Question {state.index + 1} of {game.questions.length}
      </p>
      <p className="m-0 text-xl font-bold">{q?.q}</p>
      {mine ? (
        <Center>
          <p className="m-0 text-3xl font-black uppercase">Locked in</p>
          <p className="m-0">
            You picked <b>{q?.options[mine.choice]}</b>. Waiting for the others...
          </p>
        </Center>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          {q?.options.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => void room?.answer(state.index, i)}
              className="flex min-h-20 cursor-pointer items-center gap-3 border-3 border-ink px-4 text-left text-lg font-bold shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
              style={{ background: OPTION_COLOURS[i] }}
            >
              <span aria-hidden="true" className="text-2xl">
                {OPTION_SHAPES[i]}
              </span>
              {o}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

function Center({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <main
      className="flex flex-1 flex-col items-center justify-center gap-3 px-gutter py-12 text-center"
      style={bg ? { background: bg } : undefined}
    >
      {children}
    </main>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-gutter py-16">
      <p className="m-0 border-3 border-ink p-5 font-mono text-sm">{children}</p>
    </main>
  );
}
