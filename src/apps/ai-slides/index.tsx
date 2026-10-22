import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { createDraftStore, draftAge } from '../../lib/drafts';
import { formatBytes } from '../device-drop/logic/transfer';
import { aiFileChecks } from '../ai-notes/logic/notes';
import { readFile } from '../ai-notes/logic/readFile';
import { DropZone } from '../notes/ui/DropZone';
import {
  DeckSchema,
  LAYOUTS,
  OutlineSchema,
  SavedDeckSchema,
  SlideSchema,
  THEMES,
  addSection,
  addSlide,
  deckToMarkdown,
  deleteSlide,
  duplicateSlide,
  linesToList,
  linesToPairs,
  moveSection,
  moveSlide,
  pairsToLines,
  removeSection,
  themeById,
  type Deck,
  type Layout,
  type Outline,
  type SavedDeck,
  type Slide,
} from './logic/deck';
import { aiHeaders } from '../../lib/aiHeaders';
import { Present } from './ui/Present';
import { SlideView } from './ui/SlideView';

// AI Slides: a topic, your notes or a file -> an outline you can edit -> a deck you can
// edit, rewrite with AI, present, download (PowerPoint / PDF) or publish as a page.
// Server side: api/_lib/aiSlides.ts.

const ACCENT = '#b9a2ff';
const MAX_MATERIAL = 40_000;
const drafts = createDraftStore<SavedDeck>('lepak.aislides.drafts', SavedDeckSchema, {
  days: 7,
  max: 10,
});

type Style = 'professional' | 'casual';

/** How the deck should sound, sent with every AI call. */
interface Options {
  style: Style;
  audience: string;
  language: string;
}

/** What the slides are about, kept for the deck step so notes stay true to it. */
interface Source {
  material?: string;
}

type Step =
  | { name: 'start' }
  | { name: 'outline'; outline: Outline }
  | { name: 'deck'; deck: Deck; theme: string; draftId: string };

const LANGUAGES = ['auto', 'English', 'Bahasa Malaysia', 'Bahasa Indonesia', '中文', 'தமிழ்'];

async function callAi(body: object): Promise<unknown> {
  const res = await fetch('/api/ai-slides', {
    method: 'POST',
    headers: aiHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 404 && res.headers.get('content-type')?.includes('text/html')) {
    throw new Error('AI Slides needs the Lepak server, which this copy is not running.');
  }
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ?? 'Something went wrong. Try again.',
    );
  }
  return data;
}

function optionsBody(o: Options) {
  return {
    style: o.style,
    audience: o.audience.trim() || undefined,
    language: o.language,
  };
}

export default function AiSlides() {
  // AI Notes can hand over its notes: { title, markdown }.
  // AI Notes hands over { title, markdown }; the landing page hands over { file }.
  const handoff = (useLocation().state ?? null) as {
    title?: string;
    markdown?: string;
    file?: File;
  } | null;
  const [step, setStep] = useState<Step>({ name: 'start' });
  const [options, setOptions] = useState<Options>({
    style: 'professional',
    audience: '',
    language: 'auto',
  });
  const [source, setSource] = useState<Source>({});

  return (
    <div className="min-h-dvh">
      <title>AI Slides · Lepak.gg</title>
      <AppHeader app={{ name: 'AI Slides', to: '/ai-slides', accent: ACCENT }} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)] print:p-0">
        {step.name === 'start' && (
          <Start
            handoff={handoff}
            options={options}
            setOptions={setOptions}
            onOutline={(outline, src) => {
              setSource(src);
              setStep({ name: 'outline', outline });
            }}
            onOpen={(id, saved) => setStep({ name: 'deck', draftId: id, ...saved })}
          />
        )}
        {step.name === 'outline' && (
          <OutlineEditor
            outline={step.outline}
            options={options}
            source={source}
            onChange={(outline) => setStep({ name: 'outline', outline })}
            onBack={() => setStep({ name: 'start' })}
            onDeck={(deck) => {
              const saved = { deck, theme: 'paper' };
              setStep({ name: 'deck', draftId: drafts.save(saved), ...saved });
            }}
          />
        )}
        {step.name === 'deck' && (
          <DeckScreen
            deck={step.deck}
            theme={step.theme}
            options={options}
            onChange={(deck, theme) => {
              drafts.update(step.draftId, { deck, theme });
              setStep({ ...step, deck, theme });
            }}
            onReset={() => setStep({ name: 'start' })}
          />
        )}
      </main>
    </div>
  );
}

// ---------- step 1: what about? ----------

interface StartProps {
  handoff: { title?: string; markdown?: string; file?: File } | null;
  options: Options;
  setOptions: (o: Options) => void;
  onOutline: (o: Outline, src: Source) => void;
  onOpen: (id: string, saved: SavedDeck) => void;
}

function Start({ handoff, options, setOptions, onOutline, onOpen }: StartProps) {
  const [topic, setTopic] = useState(handoff?.title ?? '');
  const [material, setMaterial] = useState(handoff?.markdown ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(() => drafts.load());
  const field = 'border-3 border-ink bg-paper px-3';
  const set = (patch: Partial<Options>) => setOptions({ ...options, ...patch });

  async function take(f: File): Promise<string | null> {
    setError(null);
    const failed = aiFileChecks(f, 'Slides saved on this device for 7 days').find((c) => !c.ok);
    if (failed) {
      setFile(null);
      return failed.label;
    }
    setFile(f);
    return null;
  }

  async function plan() {
    setBusy(true);
    setError(null);
    try {
      // A file wins over pasted notes. PDFs go to Gemini as they are; other files as text.
      const fromFile = file ? await readFile(file) : {};
      const text = (fromFile.text ?? material).slice(0, MAX_MATERIAL).trim() || undefined;
      if (file && !fromFile.pdfBase64 && !text)
        throw new Error("Couldn't find any text in that file.");
      const data = await callAi({
        step: 'outline',
        topic: topic.trim() || undefined,
        material: text,
        pdfBase64: fromFile.pdfBase64,
        fileName: file?.name,
        slideCount: count,
        ...optionsBody(options),
      });
      const parsed = OutlineSchema.safeParse(data);
      if (!parsed.success) throw new Error('The plan came back in a strange shape. Try again.');
      onOutline(parsed.data, { material: text });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div>
        <h1 className="heading-lg m-0">AI Slides.</h1>
        <p className="mt-2 mb-0 max-w-2xl text-mute">
          Drop your lecture notes, a PDF or old slides, or just type a topic. Check the plan, then
          get a deck you can edit, present, download as PowerPoint or share.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <DropZone
            onFile={take}
            initialFile={handoff?.file}
            picked={file ? `${file.name} (${formatBytes(file.size)})` : null}
            checksFor={(f) => aiFileChecks(f, 'Slides saved on this device for 7 days')}
            accept=".pdf,.pptx,.docx,.txt,.md"
            title="Drop a file to make slides from"
            hint=".pdf up to 3 MB, .pptx / .docx / .txt up to 30 MB"
            extra={
              file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-xs underline"
                >
                  Remove the file
                </button>
              )
            }
          />
          {!file && (
            <label className="flex flex-col gap-1.5 font-mono text-xs uppercase">
              Or paste notes
              <textarea
                value={material}
                maxLength={MAX_MATERIAL}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="Paste notes, or open AI Notes and press 'Make slides'"
                className="min-h-28 border-3 border-ink bg-paper p-3 text-[15px] normal-case"
              />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 font-mono text-xs uppercase">
            Topic {file || material.trim() ? '(optional)' : ''}
            <input
              id="sl-topic"
              value={topic}
              maxLength={300}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How vaccines work"
              className={`h-12 text-lg normal-case ${field}`}
            />
          </label>
          <label className="flex flex-col gap-1.5 font-mono text-xs uppercase">
            Who's it for? (optional)
            <input
              value={options.audience}
              maxLength={100}
              onChange={(e) => set({ audience: e.target.value })}
              placeholder="e.g. Year 6 class, first-year engineering, my study group"
              className={`h-12 normal-case ${field}`}
            />
          </label>
          <div className="flex flex-wrap items-end gap-5">
            <label className="flex flex-col gap-1.5 font-mono text-xs uppercase">
              Language
              <select
                value={options.language}
                onChange={(e) => set({ language: e.target.value })}
                className={`h-11 normal-case ${field}`}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l === 'auto' ? 'Same as my notes' : l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 font-mono text-xs uppercase">
              Slides: {count}
              <input
                type="range"
                min={4}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="h-11 w-44 accent-ink"
              />
            </label>
          </div>
          <div role="radiogroup" aria-label="Style" className="flex gap-2">
            {(['professional', 'casual'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={options.style === s}
                onClick={() => set({ style: s })}
                className={`min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold ${options.style === s ? 'bg-ink text-paper' : 'bg-paper'}`}
              >
                {s === 'professional' ? 'Professional' : 'Casual'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy || (!topic.trim() && !material.trim() && !file)}
          onClick={() => void plan()}
          className="push h-14 cursor-pointer border-3 border-ink px-8 font-mono text-lg font-bold shadow-hard disabled:cursor-default disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {busy ? 'Planning...' : 'Plan my slides'}
        </button>
        {busy && (
          <p role="status" className="m-0 animate-pulse font-mono text-sm">
            Reading and planning. Usually 10 to 30 seconds.
          </p>
        )}
      </div>
      <p role="alert" className="m-0 min-h-6 font-mono text-sm font-bold">
        {error ? `! ${error}` : ''}
      </p>

      {saved.length > 0 && (
        <section aria-labelledby="decks-h" className="flex flex-col gap-2">
          <h2 id="decks-h" className="m-0 text-xl font-black uppercase">
            Your recent decks
          </h2>
          <p className="m-0 font-mono text-xs text-mute">
            Saved on this device for {drafts.days} days, with your edits.
          </p>
          <ul className="m-0 flex list-none flex-col border-3 border-ink p-0">
            {saved.map((d) => {
              const age = draftAge(d.savedAt, drafts.days);
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-ink px-4 py-2 not-last:border-b-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{d.data.deck.title}</span>
                    <span className="block font-mono text-xs text-mute">
                      {d.data.deck.slides.length} slides · {age.saved} · {age.left}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(d.id, d.data)}
                      className="min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold"
                      style={{ background: ACCENT }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaved(drafts.remove(d.id))}
                      aria-label={`Delete ${d.data.deck.title}`}
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

// ---------- step 2: check the plan ----------

interface OutlineProps {
  outline: Outline;
  options: Options;
  source: Source;
  onChange: (o: Outline) => void;
  onBack: () => void;
  onDeck: (d: Deck) => void;
}

function OutlineEditor({ outline, options, source, onChange, onBack, onDeck }: OutlineProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = 'border-3 border-ink bg-paper px-3';
  const small =
    'min-h-11 min-w-11 cursor-pointer border-3 border-ink bg-paper px-2 font-mono text-sm disabled:opacity-30';

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const clean = {
        ...outline,
        sections: outline.sections.map((s) => ({ ...s, points: linesToList(s.points.join('\n')) })),
      };
      const data = await callAi({
        step: 'slides',
        outline: clean,
        material: source.material,
        ...optionsBody(options),
      });
      const parsed = DeckSchema.safeParse(data);
      if (!parsed.success) throw new Error('The slides came back in a strange shape. Try again.');
      onDeck(parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 font-mono text-xs uppercase">Step 2 of 3</p>
          <h1 className="m-0 text-[clamp(28px,4vw,44px)] font-black">Check the plan</h1>
          <p className="m-0 text-mute">Change anything you like. Each box becomes a slide.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 cursor-pointer border-0 bg-transparent font-mono text-sm underline"
        >
          ← Back
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 font-mono text-xs uppercase">
          Title
          <input
            value={outline.title}
            maxLength={300}
            onChange={(e) => onChange({ ...outline, title: e.target.value })}
            className={`h-12 text-lg normal-case ${field}`}
          />
        </label>
        <label className="flex flex-col gap-1.5 font-mono text-xs uppercase">
          Subtitle
          <input
            value={outline.subtitle}
            maxLength={300}
            onChange={(e) => onChange({ ...outline, subtitle: e.target.value })}
            className={`h-12 normal-case ${field}`}
          />
        </label>
      </div>

      <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        {outline.sections.map((s, i) => (
          <li key={i} className="flex flex-col gap-2 border-3 border-ink p-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">{i + 1}.</span>
              <label className="sr-only" htmlFor={`sec-${i}`}>
                Slide {i + 1} heading
              </label>
              <input
                id={`sec-${i}`}
                value={s.heading}
                maxLength={300}
                onChange={(e) => {
                  const sections = [...outline.sections];
                  sections[i] = { ...s, heading: e.target.value };
                  onChange({ ...outline, sections });
                }}
                className={`h-11 min-w-0 flex-1 font-bold ${field}`}
              />
              <button
                type="button"
                className={small}
                disabled={i === 0}
                onClick={() => onChange(moveSection(outline, i, -1))}
                aria-label={`Move slide ${i + 1} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className={small}
                disabled={i === outline.sections.length - 1}
                onClick={() => onChange(moveSection(outline, i, 1))}
                aria-label={`Move slide ${i + 1} down`}
              >
                ↓
              </button>
              <button
                type="button"
                className={small}
                disabled={outline.sections.length <= 1}
                onClick={() => onChange(removeSection(outline, i))}
                aria-label={`Remove slide ${i + 1}`}
              >
                ✕
              </button>
            </div>
            <label className="sr-only" htmlFor={`pts-${i}`}>
              Slide {i + 1} points, one per line
            </label>
            <textarea
              id={`pts-${i}`}
              value={s.points.join('\n')}
              rows={Math.max(2, s.points.length)}
              onChange={(e) => {
                const sections = [...outline.sections];
                sections[i] = { ...s, points: e.target.value.split('\n') };
                onChange({ ...outline, sections });
              }}
              placeholder="What this slide covers, one idea per line"
              className="border-2 border-ink/40 bg-paper p-2 text-[15px]"
            />
            <button
              type="button"
              onClick={() => onChange(addSection(outline, i))}
              className="min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-xs underline"
            >
              + Add a slide after this
            </button>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void make()}
          className="push h-14 cursor-pointer border-3 border-ink px-8 font-mono text-lg font-bold shadow-hard disabled:cursor-default disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {busy ? 'Making slides...' : 'Make the slides'}
        </button>
        {busy && (
          <p role="status" className="m-0 animate-pulse font-mono text-sm">
            Writing slides and speaker notes. Usually 20 to 40 seconds.
          </p>
        )}
      </div>
      <p role="alert" className="m-0 min-h-6 font-mono text-sm font-bold">
        {error ? `! ${error}` : ''}
      </p>
    </>
  );
}

// ---------- step 3: the deck ----------

interface DeckProps {
  deck: Deck;
  theme: string;
  options: Options;
  onChange: (deck: Deck, theme: string) => void;
  onReset: () => void;
}

const LAYOUT_LABEL: Record<Layout, string> = {
  title: 'Title',
  section: 'Section divider',
  bullets: 'Bullet points',
  'two-column': 'Two columns',
  timeline: 'Timeline / steps',
  cards: 'Cards',
  quote: 'Quote',
  'big-number': 'Big number',
};

function DeckScreen({ deck, theme: themeId, options, onChange, onReset }: DeckProps) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [newLayout, setNewLayout] = useState<Layout>('bullets');
  const theme = themeById(themeId);
  const at = Math.min(selected, deck.slides.length - 1);
  const slide = deck.slides[at]!;
  const btn =
    'min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold disabled:opacity-40';
  const tool =
    'min-h-11 cursor-pointer border-2 border-ink bg-paper px-3 font-mono text-xs font-bold disabled:opacity-30';

  const setDeck = (d: Deck, select = at) => {
    onChange(d, themeId);
    setSelected(Math.max(0, Math.min(select, d.slides.length - 1)));
  };
  const editSlide = (patch: Partial<Slide>) =>
    setDeck({ ...deck, slides: deck.slides.map((s, i) => (i === at ? { ...s, ...patch } : s)) });

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-mono text-xs uppercase">Step 3 of 3 · saved on this device</p>
            <label className="sr-only" htmlFor="deck-title">
              Deck title
            </label>
            <input
              id="deck-title"
              value={deck.title}
              maxLength={300}
              onChange={(e) => onChange({ ...deck, title: e.target.value }, themeId)}
              className="w-full border-0 border-b-2 border-transparent bg-transparent p-0 text-[clamp(26px,4vw,40px)] leading-tight font-black hover:border-ink/30 focus:border-ink"
            />
          </div>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 cursor-pointer border-0 bg-transparent font-mono text-sm underline"
          >
            ← New deck
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPresenting(at)}
            className="push min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold shadow-hard"
            style={{ background: ACCENT }}
          >
            ▶ Present
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              setStatus('Building your PowerPoint...');
              void import('./ui/pptx')
                .then((m) => m.downloadPptx(deck, theme))
                .then(() => setStatus('Downloaded. Check your downloads folder.'))
                .catch(() => setStatus('Could not build the PowerPoint. Try again.'));
            }}
          >
            PowerPoint
          </button>
          <button type="button" className={btn} onClick={() => window.print()}>
            PDF
          </button>
          <button
            type="button"
            className={btn}
            onClick={() =>
              navigate('/pages', { state: { title: deck.title, markdown: deckToMarkdown(deck) } })
            }
          >
            Publish as a page
          </button>
        </div>
        <p role="status" className="m-0 min-h-5 font-mono text-xs">
          {status}
        </p>

        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase">Theme</span>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === theme.id}
              onClick={() => onChange(deck, t.id)}
              className={`flex min-h-11 cursor-pointer items-center gap-2 border-3 px-3 font-mono text-sm ${t.id === theme.id ? 'border-ink' : 'border-ink/20'}`}
              style={{ background: t.bg, color: t.fg }}
            >
              <span aria-hidden="true" className="size-3" style={{ background: t.accent }} />
              {t.name}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-3">
            <div className="border-3 border-ink">
              <SlideView slide={slide} theme={theme} index={at} total={deck.slides.length} />
            </div>

            {/* slide tools */}
            <div className="flex flex-wrap items-center gap-2" aria-label="Slide tools">
              <button
                type="button"
                className={tool}
                disabled={at === 0}
                onClick={() => setDeck(moveSlide(deck, at, -1), at - 1)}
              >
                ← Move
              </button>
              <button
                type="button"
                className={tool}
                disabled={at === deck.slides.length - 1}
                onClick={() => setDeck(moveSlide(deck, at, 1), at + 1)}
              >
                Move →
              </button>
              <button
                type="button"
                className={tool}
                onClick={() => setDeck(duplicateSlide(deck, at), at + 1)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className={tool}
                disabled={deck.slides.length <= 1}
                onClick={() => {
                  if (window.confirm('Delete this slide?')) setDeck(deleteSlide(deck, at), at - 1);
                }}
              >
                Delete
              </button>
              <span className="ml-auto flex items-center gap-1">
                <label className="sr-only" htmlFor="new-layout">
                  New slide layout
                </label>
                <select
                  id="new-layout"
                  value={newLayout}
                  onChange={(e) => setNewLayout(e.target.value as Layout)}
                  className="h-11 border-2 border-ink bg-paper px-2 font-mono text-xs"
                >
                  {LAYOUTS.map((l) => (
                    <option key={l} value={l}>
                      {LAYOUT_LABEL[l]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={tool}
                  onClick={() => setDeck(addSlide(deck, at, newLayout), at + 1)}
                >
                  + Add slide
                </button>
              </span>
            </div>

            <ul
              aria-label="All slides"
              className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 md:grid-cols-6"
            >
              {deck.slides.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-label={`Slide ${i + 1}: ${s.title}`}
                    aria-current={i === at ? 'true' : undefined}
                    className={`block w-full cursor-pointer border-3 p-0 ${i === at ? 'border-ink' : 'border-ink/20'}`}
                  >
                    <SlideView slide={s} theme={theme} index={i} total={deck.slides.length} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <RewriteBox
              key={`r-${at}`}
              slide={slide}
              deckTitle={deck.title}
              options={options}
              onDone={(s) =>
                setDeck({ ...deck, slides: deck.slides.map((x, i) => (i === at ? s : x)) })
              }
            />
            <SlideEditor key={`e-${at}-${slide.layout}`} slide={slide} onEdit={editSlide} />
          </div>
        </div>
        <p className="m-0 font-mono text-xs text-mute">
          Made by AI. It can get things wrong: check facts before you present.
        </p>
      </div>

      {/* Only shows when printing / saving as PDF: one slide per landscape page. */}
      <div className="hidden print:block">
        <style>{'@media print { @page { size: landscape; margin: 0; } }'}</style>
        {deck.slides.map((s, i) => (
          <div key={i} className="break-after-page">
            <SlideView slide={s} theme={theme} index={i} total={deck.slides.length} />
          </div>
        ))}
      </div>

      {presenting !== null && (
        <Present deck={deck} theme={theme} start={presenting} onClose={() => setPresenting(null)} />
      )}
    </>
  );
}

const QUICK = ['Make it shorter', 'Make it simpler', 'Add more detail', 'Make it more fun'];

/** Ask the AI to redo just this slide. */
function RewriteBox({
  slide,
  deckTitle,
  options,
  onDone,
}: {
  slide: Slide;
  deckTitle: string;
  options: Options;
  onDone: (s: Slide) => void;
}) {
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rewrite(instruction: string) {
    setBusy(instruction);
    setError(null);
    try {
      const data = await callAi({
        step: 'rewrite',
        deckTitle,
        slide,
        instruction,
        ...optionsBody(options),
      });
      const parsed = SlideSchema.safeParse(data);
      if (!parsed.success) throw new Error('That came back in a strange shape. Try again.');
      onDone(parsed.data);
      setCustom('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-label="Rewrite this slide with AI"
      className="flex flex-col gap-2 border-3 border-ink p-3"
    >
      <h2 className="m-0 text-lg font-black uppercase">Rewrite with AI</h2>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            disabled={!!busy}
            onClick={() => void rewrite(q)}
            className="min-h-11 cursor-pointer border-2 border-ink bg-paper px-2 text-xs font-bold disabled:opacity-40"
            style={{ background: busy === q ? ACCENT : undefined }}
          >
            {busy === q ? 'Working...' : q}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) void rewrite(custom.trim());
        }}
      >
        <label className="sr-only" htmlFor="rewrite-custom">
          Your own instruction
        </label>
        <input
          id="rewrite-custom"
          value={custom}
          maxLength={300}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Or say how, e.g. turn into a timeline"
          className="h-11 min-w-0 flex-1 border-2 border-ink bg-paper px-2 text-sm"
        />
        <button
          type="submit"
          disabled={!!busy || !custom.trim()}
          className="min-h-11 cursor-pointer border-2 border-ink bg-ink px-3 font-mono text-xs font-bold text-paper disabled:opacity-40"
        >
          Go
        </button>
      </form>
      {error && (
        <p role="alert" className="m-0 font-mono text-xs font-bold">
          ! {error}
        </p>
      )}
    </section>
  );
}

/** Edit the selected slide's words. Layout-specific boxes show only when they matter. */
function SlideEditor({ slide, onEdit }: { slide: Slide; onEdit: (p: Partial<Slide>) => void }) {
  const box = 'border-3 border-ink bg-paper px-2';
  const lbl = 'flex flex-col gap-1 font-mono text-xs uppercase';
  const list = (v: string[] | undefined) => (v ?? []).join('\n');
  return (
    <aside aria-label="Edit this slide" className="flex flex-col gap-3 border-3 border-ink p-3">
      <h2 className="m-0 text-lg font-black uppercase">Edit slide</h2>
      <label className={lbl}>
        Layout
        <select
          value={slide.layout}
          onChange={(e) => onEdit({ layout: e.target.value as Layout })}
          className={`h-11 normal-case ${box}`}
        >
          {LAYOUTS.map((l) => (
            <option key={l} value={l}>
              {LAYOUT_LABEL[l]}
            </option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        Heading
        <input
          value={slide.title}
          maxLength={300}
          onChange={(e) => onEdit({ title: e.target.value })}
          className={`h-11 normal-case ${box}`}
        />
      </label>
      {(slide.layout === 'title' || slide.layout === 'section') && (
        <label className={lbl}>
          Subtitle
          <input
            value={slide.subtitle ?? ''}
            maxLength={300}
            onChange={(e) => onEdit({ subtitle: e.target.value })}
            className={`h-11 normal-case ${box}`}
          />
        </label>
      )}
      {slide.layout === 'bullets' && (
        <label className={lbl}>
          Bullets, one per line
          <textarea
            value={list(slide.bullets)}
            rows={5}
            onChange={(e) => onEdit({ bullets: e.target.value.split('\n') })}
            className={`py-2 text-sm normal-case ${box}`}
          />
        </label>
      )}
      {slide.layout === 'two-column' && (
        <>
          <label className={lbl}>
            Left heading
            <input
              value={slide.leftTitle ?? ''}
              onChange={(e) => onEdit({ leftTitle: e.target.value })}
              className={`h-11 normal-case ${box}`}
            />
          </label>
          <label className={lbl}>
            Left points
            <textarea
              value={list(slide.left)}
              rows={3}
              onChange={(e) => onEdit({ left: e.target.value.split('\n') })}
              className={`py-2 text-sm normal-case ${box}`}
            />
          </label>
          <label className={lbl}>
            Right heading
            <input
              value={slide.rightTitle ?? ''}
              onChange={(e) => onEdit({ rightTitle: e.target.value })}
              className={`h-11 normal-case ${box}`}
            />
          </label>
          <label className={lbl}>
            Right points
            <textarea
              value={list(slide.right)}
              rows={3}
              onChange={(e) => onEdit({ right: e.target.value.split('\n') })}
              className={`py-2 text-sm normal-case ${box}`}
            />
          </label>
        </>
      )}
      {slide.layout === 'timeline' && (
        <label className={lbl}>
          Steps, one per line as "label: text"
          <textarea
            defaultValue={pairsToLines((slide.steps ?? []).map((s) => ({ a: s.label, b: s.text })))}
            rows={5}
            onChange={(e) =>
              onEdit({
                steps: linesToPairs(e.target.value).map((p) => ({ label: p.a, text: p.b })),
              })
            }
            placeholder={'1914: War begins\n1918: Armistice'}
            className={`py-2 text-sm normal-case ${box}`}
          />
        </label>
      )}
      {slide.layout === 'cards' && (
        <label className={lbl}>
          Cards, one per line as "title: text"
          <textarea
            defaultValue={pairsToLines((slide.cards ?? []).map((c) => ({ a: c.title, b: c.text })))}
            rows={5}
            onChange={(e) =>
              onEdit({
                cards: linesToPairs(e.target.value).map((p) => ({ title: p.a, text: p.b })),
              })
            }
            placeholder={'Speed: Faster checkouts\nCost: Cheaper to run'}
            className={`py-2 text-sm normal-case ${box}`}
          />
        </label>
      )}
      {slide.layout === 'quote' && (
        <>
          <label className={lbl}>
            Quote
            <textarea
              value={slide.quote ?? ''}
              rows={3}
              onChange={(e) => onEdit({ quote: e.target.value })}
              className={`py-2 text-sm normal-case ${box}`}
            />
          </label>
          <label className={lbl}>
            Who said it
            <input
              value={slide.author ?? ''}
              onChange={(e) => onEdit({ author: e.target.value })}
              className={`h-11 normal-case ${box}`}
            />
          </label>
        </>
      )}
      {slide.layout === 'big-number' && (
        <>
          <label className={lbl}>
            Number
            <input
              value={slide.number ?? ''}
              maxLength={40}
              onChange={(e) => onEdit({ number: e.target.value })}
              className={`h-11 normal-case ${box}`}
            />
          </label>
          <label className={lbl}>
            What it means
            <input
              value={slide.numberLabel ?? ''}
              onChange={(e) => onEdit({ numberLabel: e.target.value })}
              className={`h-11 normal-case ${box}`}
            />
          </label>
        </>
      )}
      <label className={lbl}>
        Speaker notes
        <textarea
          value={slide.notes}
          rows={5}
          onChange={(e) => onEdit({ notes: e.target.value })}
          className={`py-2 text-sm normal-case ${box}`}
        />
      </label>
    </aside>
  );
}
