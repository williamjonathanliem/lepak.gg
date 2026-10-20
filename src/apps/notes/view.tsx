import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { supabaseEnabled } from '../../lib/supabase';
import { LP } from './copy';
import { renderMarkdown, withBase } from './logic/convert';
import { MAX_NOTE_CHARS } from './logic/pages';
import {
  deletePage,
  editKeyFor,
  getPage,
  pageFileUrl,
  reportPage,
  savePageLocally,
  updatePage,
  type PageRecord,
} from './net/pagesApi';
import { Shell } from './ui/Shell';

// Published pages: /n/:slug (view) and /n/:slug/edit (edit, needs the owner's browser or the edit key).

export default function PageRoutes() {
  return (
    <Routes>
      <Route index element={<ViewPage />} />
      <Route path="edit" element={<EditPage />} />
    </Routes>
  );
}

/** Loads a page by the :slug in the URL. undefined = loading, null = not found. */
function usePage(slug: string) {
  const [page, setPage] = useState<PageRecord | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!supabaseEnabled) return;
    let alive = true;
    getPage(slug)
      .then((p) => alive && setPage(p))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [slug]);
  return { page, failed, setPage };
}

function Message({ text }: { text: string }) {
  return (
    <Shell>
      <p role="status" className="px-gutter py-16 font-mono text-lg">
        {text}
      </p>
    </Shell>
  );
}

// ---------- view ----------

function ViewPage() {
  const { slug = '' } = useParams();
  const { hash } = useLocation();
  const { page, failed } = usePage(slug);
  const [reported, setReported] = useState(false);

  if (!supabaseEnabled) return <Message text={LP.offline} />;
  if (failed) return <Message text={LP.errors.generic} />;
  if (page === undefined) return <Message text={LP.loading} />;
  if (page === null) return <Message text={LP.notFound} />;

  const canEdit = page.is_owner || !!editKeyFor(slug, hash);
  const actions = (
    <>
      {canEdit && (
        <Link
          to={`/n/${slug}/edit${hash}`}
          className="flex min-h-11 items-center border-l-3 border-ink px-4 font-mono text-sm font-bold uppercase no-underline"
        >
          {LP.editText}
        </Link>
      )}
      <button
        type="button"
        disabled={reported}
        onClick={() => void reportPage(slug).then(() => setReported(true))}
        className="min-h-11 cursor-pointer border-0 border-l-3 border-ink bg-paper px-4 font-mono text-sm uppercase disabled:cursor-default"
      >
        {reported ? '✓' : LP.report}
      </button>
    </>
  );

  return (
    <Shell right={actions}>
      <title>{`${page.title} · Lepak Pages`}</title>
      {reported && (
        <p
          role="status"
          className="m-0 border-b-3 border-ink bg-[#ffd23f] px-gutter py-2 font-mono text-sm"
        >
          {LP.reported}
        </p>
      )}
      {page.kind === 'note' && <NoteView page={page} />}
      {page.kind === 'pdf' && <PdfView page={page} />}
      {page.kind === 'doc' && <DocView page={page} />}
      {page.kind === 'html' && <HtmlView page={page} />}
    </Shell>
  );
}

function NoteView({ page }: { page: PageRecord }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void renderMarkdown(page.body ?? '').then((h) => alive && setHtml(h));
    return () => {
      alive = false;
    };
  }, [page.body]);

  return (
    <main className="mx-auto w-full max-w-3xl px-gutter py-[clamp(24px,5vw,56px)]">
      <h1 className="heading-lg m-0 mb-8 break-words">{page.title}</h1>
      {html === null ? (
        <p className="font-mono">{LP.loading}</p>
      ) : (
        // Sanitised by DOMPurify in renderMarkdown.
        <article className="lp-prose" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <p className="mt-16 font-mono text-xs text-mute">
        <Link to="/pages">{LP.madeWith}</Link> · updated{' '}
        {new Date(page.updated_at).toLocaleDateString()}
      </p>
    </main>
  );
}

function PdfView({ page }: { page: PageRecord }) {
  const url = pageFileUrl(`${page.slug}/${page.file_path ?? 'file.pdf'}`);
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-ink px-gutter py-3">
        <h1 className="m-0 truncate text-xl font-black uppercase">{page.title}</h1>
        <a
          href={url}
          download
          className="inline-flex min-h-11 items-center border-3 border-ink bg-ink px-4 font-mono text-sm font-bold text-paper uppercase no-underline"
        >
          {LP.download}
        </a>
      </div>
      <iframe title={page.title} src={url} className="min-h-[80dvh] w-full flex-1 border-0" />
    </main>
  );
}

/**
 * A Word file shown with its own fonts, tables and pictures. It's drawn into a frame
 * with scripts switched off, so nothing inside a document can run.
 */
function DocView({ page }: { page: PageRecord }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const url = pageFileUrl(`${page.slug}/${page.file_path ?? 'file.docx'}`);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [blob, { renderAsync }] = await Promise.all([
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.blob();
        }),
        import('docx-preview'),
      ]);
      const doc = frame.current?.contentDocument;
      if (!alive || !doc) return;
      doc.body.innerHTML = '';
      doc.body.style.margin = '0';
      doc.body.style.background = '#e5e7eb';
      await renderAsync(blob, doc.body, doc.head, {
        inWrapper: true,
        ignoreLastRenderedPageBreak: true,
      });
      if (alive) setState('ready');
    })().catch(() => alive && setState('failed'));
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-ink px-gutter py-3">
        <h1 className="m-0 truncate text-xl font-black uppercase">{page.title}</h1>
        <a
          href={url}
          download
          className="inline-flex min-h-11 items-center border-3 border-ink bg-ink px-4 font-mono text-sm font-bold text-paper uppercase no-underline"
        >
          {LP.downloadDoc}
        </a>
      </div>
      {state !== 'ready' && (
        <p role="status" className="px-gutter py-6 font-mono">
          {state === 'failed' ? LP.errors.generic : LP.loading}
        </p>
      )}
      <iframe
        ref={frame}
        title={page.title}
        // same-origin lets us draw into it; no allow-scripts means nothing inside can run
        sandbox="allow-same-origin"
        srcDoc="<!doctype html><html><head></head><body></body></html>"
        className={`w-full flex-1 border-0 ${state === 'ready' ? '' : 'h-0'}`}
        style={state === 'ready' ? { minHeight: 'calc(100dvh - 120px)' } : undefined}
      />
    </main>
  );
}

/**
 * Someone's uploaded site. It runs in a sandboxed frame WITHOUT allow-same-origin, so its
 * scripts get a blank, separate origin: they can't read Lepak's storage, sign-in or cookies.
 */
function HtmlView({ page }: { page: PageRecord }) {
  const [doc, setDoc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const entry = page.file_path ?? 'index.html';
  const folder = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : '';

  useEffect(() => {
    let alive = true;
    fetch(pageFileUrl(`${page.slug}/${entry}`))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((html) => alive && setDoc(withBase(html, pageFileUrl(`${page.slug}/${folder}`))))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [page.slug, entry, folder]);

  if (failed) return <p className="px-gutter py-16 font-mono">{LP.errors.generic}</p>;
  if (doc === null) return <p className="px-gutter py-16 font-mono">{LP.loading}</p>;
  return (
    <iframe
      title={page.title}
      srcDoc={doc}
      sandbox="allow-scripts allow-forms allow-popups allow-modals"
      referrerPolicy="no-referrer"
      className="w-full flex-1 border-0"
      style={{ minHeight: 'calc(100dvh - 48px)' }}
    />
  );
}

// ---------- edit ----------

function EditPage() {
  const { slug = '' } = useParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { page, failed } = usePage(slug);
  const key = editKeyFor(slug, hash);
  const [title, setTitle] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!supabaseEnabled) return <Message text={LP.offline} />;
  if (failed) return <Message text={LP.errors.generic} />;
  if (page === undefined) return <Message text={LP.loading} />;
  if (page === null) return <Message text={LP.notFound} />;
  if (!page.is_owner && !key) return <Message text={LP.noAccess} />;

  const t = title ?? page.title;
  const b = body ?? page.body ?? '';

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    const ok = await updatePage({
      slug,
      editKey: key,
      title: t.trim() || slug,
      body: page!.kind === 'note' ? b : undefined,
    }).catch(() => false);
    if (!ok) return setStatus(LP.noAccess);
    // Remember the key on this device, so the edit link isn't needed next time.
    if (key)
      savePageLocally({ slug, title: t, kind: page!.kind, editKey: key, createdAt: Date.now() });
    setStatus(LP.saved);
  }

  async function onDelete() {
    if (!window.confirm(LP.confirmDelete)) return;
    const ok = await deletePage(slug, key).catch(() => false);
    if (ok) navigate('/pages');
    else setStatus(LP.noAccess);
  }

  return (
    <Shell>
      <title>{`Edit ${page.title} · Lepak Pages`}</title>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-gutter py-[clamp(24px,5vw,56px)]">
        <p className="m-0 font-mono text-sm">
          <Link to={`/n/${slug}`}>← /n/{slug}</Link>
        </p>
        <form onSubmit={onSave} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ed-title" className="font-mono text-xs uppercase">
              {LP.titleLabel}
            </label>
            <input
              id="ed-title"
              value={t}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 border-3 border-ink bg-paper px-3 text-lg"
            />
          </div>
          {page.kind === 'note' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-body" className="font-mono text-xs uppercase">
                {LP.bodyLabel}
              </label>
              <textarea
                id="ed-body"
                value={b}
                maxLength={MAX_NOTE_CHARS}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[50vh] resize-y border-3 border-ink bg-paper p-3 font-mono text-[15px] leading-relaxed"
              />
            </div>
          )}
          <p role="status" className="m-0 min-h-6 font-mono text-sm font-bold">
            {status}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              className="push h-14 cursor-pointer border-3 border-ink bg-ink px-8 font-mono text-lg font-bold text-paper uppercase shadow-hard"
            >
              {LP.save}
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
            >
              {LP.delete}
            </button>
          </div>
        </form>
      </main>
    </Shell>
  );
}
