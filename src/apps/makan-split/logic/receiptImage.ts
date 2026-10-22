// "Download PNG": the receipt drawn on a canvas (no screenshot library). receiptRows is
// pure (what goes on the receipt); drawReceipt paints the rows, with torn edges like the one
// on screen.

import { currencyOf, money } from './currency';
import type { Bill, Split } from './split';

export type Row =
  | { kind: 'center'; text: string; bold?: boolean; big?: boolean }
  | { kind: 'pair'; left: string; right: string; bold?: boolean; big?: boolean; dots?: boolean }
  | { kind: 'rule' }
  | { kind: 'gap' };

export function receiptRows(bill: Bill, split: Split, date: string): Row[] {
  const m = (n: number) => money(n, bill.currency);
  const tax = currencyOf(bill.currency).tax.toUpperCase();
  const payer = bill.people[bill.payer] ?? '';
  const rows: Row[] = [
    { kind: 'center', text: 'LEPAK.GG', bold: true, big: true },
    { kind: 'center', text: 'MAKAN SPLIT' },
    { kind: 'center', text: date },
    { kind: 'rule' },
    { kind: 'center', text: `WHO OWES ${payer.toUpperCase()}`, bold: true },
    { kind: 'gap' },
    ...split.people.map((p, i): Row => ({
      kind: 'pair',
      left: `${p.name.toUpperCase()}${i === bill.payer ? ' (PAID)' : ''}`,
      right: m(p.total),
      bold: true,
      dots: true,
    })),
    { kind: 'rule' },
    { kind: 'pair', left: 'SUBTOTAL', right: m(split.subtotal) },
  ];
  if (split.service) {
    const label = bill.serviceFixed !== null ? 'SERVICE CHG' : `SERVICE CHG ${bill.servicePct}%`;
    rows.push({ kind: 'pair', left: label, right: m(split.service) });
  }
  if (split.sst) {
    const label = bill.sstFixed !== null ? tax : `${tax} ${bill.sstPct}%`;
    rows.push({ kind: 'pair', left: label, right: m(split.sst) });
  }
  if (split.discount) rows.push({ kind: 'pair', left: 'DISCOUNT', right: `-${m(split.discount)}` });
  if (split.rounding) {
    const r = m(Math.abs(split.rounding));
    rows.push({ kind: 'pair', left: 'ROUNDING ADJ', right: split.rounding < 0 ? `-${r}` : r });
  }
  rows.push(
    { kind: 'rule' },
    { kind: 'pair', left: 'TOTAL', right: m(split.grand), bold: true, big: true },
    { kind: 'rule' },
    { kind: 'center', text: 'TERIMA KASIH. SILA DATANG LAGI!' },
    {
      kind: 'center',
      text: `${bill.items.length} ITEM${bill.items.length === 1 ? '' : 'S'} · ${bill.people.length} PAX`,
    },
  );
  return rows;
}

const SCALE = 2;
const W = 380;
const PAD = 26;
const TEAR = 12;
const FONT = '"Space Mono", ui-monospace, monospace';
const LINE = { normal: 22, big: 30, rule: 18, gap: 8 };

/** Draws the rows as a receipt and returns a PNG blob. */
export async function drawReceipt(rows: readonly Row[]): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load(`400 14px ${FONT}`),
      document.fonts.load(`700 14px ${FONT}`),
    ]);
  } catch {
    // falls back to any monospace font
  }
  const height =
    PAD * 2 +
    TEAR * 2 +
    rows.reduce(
      (h, r) =>
        h +
        (r.kind === 'rule'
          ? LINE.rule
          : r.kind === 'gap'
            ? LINE.gap
            : r.big
              ? LINE.big
              : LINE.normal),
      0,
    );
  const margin = 16; // room for the hard shadow
  const canvas = document.createElement('canvas');
  canvas.width = (W + margin) * SCALE;
  canvas.height = (height + margin) * SCALE;
  const g = canvas.getContext('2d')!;
  g.scale(SCALE, SCALE);

  // Torn paper shape: zigzag top and bottom.
  const paper = new Path2D();
  paper.moveTo(0, TEAR);
  for (let x = 0; x < W; x += TEAR) {
    paper.lineTo(x + TEAR / 2, 0);
    paper.lineTo(Math.min(x + TEAR, W), TEAR);
  }
  paper.lineTo(W, height - TEAR);
  for (let x = W; x > 0; x -= TEAR) {
    paper.lineTo(x - TEAR / 2, height);
    paper.lineTo(Math.max(x - TEAR, 0), height - TEAR);
  }
  paper.closePath();

  g.save();
  g.translate(6, 6);
  g.fillStyle = '#000';
  g.fill(paper); // hard shadow
  g.restore();
  g.fillStyle = '#fffdf4';
  g.fill(paper);

  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.textBaseline = 'middle';
  let y = TEAR + PAD;
  for (const r of rows) {
    if (r.kind === 'gap') {
      y += LINE.gap;
      continue;
    }
    if (r.kind === 'rule') {
      g.setLineDash([6, 4]);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(PAD, y + LINE.rule / 2);
      g.lineTo(W - PAD, y + LINE.rule / 2);
      g.stroke();
      g.setLineDash([]);
      y += LINE.rule;
      continue;
    }
    const h = r.big ? LINE.big : LINE.normal;
    g.font = `${r.bold ? 700 : 400} ${r.big ? 20 : 13}px ${FONT}`;
    const mid = y + h / 2;
    if (r.kind === 'center') {
      g.textAlign = 'center';
      g.fillText(r.text, W / 2, mid, W - PAD * 2);
    } else {
      g.textAlign = 'left';
      const rightW = g.measureText(r.right).width;
      const maxLeft = W - PAD * 2 - rightW - 16;
      g.fillText(r.left, PAD, mid, maxLeft);
      g.textAlign = 'right';
      g.fillText(r.right, W - PAD, mid);
      if (r.dots) {
        const leftW = Math.min(g.measureText(r.left).width, maxLeft);
        g.setLineDash([2, 4]);
        g.lineWidth = 2;
        g.globalAlpha = 0.45;
        g.beginPath();
        g.moveTo(PAD + leftW + 8, mid + 5);
        g.lineTo(W - PAD - rightW - 8, mid + 5);
        g.stroke();
        g.globalAlpha = 1;
        g.setLineDash([]);
      }
    }
    y += h;
  }

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), 'image/png'),
  );
}
