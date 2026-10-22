// Makan Split: who owes what after a meal. Pure. All money is in the currency's smallest
// unit (sen, cents; see currency.ts), as whole numbers, so there are no floating point
// surprises, and every split adds up to the bill exactly.
//
// How a Malaysian bill usually works, and what this does:
//   subtotal (what was ordered)
//   + service charge (often 10%) on the subtotal
//   + SST (6% on food and drink) on subtotal + service charge
//   - any discount
//   rounded to the nearest 5 sen if you like (how cash bills are rounded here).
// Each item is shared equally by the people who had it; the charges and discount are then
// shared in proportion to what each person ordered.

import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import { currencyOf, money, parseAmount } from './currency';

export const MAX_PEOPLE = 20;
export const MAX_ITEMS = 60;

export const BillSchema = z.object({
  people: z.array(z.string().max(20)).max(MAX_PEOPLE),
  items: z
    .array(
      z.object({
        name: z.string().max(40),
        /** Price in the currency's smallest unit. */
        price: z.number().int().min(0).max(1_000_000_000),
        /** Who had it (indexes into people). Empty means everyone. */
        shares: z.array(z.number().int().min(0)).max(MAX_PEOPLE),
      }),
    )
    .max(MAX_ITEMS),
  servicePct: z.number().min(0).max(30),
  sstPct: z.number().min(0).max(20),
  /** A fixed service charge (smallest units) instead of the percent, when set. */
  serviceFixed: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  /** A fixed tax amount instead of the percent, when set. */
  sstFixed: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  /** Discount in the currency's smallest unit. */
  discount: z.number().int().min(0).max(1_000_000_000),
  /** Round the total for cash (only where the currency does that, e.g. 5 sen in Malaysia). */
  round5: z.boolean(),
  /** ISO code, e.g. "MYR". Older saved bills have none: they were ringgit. */
  currency: z.string().length(3).default('MYR'),
  /** Who paid the bill (index into people). */
  payer: z.number().int().min(0),
});

export type Bill = z.infer<typeof BillSchema>;
export type Item = Bill['items'][number];

export const newBill = (people: string[] = ['Me']): Bill => ({
  people,
  items: [],
  servicePct: 10,
  sstPct: 6,
  discount: 0,
  round5: true,
  payer: 0,
  currency: 'MYR',
  serviceFixed: null,
  sstFixed: null,
});

/**
 * Splits `total` sen into whole-sen parts in proportion to `weights` (largest remainder, so
 * the parts always add up to exactly `total`). All-zero weights split it evenly.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? weights : weights.map(() => 1);
  const wSum = sum > 0 ? sum : n;
  const exact = w.map((x) => (total * x) / wSum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i]!++;
    left--;
  }
  return parts;
}

/** Malaysian 5-sen rounding: x.x1, x.x2 down; x.x3, x.x4 up to 5; x.x6, x.x7 down to 5; x.x8, x.x9 up. */
export function roundTo5Sen(sen: number): number {
  return Math.round(sen / 5) * 5;
}

export interface PersonShare {
  name: string;
  /** What they ordered, in sen. */
  ordered: number;
  /** What they pay in the end, in sen (their share of charges and discount included). */
  total: number;
}

export interface Split {
  subtotal: number;
  service: number;
  sst: number;
  discount: number;
  rounding: number;
  grand: number;
  people: PersonShare[];
}

export function splitBill(bill: Bill): Split {
  const n = bill.people.length;
  const ordered = Array.from({ length: n }, () => 0);
  for (const item of bill.items) {
    const who = item.shares.filter((i) => i < n);
    const sharers = who.length ? who : Array.from({ length: n }, (_, i) => i);
    allocate(
      item.price,
      sharers.map(() => 1),
    ).forEach((part, k) => {
      ordered[sharers[k]!]! += part;
    });
  }
  const subtotal = ordered.reduce((a, b) => a + b, 0);
  const service = bill.serviceFixed ?? Math.round((subtotal * bill.servicePct) / 100);
  const sst = bill.sstFixed ?? Math.round(((subtotal + service) * bill.sstPct) / 100);
  const discount = Math.min(bill.discount, subtotal + service + sst);
  const before = subtotal + service + sst - discount;
  const step = currencyOf(bill.currency).cashStep;
  const grand = bill.round5 && step ? Math.round(before / step) * step : before;
  const totals = allocate(grand, ordered);
  return {
    subtotal,
    service,
    sst,
    discount,
    rounding: grand - before,
    grand,
    people: bill.people.map((name, i) => ({ name, ordered: ordered[i]!, total: totals[i]! })),
  };
}

/** "RM12.30" (ringgit; tests and older code). */
export const rm = (sen: number) => money(sen, 'MYR');

/** Reads a typed price in ringgit into sen (see parseAmount for other currencies). */
export const parsePrice = (raw: string) => parseAmount(raw, 'MYR');

/** "10% service charge and 6% SST", or the amounts when they were typed in as amounts. */
export function chargeText(bill: Bill, split: Split): string {
  const tax = currencyOf(bill.currency).tax;
  const part = (fixed: number | null, pct: number, amount: number, name: string) =>
    fixed !== null ? `${money(amount, bill.currency)} ${name}` : `${pct}% ${name}`;
  return [
    split.service ? part(bill.serviceFixed, bill.servicePct, split.service, 'service charge') : '',
    split.sst ? part(bill.sstFixed, bill.sstPct, split.sst, tax) : '',
  ]
    .filter(Boolean)
    .join(' and ');
}

/** The items someone had, for the message ("Teh tarik", "Nasi lemak (shared by 3)"). */
export function itemsOf(bill: Bill, person: number): string[] {
  return bill.items.flatMap((it) => {
    const sharers = it.shares.length ? it.shares : bill.people.map((_, i) => i);
    if (!sharers.includes(person)) return [];
    return [sharers.length > 1 ? `${it.name} (shared by ${sharers.length})` : it.name];
  });
}

const MAX_ITEMS_LISTED = 4;

/**
 * A message for the group chat, in WhatsApp formatting (*bold*, _italic_): the total, who
 * owes the payer what with the items they had, and the charges.
 */
export function summaryText(bill: Bill, split: Split, footer?: string): string {
  const payer = bill.people[bill.payer] ?? bill.people[0] ?? 'the payer';
  const m = (n: number) => money(n, bill.currency);
  const charges = chargeText(bill, split);
  const extras = [charges, split.discount ? `minus ${m(split.discount)} discount` : '']
    .filter(Boolean)
    .join(', ');
  const lines = [
    '🧾 *MAKAN SPLIT*',
    `Total *${m(split.grand)}* · paid by *${payer}*`,
    ...(extras ? [`_incl. ${extras}_`] : []),
    '',
  ];
  const owing = split.people
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.i !== bill.payer && p.total > 0);
  if (owing.length) {
    lines.push(`💸 *Pay ${payer} back:*`);
    for (const p of owing) {
      lines.push(`• *${p.name}*: ${m(p.total)}`);
      const items = itemsOf(bill, p.i);
      const shown = items.slice(0, MAX_ITEMS_LISTED);
      if (shown.length) {
        const more = items.length - shown.length;
        lines.push(`   ↳ ${shown.join(', ')}${more > 0 ? ` +${more} more` : ''}`);
      }
    }
    const own = split.people[bill.payer];
    if (own?.total) lines.push(`_(${payer}’s own share: ${m(own.total)})_`);
  } else {
    lines.push(`Nobody owes ${payer} anything. Steady!`);
  }
  lines.push('', 'Terima kasih! 🙏');
  if (footer) lines.push(footer);
  return lines.join('\n');
}

// ---------- sharing by link ----------
// Links carry the whole bill, so they're packed: a plain array instead of named fields,
// squeezed with deflate, then base64url. The leading "1" is the format version. Older links
// (plain JSON in base64, which always starts with "eyJ") still open.

type Packed = [
  1,
  string[],
  [string, number, number[]][],
  number,
  number,
  number | null,
  number | null,
  number,
  0 | 1,
  string,
  number,
];

const toB64Url = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** The bill as a short URL-safe string, for /split#b=... */
export function encodeBill(bill: Bill): string {
  const packed: Packed = [
    1,
    bill.people,
    bill.items.map((it) => [it.name, it.price, it.shares]),
    bill.servicePct,
    bill.sstPct,
    bill.serviceFixed,
    bill.sstFixed,
    bill.discount,
    bill.round5 ? 1 : 0,
    bill.currency,
    bill.payer,
  ];
  return `1${toB64Url(deflateSync(strToU8(JSON.stringify(packed)), { level: 9 }))}`;
}

export function decodeBill(s: string): Bill | null {
  try {
    let raw: unknown;
    if (s.startsWith('eyJ')) {
      raw = JSON.parse(new TextDecoder().decode(fromB64Url(s)));
    } else if (s.startsWith('1')) {
      const p = JSON.parse(strFromU8(inflateSync(fromB64Url(s.slice(1))))) as Packed;
      raw = {
        people: p[1],
        items: p[2].map(([name, price, shares]) => ({ name, price, shares })),
        servicePct: p[3],
        sstPct: p[4],
        serviceFixed: p[5],
        sstFixed: p[6],
        discount: p[7],
        round5: p[8] === 1,
        currency: p[9],
        payer: p[10],
      };
    } else {
      return null;
    }
    const parsed = BillSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
