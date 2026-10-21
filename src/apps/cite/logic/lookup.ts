// Autofill for citations. Paste a link, DOI or ISBN:
//   PubMed Central / PubMed links -> Europe PMC (free, no key, browser-friendly)
//   arXiv links and DOIs not in Crossref -> doi.org (CSL JSON)
//   DOIs -> Crossref     ISBNs -> Open Library
//   any other web page -> our /api/meta server function reads the page's citation tags
// The map* functions are pure (tested); lookup() does the fetching.

import type { Person, Source, SourceDate } from './cite';
import { parseDateParts, type PageMeta } from './meta';

export type LookupKind = 'doi' | 'isbn' | 'pmc' | 'pmid' | 'arxiv' | 'url';

/** Works out what the user pasted. Specific link types win over a DOI hidden inside a URL. */
export function detectId(input: string): { kind: LookupKind; id: string } | null {
  const s = input.trim();
  const pmc = /\bPMC(\d{4,9})\b/i.exec(s);
  if (pmc) return { kind: 'pmc', id: `PMC${pmc[1]}` };
  const pmid = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d{4,9})/i.exec(s);
  if (pmid) return { kind: 'pmid', id: pmid[1]! };
  const arxiv = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})/i.exec(s);
  if (arxiv) return { kind: 'arxiv', id: arxiv[1]! };
  const doi = /(10\.\d{4,9}\/[^\s"<>?#]+)/i.exec(s);
  if (doi) return { kind: 'doi', id: doi[1]!.replace(/[.,;]+$/, '') };
  const digits = s.replace(/[\s-]/g, '').toUpperCase();
  if (/^(97[89])?\d{9}[\dX]$/.test(digits)) return { kind: 'isbn', id: digits };
  if (/^https?:\/\/[^\s]+\.[^\s]+/i.test(s)) return { kind: 'url', id: s };
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return { kind: 'url', id: `https://${s}` };
  return null;
}

/** "Siti Nur Rahman" -> { first: "Siti Nur", last: "Rahman" }. "Rahman, Siti" also works. */
export function splitName(full: string): Person {
  const name = full.trim();
  if (name.includes(',')) {
    const [last, first] = name.split(',', 2).map((p) => p.trim());
    return { first: first ?? '', last: last ?? '' };
  }
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0]! };
  return { first: parts.slice(0, -1).join(' '), last: parts.at(-1)! };
}

// ---------- Crossref ----------

interface CrossrefWork {
  type?: string;
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  issued?: { 'date-parts'?: number[][] };
  'container-title'?: string[];
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
  URL?: string;
}

export function mapCrossref(work: CrossrefWork): Source {
  const [year, month, day] = work.issued?.['date-parts']?.[0] ?? [];
  const date: SourceDate = { year, month, day };
  const isBook = work.type === 'book' || work.type === 'monograph' || work.type === 'edited-book';
  return {
    type: isBook ? 'book' : 'journal',
    authors: (work.author ?? []).map((a) =>
      a.family
        ? { first: a.given ?? '', last: a.family }
        : { first: '', last: a.name ?? '', org: true },
    ),
    date: isBook ? { year } : date,
    title: work.title?.[0] ?? '',
    container: work['container-title']?.[0],
    publisher: work.publisher,
    volume: work.volume,
    issue: work.issue,
    pages: work.page,
    doi: work.DOI,
  };
}

// ---------- doi.org CSL JSON (DataCite DOIs such as arXiv, Zenodo) ----------

interface CslItem {
  type?: string;
  title?: string;
  author?: { given?: string; family?: string; literal?: string }[];
  issued?: { 'date-parts'?: number[][] };
  'container-title'?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
  URL?: string;
}

export function mapCsl(item: CslItem): Source {
  const [year, month, day] = item.issued?.['date-parts']?.[0] ?? [];
  const isBook = item.type === 'book';
  const isJournal = item.type === 'article-journal' || !!item['container-title'];
  return {
    type: isBook ? 'book' : isJournal ? 'journal' : 'website',
    authors: (item.author ?? []).map((a) =>
      a.family
        ? { first: a.given ?? '', last: a.family }
        : { first: '', last: a.literal ?? '', org: true },
    ),
    date: isBook ? { year } : { year, month, day },
    title: item.title ?? '',
    container: item['container-title'] || (isJournal || isBook ? undefined : item.publisher),
    publisher: item.publisher,
    volume: item.volume,
    issue: item.issue,
    pages: item.page,
    doi: item.DOI,
  };
}

// ---------- Europe PMC (PubMed Central, PubMed) ----------

interface EuropePmcResult {
  title?: string;
  authorList?: { author?: { firstName?: string; lastName?: string; collectiveName?: string }[] };
  journalInfo?: {
    volume?: string;
    issue?: string;
    printPublicationDate?: string;
    yearOfPublication?: number;
    journal?: { title?: string };
  };
  pageInfo?: string;
  doi?: string;
  firstPublicationDate?: string;
}

export function mapEuropePmc(r: EuropePmcResult): Source {
  const date = parseDateParts(r.journalInfo?.printPublicationDate ?? r.firstPublicationDate);
  return {
    type: 'journal',
    authors: (r.authorList?.author ?? []).map((a) =>
      a.lastName
        ? { first: a.firstName ?? '', last: a.lastName }
        : { first: '', last: a.collectiveName ?? '', org: true },
    ),
    date: { year: date.year ?? r.journalInfo?.yearOfPublication, month: date.month, day: date.day },
    // Europe PMC titles end with a full stop; the formatter adds its own.
    title: (r.title ?? '').replace(/\.$/, ''),
    container: r.journalInfo?.journal?.title,
    volume: r.journalInfo?.volume,
    issue: r.journalInfo?.issue,
    pages: r.pageInfo,
    doi: r.doi,
  };
}

// ---------- Open Library ----------

interface OpenLibraryBook {
  title?: string;
  subtitle?: string;
  authors?: { name: string }[];
  publishers?: { name: string }[];
  publish_date?: string;
}

export function mapOpenLibrary(book: OpenLibraryBook): Source {
  const year = Number(/\d{4}/.exec(book.publish_date ?? '')?.[0]) || undefined;
  return {
    type: 'book',
    authors: (book.authors ?? []).map((a) => splitName(a.name)),
    date: { year },
    title: book.subtitle ? `${book.title}: ${book.subtitle}` : (book.title ?? ''),
    publisher: book.publishers?.[0]?.name,
  };
}

// ---------- any web page (via /api/meta) ----------

/** "https://www.who.int/news/x" -> "who.int": a last-resort site name. */
function siteFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function mapPageMeta(m: PageMeta, url: string): Source {
  m = { ...m, siteName: m.siteName ?? siteFromUrl(m.url ?? url) };
  const date = parseDateParts(m.date);
  const pages = m.firstPage
    ? m.lastPage
      ? `${m.firstPage}-${m.lastPage}`
      : m.firstPage
    : undefined;
  const authors = m.authors.map(splitName).filter((a) => a.last);
  // A site that lists itself as the author (e.g. "BBC") is an organisation.
  if (!authors.length && m.siteName && !m.journal)
    authors.push({ first: '', last: m.siteName, org: true });
  return {
    type: m.journal ? 'journal' : 'website',
    authors,
    date,
    title: (m.title ?? '').replace(/\s+[|·–-]\s+[^|·–-]+$/, ''), // drop " | Site name" suffixes
    container: m.journal ?? m.siteName,
    publisher: m.publisher,
    volume: m.volume,
    issue: m.issue,
    pages,
    doi: m.doi,
    url: m.doi ? undefined : (m.url ?? url),
  };
}

// ---------- fetching ----------

export type LookupResult = Source | 'not-found' | 'bad-input' | 'no-server' | 'busy';

async function json<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, init);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

async function byDoi(doi: string): Promise<Source | null> {
  const cr = await json<{ message: CrossrefWork }>(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
  ).catch(() => null);
  if (cr) return mapCrossref(cr.message);
  // Not a Crossref DOI (e.g. arXiv, Zenodo use DataCite): ask doi.org for CSL JSON.
  const csl = await json<CslItem>(`https://doi.org/${doi}`, {
    headers: { Accept: 'application/vnd.citationstyles.csl+json' },
  }).catch(() => null);
  return csl ? mapCsl(csl) : null;
}

async function byEuropePmc(query: string): Promise<Source | null> {
  const body = await json<{ resultList?: { result?: EuropePmcResult[] } }>(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core`,
  );
  const r = body?.resultList?.result?.[0];
  return r ? mapEuropePmc(r) : null;
}

export async function lookup(input: string): Promise<LookupResult> {
  const found = detectId(input);
  if (!found) return 'bad-input';
  let source: Source | null = null;

  switch (found.kind) {
    case 'pmc':
      source = await byEuropePmc(`PMCID:${found.id}`);
      break;
    case 'pmid':
      source = await byEuropePmc(`EXT_ID:${found.id} AND SRC:MED`);
      break;
    case 'arxiv':
      source = await byDoi(`10.48550/arXiv.${found.id}`);
      if (source) source = { ...source, url: `https://arxiv.org/abs/${found.id}` };
      break;
    case 'doi':
      source = await byDoi(found.id);
      break;
    case 'isbn': {
      const key = `ISBN:${found.id}`;
      const body = await json<Record<string, OpenLibraryBook>>(
        `https://openlibrary.org/api/books?bibkeys=${key}&format=json&jscmd=data`,
      );
      source = body?.[key] ? mapOpenLibrary(body[key]) : null;
      break;
    }
    case 'url': {
      const res = await fetch(`/api/meta?url=${encodeURIComponent(found.id)}`);
      if (res.status === 404 && res.headers.get('content-type')?.includes('text/html')) {
        return 'no-server'; // the server function isn't running (e.g. plain static preview)
      }
      if (res.status === 429) return 'busy';
      if (!res.ok) return 'not-found';
      const meta = (await res.json()) as PageMeta;
      // Pages that carry a DOI get the full journal details from Crossref.
      source = (meta.doi ? await byDoi(meta.doi) : null) ?? mapPageMeta(meta, found.id);
      if (source && source.type === 'website' && !source.url) source = { ...source, url: found.id };
      break;
    }
  }
  return source && source.title ? source : 'not-found';
}
