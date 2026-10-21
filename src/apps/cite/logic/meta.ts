// Reads citation details out of a web page's HTML: Google Scholar "citation_*" tags
// (used by most journals and PubMed Central), Dublin Core, Open Graph and plain <title>.
// Pure string parsing, so it runs both in the browser tests and in the server function.

export interface PageMeta {
  title?: string;
  authors: string[];
  date?: string; // as found, e.g. "2015/10/02" or "2015-10-02"
  siteName?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  firstPage?: string;
  lastPage?: string;
  doi?: string;
  publisher?: string;
  url?: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every <meta name|property="..." content="..."> as [key (lowercase), value] pairs, in order. */
function metaTags(html: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = /\b(?:name|property|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (key && content) out.push([key.toLowerCase(), decode(content[1] ?? content[2] ?? '')]);
  }
  return out;
}

interface LdInfo {
  title?: string;
  date?: string;
  authors: string[];
  publisher?: string;
}

/** Article details from schema.org JSON-LD blocks (common on news sites). Bad JSON is skipped. */
function jsonLd(html: string): LdInfo {
  const info: LdInfo = { authors: [] };
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (o['@graph']) visit(o['@graph']);
    const type = String(o['@type'] ?? '');
    if (!/Article|Posting|Report|WebPage|BlogPosting/i.test(type)) return;
    if (!info.title && typeof o.headline === 'string') info.title = o.headline;
    if (!info.date && typeof o.datePublished === 'string') info.date = o.datePublished;
    if (!info.authors.length && o.author) {
      const list = Array.isArray(o.author) ? o.author : [o.author];
      for (const a of list) {
        const name = typeof a === 'string' ? a : (a as { name?: unknown })?.name;
        if (typeof name === 'string' && name.trim()) info.authors.push(name.trim());
      }
    }
    const pub = o.publisher as { name?: unknown } | undefined;
    if (!info.publisher && typeof pub?.name === 'string') info.publisher = pub.name;
  };
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1]!));
    } catch {
      // some sites ship invalid JSON-LD; ignore it
    }
  }
  return info;
}

export function parseMeta(html: string, url?: string): PageMeta {
  const tags = metaTags(html);
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const hit = tags.find(([key, v]) => key === k && v);
      if (hit) return hit[1];
    }
    return undefined;
  };
  const all = (key: string) => tags.filter(([k, v]) => k === key && v).map(([, v]) => v);

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  let authors = all('citation_author');
  if (!authors.length) authors = all('dc.creator');
  if (!authors.length) authors = all('author').flatMap((a) => a.split(/\s*[,;]\s*(?=[A-Z])/));
  const ld = jsonLd(html);
  if (!authors.length) authors = ld.authors;

  return {
    title:
      first('citation_title', 'dc.title', 'og:title', 'twitter:title') ??
      ld.title ??
      (titleTag ? decode(titleTag) : undefined),
    authors,
    date:
      first(
        'citation_publication_date',
        'citation_date',
        'citation_online_date',
        'dc.date',
        'article:published_time',
        'date',
      ) ?? ld.date,
    siteName: first('og:site_name', 'application-name') ?? ld.publisher,
    journal: first('citation_journal_title'),
    volume: first('citation_volume'),
    issue: first('citation_issue'),
    firstPage: first('citation_firstpage'),
    lastPage: first('citation_lastpage'),
    doi: first('citation_doi', 'dc.identifier')
      ?.replace(/^doi:/i, '')
      .match(/10\.\d{4,9}\/\S+/)?.[0],
    publisher: first('citation_publisher', 'dc.publisher'),
    url: first('og:url') ?? url,
  };
}

/** "2015/10/02", "2015-10-02T08:00:00Z", "Oct 2, 2015" -> { year, month, day } */
export function parseDateParts(s?: string): { year?: number; month?: number; day?: number } {
  if (!s) return {};
  if (/^\s*\d{4}\s*$/.test(s)) return { year: Number(s) }; // year only: don't invent a date
  const iso = /(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/.exec(s);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]) || undefined,
      day: iso[3] ? Number(iso[3]) : undefined,
    };
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  const y = /\b(19|20)\d{2}\b/.exec(s);
  return y ? { year: Number(y[0]) } : {};
}
