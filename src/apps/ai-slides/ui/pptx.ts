// Download a deck as PowerPoint (.pptx), built in the browser with pptxgenjs (MIT).
// Speaker notes go into PowerPoint's notes. Fonts fall back to Arial so it opens the same
// everywhere. Loaded only when someone clicks the button.

import type { Deck, Theme } from '../logic/deck';

const W = 10; // inches, 16:9
const H = 5.625;
const PAD = 0.6;

const hex = (c: string) => c.replace('#', '').toUpperCase();

export function fileNameFor(title: string): string {
  const base = title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${base || 'slides'}.pptx`;
}

/** Builds the PowerPoint in memory (tested on its own; no download). */
export async function buildPptx(deck: Deck, theme: Theme) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.title;
  pptx.author = 'Lepak AI Slides';

  const fg = hex(theme.fg);
  const muted = hex(theme.muted);
  const accent = hex(theme.accent);
  const font = 'Arial';
  const bullets = (items: string[], size: number) =>
    items.map((t) => ({ text: t, options: { bullet: true, breakLine: true, fontSize: size } }));

  deck.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: hex(theme.bg) };
    const text = (t: string, o: Record<string, unknown>) =>
      slide.addText(t, { fontFace: font, color: fg, margin: 0, ...o });

    switch (s.layout) {
      case 'title':
        slide.addShape(pptx.ShapeType.rect, {
          x: PAD,
          y: 1.5,
          w: 1,
          h: 0.1,
          fill: { color: accent },
        });
        text(s.title, {
          x: PAD,
          y: 1.75,
          w: W - 2 * PAD,
          h: 1.6,
          fontSize: 40,
          bold: true,
          valign: 'top',
        });
        if (s.subtitle)
          text(s.subtitle, { x: PAD, y: 3.4, w: W - 2 * PAD, h: 0.7, fontSize: 18, color: muted });
        break;
      case 'section':
        slide.addShape(pptx.ShapeType.rect, {
          x: PAD,
          y: 1.6,
          w: 0.18,
          h: 2.2,
          fill: { color: accent },
        });
        text(s.title, {
          x: PAD + 0.45,
          y: 1.8,
          w: W - 2 * PAD - 0.5,
          h: 1.2,
          fontSize: 34,
          bold: true,
        });
        if (s.subtitle)
          text(s.subtitle, {
            x: PAD + 0.45,
            y: 3.0,
            w: W - 2 * PAD - 0.5,
            h: 0.6,
            fontSize: 16,
            color: muted,
          });
        break;
      case 'bullets':
        text(s.title, { x: PAD, y: 0.45, w: W - 2 * PAD, h: 0.8, fontSize: 28, bold: true });
        slide.addText(bullets(s.bullets ?? [], 18), {
          x: PAD,
          y: 1.4,
          w: W - 2 * PAD,
          h: H - 2,
          fontFace: font,
          color: fg,
          valign: 'top',
          paraSpaceAfter: 8,
        });
        break;
      case 'two-column': {
        text(s.title, { x: PAD, y: 0.45, w: W - 2 * PAD, h: 0.8, fontSize: 28, bold: true });
        const colW = (W - 2 * PAD - 0.4) / 2;
        [
          [s.leftTitle, s.left, PAD],
          [s.rightTitle, s.right, PAD + colW + 0.4],
        ].forEach(([head, items, x]) => {
          if (head)
            text(head as string, {
              x: x as number,
              y: 1.35,
              w: colW,
              h: 0.45,
              fontSize: 18,
              bold: true,
            });
          slide.addShape(pptx.ShapeType.rect, {
            x: x as number,
            y: 1.82,
            w: colW,
            h: 0.04,
            fill: { color: accent },
          });
          slide.addText(bullets((items as string[] | undefined) ?? [], 15), {
            x: x as number,
            y: 1.95,
            w: colW,
            h: H - 2.5,
            fontFace: font,
            color: fg,
            valign: 'top',
            paraSpaceAfter: 6,
          });
        });
        break;
      }
      case 'timeline': {
        text(s.title, { x: PAD, y: 0.45, w: W - 2 * PAD, h: 0.8, fontSize: 28, bold: true });
        const steps = s.steps ?? [];
        const n = Math.max(1, steps.length);
        const stepW = (W - 2 * PAD) / n;
        slide.addShape(pptx.ShapeType.rect, {
          x: PAD,
          y: 2.75,
          w: W - 2 * PAD,
          h: 0.05,
          fill: { color: accent },
        });
        steps.forEach((st, k) => {
          const x = PAD + k * stepW;
          text(st.label, {
            x,
            y: 1.75,
            w: stepW - 0.15,
            h: 0.8,
            fontSize: 15,
            bold: true,
            valign: 'bottom',
          });
          slide.addShape(pptx.ShapeType.ellipse, {
            x,
            y: 2.62,
            w: 0.3,
            h: 0.3,
            fill: { color: hex(theme.bg) },
            line: { color: accent, width: 3 },
          });
          text(st.text, {
            x,
            y: 3.1,
            w: stepW - 0.15,
            h: 1.4,
            fontSize: 12,
            color: muted,
            valign: 'top',
          });
        });
        break;
      }
      case 'cards': {
        text(s.title, { x: PAD, y: 0.45, w: W - 2 * PAD, h: 0.8, fontSize: 28, bold: true });
        const cards = s.cards ?? [];
        const cols = cards.length === 4 ? 2 : 3;
        const gap = 0.25;
        const cw = (W - 2 * PAD - gap * (cols - 1)) / cols;
        const rows = Math.ceil(cards.length / cols);
        const ch = rows > 1 ? 1.6 : 2.6;
        cards.forEach((c, k) => {
          const x = PAD + (k % cols) * (cw + gap);
          const y = 1.5 + Math.floor(k / cols) * (ch + gap);
          slide.addShape(pptx.ShapeType.rect, {
            x,
            y,
            w: cw,
            h: ch,
            fill: { color: hex(theme.fg), transparency: 94 },
          });
          slide.addShape(pptx.ShapeType.rect, { x, y, w: cw, h: 0.07, fill: { color: accent } });
          text(c.title, { x: x + 0.15, y: y + 0.2, w: cw - 0.3, h: 0.5, fontSize: 16, bold: true });
          text(c.text, {
            x: x + 0.15,
            y: y + 0.7,
            w: cw - 0.3,
            h: ch - 0.85,
            fontSize: 12,
            color: muted,
            valign: 'top',
          });
        });
        break;
      }
      case 'quote':
        text('“', { x: PAD, y: 0.7, w: 1.5, h: 1.2, fontSize: 96, bold: true, color: accent });
        text(s.quote ?? s.title, {
          x: PAD,
          y: 1.7,
          w: W - 2 * PAD,
          h: 2,
          fontSize: 26,
          bold: true,
          valign: 'top',
        });
        if (s.author)
          text(s.author, { x: PAD, y: 3.9, w: W - 2 * PAD, h: 0.5, fontSize: 15, color: muted });
        break;
      case 'big-number':
        text(s.title, {
          x: PAD,
          y: 0.9,
          w: W - 2 * PAD,
          h: 0.5,
          fontSize: 16,
          bold: true,
          color: muted,
        });
        text(s.number ?? '', { x: PAD, y: 1.4, w: W - 2 * PAD, h: 1.8, fontSize: 96, bold: true });
        slide.addShape(pptx.ShapeType.rect, {
          x: PAD,
          y: 3.3,
          w: 1.4,
          h: 0.08,
          fill: { color: accent },
        });
        if (s.numberLabel)
          text(s.numberLabel, { x: PAD, y: 3.5, w: W - 2 * PAD, h: 0.7, fontSize: 18 });
        break;
    }
    text(`${i + 1} / ${deck.slides.length}`, {
      x: W - 1.3,
      y: H - 0.45,
      w: 1,
      h: 0.3,
      fontSize: 9,
      color: muted,
      align: 'right',
    });
    if (s.notes) slide.addNotes(s.notes);
  });

  return pptx;
}

export async function downloadPptx(deck: Deck, theme: Theme): Promise<void> {
  const pptx = await buildPptx(deck, theme);
  await pptx.writeFile({ fileName: fileNameFor(deck.title) });
}
