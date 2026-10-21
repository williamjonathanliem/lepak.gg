// Citation formatting: APA 7, MLA 9 and Harvard (Cite Them Right). Pure functions.
// Output is a list of pieces so the UI can show italics and copy as rich text or plain text.

export type Style = 'apa' | 'mla' | 'harvard';
export type SourceType = 'website' | 'journal' | 'book' | 'video';

export interface Person {
  /** Given names, e.g. "Siti Nur". Empty for an organisation. */
  first: string;
  /** Family name, or the organisation's full name. */
  last: string;
  org?: boolean;
}

export interface SourceDate {
  year?: number;
  month?: number; // 1-12
  day?: number;
}

export interface Source {
  type: SourceType;
  authors: Person[];
  date: SourceDate;
  title: string;
  /** Website name, journal name, or YouTube/platform for videos. */
  container?: string;
  publisher?: string;
  edition?: string; // e.g. "3"
  volume?: string;
  issue?: string;
  pages?: string; // e.g. "45-67"
  doi?: string; // bare DOI, e.g. 10.1000/xyz
  url?: string;
  accessed?: SourceDate; // used by Harvard for web sources
}

export interface Piece {
  text: string;
  italic?: boolean;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MLA_MONTHS = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
];

// ---------- small helpers ----------

const clean = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ');

/** "Siti Nur" -> "S. N." */
export function initials(first: string): string {
  return clean(first)
    .split(/[\s]+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split('-')
        .map((p) => `${p[0]!.toUpperCase()}.`)
        .join('-'),
    )
    .join(' ');
}

/** Adds a full stop unless the text already ends with . ? or ! */
function stop(text: string): string {
  return /[.?!]$/.test(text) ? text : `${text}.`;
}

function doiUrl(doi?: string): string {
  const d = clean(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return d ? `https://doi.org/${d}` : '';
}

function link(s: Source): string {
  return doiUrl(s.doi) || clean(s.url);
}

function realAuthors(s: Source): Person[] {
  return s.authors.filter((a) => clean(a.last));
}

// ---------- APA 7 ----------

function apaName(p: Person): string {
  if (p.org) return clean(p.last);
  const init = initials(p.first);
  return init ? `${clean(p.last)}, ${init}` : clean(p.last);
}

/** APA author list: up to 20 names; with 21 or more, the first 19, "...", then the last. */
export function apaAuthors(people: Person[]): string {
  const names = people.map(apaName);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) return `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`;
  return `${names.slice(0, 19).join(', ')}, . . . ${names.at(-1)}`;
}

function apaDate(s: Source): string {
  const { year, month, day } = s.date;
  if (!year) return '(n.d.)';
  // Dated web content and videos show month and day when known.
  if ((s.type === 'website' || s.type === 'video') && month) {
    return `(${year}, ${MONTHS[month - 1]}${day ? ` ${day}` : ''})`;
  }
  return `(${year})`;
}

function apa(s: Source): Piece[] {
  const authors = realAuthors(s);
  const title = clean(s.title);
  const out: Piece[] = [];
  // With no author, the title moves to the front.
  if (authors.length) out.push({ text: `${stop(apaAuthors(authors))} ${apaDate(s)}. ` });
  const titleFirst = authors.length === 0;

  switch (s.type) {
    case 'journal': {
      const head = `${stop(title)} `;
      if (titleFirst) out.push({ text: `${head}${apaDate(s)}. ` });
      else out.push({ text: head });
      if (clean(s.container)) {
        out.push({ text: clean(s.container), italic: true });
        if (clean(s.volume)) {
          out.push({ text: ', ' });
          out.push({ text: clean(s.volume), italic: true });
        }
        if (clean(s.issue)) out.push({ text: `(${clean(s.issue)})` });
        if (clean(s.pages)) out.push({ text: `, ${clean(s.pages).replace(/-/g, '–')}` });
        out.push({ text: '. ' });
      }
      break;
    }
    case 'book': {
      out.push({ text: title, italic: true });
      if (clean(s.edition)) out.push({ text: ` (${ordinal(clean(s.edition))} ed.)` });
      out.push({ text: titleFirst ? `. ${apaDate(s)}. ` : '. ' });
      if (clean(s.publisher)) out.push({ text: `${stop(clean(s.publisher))} ` });
      break;
    }
    case 'video': {
      out.push({ text: title, italic: true });
      out.push({ text: ' [Video]' });
      out.push({ text: titleFirst ? `. ${apaDate(s)}. ` : '. ' });
      if (clean(s.container)) out.push({ text: `${stop(clean(s.container))} ` });
      break;
    }
    case 'website': {
      out.push({ text: title, italic: true });
      out.push({ text: titleFirst ? `. ${apaDate(s)}. ` : '. ' });
      // Skip the site name when it's the same as the author.
      const site = clean(s.container);
      const sameAsAuthor =
        authors.length === 1 && authors[0]!.org && clean(authors[0]!.last) === site;
      if (site && !sameAsAuthor) out.push({ text: `${stop(site)} ` });
      break;
    }
  }
  const l = link(s);
  if (l) out.push({ text: l });
  return trimEnd(out);
}

/** In-text: (Lim, 2024), (Lim & Tan, 2024), (Lim et al., 2024), or the title if there's no author. */
export function apaInText(s: Source): string {
  const a = realAuthors(s);
  const year = s.date.year ?? 'n.d.';
  if (a.length === 0) {
    const t = clean(s.title);
    const short = t.split(' ').slice(0, 4).join(' ');
    return `(${s.type === 'journal' ? `"${short}"` : short}, ${year})`;
  }
  const last = (p: Person) => clean(p.last);
  if (a.length === 1) return `(${last(a[0]!)}, ${year})`;
  if (a.length === 2) return `(${last(a[0]!)} & ${last(a[1]!)}, ${year})`;
  return `(${last(a[0]!)} et al., ${year})`;
}

// ---------- MLA 9 ----------

function mlaAuthors(people: Person[]): string {
  const name = (p: Person, inverted: boolean) =>
    p.org || !clean(p.first)
      ? clean(p.last)
      : inverted
        ? `${clean(p.last)}, ${clean(p.first)}`
        : `${clean(p.first)} ${clean(p.last)}`;
  if (people.length === 0) return '';
  if (people.length === 1) return name(people[0]!, true);
  if (people.length === 2) return `${name(people[0]!, true)}, and ${name(people[1]!, false)}`;
  return `${name(people[0]!, true)}, et al`;
}

function mlaDate(d: SourceDate): string {
  if (!d.year) return '';
  if (!d.month) return String(d.year);
  return `${d.day ? `${d.day} ` : ''}${MLA_MONTHS[d.month - 1]} ${d.year}`;
}

function mla(s: Source): Piece[] {
  const out: Piece[] = [];
  const authors = realAuthors(s);
  if (authors.length) out.push({ text: `${stop(mlaAuthors(authors))} ` });
  const title = clean(s.title);
  const date = mlaDate(s.date);
  const l = s.doi ? doiUrl(s.doi) : clean(s.url).replace(/^https?:\/\//, '');

  if (s.type === 'book') {
    out.push({ text: title, italic: true });
    out.push({ text: '. ' });
    if (clean(s.edition)) out.push({ text: `${ordinal(clean(s.edition))} ed., ` });
    const tail = [clean(s.publisher), date].filter(Boolean).join(', ');
    if (tail) out.push({ text: `${tail}.` });
  } else {
    out.push({ text: `“${stop(title)}” ` });
    if (clean(s.container)) {
      out.push({ text: clean(s.container), italic: true });
      out.push({ text: ', ' });
    }
    const parts: string[] = [];
    if (s.type === 'journal') {
      if (clean(s.volume)) parts.push(`vol. ${clean(s.volume)}`);
      if (clean(s.issue)) parts.push(`no. ${clean(s.issue)}`);
    }
    if (date) parts.push(date);
    if (s.type === 'journal' && clean(s.pages))
      parts.push(`pp. ${clean(s.pages).replace(/-/g, '–')}`);
    if (l) parts.push(l);
    if (parts.length) out.push({ text: `${parts.join(', ')}.` });
  }
  return trimEnd(out);
}

export function mlaInText(s: Source): string {
  const a = realAuthors(s);
  if (a.length === 0) return `(“${clean(s.title).split(' ').slice(0, 4).join(' ')}”)`;
  if (a.length === 1) return `(${clean(a[0]!.last)})`;
  if (a.length === 2) return `(${clean(a[0]!.last)} and ${clean(a[1]!.last)})`;
  return `(${clean(a[0]!.last)} et al.)`;
}

// ---------- Harvard (Cite Them Right) ----------

function harvardAuthors(people: Person[]): string {
  const names = people.map((p) =>
    p.org ? clean(p.last) : `${clean(p.last)}, ${initials(p.first)}`.replace(/, $/, ''),
  );
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${names[0]} et al.`;
}

function harvard(s: Source, today: SourceDate): Piece[] {
  const out: Piece[] = [];
  const authors = realAuthors(s);
  const year = s.date.year ? String(s.date.year) : 'no date';
  const title = clean(s.title);
  if (authors.length) out.push({ text: `${harvardAuthors(authors)} (${year}) ` });

  if (s.type === 'journal') {
    out.push({ text: `‘${title}’, ` });
    if (clean(s.container)) out.push({ text: clean(s.container), italic: true });
    const vol = clean(s.volume)
      ? `, ${clean(s.volume)}${clean(s.issue) ? `(${clean(s.issue)})` : ''}`
      : '';
    const pages = clean(s.pages) ? `, pp. ${clean(s.pages).replace(/-/g, '–')}` : '';
    out.push({ text: `${vol}${pages}. ` });
    if (s.doi) out.push({ text: `Available at: ${doiUrl(s.doi)}.` });
  } else if (s.type === 'book') {
    out.push({ text: title, italic: true });
    out.push({ text: '. ' });
    if (clean(s.edition)) out.push({ text: `${ordinal(clean(s.edition))} edn. ` });
    if (clean(s.publisher)) out.push({ text: `${stop(clean(s.publisher))}` });
  } else {
    out.push({ text: title, italic: true });
    out.push({ text: s.type === 'video' ? ' [Video]. ' : '. ' });
    const l = link(s);
    if (l) {
      const acc = s.accessed?.year ? s.accessed : today;
      out.push({
        text: `Available at: ${l} (Accessed: ${acc.day ?? 1} ${MONTHS[(acc.month ?? 1) - 1]} ${acc.year}).`,
      });
    }
  }
  if (!authors.length) out.unshift({ text: '' });
  return trimEnd(out);
}

export function harvardInText(s: Source): string {
  const a = realAuthors(s);
  const year = s.date.year ? String(s.date.year) : 'no date';
  if (a.length === 0) return `(${clean(s.title).split(' ').slice(0, 4).join(' ')}, ${year})`;
  if (a.length === 1) return `(${clean(a[0]!.last)}, ${year})`;
  if (a.length <= 3) {
    const last = a.map((p) => clean(p.last));
    return `(${last.slice(0, -1).join(', ')} and ${last.at(-1)}, ${year})`;
  }
  return `(${clean(a[0]!.last)} et al., ${year})`;
}

// ---------- shared ----------

function ordinal(n: string): string {
  const num = Number.parseInt(n, 10);
  if (!Number.isFinite(num)) return n;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return `${num}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function trimEnd(pieces: Piece[]): Piece[] {
  const out = pieces.filter((p) => p.text !== '');
  const last = out.at(-1);
  if (last) out[out.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') };
  return out;
}

export function cite(s: Source, style: Style, today: SourceDate = todayParts()): Piece[] {
  if (style === 'mla') return mla(s);
  if (style === 'harvard') return harvard(s, today);
  return apa(s);
}

export function inText(s: Source, style: Style): string {
  if (style === 'mla') return mlaInText(s);
  if (style === 'harvard') return harvardInText(s);
  return apaInText(s);
}

export function toPlain(pieces: Piece[]): string {
  return pieces.map((p) => p.text).join('');
}

const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Rich text for pasting into Word or Google Docs with italics kept. */
export function toHtml(pieces: Piece[]): string {
  return pieces.map((p) => (p.italic ? `<i>${escape(p.text)}</i>` : escape(p.text))).join('');
}

/** Sort key for the reference list: first author's family name, else the title. */
export function sortKey(s: Source): string {
  const a = realAuthors(s)[0];
  return (a ? clean(a.last) : clean(s.title)).toLowerCase();
}

export function todayParts(now = new Date()): SourceDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}
