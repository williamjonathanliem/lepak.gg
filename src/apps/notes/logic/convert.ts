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

/** Markdown to HTML that's safe to put on the page: scripts, handlers and iframes are stripped. */
export async function renderMarkdown(md: string): Promise<string> {
  const [{ marked }, { default: DOMPurify }] = await Promise.all([
    import('marked'),
    import('dompurify'),
  ]);
  const html = await marked.parse(md, { gfm: true, breaks: true });
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['style'],
  });
  // Links open in a new tab and can't reach back into this page.
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer nofollow" ');
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
