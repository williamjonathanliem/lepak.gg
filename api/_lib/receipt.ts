// Makan Split receipt scanning: a photo of a restaurant receipt in, the items and charges
// out, read by Gemini. Used by /api/receipt (Vercel) and the dev server (vite.config.ts).
// The photo is only read, never kept.

import { z } from 'genkit';
import { currencyOf, toUnits } from '../../src/apps/makan-split/logic/currency.js';
import { SAFETY_NOTE, aiErrorResponse, generateWithFallback, guardAiRequest } from './ai.js';

const RECEIPTS_PER_MINUTE = 4;
/** The page shrinks photos before sending; this is a safety cap (base64 of ~2 MB). */
const MAX_IMAGE_CHARS = 2_800_000;

const InputSchema = z.object({
  imageBase64: z.string().min(100).max(MAX_IMAGE_CHARS),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  /** The bill's currency, e.g. "MYR". */
  currency: z.string().length(3).default('MYR'),
});

const ReceiptSchema = z.object({
  isReceipt: z.boolean().describe('false if the photo is not a shop or restaurant bill'),
  items: z
    .array(
      z.object({
        name: z.string().describe('Item name as printed, tidied up (e.g. "Teh tarik")'),
        quantity: z.number().int().describe('How many, 1 if not shown'),
        lineTotal: z.number().describe('Price for the whole line, e.g. 7.50, as printed'),
      }),
    )
    .describe('Every food or drink line. Not subtotals, taxes, charges or payments'),
  servicePct: z.number().describe('Service charge percent, e.g. 10. 0 if none'),
  sstPct: z.number().describe('SST or service tax percent, e.g. 6. 0 if none'),
  discount: z.number().describe('Total discount as a positive number. 0 if none'),
  total: z.number().describe('The final total printed on the receipt. 0 if unreadable'),
});

const pct = (n: number, max: number) => (n > 0 && n <= max ? Math.round(n * 100) / 100 : 0);

/** Gemini's reading turned into what Makan Split uses (smallest units, capped, junk dropped). */
export function toBillParts(r: z.infer<typeof ReceiptSchema>, currency = 'MYR') {
  const units = (n: number) => toUnits(n, currency);
  const items = r.items
    .map((it) => {
      const name = it.name.trim().replace(/\s+/g, ' ').slice(0, 36);
      const q = it.quantity > 1 ? it.quantity : 1;
      return { name: q > 1 ? `${q}x ${name}` : name, price: units(it.lineTotal) };
    })
    .filter((it) => it.name && it.price > 0 && it.price <= 1_000_000_000)
    .slice(0, 60);
  return {
    items,
    servicePct: pct(r.servicePct, 30),
    sstPct: pct(r.sstPct, 20),
    discount: units(r.discount),
    total: units(r.total),
  };
}

/** POST /api/receipt with { imageBase64, mimeType } -> { items, servicePct, sstPct, discount, total }. */
export async function handleReceiptRequest(request: Request): Promise<Response> {
  const refused = guardAiRequest(request, 'receipt', RECEIPTS_PER_MINUTE);
  if (refused) return refused;
  const parsed = InputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Bad photo' }, { status: 400 });
  const { imageBase64, mimeType } = parsed.data;
  const cur = currencyOf(parsed.data.currency);

  try {
    const { output } = await generateWithFallback({
      prompt: [
        {
          text: [
            'Read this photo of a restaurant or shop receipt.',
            `Amounts are in ${cur.name} (${cur.code}); give them as printed, without the symbol.`,
            'List every food and drink line with its quantity and line total.',
            `Find the service charge percent, the ${cur.tax} or sales tax percent and any discount.`,
            'Skip subtotal, tax, charge, rounding, cash, change and card lines in the items.',
            'If a number is unreadable, leave that line out rather than guess.',
            SAFETY_NOTE,
          ].join('\n'),
        },
        { media: { url: `data:${mimeType};base64,${imageBase64}`, contentType: mimeType } },
      ],
      output: { schema: ReceiptSchema },
      config: { temperature: 0 },
    });
    if (!output) throw new Error('Nothing came back');
    if (!output.isReceipt) {
      return Response.json({ error: 'That doesn’t look like a receipt.' }, { status: 422 });
    }
    return Response.json(toBillParts(output, cur.code), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return aiErrorResponse(e, 'receipt', 'Could not read that receipt.');
  }
}
