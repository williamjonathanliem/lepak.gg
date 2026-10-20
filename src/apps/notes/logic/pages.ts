// Lepak Pages rules. Pure functions, no network, no React.

export type PageKind = 'note' | 'pdf' | 'html' | 'doc';

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the bucket limit in supabase/schema.sql
export const MAX_SITE_FILES = 200;
export const MAX_NOTE_CHARS = 200_000;

/** Must match private.reserved_slugs in supabase/schema.sql. */
export const RESERVED_SLUGS = new Set([
  'new',
  'edit',
  'admin',
  'api',
  'www',
  'lepak',
  'hub',
  'help',
  'login',
  'settings',
  'about',
  'terms',
  'privacy',
]);

/** "Bio Chapter 3: Cells!" -> "bio-chapter-3-cells" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

export type SlugError = 'too-short' | 'too-long' | 'bad-chars' | 'reserved';

export function checkSlug(slug: string): SlugError | null {
  if (slug.length < SLUG_MIN) return 'too-short';
  if (slug.length > SLUG_MAX) return 'too-long';
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return 'bad-chars';
  if (RESERVED_SLUGS.has(slug)) return 'reserved';
  return null;
}

/** Random suffix so a suggested slug is unlikely to be taken: "bio-notes-k3x9". */
export function withSuffix(slug: string, randomInt: (max: number) => number): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let tag = '';
  for (let i = 0; i < 4; i++) tag += abc[randomInt(abc.length)];
  const base = slug.slice(0, SLUG_MAX - 5).replace(/-+$/g, '') || 'page';
  return `${base}-${tag}`;
}

/** Secret edit key: 32 url-safe characters from the browser's crypto. */
export function newEditKey(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(24))): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------- files ----------

const MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  woff: 'font/woff',
  woff2: 'font/woff2',
  pdf: 'application/pdf',
};

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1]!.toLowerCase() : '';
}

/** Content type for a site file, or null if we don't host that kind of file. */
export function mimeFor(name: string): string | null {
  return MIME[extOf(name)] ?? null;
}

export type DropKind = 'markdown' | 'docx' | 'pdf' | 'html' | 'zip' | 'unsupported';

export function classifyFile(name: string): DropKind {
  const ext = extOf(name);
  if (ext === 'md' || ext === 'markdown' || ext === 'txt') return 'markdown';
  if (ext === 'docx') return 'docx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'zip') return 'zip';
  return 'unsupported';
}

/** Turns zip entry paths into safe relative paths, dropping folders, junk and anything sneaky. */
export function cleanSitePath(path: string): string | null {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0 || path.endsWith('/')) return null; // folder entry
  if (parts.some((p) => p === '..' || p === '.' || p.startsWith('.'))) return null; // ../, .DS_Store
  if (parts[0] === '__MACOSX') return null;
  if (!mimeFor(parts[parts.length - 1]!)) return null;
  return parts.join('/');
}

/**
 * Many zips wrap everything in one folder ("my-site/index.html"). Strip that shared
 * folder so index.html sits at the top.
 */
export function stripCommonFolder(paths: string[]): string[] {
  if (paths.length === 0) return paths;
  const first = paths[0]!.split('/');
  if (first.length < 2) return paths;
  const top = first[0]!;
  if (!paths.every((p) => p.startsWith(`${top}/`))) return paths;
  return paths.map((p) => p.slice(top.length + 1));
}

/** The page to open first: index.html at the top, else the shallowest .html file. */
export function findEntry(paths: string[]): string | null {
  if (paths.includes('index.html')) return 'index.html';
  const html = paths
    .filter((p) => /\.html?$/i.test(p))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  return html[0] ?? null;
}

// ---------- pages you made on this device ----------

export interface MyPage {
  slug: string;
  title: string;
  kind: PageKind;
  editKey: string;
  createdAt: number;
}

/** Adds or replaces a page in the "my pages" list, newest first, capped at 100. */
export function rememberPage(list: MyPage[], page: MyPage): MyPage[] {
  return [page, ...list.filter((p) => p.slug !== page.slug)].slice(0, 100);
}
