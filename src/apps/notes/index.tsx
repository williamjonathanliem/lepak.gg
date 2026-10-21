import { useEffect, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { supabaseEnabled } from '../../lib/supabase';
import { cryptoRandomInt } from '../../lib/roomCode';
import { LP, SLUG_ERRORS } from './copy';
import {
  docxToMarkdown,
  imageToText,
  readSite,
  renderMarkdown,
  type SiteBundle,
} from './logic/convert';
import {
  MAX_FILE_BYTES,
  MAX_NOTE_CHARS,
  checkSlug,
  classifyFile,
  newEditKey,
  slugify,
  withSuffix,
  type PageKind,
} from './logic/pages';
import {
  canHostHtml,
  createPage,
  deletePage,
  myPages,
  redeemInvite,
  savePageLocally,
  uploadFiles,
} from './net/pagesApi';
import { DropZone } from './ui/DropZone';
import { Prose } from './ui/Prose';
import { Shell } from './ui/Shell';

// Lepak Pages: /pages to publish. Published pages live at /n/:slug (see view.tsx).

export default function NotesApp() {
  return (
    <Routes>
      <Route index element={<Publish />} />
    </Routes>
  );
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type Draft =
  | { kind: 'note' }
  | { kind: 'pdf'; file: File }
  | { kind: 'doc'; file: File }
  | { kind: 'html'; bundle: SiteBundle; name: string };

interface Done {
  slug: string;
  editKey: string;
}

function Publish() {
  // The landing page can hand over a file or a link (in memory, via router state).
  // Other apps can hand over a file, or a ready note (AI Notes sends { title, markdown }).
  const handoff = (useLocation().state ?? null) as {
    file?: File;
    slug?: string;
    title?: string;
    markdown?: string;
  } | null;
  const [mode, setMode] = useState<'write' | 'drop'>(handoff?.file ? 'drop' : 'write');
  const [draft, setDraft] = useState<Draft>({ kind: 'note' });
  const [title, setTitle] = useState(handoff?.title ?? '');
  const [body, setBody] = useState((handoff?.markdown ?? '').slice(0, MAX_NOTE_CHARS));
  const [slug, setSlug] = useState(handoff?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!handoff?.slug);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [needInvite, setNeedInvite] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const slugError = effectiveSlug ? checkSlug(effectiveSlug) : null;

  if (!supabaseEnabled) {
    return (
      <Shell>
        <p className="px-gutter py-16 font-mono">{LP.offline}</p>
      </Shell>
    );
  }

  if (done) return <Published done={done} onAgain={() => window.location.reload()} />;

  /** Takes a dropped/picked file. Returns an error message, or null when it's accepted. */
  async function onFile(file: File): Promise<string | null> {
    setError(null);
    const type = classifyFile(file.name);
    const name = file.name.replace(/\.[^.]+$/, '');
    try {
      if (type === 'markdown') {
        setBody((await file.text()).slice(0, MAX_NOTE_CHARS));
        setDraft({ kind: 'note' });
        setTitle((t) => t || name);
        setMode('write');
      } else if (type === 'image') {
        // Snap to text: read the photo on this device, then edit the result as a note.
        setBusy(LP.readingPhoto(0));
        const text = await imageToText(file, (pct) => setBusy(LP.readingPhoto(pct)));
        if (!text) return LP.noTextFound;
        setBody(text.slice(0, MAX_NOTE_CHARS));
        setDraft({ kind: 'note' });
        setTitle((t) => t || name);
        setMode('write');
      } else if (type === 'docx') {
        // Default: keep the original layout. The user can switch to an editable note.
        if (file.size > MAX_FILE_BYTES) return LP.errors.tooBig;
        setDraft({ kind: 'doc', file });
        setTitle((t) => t || name);
      } else if (type === 'pdf') {
        if (file.size > MAX_FILE_BYTES) return LP.errors.tooBig;
        setDraft({ kind: 'pdf', file });
        setTitle((t) => t || name);
      } else if (type === 'html' || type === 'zip') {
        if (!(await canHostHtml())) {
          setNeedInvite(true);
          return LP.errors['need-invite'];
        }
        setBusy('Reading site...');
        const site = await readSite(file);
        if (site === 'too-big') return LP.errors.tooBig;
        if (site === 'too-many') return LP.errors.tooMany;
        if (site === 'no-html') return LP.errors.noHtml;
        if (site === 'empty') return LP.errors.zipEmpty;
        setDraft({ kind: 'html', bundle: site, name: file.name });
        setTitle((t) => t || name);
      } else {
        return LP.errors.unsupported;
      }
      return null;
    } catch {
      return LP.errors.generic;
    } finally {
      setBusy(null);
    }
  }

  async function makeEditable() {
    if (draft.kind !== 'doc') return;
    setBusy('Reading .docx...');
    try {
      setBody((await docxToMarkdown(draft.file)).slice(0, MAX_NOTE_CHARS));
      setDraft({ kind: 'note' });
      setMode('write');
    } catch {
      setError(LP.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  async function onPublish(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const s = effectiveSlug;
    if (draft.kind === 'note' && !body.trim()) return setError(LP.errors.empty);
    const bad = checkSlug(s);
    if (bad) return setError(SLUG_ERRORS[bad]);

    const editKey = newEditKey();
    const kind: PageKind = draft.kind;
    const filePath =
      draft.kind === 'pdf'
        ? 'file.pdf'
        : draft.kind === 'doc'
          ? 'file.docx'
          : draft.kind === 'html'
            ? draft.bundle.entry
            : null;
    setBusy(LP.publishing);
    try {
      const result = await createPage({
        slug: s,
        kind,
        title: title.trim() || s,
        body: draft.kind === 'note' ? body : null,
        filePath,
        editKey,
      });
      if (result !== 'ok') {
        if (result === 'taken') {
          setSlug(withSuffix(s, cryptoRandomInt));
          setSlugTouched(true);
        }
        if (result === 'need-invite') setNeedInvite(true);
        return setError(LP.errors[result]);
      }
      if (draft.kind !== 'note') {
        const files =
          draft.kind === 'pdf'
            ? [{ path: 'file.pdf', data: draft.file, type: 'application/pdf' }]
            : draft.kind === 'doc'
              ? [{ path: 'file.docx', data: draft.file, type: DOCX_MIME }]
              : draft.bundle.files;
        try {
          await uploadFiles(s, files, (d, t) => setBusy(LP.uploading(d, t)));
        } catch {
          // Don't leave a half-made page behind.
          await deletePage(s, editKey).catch(() => undefined);
          return setError(LP.errors.upload);
        }
      }
      savePageLocally({ slug: s, title: title.trim() || s, kind, editKey, createdAt: Date.now() });
      setDone({ slug: s, editKey });
    } catch (err) {
      // Show the database's error code so problems are easy to report, e.g. (23514).
      const code = (err as { code?: string } | null)?.code;
      setError(code ? `${LP.errors.generic} (${code})` : LP.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell>
      <title>Lepak Pages · Lepak.gg</title>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)]">
        <div>
          <h1 className="heading-lg m-0">{LP.name}</h1>
          <p className="mt-2 mb-0 text-mute">{LP.tagline}</p>
        </div>

        {needInvite && <InviteBox onUnlocked={() => setNeedInvite(false)} />}

        <form noValidate onSubmit={onPublish} className="flex flex-col gap-5">
          <div
            role="tablist"
            className="flex border-3 border-ink font-mono text-sm font-bold uppercase"
          >
            {(['write', 'drop'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-12 flex-1 cursor-pointer border-0 font-mono font-bold uppercase not-last:border-r-3 not-last:border-ink ${mode === m ? 'bg-ink text-paper' : 'bg-paper'}`}
              >
                {m === 'write' ? LP.write : LP.drop}
              </button>
            ))}
          </div>

          <Field id="lp-title" label={LP.titleLabel}>
            <input
              id="lp-title"
              value={title}
              maxLength={120}
              placeholder={LP.titlePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 w-full border-3 border-ink bg-paper px-3 text-lg"
            />
          </Field>

          {mode === 'write' ? (
            <NoteEditor
              body={body}
              setBody={setBody}
              preview={preview}
              setPreview={setPreview}
              disabled={draft.kind !== 'note'}
            />
          ) : (
            <DropZone
              onFile={onFile}
              initialFile={handoff?.file}
              status={busy}
              picked={pickedLabel(draft)}
              extra={
                draft.kind === 'doc' && (
                  <p className="m-0 font-mono text-xs">
                    {LP.docKeepsLayout}{' '}
                    <button
                      type="button"
                      onClick={() => void makeEditable()}
                      className="min-h-11 cursor-pointer border-0 bg-transparent p-0 font-mono text-xs font-bold underline"
                    >
                      {LP.makeEditable}
                    </button>
                  </p>
                )
              }
            />
          )}

          <Field id="lp-slug" label={LP.slugLabel}>
            <div className="flex items-stretch border-3 border-ink bg-paper">
              <span className="flex items-center border-r-3 border-ink bg-soft px-3 font-mono text-sm">
                /n/
              </span>
              <input
                id="lp-slug"
                value={effectiveSlug}
                maxLength={40}
                placeholder="bio-chapter-3"
                aria-invalid={slugError ? true : undefined}
                aria-describedby="lp-slug-hint"
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                  setSlugTouched(true);
                }}
                className="h-12 min-w-0 flex-1 border-0 bg-paper px-3 font-mono"
              />
            </div>
            <p id="lp-slug-hint" className="m-0 mt-1 font-mono text-xs text-mute">
              {slugError ? SLUG_ERRORS[slugError] : LP.unlisted}
            </p>
          </Field>

          <p role="alert" className="m-0 min-h-6 font-mono text-sm font-bold">
            {error ? `! ${error}` : ''}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={!!busy}
              className="push h-14 cursor-pointer border-3 border-ink bg-ink px-8 font-mono text-lg font-bold text-paper uppercase shadow-hard disabled:cursor-wait disabled:opacity-60"
            >
              {busy ?? LP.publish}
            </button>
            <p className="m-0 font-mono text-xs text-mute">{LP.expiry}</p>
          </div>
        </form>

        <MyPagesList />
      </main>
    </Shell>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-xs uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

function NoteEditor({
  body,
  setBody,
  preview,
  setPreview,
  disabled,
}: {
  body: string;
  setBody: (b: string) => void;
  preview: string | null;
  setPreview: (p: string | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between">
        <label htmlFor="lp-body" className="font-mono text-xs uppercase">
          {LP.bodyLabel}
        </label>
        <button
          type="button"
          onClick={async () => setPreview(preview === null ? await renderMarkdown(body) : null)}
          className="min-h-10 cursor-pointer border-0 bg-transparent font-mono text-xs font-bold uppercase underline"
        >
          {preview === null ? LP.preview : LP.editText}
        </button>
      </div>
      {preview === null ? (
        <textarea
          id="lp-body"
          value={body}
          disabled={disabled}
          maxLength={MAX_NOTE_CHARS}
          placeholder={LP.bodyPlaceholder}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[40vh] w-full resize-y border-3 border-ink bg-paper p-3 font-mono text-[15px] leading-relaxed disabled:opacity-50"
        />
      ) : (
        <Prose html={preview} className="min-h-[40vh] border-3 border-ink bg-paper p-4" />
      )}
    </div>
  );
}

/** Short description of the picked file for the drop box. */
function pickedLabel(draft: Draft): string | null {
  if (draft.kind === 'pdf' || draft.kind === 'doc') {
    return `${draft.file.name} (${(draft.file.size / 1024 / 1024).toFixed(1)} MB)`;
  }
  if (draft.kind === 'html') {
    return `${draft.name}: ${draft.bundle.files.length} files, opens ${draft.bundle.entry}`;
  }
  return null;
}

function InviteBox({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await redeemInvite(code).catch(() => false);
    if (ok) {
      setMsg(LP.inviteOk);
      setTimeout(onUnlocked, 1200);
    } else setMsg(LP.inviteBad);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 border-3 border-ink bg-[#ffd23f] p-4 shadow-hard"
    >
      <h2 className="m-0 text-lg font-black uppercase">{LP.inviteTitle}</h2>
      <label htmlFor="lp-invite" className="font-mono text-xs uppercase">
        {LP.inviteLabel}
      </label>
      <div className="flex">
        <input
          id="lp-invite"
          type="password"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 min-w-0 flex-1 border-3 border-ink bg-paper px-3 font-mono"
        />
        <button
          type="submit"
          className="h-12 cursor-pointer border-3 border-l-0 border-ink bg-ink px-4 font-mono text-sm font-bold text-paper uppercase"
        >
          {LP.inviteButton}
        </button>
      </div>
      <p role="status" className="m-0 min-h-5 font-mono text-sm font-bold">
        {msg}
      </p>
    </form>
  );
}

function Published({ done, onAgain }: { done: Done; onAgain: () => void }) {
  const view = `${window.location.origin}/n/${done.slug}`;
  const edit = `${view}/edit#k=${done.editKey}`;
  return (
    <Shell>
      <title>Published · Lepak Pages</title>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,56px)]">
        <h1 className="heading-lg m-0">{LP.published}</h1>
        <CopyRow label={LP.viewLink} value={view} />
        <PageQr url={view} />
        <CopyRow label={LP.editLink} value={edit} secret />
        <p className="m-0 border-3 border-ink bg-[#ffd23f] p-3 font-mono text-sm">
          {LP.editWarning}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/n/${done.slug}`}
            className="push inline-flex min-h-12 items-center border-3 border-ink bg-ink px-6 font-mono font-bold text-paper uppercase no-underline shadow-hard"
          >
            {LP.open}
          </Link>
          <button
            type="button"
            onClick={onAgain}
            className="min-h-12 cursor-pointer border-3 border-ink bg-paper px-6 font-mono font-bold uppercase"
          >
            {LP.another}
          </button>
        </div>
      </main>
    </Shell>
  );
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs uppercase">{label}</span>
      <div className="flex border-3 border-ink">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.target.select()}
          className={`h-12 min-w-0 flex-1 border-0 px-3 font-mono text-sm ${secret ? 'bg-[#ffd23f]' : 'bg-paper'}`}
        />
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="h-12 cursor-pointer border-0 border-l-3 border-ink bg-ink px-4 font-mono text-sm font-bold text-paper uppercase"
        >
          {copied ? LP.copied : LP.copy}
        </button>
      </div>
    </div>
  );
}

function MyPagesList() {
  const [pages] = useState(myPages);
  const origin = window.location.origin;
  return (
    <section aria-labelledby="mine-h" className="border-t-3 border-ink pt-6">
      <h2 id="mine-h" className="m-0 mb-3 font-mono text-sm font-bold uppercase">
        {LP.mine}
      </h2>
      {pages.length === 0 ? (
        <p className="m-0 font-mono text-sm text-mute">{LP.none}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col border-3 border-ink p-0">
          {pages.map((p) => (
            <li
              key={p.slug}
              className="flex flex-wrap items-center justify-between gap-2 border-ink px-3 py-2 not-last:border-b-3"
            >
              <Link to={`/n/${p.slug}`} className="min-w-0 truncate font-bold">
                {p.title}
              </Link>
              <span className="flex items-center gap-3 font-mono text-xs">
                <span className="uppercase text-mute">{p.kind}</span>
                <span className="text-mute" title={`${origin}/n/${p.slug}`}>
                  /n/{p.slug}
                </span>
                <Link to={`/n/${p.slug}/edit`} className="min-h-11 content-center underline">
                  {LP.editText}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** QR code of the page link, for projecting in class or scanning off a screen. */
function PageQr({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import('qrcode').then((QR) =>
      QR.toDataURL(url, {
        margin: 1,
        width: 200,
        color: { dark: '#000000', light: '#f9fafb' },
      }).then((d) => alive && setSrc(d)),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div className="self-start border-3 border-ink p-2 shadow-hard">
      {src ? (
        <img src={src} width={200} height={200} alt={`QR code for ${url}`} />
      ) : (
        <div className="size-[200px]" />
      )}
    </div>
  );
}
