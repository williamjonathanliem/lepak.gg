// Flashcard practice with spaced repetition (a Leitner box system). Pure.
//
// Every card sits in a box. "Got it" moves it up a box, "Again" sends it back to the first.
// Each box waits longer before the card comes back: box 0 now, then 1, 2, 4 and 7 days.
// A card in the top two boxes counts as learnt. In a session, a card you miss comes back a
// few cards later, so you see it again while it's fresh.

const DAY_MS = 24 * 60 * 60 * 1000;
export const BOX_DAYS = [0, 1, 2, 4, 7] as const;
export const TOP_BOX = BOX_DAYS.length - 1;
/** From this box up a card counts as learnt. */
export const LEARNT_BOX = 3;
/** A missed card comes back this many cards later in the same session. */
const RETRY_GAP = 3;

export interface CardState {
  box: number;
  /** When it's next due (ms). */
  due: number;
}

/** Progress for one set of cards, by card number. Cards not in here are new. */
export type Progress = Readonly<Record<number, CardState>>;

const isDue = (p: Progress, i: number, now: number) => (p[i]?.due ?? 0) <= now;

/** Cards to practise now: due ones (new included), lowest box first, otherwise in order.
 * With `all`, every card, for a full run-through. */
export function startSession(cards: number, p: Progress, now: number, all = false): number[] {
  return Array.from({ length: cards }, (_, i) => i)
    .filter((i) => all || isDue(p, i, now))
    .sort((a, b) => (p[a]?.box ?? 0) - (p[b]?.box ?? 0) || a - b);
}

export function grade(p: Progress, card: number, gotIt: boolean, now: number): Progress {
  const box = gotIt ? Math.min((p[card]?.box ?? 0) + 1, TOP_BOX) : 0;
  return { ...p, [card]: { box, due: now + BOX_DAYS[box]! * DAY_MS } };
}

/** The session queue after answering the card at its front. */
export function nextInQueue(queue: readonly number[], gotIt: boolean): number[] {
  const [card, ...rest] = queue;
  if (card === undefined || gotIt) return rest;
  const at = Math.min(RETRY_GAP, rest.length);
  return [...rest.slice(0, at), card, ...rest.slice(at)];
}

export function learnt(cards: number, p: Progress): number {
  let n = 0;
  for (let i = 0; i < cards; i++) if ((p[i]?.box ?? 0) >= LEARNT_BOX) n++;
  return n;
}

/** When the next card comes due after today's are done, or null if none are waiting. */
export function nextDue(cards: number, p: Progress, now: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < cards; i++) {
    const due = p[i]?.due ?? 0;
    if (due > now && (best === null || due < best)) best = due;
  }
  return best;
}

// ---------- export ----------

interface Card {
  front: string;
  back: string;
}

/** CSV for Anki (File > Import) and most flashcard apps: front,back per line. */
export function toCsv(cards: readonly Card[]): string {
  const cell = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  return cards.map((c) => `${cell(c.front)},${cell(c.back)}`).join('\n');
}

/** Tab between term and definition, one card per line: what Quizlet's import box expects. */
export function toTabText(cards: readonly Card[]): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ').trim();
  return cards.map((c) => `${clean(c.front)}\t${clean(c.back)}`).join('\n');
}
