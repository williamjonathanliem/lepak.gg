// File conversions for Lepak Pages. Each heavy library loads only when needed.

import {
  MAX_FILE_BYTES,
  MAX_SITE_FILES,
  cleanSitePath,
  findEntry,
  mimeFor,
  stripCommonFolder,
} from './pages';
import type { SiteFile } from '../net/pagesApi';

// Maths: $inline$ and $$display$$. The tokenizer turns them into empty placeholder spans that
// survive sanitising; KaTeX fills them in afterwards. KaTeX escapes its input and runs with
// trust: false, so formulas can't inject HTML.
// $ then a non-space, escaped chars or anything but \ newline $, a non-space, then $ not followed
// by a digit (so "$5 and $10" stays plain text).
const INLINE_MATH = /^\$(?!\s)((?:\\.|[^\\\n$])+?)(?<!\s)\$(?!\d)/;
const BLOCK_MATH = /^\$\$([\s\S]+?)\$\$/;

function mathSpan(tex: string, display: boolean): string {
  return `<span data-math="${encodeURIComponent(tex.trim())}" data-display="${display ? 1 : 0}"></span>`;
}

const mathExtension = {
  extensions: [
    {
      name: 'mathBlock',
      level: 'block' as const,
      start: (src: string) => src.indexOf('$$'),
      tokenizer(src: string) {
        const m = BLOCK_MATH.exec(src);
        return m ? { type: 'mathBlock', raw: m[0], text: m[1]! } : undefined;
      },
      renderer: (t: { text?: string }) => `<p>${mathSpan(t.text ?? '', true)}</p>`,
    },
    {
      name: 'mathInline',
      level: 'inline' as const,
      start: (src: string) => src.indexOf('$'),
      tokenizer(src: string) {
        const m = BLOCK_MATH.exec(src) ?? INLINE_MATH.exec(src);
        if (!m) return undefined;
        return { type: 'mathInline', raw: m[0], text: m[1]!, display: m[0].startsWith('$$') };
      },
      renderer: (t: { text?: string; display?: boolean }) => mathSpan(t.text ?? '', !!t.display),
    },
  ],
};

/**
 * Markdown to HTML that's safe to put on the page: scripts, handlers and iframes are stripped.
 * Supports maths ($...$, $$...$$). Mermaid diagrams are drawn later by drawDiagrams().
 */
export async function renderMarkdown(md: string): Promise<string> {
  const [{ Marked }, { default: DOMPurify }] = await Promise.all([
    import('marked'),
    import('dompurify'),
  ]);
  const marked = new Marked({ gfm: true, breaks: true }, mathExtension);
  const html = await marked.parse(md);
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['style'],
  });

  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  // Links open in a new tab and can't reach back into this page.
  tpl.content.querySelectorAll('a').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
  });
  const maths = tpl.content.querySelectorAll<HTMLElement>('[data-math]');
  if (maths.length) {
    const [{ default: katex }] = await Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ]);
    maths.forEach((el) => {
      el.outerHTML = katex.renderToString(decodeURIComponent(el.dataset.math ?? ''), {
        displayMode: el.dataset.display === '1',
        throwOnError: false,
        trust: false,
        strict: 'ignore',
      });
    });
  }
  return tpl.innerHTML;
}

let diagramCount = 0;

/**
 * Draws ```mermaid code blocks inside `root` as diagrams. Mermaid runs in strict mode
 * (no scripts, no clicks, HTML labels escaped). Loaded only when a note has a diagram.
 */
export async function drawDiagrams(root: HTMLElement): Promise<void> {
  const blocks = root.querySelectorAll<HTMLElement>('code.language-mermaid');
  if (!blocks.length) return;
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
  for (const code of blocks) {
    const pre = code.closest('pre') ?? code;
    try {
      const { svg } = await mermaid.render(`lp-diagram-${++diagramCount}`, code.textContent ?? '');
      const figure = document.createElement('figure');
      figure.className = 'lp-diagram';
      figure.innerHTML = svg;
      pre.replaceWith(figure);
    } catch {
      // Leave the code block as is if the diagram has a mistake in it.
    }
  }
}

/**
 * "Snap to text": reads the text in a photo (whiteboard, handwritten or printed notes)
 * right here in the browser with Tesseract. The photo is never uploaded.
 * The first run downloads the reader and English language data (a few MB, then cached).
 */
export async function imageToText(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    // Tidy up: drop empty lines at the ends, collapse runs of blank lines.
    return data.text.replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    await worker.terminate();
  }
}

/** .docx to markdown, keeping headings, lists, bold and links. */
export async function docxToMarkdown(file: File): Promise<string> {
  const [mammoth, { default: TurndownService }] = await Promise.all([
    import('mammoth'),
    import('turndown'),
  ]);
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' }).turndown(html);
}

export interface SiteBundle {
  files: SiteFile[];
  entry: string;
}

export type SiteError = 'no-html' | 'too-big' | 'too-many' | 'empty';

/** A single .html file or a .zip of a site, ready to upload. */
export async function readSite(file: File): Promise<SiteBundle | SiteError> {
  if (/\.html?$/i.test(file.name)) {
    if (file.size > MAX_FILE_BYTES) return 'too-big';
    return {
      entry: 'index.html',
      files: [{ path: 'index.html', data: file, type: 'text/html' }],
    };
  }

  const { unzipSync } = await import('fflate');
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const raw: { clean: string; data: Uint8Array }[] = [];
  for (const [path, data] of Object.entries(entries)) {
    const clean = cleanSitePath(path);
    if (clean) raw.push({ clean, data });
  }
  if (raw.length === 0) return 'empty';
  if (raw.length > MAX_SITE_FILES) return 'too-many';
  if (raw.some((e) => e.data.byteLength > MAX_FILE_BYTES)) return 'too-big';

  const paths = stripCommonFolder(raw.map((e) => e.clean));
  const entry = findEntry(paths);
  if (!entry) return 'no-html';
  const files = raw.map((e, i) => {
    const path = paths[i]!;
    const type = mimeFor(path)!;
    return { path, type, data: new Blob([e.data as BlobPart], { type }) };
  });
  return { files, entry };
}

/**
 * Prepares an uploaded site's HTML to run inside a sealed frame: relative links
 * (css/app.js, img/logo.png) point at the hosted files.
 */
export function withBase(html: string, baseUrl: string): string {
  const base = `<base href="${baseUrl.replace(/"/g, '%22')}">`;
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => `${m}${base}`)
    : `${base}${html}`;
}
