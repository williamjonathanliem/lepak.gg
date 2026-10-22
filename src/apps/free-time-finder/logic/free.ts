// Free-Time Finder: everyone marks when they're free, and we find when the most people
// overlap. Pure.
//
// A poll covers some days, each cut into hour slots from `from` to `to` (24h clock). Slot
// k of day d is number d * slotsPerDay + k. Each person's free slots are a string of 0/1,
// one character per slot, which is small to store and easy to check.

export interface PollMeta {
  owner: string;
  title: string;
  /** Days as "YYYY-MM-DD", in order. */
  days: string[];
  /** First hour (inclusive) and last hour (exclusive), e.g. 9 and 23. */
  from: number;
  to: number;
}

export interface Person {
  uid: string;
  nick: string;
  /** "0101..." one character per slot. */
  free: string;
}

export const MAX_DAYS = 14;
export const TITLE_MAX = 60;

export const slotsPerDay = (m: Pick<PollMeta, 'from' | 'to'>) => Math.max(0, m.to - m.from);
export const slotCount = (m: Pick<PollMeta, 'days' | 'from' | 'to'>) =>
  m.days.length * slotsPerDay(m);

export function emptyFree(m: PollMeta): string {
  return '0'.repeat(slotCount(m));
}

/** Someone's free string, fixed up to the poll's size (the poll may have been edited). */
export function normaliseFree(free: string, m: PollMeta): string {
  const n = slotCount(m);
  const clean = free.replace(/[^01]/g, '0');
  return clean.length >= n ? clean.slice(0, n) : clean + '0'.repeat(n - clean.length);
}

export function setSlots(free: string, slots: readonly number[], value: boolean): string {
  const chars = free.split('');
  for (const s of slots) if (s >= 0 && s < chars.length) chars[s] = value ? '1' : '0';
  return chars.join('');
}

/** For each slot, who is free. */
export function whoIsFree(people: readonly Person[], m: PollMeta): string[][] {
  const out: string[][] = Array.from({ length: slotCount(m) }, () => []);
  for (const p of people) {
    const f = normaliseFree(p.free, m);
    for (let s = 0; s < f.length; s++) if (f[s] === '1') out[s]!.push(p.nick);
  }
  return out;
}

export interface Block {
  day: number;
  /** First slot of the block within the day, and how many slots long. */
  start: number;
  length: number;
  names: string[];
}

/**
 * The best times to meet: runs of back-to-back slots on the same day where the same people
 * are free, most people first, then the longest. Only blocks with at least `min` people.
 */
export function bestBlocks(people: readonly Person[], m: PollMeta, min = 2, limit = 5): Block[] {
  const per = slotsPerDay(m);
  const who = whoIsFree(people, m);
  const blocks: Block[] = [];
  for (let d = 0; d < m.days.length; d++) {
    let k = 0;
    while (k < per) {
      const names = who[d * per + k]!;
      if (names.length < min) {
        k++;
        continue;
      }
      const key = [...names].sort().join('|');
      let len = 1;
      while (k + len < per && [...who[d * per + k + len]!].sort().join('|') === key) len++;
      blocks.push({ day: d, start: k, length: len, names: [...names].sort() });
      k += len;
    }
  }
  return blocks
    .sort((a, b) => b.names.length - a.names.length || b.length - a.length || a.day - b.day)
    .slice(0, limit);
}

/** "3 pm", "12 pm", "11 am", "12 am". */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const twelve = hh % 12 === 0 ? 12 : hh % 12;
  return `${twelve} ${hh < 12 ? 'am' : 'pm'}`;
}

/** "Thu 24 Oct" from "2026-10-24". */
export function dayLabel(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, mo - 1, d).toLocaleDateString('en-MY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** The next `count` days from `start` as "YYYY-MM-DD" (local time). */
export function nextDays(start: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
}

export function blockLabel(b: Block, m: PollMeta): string {
  return `${dayLabel(m.days[b.day]!)}, ${hourLabel(m.from + b.start)} to ${hourLabel(m.from + b.start + b.length)}`;
}
