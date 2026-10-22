// Deadlines: a class board of due dates. Pure: countdowns, sorting, checking new
// deadlines, and calendar files.

export interface Deadline {
  id: string;
  title: string;
  /** Course or subject code, e.g. "BIO1001". */
  course: string;
  /** When it's due (ms). */
  due: number;
  note: string;
  /** Nickname of whoever added it. */
  by: string;
  byUid: string;
}

export interface BoardMeta {
  owner: string;
  title: string;
  /** Anyone with the code can add deadlines (otherwise only the class rep). */
  open: boolean;
}

export const LIMITS = { title: 80, course: 30, note: 200, boardTitle: 60 } as const;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type Urgency = 'overdue' | 'today' | 'soon' | 'later';

/** How soon: overdue, due within the day, within 3 days, or later. */
export function urgency(due: number, now: number): Urgency {
  const left = due - now;
  if (left < 0) return 'overdue';
  if (left < DAY) return 'today';
  if (left < 3 * DAY) return 'soon';
  return 'later';
}

/** "in 3 days 4 h", "in 2 h 15 min", "5 min ago", "2 days ago". */
export function countdown(due: number, now: number): string {
  const left = due - now;
  const abs = Math.abs(left);
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / HOUR);
  const m = Math.floor((abs % HOUR) / MIN);
  const text =
    d > 0
      ? `${d} day${d === 1 ? '' : 's'}${d < 7 && h ? ` ${h} h` : ''}`
      : h > 0
        ? `${h} h${m ? ` ${m} min` : ''}`
        : `${Math.max(m, 1)} min`;
  return left >= 0 ? `in ${text}` : `${text} ago`;
}

/** Upcoming first (soonest at the top), then the overdue ones (most recent first). */
export function sortDeadlines<T extends { due: number }>(items: readonly T[], now: number): T[] {
  const upcoming = items.filter((i) => i.due >= now).sort((a, b) => a.due - b.due);
  const past = items.filter((i) => i.due < now).sort((a, b) => b.due - a.due);
  return [...upcoming, ...past];
}

export type DraftError = 'title' | 'due' | 'past';

/** Checks a deadline before it's added. A due date more than a day in the past is a typo. */
export function checkDraft(
  draft: { title: string; due: number | null },
  now: number,
): DraftError | null {
  if (!draft.title.trim()) return 'title';
  if (draft.due === null || Number.isNaN(draft.due)) return 'due';
  if (draft.due < now - DAY) return 'past';
  return null;
}

/** Reads a datetime-local input value ("2026-11-03T23:59") as local time, in ms. */
export function parseLocalDateTime(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const t = new Date(y, mo - 1, d, h, mi).getTime();
  return Number.isNaN(t) ? null : t;
}

/** The other way: ms to a datetime-local value, in local time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- calendar ----------

const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
const icsTime = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** A calendar file (.ics) with one event at the due time, and a reminder a day before. */
export function toIcs(d: Pick<Deadline, 'id' | 'title' | 'course' | 'due' | 'note'>, now: number) {
  const summary = d.course ? `${d.course}: ${d.title}` : d.title;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lepak.gg//Deadlines//EN',
    'BEGIN:VEVENT',
    `UID:${d.id}@lepak.gg`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(d.due)}`,
    `DTEND:${icsTime(d.due)}`,
    `SUMMARY:${icsText(`Due: ${summary}`)}`,
    ...(d.note ? [`DESCRIPTION:${icsText(d.note)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(`Due tomorrow: ${summary}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
