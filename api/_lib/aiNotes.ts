// AI Notes: turns a PDF, slides or pasted text into study notes, with Genkit + Gemini.
// Used by /api/ai-notes (Vercel) and the dev server (vite.config.ts).
//
// Genkit pieces used here:
// - a flow (`studyNotes`): one named, typed step from input to output, which Genkit can
//   trace and test in its Dev UI;
// - structured output: Gemini must answer in exactly the NotesSchema shape (checked by Zod),
//   so the page never has to guess what came back.
//
// Shared Gemini setup and safety checks: ./ai.ts.

import { z } from 'genkit';
import { SAFETY_NOTE, aiErrorResponse, generateWithFallback, getAi, guardAiRequest } from './ai.js';

export const MAX_TEXT_CHARS = 60_000;
export const MAX_PDF_BYTES = 3 * 1024 * 1024; // base64 grows it to ~4 MB, under Vercel's limit
const NOTES_PER_MINUTE = 4; // per IP: Gemini's free tier is small, share it fairly

export const NotesSchema = z.object({
  title: z.string().describe('A short title for these notes'),
  summary: z.string().describe('A clear summary in 1 to 3 short paragraphs, plain text'),
  keyPoints: z.array(z.string()).describe('5 to 10 key points, one sentence each'),
  terms: z
    .array(z.object({ term: z.string(), meaning: z.string() }))
    .describe('Up to 12 key terms with a one-line meaning'),
  flashcards: z
    .array(z.object({ front: z.string(), back: z.string() }))
    .describe('8 to 15 flashcards: a question or term on the front, the answer on the back'),
  quiz: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).describe('Exactly 4 options'),
        answer: z.number().int().describe('Index (0 to 3) of the correct option'),
        why: z.string().describe('One sentence on why it is right'),
      }),
    )
    .describe('5 to 8 multiple-choice questions'),
});

const InputSchema = z.object({
  text: z.string().max(MAX_TEXT_CHARS).optional(),
  pdfBase64: z.string().optional(),
  fileName: z.string().max(200).optional(),
});

type Input = z.infer<typeof InputSchema>;

let flow: ((input: Input) => Promise<z.infer<typeof NotesSchema>>) | null = null;

function studyNotesFlow() {
  if (flow) return flow;
  const ai = getAi();
  flow = ai.defineFlow(
    { name: 'studyNotes', inputSchema: InputSchema, outputSchema: NotesSchema },
    async (input) => {
      const instructions = [
        'You write study notes for university and school students.',
        'Use ONLY the material provided below. Do not add facts that are not in it.',
        'Write in the same language as the material (for example English or Bahasa Malaysia).',
        'Keep it short, plain and friendly. No em dashes.',
        SAFETY_NOTE,
        input.fileName ? `The file is called "${input.fileName}".` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const prompt = input.pdfBase64
        ? [
            { text: instructions },
            {
              media: {
                url: `data:application/pdf;base64,${input.pdfBase64}`,
                contentType: 'application/pdf',
              },
            },
          ]
        : [{ text: `${instructions}\n\n--- MATERIAL ---\n${input.text ?? ''}` }];
      const { output } = await generateWithFallback({
        prompt,
        output: { schema: NotesSchema },
        config: { temperature: 0.3 },
      });
      if (!output) throw new Error('No notes came back');
      return output;
    },
  );
  return flow;
}

/** POST /api/ai-notes with { text } or { pdfBase64, fileName } -> notes as JSON. */
export async function handleAiNotesRequest(request: Request): Promise<Response> {
  const refused = guardAiRequest(request, 'notes', NOTES_PER_MINUTE);
  if (refused) return refused;

  const parsed = InputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Bad input' }, { status: 400 });
  const input = parsed.data;
  if (input.pdfBase64 && (input.pdfBase64.length * 3) / 4 > MAX_PDF_BYTES) {
    return Response.json({ error: 'File too big (3 MB max)' }, { status: 413 });
  }
  if (!input.pdfBase64 && !(input.text ?? '').trim()) {
    return Response.json({ error: 'Nothing to read' }, { status: 400 });
  }

  try {
    const notes = await studyNotesFlow()(input);
    return Response.json(notes, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return aiErrorResponse(e, 'ai-notes', 'Could not make notes.');
  }
}
