// AI Slides: topic, notes or a file -> an outline the user can edit -> a full slide deck.
// Three Genkit flows:
//   slideOutline  { topic?, material?, pdfBase64?, slideCount, style, audience, language }
//                   -> { title, subtitle, sections[] }      (people fix the plan first)
//   slideDeck     { outline, material?, style, audience, language } -> { title, slides[] }
//   slideRewrite  { slide, instruction, ... } -> one slide    ("make it shorter", etc.)
// Used by /api/ai-slides (Vercel) and the dev server (vite.config.ts).

import { z } from 'genkit';
import { SAFETY_NOTE, aiErrorResponse, generateWithFallback, getAi, guardAiRequest } from './ai.js';

const PER_MINUTE = 10; // outline + deck + a few rewrites
const MAX_MATERIAL = 40_000;
const MAX_PDF_BYTES = 3 * 1024 * 1024;

const Style = z.enum(['professional', 'casual']);
const Common = {
  style: Style,
  audience: z.string().max(100).optional(),
  language: z.string().max(40).optional(),
};

export const OutlineSchema = z.object({
  title: z.string().describe('Deck title, short'),
  subtitle: z.string().describe('One short line under the title'),
  sections: z
    .array(
      z.object({
        heading: z.string().describe('Slide heading, a few words'),
        points: z.array(z.string()).describe('2 to 4 short ideas this slide covers'),
      }),
    )
    .describe('One entry per content slide, in order'),
});

const Layout = z.enum([
  'title',
  'section',
  'bullets',
  'two-column',
  'timeline',
  'cards',
  'quote',
  'big-number',
]);

export const SlideSchema = z.object({
  layout: Layout.describe(
    'title: opening slide. section: a divider. bullets: heading + 3 to 5 bullets. ' +
      'two-column: compare two sides. timeline: 3 to 6 steps or dates in order. ' +
      'cards: 3 or 4 parallel ideas, each a short title + one line. ' +
      'quote: one real quote from the material. big-number: one real key figure from the material.',
  ),
  title: z.string().describe('Slide heading'),
  subtitle: z.string().optional().describe('For title and section slides'),
  bullets: z.array(z.string()).optional().describe('For bullets: 3 to 5, under 12 words each'),
  left: z.array(z.string()).optional().describe('For two-column: left side points'),
  right: z.array(z.string()).optional().describe('For two-column: right side points'),
  leftTitle: z.string().optional(),
  rightTitle: z.string().optional(),
  steps: z
    .array(z.object({ label: z.string(), text: z.string() }))
    .optional()
    .describe('For timeline: label is a date or "Step 1", text is under 10 words'),
  cards: z
    .array(z.object({ title: z.string(), text: z.string() }))
    .optional()
    .describe('For cards: 3 or 4 cards, title of 1 to 3 words, text under 14 words'),
  quote: z.string().optional().describe('For quote slides'),
  author: z.string().optional(),
  number: z.string().optional().describe('For big-number: the figure, e.g. "71%"'),
  numberLabel: z.string().optional().describe('For big-number: what the figure means'),
  notes: z.string().describe('Speaker notes: 2 to 4 sentences to say out loud'),
});

export const DeckSchema = z.object({
  title: z.string(),
  slides: z.array(SlideSchema).describe('The whole deck, starting with a title slide'),
});

const OutlineInput = z.object({
  step: z.literal('outline'),
  topic: z.string().max(300).optional(),
  material: z.string().max(MAX_MATERIAL).optional(),
  pdfBase64: z.string().optional(),
  fileName: z.string().max(200).optional(),
  slideCount: z.number().int().min(4).max(20),
  ...Common,
});

const DeckInput = z.object({
  step: z.literal('slides'),
  outline: OutlineSchema,
  material: z.string().max(MAX_MATERIAL).optional(),
  ...Common,
});

const RewriteInput = z.object({
  step: z.literal('rewrite'),
  deckTitle: z.string().max(300),
  slide: SlideSchema,
  instruction: z.string().min(1).max(300),
  ...Common,
});

const Input = z.discriminatedUnion('step', [OutlineInput, DeckInput, RewriteInput]);

const VOICE = {
  professional: 'Clear and professional, like a good university presentation.',
  casual: 'Friendly and relaxed, like a student talking to classmates. A little humour is fine.',
};

function rules(i: { style: z.infer<typeof Style>; audience?: string; language?: string }) {
  return [
    'You make presentation slides for students and teachers.',
    'Slides are short: headings of a few words, bullets under 12 words. Detail goes in speaker notes.',
    i.language && i.language !== 'auto'
      ? `Write everything in ${i.language}.`
      : 'Write in the language of the topic or material (for example English or Bahasa Malaysia).',
    `Voice: ${VOICE[i.style]}`,
    i.audience ? `The audience is: ${i.audience}. Pitch the words and ideas at their level.` : '',
    'No em dashes. No emoji. Never invent statistics, quotes, dates or sources.',
    SAFETY_NOTE,
  ]
    .filter(Boolean)
    .join('\n');
}

type Flows = {
  outline: (i: z.infer<typeof OutlineInput>) => Promise<z.infer<typeof OutlineSchema>>;
  deck: (i: z.infer<typeof DeckInput>) => Promise<z.infer<typeof DeckSchema>>;
  rewrite: (i: z.infer<typeof RewriteInput>) => Promise<z.infer<typeof SlideSchema>>;
};
let flows: Flows | null = null;

function slideFlows(): Flows {
  if (flows) return flows;
  const ai = getAi();

  const outline = ai.defineFlow(
    { name: 'slideOutline', inputSchema: OutlineInput, outputSchema: OutlineSchema },
    async (input) => {
      const ask =
        `${rules(input)}\n` +
        `Plan a deck of about ${input.slideCount} slides (not counting the title slide).\n` +
        (input.topic ? `Topic: ${input.topic}\n` : '') +
        (input.fileName ? `The file is called "${input.fileName}".\n` : '');
      const prompt = input.pdfBase64
        ? [
            { text: `${ask}Base it ONLY on the attached document.` },
            {
              media: {
                url: `data:application/pdf;base64,${input.pdfBase64}`,
                contentType: 'application/pdf',
              },
            },
          ]
        : [
            {
              text:
                ask +
                (input.material
                  ? `Base it ONLY on this material:\n--- MATERIAL ---\n${input.material}`
                  : 'Use well-known, uncontroversial facts only.'),
            },
          ];
      const { output } = await generateWithFallback({
        prompt,
        output: { schema: OutlineSchema },
        config: { temperature: 0.5 },
      });
      if (!output) throw new Error('No outline came back');
      return output;
    },
  );

  const deck = ai.defineFlow(
    { name: 'slideDeck', inputSchema: DeckInput, outputSchema: DeckSchema },
    async (input) => {
      const { output } = await generateWithFallback({
        prompt:
          `${rules(input)}\n` +
          'Turn this outline into slides. Start with a title slide, then one slide per section. ' +
          'You may add a section divider and a closing slide.\n' +
          'Make the deck varied: pick the layout that fits each slide, and use at least 3 ' +
          'different layouts when the content allows. timeline for steps, processes or dates; ' +
          'cards for 3 or 4 parallel ideas; two-column for comparisons or pros and cons; ' +
          'bullets for everything else. Only use quote or big-number with real ones from the ' +
          'material.\n--- OUTLINE ---\n' +
          JSON.stringify(input.outline) +
          (input.material
            ? `\n--- MATERIAL (for facts and speaker notes) ---\n${input.material}`
            : ''),
        output: { schema: DeckSchema },
        config: { temperature: 0.6 },
      });
      if (!output) throw new Error('No slides came back');
      return output;
    },
  );

  const rewrite = ai.defineFlow(
    { name: 'slideRewrite', inputSchema: RewriteInput, outputSchema: SlideSchema },
    async (input) => {
      const { output } = await generateWithFallback({
        prompt:
          `${rules(input)}\n` +
          `This slide is from a deck called "${input.deckTitle}". Rewrite it following this ` +
          `request: "${input.instruction}". You may change the layout if the request needs it. ` +
          'Keep the facts the same.\n--- SLIDE ---\n' +
          JSON.stringify(input.slide),
        output: { schema: SlideSchema },
        config: { temperature: 0.6 },
      });
      if (!output) throw new Error('No slide came back');
      return output;
    },
  );

  flows = { outline, deck, rewrite };
  return flows;
}

/** POST /api/ai-slides with { step: 'outline' | 'slides' | 'rewrite', ... }. */
export async function handleAiSlidesRequest(request: Request): Promise<Response> {
  const refused = guardAiRequest(request, 'slides', PER_MINUTE);
  if (refused) return refused;

  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Bad input' }, { status: 400 });
  const input = parsed.data;
  if (input.step === 'outline') {
    if (!input.topic?.trim() && !input.material?.trim() && !input.pdfBase64) {
      return Response.json({ error: 'Give it a topic, some notes or a file' }, { status: 400 });
    }
    if (input.pdfBase64 && (input.pdfBase64.length * 3) / 4 > MAX_PDF_BYTES) {
      return Response.json({ error: 'File too big (3 MB max)' }, { status: 413 });
    }
  }

  try {
    const f = slideFlows();
    const result =
      input.step === 'outline'
        ? await f.outline(input)
        : input.step === 'slides'
          ? await f.deck(input)
          : await f.rewrite(input);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return aiErrorResponse(e, 'ai-slides', 'Could not make the slides. Try again.');
  }
}
