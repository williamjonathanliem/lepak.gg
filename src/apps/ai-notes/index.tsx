import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { DRAFT_DAYS, deleteDraft, draftAge, loadDrafts, saveDraft } from './logic/drafts';
import { formatBytes } from '../device-drop/logic/transfer';
import { DropZone } from '../notes/ui/DropZone';
import { readFile } from './logic/readFile';
import { NotesSchema, aiFileChecks, bingoWords, toMarkdown, type Notes } from './logic/notes';

// AI Notes: drop a PDF, slides or Word file (or paste text) and get a summary, key terms,
// flashcards and a quiz. The server side is a Genkit flow calling Gemini (api/_lib/aiNotes.ts).

const ACCENT = '#ffd23f';
const MAX_TEXT = 60_000;

type Tab = 'notes' | 'cards' | 'quiz';

export default function AiNotes() {
  const [notes, setNotes] = useState<Notes | null>(null);
  return (
    <div className="min-h-dvh">
      <title>AI Notes · Lepak.gg</title>
      <AppHeader app={{ name: 'AI Notes', to: '/ai-notes', accent: ACCENT }} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)]">
        {notes ? (
          <Result notes={notes} onReset={() => setNotes(null)} />
        ) : (
          <Maker
            onDone={(n) => {
              saveDraft(n); // kept on this device for a week
              setNotes(n);
            }}
            onOpen={setNotes}
          />
        )}
      </main>
    </div>
  );
}

// ---------- input ----------

function Maker({ onDone, onOpen }: { onDone: (n: Notes) => void; onOpen: (n: Notes) => void }) {
  const [drafts, setDrafts] = useState(() => loadDrafts());
  // A file dropped on the landing page arrives here and goes straight into the box.
  const handed = (useLocation().state as { file?: File } | null)?.file;
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A file landed: keep it if every check passed, otherwise say what's wrong. */
  async function take(f: File): Promise<string | null> {
    setError(null);
    const failed = aiFileChecks(f).find((c) => !c.ok);
    if (failed) {
      setFile(null);
      return failed.label;
    }
    setFile(f);
    return null;
  }

  async function make() {
    setError(null);
    setBusy(true);
    try {
      const input = file ? await readFile(file) : { text };
      if (input.text !== undefined) {
        input.text = input.text.slice(0, MAX_TEXT);
        if (!input.text.trim()) throw new Error("Couldn't find any text in that.");
      }
      const res = await fetch('/api/ai-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, fileName: file?.name }),
      });
      if (res.status === 404 && res.headers.get('content-type')?.includes('text/html')) {
        throw new Error('AI Notes needs the Lepak server, which this copy is not running.');
      }
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const msg = (body as { error?: string } | null)?.error;
        throw new Error(msg ?? 'Could not make notes. Try again.');
      }
      const parsed = NotesSchema.safeParse(body);
      if (!parsed.success) throw new Error('The notes came back in a strange shape. Try again.');
      onDone(parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make notes. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const ready = !!file || text.trim().length > 40;

  return (
    <>
      <div>
        <h1 className="heading-lg m-0">AI Notes.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          Drop your lecture slides, a PDF or a Word file. Get a summary, key terms, flashcards and a
          quick quiz in about 20 seconds.
        </p>
      </div>

      {/* Same animated drop box as Lepak Pages: marching border, then the checks tick in. */}
      <DropZone
        onFile={take}
        initialFile={handed}
        picked={file ? `${file.name} (${formatBytes(file.size)})` : null}
        checksFor={aiFileChecks}
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ai-text" className="font-mono text-xs uppercase">
            Or paste your notes
          </label>
          <textarea
            id="ai-text"
            value={text}
            maxLength={MAX_TEXT}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a chapter, lecture notes, an article..."
            className="min-h-40 border-3 border-ink bg-paper p-3 text-[15px]"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => void make()}
          className="push h-14 cursor-pointer border-3 border-ink px-8 font-mono text-lg font-bold uppercase shadow-hard disabled:cursor-default disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {busy ? 'Reading...' : 'Make notes'}
        </button>
        {busy && (
          <p role="status" className="m-0 animate-pulse font-mono text-sm">
            Reading it through. Usually 15 to 30 seconds.
          </p>
        )}
      </div>
      <p role="alert" className="m-0 min-h-6 font-mono text-sm font-bold">
        {error ? `! ${error}` : ''}
      </p>
      <p className="m-0 font-mono text-xs text-mute">
        Your file is sent to Google's Gemini to write the notes, then forgotten. Don't upload
        anything private.
      </p>

      {drafts.length > 0 && (
        <section aria-labelledby="drafts-h" className="flex flex-col gap-2">
          <h2 id="drafts-h" className="m-0 text-xl font-black uppercase">
            Your recent notes
          </h2>
          <p className="m-0 font-mono text-xs text-mute">
            Saved on this device for {DRAFT_DAYS} days. Open them again without another AI run.
          </p>
          <ul className="m-0 flex list-none flex-col border-3 border-ink p-0">
            {drafts.map((d) => {
              const age = draftAge(d.savedAt);
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-ink px-4 py-2 not-last:border-b-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{d.data.title}</span>
                    <span className="block font-mono text-xs text-mute">
                      {age.saved} · {age.left}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(d.data)}
                      className="min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold"
                      style={{ background: ACCENT }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrafts(deleteDraft(d.id))}
                      aria-label={`Delete ${d.data.title}`}
                      className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-3 font-mono text-sm"
                    >
                      Delete
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

// ---------- result ----------

function Result({ notes, onReset }: { notes: Notes; onReset: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('notes');
  const [copied, setCopied] = useState(false);
  const words = bingoWords(notes);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'notes', label: 'Notes' },
    { id: 'cards', label: `Flashcards (${notes.flashcards.length})` },
    { id: 'quiz', label: `Quiz (${notes.quiz.length})` },
  ];

  return (
    <>
      <div className="flex flex-col gap-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="m-0 text-[clamp(28px,4vw,44px)] leading-tight font-black">
            {notes.title}
          </h1>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 cursor-pointer border-0 bg-transparent font-mono text-sm underline"
          >
            ← Start over
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              navigate('/pages', { state: { title: notes.title, markdown: toMarkdown(notes) } })
            }
            className="push min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase shadow-hard"
            style={{ background: ACCENT }}
          >
            Publish as a page
          </button>
          <button
            type="button"
            onClick={() => navigate('/bingo', { state: { words } })}
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
            title={words.length < 24 ? 'You may need to add a few more words' : undefined}
          >
            Revision bingo
          </button>
          <button
            type="button"
            onClick={() =>
              navigate('/ai-slides', { state: { title: notes.title, markdown: toMarkdown(notes) } })
            }
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
          >
            Make slides
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
          >
            Save as PDF
          </button>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(toMarkdown(notes)).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div role="tablist" aria-label="Notes sections" className="flex border-b-3 border-ink">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-11 cursor-pointer border-0 px-4 font-mono text-sm font-bold ${tab === t.id ? 'bg-ink text-paper' : 'bg-transparent'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'notes' && <NotesTab notes={notes} />}
        {tab === 'cards' && <Flashcards cards={notes.flashcards} />}
        {tab === 'quiz' && <Quiz quiz={notes.quiz} />}

        <p className="m-0 font-mono text-xs text-mute">
          Made by AI from your file. It can get things wrong: check anything important. Saved on
          this device for {DRAFT_DAYS} days.
        </p>
      </div>
      {/* Only shows when printing / saving as PDF. */}
      <PrintNotes notes={notes} />
    </>
  );
}

function NotesTab({ notes }: { notes: Notes }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-xl font-black uppercase">Summary</h2>
        {notes.summary
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((p, i) => (
            <p key={i} className="m-0 text-[17px] leading-relaxed">
              {p}
            </p>
          ))}
      </section>
      {notes.keyPoints.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-xl font-black uppercase">Key points</h2>
          <ul className="m-0 flex flex-col gap-1.5 pl-5">
            {notes.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      {notes.terms.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-xl font-black uppercase">Key terms</h2>
          <dl className="m-0 grid gap-[2px] bg-ink sm:grid-cols-2">
            {notes.terms.map((t, i) => (
              <div key={i} className="bg-paper p-3">
                <dt className="font-bold">{t.term}</dt>
                <dd className="m-0 text-mute">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

function Flashcards({ cards }: { cards: Notes['flashcards'] }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[i];
  if (!card) return <p className="m-0">No flashcards this time.</p>;
  const go = (d: number) => {
    setFlipped(false);
    setI((n) => (n + d + cards.length) % cards.length);
  };
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Show the question' : 'Show the answer'}
        className="flex min-h-56 w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-3 border-3 border-ink p-6 text-center shadow-hard"
        style={{ background: flipped ? '#f9fafb' : ACCENT }}
      >
        <span className="font-mono text-xs uppercase">{flipped ? 'Answer' : 'Question'}</span>
        <span key={`${i}-${flipped}`} className="animate-pop text-[clamp(18px,3vw,26px)] font-bold">
          {flipped ? card.back : card.front}
        </span>
        <span className="font-mono text-xs text-mute">Tap to flip</span>
      </button>
      <div className="flex items-center gap-4 font-mono text-sm">
        <button
          type="button"
          onClick={() => go(-1)}
          className="min-h-11 min-w-11 cursor-pointer border-3 border-ink bg-paper px-3"
          aria-label="Previous card"
        >
          ←
        </button>
        <span>
          {i + 1} / {cards.length}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="min-h-11 min-w-11 cursor-pointer border-3 border-ink bg-paper px-3"
          aria-label="Next card"
        >
          →
        </button>
      </div>
    </div>
  );
}

function Quiz({ quiz }: { quiz: Notes['quiz'] }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = quiz[i];

  if (!quiz.length) return <p className="m-0">No quiz this time.</p>;
  if (!q) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="m-0 text-3xl font-black">
          {score} / {quiz.length}
        </p>
        <p className="m-0">
          {score === quiz.length
            ? 'Perfect! Steady lah.'
            : 'Not bad. Flip through the flashcards and try again.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setI(0);
            setScore(0);
            setPicked(null);
          }}
          className="push min-h-11 cursor-pointer border-3 border-ink px-4 font-mono font-bold uppercase shadow-hard"
          style={{ background: ACCENT }}
        >
          Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 font-mono text-xs uppercase">
        Question {i + 1} of {quiz.length} · score {score}
      </p>
      <p className="m-0 text-xl font-bold">{q.question}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, j) => {
          const right = picked !== null && j === q.answer;
          const wrong = picked === j && j !== q.answer;
          return (
            <button
              key={j}
              type="button"
              disabled={picked !== null}
              onClick={() => {
                setPicked(j);
                if (j === q.answer) setScore((s) => s + 1);
              }}
              className={`min-h-12 cursor-pointer border-3 border-ink px-3 py-2 text-left font-bold disabled:cursor-default ${
                right ? 'bg-[#7ee081]' : wrong ? 'bg-hot' : 'bg-paper'
              }`}
            >
              {String.fromCharCode(65 + j)}. {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3" role="status">
          <p className="m-0">
            {picked === q.answer ? 'Correct! ' : 'Not quite. '}
            {q.why}
          </p>
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setI((n) => n + 1);
            }}
            className="push min-h-11 cursor-pointer border-3 border-ink bg-ink px-4 font-mono font-bold text-paper uppercase shadow-hard"
          >
            {i + 1 < quiz.length ? 'Next' : 'See score'}
          </button>
        </div>
      )}
    </div>
  );
}

/** The printable version: notes, flashcards and the quiz with answers. Hidden on screen. */
function PrintNotes({ notes }: { notes: Notes }) {
  const h2 = 'mt-4 mb-1 text-[14pt] font-black uppercase';
  return (
    <article className="hidden text-[12pt] leading-normal text-black print:block">
      <h1 className="m-0 mb-2 text-[22pt] font-black">{notes.title}</h1>
      <h2 className={h2}>Summary</h2>
      {notes.summary
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="m-0 mb-2">
            {p}
          </p>
        ))}
      {notes.keyPoints.length > 0 && (
        <>
          <h2 className={h2}>Key points</h2>
          <ul className="m-0 pl-5">
            {notes.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}
      {notes.terms.length > 0 && (
        <>
          <h2 className={h2}>Key terms</h2>
          <dl className="m-0">
            {notes.terms.map((t, i) => (
              <div key={i} className="mb-1 break-inside-avoid">
                <dt className="inline font-bold">{t.term}: </dt>
                <dd className="m-0 inline">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {notes.flashcards.length > 0 && (
        <>
          <h2 className={h2}>Flashcards</h2>
          <ol className="m-0 pl-5">
            {notes.flashcards.map((c, i) => (
              <li key={i} className="mb-1 break-inside-avoid">
                <b>{c.front}</b>
                <br />
                {c.back}
              </li>
            ))}
          </ol>
        </>
      )}
      {notes.quiz.length > 0 && (
        <>
          <h2 className={h2}>Quick quiz</h2>
          <ol className="m-0 pl-5">
            {notes.quiz.map((q, i) => (
              <li key={i} className="mb-2 break-inside-avoid">
                {q.question}
                <ol className="m-0 list-[upper-alpha] pl-5">
                  {q.options.map((o, j) => (
                    <li key={j}>{o}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <h3 className="mt-3 mb-1 text-[12pt] font-black uppercase">Answers</h3>
          <ol className="m-0 pl-5">
            {notes.quiz.map((q, i) => (
              <li key={i}>
                {String.fromCharCode(65 + q.answer)}. {q.options[q.answer]}. {q.why}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mt-6 text-[9pt]">
        Made with Lepak AI Notes (lepak.gg). AI can get things wrong: check anything important.
      </p>
    </article>
  );
}
