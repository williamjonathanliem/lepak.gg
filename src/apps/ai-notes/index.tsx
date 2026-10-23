import { AI_SIGNIN_NOTE } from '../../copy/ai';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { aiHeaders } from '../../lib/aiHeaders';
import {
  DRAFT_DAYS,
  deleteDraft,
  draftAge,
  loadDrafts,
  saveDraft,
  updateDraft,
  type NotesDraft,
} from './logic/drafts';
import { formatBytes } from '../device-drop/logic/transfer';
import { DropZone } from '../notes/ui/DropZone';
import { readFile } from './logic/readFile';
import {
  NotesSchema,
  aiFileChecks,
  answerText,
  bingoWords,
  toMarkdown,
  type Notes,
} from './logic/notes';
import { learnt, startSession } from './logic/practice';
import { forgetOthers, loadProgress, saveSource, type Source } from './logic/saved';
import { Practice } from './ui/Practice';
import { QuizTab } from './ui/QuizTab';

// AI Notes: drop a PDF, slides or Word file (or paste text) and get a summary, key terms,
// flashcards and a quiz. The server side is a Genkit flow calling Gemini (api/_lib/aiNotes.ts).

const ACCENT = '#ffd23f';
const MAX_TEXT = 60_000;

type Tab = 'notes' | 'cards' | 'quiz';

/** The set of notes on screen, and the draft it's saved as. */
interface Open {
  id: string;
  notes: Notes;
  tab?: Tab;
}

/** What the start page promises, so people know about practice and quizzes before uploading. */
const FEATURES = [
  { title: 'Notes', blurb: 'Summary, key points and key terms in plain words.' },
  {
    title: 'Flashcards that remember',
    blurb: 'Say “got it” or “again”. Cards come back right before you forget them.',
  },
  {
    title: 'Quiz builder',
    blurb: 'Add 10 to 30 questions: multiple choice, true or false, short answer.',
  },
  { title: 'Exam mode', blurb: 'Timed, answers at the end, then retry the ones you got wrong.' },
];

export default function AiNotes() {
  // The hub can send you straight to a set's flashcards ("3 flashcards due").
  const openDraft = (useLocation().state as { openDraft?: string } | null)?.openDraft;
  const [open, setOpen] = useState<Open | null>(() => {
    const d = openDraft ? loadDrafts().find((x) => x.id === openDraft) : undefined;
    return d ? { id: d.id, notes: d.data, tab: 'cards' } : null;
  });
  return (
    <div className="min-h-dvh">
      <title>AI Notes · Lepak.gg</title>
      <AppHeader app={{ name: 'AI Notes', to: '/ai-notes', accent: ACCENT }} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)]">
        {open ? (
          <Result
            key={open.id}
            draftId={open.id}
            initialTab={open.tab}
            notes={open.notes}
            onChange={(notes) => {
              updateDraft(open.id, notes);
              setOpen({ ...open, notes });
            }}
            onReset={() => setOpen(null)}
          />
        ) : (
          <Maker
            onDone={(notes, source) => {
              const id = saveDraft(notes); // kept on this device for a week
              void saveSource(id, source); // so more quiz questions can be made later
              setOpen({ id, notes });
            }}
            onOpen={(d, tab) => setOpen({ id: d.id, notes: d.data, tab })}
          />
        )}
      </main>
    </div>
  );
}

// ---------- input ----------

function Maker({
  onDone,
  onOpen,
}: {
  onDone: (n: Notes, source: Source) => void;
  onOpen: (d: NotesDraft, tab?: Tab) => void;
}) {
  const [drafts, setDrafts] = useState(() => loadDrafts());
  const [now] = useState(() => Date.now());
  // Drop saved files and flashcard progress of drafts that expired or were deleted.
  useEffect(() => {
    void forgetOthers(drafts.map((d) => d.id));
  }, [drafts]);
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
        headers: await aiHeaders(),
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
      onDone(parsed.data, { ...input, fileName: file?.name });
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
          Drop your lecture slides, a PDF or a Word file. In about 20 seconds you get:
        </p>
        <ul className="m-0 mt-4 grid list-none gap-[3px] border-3 border-ink bg-ink p-0 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="flex flex-col gap-1 bg-paper p-4">
              <span className="font-mono text-xs text-mute">0{i + 1}</span>
              <span className="font-black uppercase">{f.title}</span>
              <span className="text-sm text-mute">{f.blurb}</span>
            </li>
          ))}
        </ul>
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
        anything private. {AI_SIGNIN_NOTE}
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
              const total = d.data.flashcards.length;
              const progress = loadProgress(d.id);
              const started = Object.keys(progress).length > 0;
              const due = startSession(total, progress, now).length;
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
                    <span className="block font-mono text-xs">
                      {started
                        ? `${learnt(total, progress)} of ${total} cards learnt · ${due} due`
                        : `${total} flashcards`}{' '}
                      · {d.data.quiz.length} quiz questions
                    </span>
                  </span>
                  <span className="flex gap-2">
                    {started && due > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpen(d, 'cards')}
                        className="min-h-11 cursor-pointer border-3 border-ink bg-[#7ee081] px-3 font-mono text-sm font-bold"
                      >
                        Practise {due}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpen(d)}
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

function Result({
  draftId,
  notes,
  initialTab = 'notes',
  onChange,
  onReset,
}: {
  draftId: string;
  notes: Notes;
  initialTab?: Tab;
  onChange: (notes: Notes) => void;
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(initialTab);
  const cardsLearnt = learnt(notes.flashcards.length, loadProgress(draftId));
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

        {/* The study tools, front and centre: most people never open a second tab. */}
        {tab === 'notes' && (notes.flashcards.length > 0 || notes.quiz.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {notes.flashcards.length > 0 && (
              <button
                type="button"
                onClick={() => setTab('cards')}
                className="push flex min-h-20 cursor-pointer flex-col items-start justify-center gap-1 border-3 border-ink bg-[#7ee081] px-4 py-3 text-left shadow-hard"
              >
                <span className="text-xl font-black uppercase">
                  Practise {notes.flashcards.length} flashcards →
                </span>
                <span className="font-mono text-xs">
                  {cardsLearnt > 0 ? `${cardsLearnt} learnt so far. ` : ''}They come back right
                  before you forget.
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setTab('quiz')}
              className="push flex min-h-20 cursor-pointer flex-col items-start justify-center gap-1 border-3 border-ink bg-[#b9a2ff] px-4 py-3 text-left shadow-hard"
            >
              <span className="text-xl font-black uppercase">Take a quiz →</span>
              <span className="font-mono text-xs">
                {notes.quiz.length} questions. Exam mode, or add more any time.
              </span>
            </button>
          </div>
        )}

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
        {tab === 'cards' && <Practice draftId={draftId} cards={notes.flashcards} />}
        {tab === 'quiz' && <QuizTab notes={notes} draftId={draftId} onChange={onChange} />}

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
          <h2 className={h2}>Quiz</h2>
          <ol className="m-0 pl-5">
            {notes.quiz.map((q, i) => (
              <li key={i} className="mb-2 break-inside-avoid">
                {q.question}
                {q.type === 'tf' && ' (True or false?)'}
                {q.type === 'short' && ' ______________'}
                {q.type !== 'tf' && q.type !== 'short' && (
                  <ol className="m-0 list-[upper-alpha] pl-5">
                    {q.options.map((o, j) => (
                      <li key={j}>{o}</li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
          <h3 className="mt-3 mb-1 text-[12pt] font-black uppercase">Answers</h3>
          <ol className="m-0 pl-5">
            {notes.quiz.map((q, i) => (
              <li key={i}>
                {answerText(q)}. {q.why}
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
