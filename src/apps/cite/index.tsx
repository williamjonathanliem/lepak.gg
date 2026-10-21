import { useState, type FormEvent } from 'react';
import { readStorage, writeStorage } from '../../lib/storage';
import {
  cite,
  inText,
  sortKey,
  toHtml,
  toPlain,
  type Person,
  type Source,
  type SourceType,
  type Style,
} from './logic/cite';
import { lookup } from './logic/lookup';
import { AppHeader } from '../../components/AppHeader';

// Cite: make APA 7, MLA 9 or Harvard references. Your list is saved on this device.

const ACCENT = '#b9a2ff';
const LIST_KEY = 'lepak.cite.list';

const STYLES: { id: Style; label: string }[] = [
  { id: 'apa', label: 'APA 7' },
  { id: 'mla', label: 'MLA 9' },
  { id: 'harvard', label: 'Harvard' },
];

const TYPES: { id: SourceType; label: string }[] = [
  { id: 'website', label: 'Website' },
  { id: 'journal', label: 'Journal article' },
  { id: 'book', label: 'Book' },
  { id: 'video', label: 'Video' },
];

interface Saved {
  id: string;
  source: Source;
}

const blank = (type: SourceType = 'website'): Source => ({
  type,
  authors: [{ first: '', last: '' }],
  date: {},
  title: '',
  container: type === 'video' ? 'YouTube' : '',
});

function loadList(): Saved[] {
  try {
    return JSON.parse(readStorage(LIST_KEY) ?? '[]') as Saved[];
  } catch {
    return [];
  }
}

/** Copies as rich text (italics kept in Word / Google Docs) with plain text as a fallback. */
async function copyRich(html: string, plain: string) {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
  } catch {
    await navigator.clipboard?.writeText(plain);
  }
}

export default function Cite() {
  const [style, setStyle] = useState<Style>('apa');
  const [source, setSource] = useState<Source>(() => blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [list, setList] = useState<Saved[]>(loadList);
  const [copied, setCopied] = useState<string | null>(null);

  const save = (next: Saved[]) => {
    setList(next);
    writeStorage(LIST_KEY, JSON.stringify(next));
  };
  const flash = (id: string) => {
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
  };

  const sorted = [...list].sort((a, b) => sortKey(a.source).localeCompare(sortKey(b.source)));
  const set = (patch: Partial<Source>) => setSource((s) => ({ ...s, ...patch }));
  const canAdd = source.title.trim().length > 0;

  function add() {
    if (!canAdd) return;
    const id = editing ?? crypto.randomUUID();
    save([...list.filter((s) => s.id !== id), { id, source }]);
    setSource(blank(source.type));
    setEditing(null);
  }

  return (
    <div className="min-h-dvh">
      <title>Cite · Lepak.gg</title>
      <AppHeader app={{ name: 'Cite', to: '/cite', accent: ACCENT }}>
        <div role="tablist" aria-label="Citation style" className="flex">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={style === s.id}
              onClick={() => setStyle(s.id)}
              className="min-h-11 cursor-pointer border-0 border-l-3 border-ink px-3 font-mono text-xs font-bold uppercase sm:px-4 sm:text-sm"
              style={{ background: style === s.id ? ACCENT : undefined }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </AppHeader>

      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,48px)]">
        <div>
          <h1 className="heading-lg m-0">Cite.</h1>
          <p className="mt-2 mb-0 text-mute">
            Make {STYLES.find((s) => s.id === style)!.label} references. Paste a link, DOI or ISBN
            to fill it in, or type the details.
          </p>
        </div>

        <Autofill onFound={(s) => setSource({ ...blank(s.type), ...s })} />

        <section
          aria-labelledby="src-h"
          className="flex flex-col gap-4 border-3 border-ink p-4 sm:p-5"
        >
          <h2 id="src-h" className="sr-only">
            Source details
          </h2>
          <div role="radiogroup" aria-label="Source type" className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={source.type === t.id}
                onClick={() =>
                  set({ type: t.id, container: t.id === 'video' ? 'YouTube' : source.container })
                }
                className={`min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold uppercase ${source.type === t.id ? 'bg-ink text-paper' : 'bg-paper'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Authors authors={source.authors} onChange={(authors) => set({ authors })} />

          <Field label="Title" id="c-title">
            <input
              id="c-title"
              value={source.title}
              onChange={(e) => set({ title: e.target.value })}
              className={INPUT}
            />
          </Field>

          {source.type !== 'book' && (
            <Field
              label={
                source.type === 'journal'
                  ? 'Journal name'
                  : source.type === 'video'
                    ? 'Platform'
                    : 'Website name'
              }
              id="c-container"
            >
              <input
                id="c-container"
                value={source.container ?? ''}
                onChange={(e) => set({ container: e.target.value })}
                className={INPUT}
              />
            </Field>
          )}

          <DateFields
            date={source.date}
            withDay={source.type === 'website' || source.type === 'video'}
            onChange={(date) => set({ date })}
          />

          {source.type === 'journal' && (
            <div className="grid grid-cols-3 gap-3">
              {(['volume', 'issue', 'pages'] as const).map((k) => (
                <Field
                  key={k}
                  label={k === 'pages' ? 'Pages' : k === 'issue' ? 'Issue' : 'Volume'}
                  id={`c-${k}`}
                >
                  <input
                    id={`c-${k}`}
                    value={source[k] ?? ''}
                    placeholder={k === 'pages' ? '45-67' : ''}
                    onChange={(e) => set({ [k]: e.target.value })}
                    className={INPUT}
                  />
                </Field>
              ))}
            </div>
          )}

          {source.type === 'book' && (
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Publisher" id="c-pub">
                <input
                  id="c-pub"
                  value={source.publisher ?? ''}
                  onChange={(e) => set({ publisher: e.target.value })}
                  className={INPUT}
                />
              </Field>
              <Field label="Edition" id="c-ed">
                <input
                  id="c-ed"
                  inputMode="numeric"
                  value={source.edition ?? ''}
                  placeholder="2"
                  onChange={(e) => set({ edition: e.target.value })}
                  className={INPUT}
                />
              </Field>
            </div>
          )}

          <Field
            label={source.type === 'journal' || source.type === 'book' ? 'DOI or URL' : 'URL'}
            id="c-url"
          >
            <input
              id="c-url"
              value={source.doi ?? source.url ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                set(
                  /^10\.\d{4,}\//.test(v) || /doi\.org\//i.test(v)
                    ? { doi: v, url: undefined }
                    : { url: v, doi: undefined },
                );
              }}
              className={INPUT}
            />
          </Field>

          {/* live preview */}
          <div
            className="flex flex-col gap-2 border-3 border-ink p-3"
            style={{ background: '#f3efff' }}
          >
            <span className="font-mono text-xs uppercase">Preview</span>
            <p className="m-0 pl-6 -indent-6 leading-relaxed">
              {canAdd ? (
                <Pieces source={source} style={style} />
              ) : (
                <span className="text-mute">Add a title to see your reference.</span>
              )}
            </p>
            {canAdd && (
              <p className="m-0 font-mono text-sm">
                In text: <b>{inText(source, style)}</b>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canAdd}
              onClick={add}
              className="push h-14 cursor-pointer border-3 border-ink px-6 font-mono font-bold uppercase shadow-hard disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              style={{ background: ACCENT }}
            >
              {editing ? 'Save changes' : 'Add to list'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setSource(blank(source.type));
                }}
                className="h-14 cursor-pointer border-3 border-ink bg-paper px-5 font-mono font-bold uppercase"
              >
                Cancel
              </button>
            )}
          </div>
        </section>

        <section aria-labelledby="list-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="list-h" className="m-0 font-mono text-sm font-bold uppercase">
              Your references ({sorted.length})
            </h2>
            {sorted.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const html = sorted
                    .map((s) => `<p>${toHtml(cite(s.source, style))}</p>`)
                    .join('');
                  const plain = sorted.map((s) => toPlain(cite(s.source, style))).join('\n\n');
                  void copyRich(html, plain).then(() => flash('all'));
                }}
                className="min-h-11 cursor-pointer border-3 border-ink bg-ink px-4 font-mono text-sm font-bold text-paper uppercase"
              >
                {copied === 'all' ? 'Copied!' : 'Copy all'}
              </button>
            )}
          </div>
          {sorted.length === 0 ? (
            <p className="m-0 font-mono text-sm text-mute">Nothing yet. Add a source above.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col border-3 border-ink p-0">
              {sorted.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 border-ink p-3 not-last:border-b-3">
                  <p className="m-0 pl-6 -indent-6 leading-relaxed">
                    <Pieces source={s.source} style={style} />
                  </p>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="mr-auto text-mute">{inText(s.source, style)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void copyRich(
                          toHtml(cite(s.source, style)),
                          toPlain(cite(s.source, style)),
                        ).then(() => flash(s.id))
                      }
                      className="min-h-11 cursor-pointer border-2 border-ink bg-paper px-3 font-bold uppercase"
                    >
                      {copied === s.id ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSource(s.source);
                        setEditing(s.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="min-h-11 cursor-pointer border-2 border-ink bg-paper px-3 font-bold uppercase"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => save(list.filter((x) => x.id !== s.id))}
                      className="min-h-11 cursor-pointer border-2 border-ink bg-paper px-3 font-bold uppercase"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="m-0 font-mono text-xs text-mute">
            Double-check against your course's guide: lecturers sometimes want small changes. Saved
            on this device only.
          </p>
        </section>
      </main>
    </div>
  );
}

const INPUT = 'h-11 w-full min-w-0 border-3 border-ink bg-paper px-3';

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="font-mono text-xs uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

function Pieces({ source, style }: { source: Source; style: Style }) {
  return (
    <>
      {cite(source, style).map((p, i) =>
        p.italic ? <i key={i}>{p.text}</i> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}

function Authors({ authors, onChange }: { authors: Person[]; onChange: (a: Person[]) => void }) {
  const update = (i: number, patch: Partial<Person>) =>
    onChange(authors.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 font-mono text-xs uppercase">Authors</legend>
      {authors.map((a, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          {a.org ? (
            <input
              aria-label={`Organisation ${i + 1}`}
              placeholder="Organisation, e.g. World Health Organization"
              value={a.last}
              onChange={(e) => update(i, { last: e.target.value })}
              className={`${INPUT} flex-[1_1_240px]`}
            />
          ) : (
            <>
              <input
                aria-label={`Author ${i + 1} first names`}
                placeholder="First names"
                value={a.first}
                onChange={(e) => update(i, { first: e.target.value })}
                className={`${INPUT} flex-[1_1_140px]`}
              />
              <input
                aria-label={`Author ${i + 1} family name`}
                placeholder="Family name"
                value={a.last}
                onChange={(e) => update(i, { last: e.target.value })}
                className={`${INPUT} flex-[1_1_140px]`}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => update(i, { org: !a.org, first: '' })}
            className="h-11 cursor-pointer border-2 border-ink bg-paper px-2 font-mono text-xs uppercase"
          >
            {a.org ? 'Person' : 'Organisation'}
          </button>
          {authors.length > 1 && (
            <button
              type="button"
              aria-label={`Remove author ${i + 1}`}
              onClick={() => onChange(authors.filter((_, j) => j !== i))}
              className="size-11 cursor-pointer border-2 border-ink bg-paper font-bold"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...authors, { first: '', last: '' }])}
        className="min-h-11 self-start cursor-pointer border-0 bg-transparent p-0 font-mono text-sm font-bold underline"
      >
        + Add author
      </button>
    </fieldset>
  );
}

function DateFields({
  date,
  withDay,
  onChange,
}: {
  date: Source['date'];
  withDay: boolean;
  onChange: (d: Source['date']) => void;
}) {
  const num = (v: string) => (v.trim() === '' ? undefined : Number.parseInt(v, 10) || undefined);
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 font-mono text-xs uppercase">
        Date published (leave blank if none)
      </legend>
      <div className="flex gap-2">
        <input
          aria-label="Year"
          inputMode="numeric"
          placeholder="Year"
          value={date.year ?? ''}
          onChange={(e) => onChange({ ...date, year: num(e.target.value) })}
          className={`${INPUT} w-24`}
        />
        {withDay && (
          <>
            <input
              aria-label="Month (1-12)"
              inputMode="numeric"
              placeholder="Month"
              value={date.month ?? ''}
              onChange={(e) => onChange({ ...date, month: num(e.target.value) })}
              className={`${INPUT} w-24`}
            />
            <input
              aria-label="Day"
              inputMode="numeric"
              placeholder="Day"
              value={date.day ?? ''}
              onChange={(e) => onChange({ ...date, day: num(e.target.value) })}
              className={`${INPUT} w-20`}
            />
          </>
        )}
      </div>
    </fieldset>
  );
}

function Autofill({ onFound }: { onFound: (s: Source) => void }) {
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await lookup(value);
      if (r === 'bad-input') setMsg('Paste a web link, a DOI (10.xxxx/...) or an ISBN.');
      else if (r === 'no-server')
        setMsg(
          'Ordinary web links need the Lepak server, which this copy is not running. DOIs, ISBNs and PubMed links still work.',
        );
      else if (r === 'not-found') setMsg('Nothing found for that. Fill it in by hand below.');
      else if (r === 'busy') setMsg('Too many link lookups in a row. Wait a minute and try again.');
      else {
        onFound(r);
        setMsg('Filled in. Check the details below.');
        setValue('');
      }
    } catch {
      setMsg('Could not look that up right now. Fill it in by hand below.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <label htmlFor="c-auto" className="font-mono text-xs uppercase">
        Paste a link, DOI or ISBN
      </label>
      <div className="flex">
        <input
          id="c-auto"
          value={value}
          placeholder="https://pmc.ncbi.nlm.nih.gov/articles/PMC4594631/"
          onChange={(e) => setValue(e.target.value)}
          className="h-12 min-w-0 flex-1 border-3 border-ink bg-paper px-3 font-mono"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="h-12 cursor-pointer border-3 border-l-0 border-ink bg-ink px-4 font-mono text-sm font-bold text-paper uppercase disabled:opacity-50"
        >
          {busy ? '...' : 'Fill'}
        </button>
      </div>
      <p role="status" className="m-0 min-h-5 font-mono text-xs">
        {msg}
      </p>
    </form>
  );
}
