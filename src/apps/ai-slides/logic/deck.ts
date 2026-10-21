// AI Slides, browser side. Pure: the deck format, themes, outline editing and markdown.

import { z } from 'zod';

const short = z.string().max(300);

export const OutlineSchema = z.object({
  title: short,
  subtitle: short,
  sections: z
    .array(z.object({ heading: short, points: z.array(short).max(8) }))
    .min(1)
    .max(20),
});

export const LAYOUTS = [
  'title',
  'section',
  'bullets',
  'two-column',
  'timeline',
  'cards',
  'quote',
  'big-number',
] as const;
export type Layout = (typeof LAYOUTS)[number];

export const SlideSchema = z.object({
  layout: z.enum(LAYOUTS),
  title: short,
  subtitle: short.optional(),
  bullets: z.array(short).max(10).optional(),
  left: z.array(short).max(10).optional(),
  right: z.array(short).max(10).optional(),
  leftTitle: short.optional(),
  rightTitle: short.optional(),
  steps: z
    .array(z.object({ label: short, text: short }))
    .max(8)
    .optional(),
  cards: z
    .array(z.object({ title: short, text: short }))
    .max(6)
    .optional(),
  quote: z.string().max(600).optional(),
  author: short.optional(),
  number: z.string().max(40).optional(),
  numberLabel: short.optional(),
  notes: z.string().max(2000).default(''),
});

export const DeckSchema = z.object({
  title: short,
  slides: z.array(SlideSchema).min(1).max(30),
});

export type Outline = z.infer<typeof OutlineSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type Deck = z.infer<typeof DeckSchema>;

/** What a saved draft holds: the deck plus the theme it was shown in. */
export const SavedDeckSchema = z.object({ deck: DeckSchema, theme: z.string() });
export type SavedDeck = z.infer<typeof SavedDeckSchema>;

// ---------- themes ----------

export interface Theme {
  id: string;
  name: string;
  bg: string;
  fg: string;
  /** Decoration only (bars, number), never body text. */
  accent: string;
  muted: string;
}

export const THEMES: Theme[] = [
  { id: 'paper', name: 'Paper', bg: '#f9fafb', fg: '#000000', accent: '#ffd23f', muted: '#555555' },
  { id: 'night', name: 'Night', bg: '#16120f', fg: '#f9fafb', accent: '#ff7a45', muted: '#bdbdbd' },
  { id: 'mint', name: 'Mint', bg: '#e6f8e7', fg: '#0b2a12', accent: '#2f9e44', muted: '#3d5a43' },
  { id: 'grape', name: 'Grape', bg: '#231a3d', fg: '#f4efff', accent: '#b9a2ff', muted: '#c9bfe6' },
  { id: 'ocean', name: 'Ocean', bg: '#0b2440', fg: '#eaf4ff', accent: '#4fd1e8', muted: '#a9c4de' },
  {
    id: 'sunset',
    name: 'Sunset',
    bg: '#fff4e6',
    fg: '#2b1600',
    accent: '#ff7a45',
    muted: '#6b4a2f',
  },
  { id: 'blush', name: 'Blush', bg: '#fff0f6', fg: '#3a0d22', accent: '#ff8fd0', muted: '#7a4a5f' },
  {
    id: 'chalk',
    name: 'Chalkboard',
    bg: '#1f3a2e',
    fg: '#f2f2e9',
    accent: '#ffd23f',
    muted: '#c4d1c8',
  },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

// ---------- outline editing ----------

export function moveSection(o: Outline, i: number, by: -1 | 1): Outline {
  const j = i + by;
  if (j < 0 || j >= o.sections.length) return o;
  const sections = [...o.sections];
  [sections[i], sections[j]] = [sections[j]!, sections[i]!];
  return { ...o, sections };
}

export function removeSection(o: Outline, i: number): Outline {
  if (o.sections.length <= 1) return o;
  return { ...o, sections: o.sections.filter((_, k) => k !== i) };
}

export function addSection(o: Outline, after: number): Outline {
  const sections = [...o.sections];
  sections.splice(after + 1, 0, { heading: 'New slide', points: [] });
  return { ...o, sections: sections.slice(0, 20) };
}

/** Text area (one idea per line) <-> list of points. */
export function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}

// ---------- deck editing ----------

/** A starter slide for each layout, used by "Add slide". */
export function blankSlide(layout: Layout): Slide {
  const base = { layout, title: 'New slide', notes: '' };
  switch (layout) {
    case 'title':
    case 'section':
      return { ...base, subtitle: '' };
    case 'bullets':
      return { ...base, bullets: ['First point', 'Second point', 'Third point'] };
    case 'two-column':
      return {
        ...base,
        leftTitle: 'Before',
        rightTitle: 'After',
        left: ['Point'],
        right: ['Point'],
      };
    case 'timeline':
      return {
        ...base,
        steps: [
          { label: 'Step 1', text: 'What happens first' },
          { label: 'Step 2', text: 'What happens next' },
          { label: 'Step 3', text: 'How it ends' },
        ],
      };
    case 'cards':
      return {
        ...base,
        cards: [
          { title: 'Idea one', text: 'A short line about it' },
          { title: 'Idea two', text: 'A short line about it' },
          { title: 'Idea three', text: 'A short line about it' },
        ],
      };
    case 'quote':
      return { ...base, quote: 'Your quote here', author: '' };
    case 'big-number':
      return { ...base, number: '0', numberLabel: 'What the number means' };
  }
}

export function addSlide(d: Deck, after: number, layout: Layout): Deck {
  const slides = [...d.slides];
  slides.splice(after + 1, 0, blankSlide(layout));
  return { ...d, slides: slides.slice(0, 30) };
}

export function duplicateSlide(d: Deck, i: number): Deck {
  const s = d.slides[i];
  if (!s || d.slides.length >= 30) return d;
  const slides = [...d.slides];
  slides.splice(i + 1, 0, structuredClone(s));
  return { ...d, slides };
}

export function deleteSlide(d: Deck, i: number): Deck {
  if (d.slides.length <= 1) return d;
  return { ...d, slides: d.slides.filter((_, k) => k !== i) };
}

export function moveSlide(d: Deck, i: number, by: -1 | 1): Deck {
  const j = i + by;
  if (j < 0 || j >= d.slides.length) return d;
  const slides = [...d.slides];
  [slides[i], slides[j]] = [slides[j]!, slides[i]!];
  return { ...d, slides };
}

/** "Label: text" lines <-> timeline steps or cards. */
export function pairsToLines(pairs: { a: string; b: string }[]): string {
  return pairs.map((p) => (p.b ? `${p.a}: ${p.b}` : p.a)).join('\n');
}

export function linesToPairs(text: string): { a: string; b: string }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const at = l.indexOf(':');
      return at > 0 ? { a: l.slice(0, at).trim(), b: l.slice(at + 1).trim() } : { a: l, b: '' };
    });
}

// ---------- export ----------

/** The deck as markdown, for publishing as a Lepak Page. */
export function deckToMarkdown(deck: Deck): string {
  const out: string[] = [`# ${deck.title}`, ''];
  deck.slides.forEach((s, i) => {
    if (i === 0 && s.layout === 'title') {
      if (s.subtitle) out.push(`*${s.subtitle}*`, '');
      return;
    }
    out.push(`## ${s.title}`, '');
    if (s.subtitle) out.push(s.subtitle, '');
    for (const b of s.bullets ?? []) out.push(`- ${b}`);
    if (s.left?.length || s.right?.length) {
      out.push(`**${s.leftTitle ?? 'One side'}**`, ...(s.left ?? []).map((b) => `- ${b}`), '');
      out.push(`**${s.rightTitle ?? 'Other side'}**`, ...(s.right ?? []).map((b) => `- ${b}`));
    }
    for (const st of s.steps ?? []) out.push(`- **${st.label}**: ${st.text}`);
    for (const c of s.cards ?? []) out.push(`- **${c.title}**: ${c.text}`);
    if (s.quote) out.push(`> ${s.quote}${s.author ? ` (${s.author})` : ''}`);
    if (s.number) out.push(`**${s.number}** ${s.numberLabel ?? ''}`.trim());
    out.push('');
  });
  out.push(
    '---',
    '',
    '*Made with Lepak AI Slides. AI can get things wrong: check anything important.*',
  );
  return out.join('\n');
}
