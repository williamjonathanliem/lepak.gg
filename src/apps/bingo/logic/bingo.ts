// Bingo rules. Pure functions, no React, no network.
//
// Each player's card comes from a seed (room code + player id), so the host can rebuild any
// card to check a "Bingo!" claim. Players can't fake a card.

export const FREE = '★';
export const SIZE = 5;
export const MIN_WORDS = SIZE * SIZE - 1; // 24, the centre is free

/** Classic numbers 1 to 75. */
export const NUMBERS = Array.from({ length: 75 }, (_, i) => String(i + 1));

/** Small seeded random generator (mulberry32), so the same seed always gives the same card. */
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Cleans a pasted word list: one item per line or comma, trimmed, no duplicates, max 40 chars each. */
export function parseWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const w = raw.trim().slice(0, 40);
    const key = w.toLowerCase();
    if (w && !seen.has(key)) {
      seen.add(key);
      out.push(w);
    }
  }
  return out;
}

/**
 * A 5×5 card as 25 cells, row by row, centre = FREE.
 * Numbers use the classic B-I-N-G-O columns (1-15, 16-30...); word lists are just shuffled.
 */
export function makeCard(items: readonly string[], seed: string): string[] {
  const rng = seededRng(seed);
  let cells: string[];
  if (items === NUMBERS || (items.length === 75 && items[0] === '1' && items[74] === '75')) {
    const cols = Array.from({ length: SIZE }, (_, c) =>
      shuffle(items.slice(c * 15, c * 15 + 15), rng).slice(0, SIZE),
    );
    cells = Array.from({ length: SIZE * SIZE }, (_, i) => cols[i % SIZE]![Math.floor(i / SIZE)]!);
  } else {
    cells = shuffle(items, rng).slice(0, SIZE * SIZE - 1);
    cells.splice(12, 0, FREE);
  }
  cells[12] = FREE;
  return cells;
}

/** All 12 winning lines: 5 rows, 5 columns, 2 diagonals (as cell indexes). */
export const LINES: number[][] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c)),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => r * SIZE + c)),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + i),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)),
];

/** The first complete line on this card given what's been called, or null. */
export function winningLine(card: readonly string[], called: ReadonlySet<string>): number[] | null {
  return LINES.find((line) => line.every((i) => card[i] === FREE || called.has(card[i]!))) ?? null;
}

/** Next item to call, at random from what's left. null when everything's been called. */
export function nextCall(
  items: readonly string[],
  called: readonly string[],
  rng: () => number,
): string | null {
  const done = new Set(called);
  const left = items.filter((i) => !done.has(i));
  return left.length ? left[Math.floor(rng() * left.length)]! : null;
}

/** "B 12" style label for classic numbers. */
export function callLabel(item: string, numbers: boolean): string {
  if (!numbers) return item;
  const n = Number(item);
  return `${'BINGO'[Math.min(4, Math.floor((n - 1) / 15))]} ${n}`;
}
