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

// ---------- more quiz questions ----------

const QuizInputSchema = InputSchema.extend({
  mode: z.literal('quiz'),
  count: z.number().int().min(5).max(30),
  difficulty: z.enum(['easy', 'mixed', 'hard']),
  kinds: z
    .array(z.enum(['mc', 'tf', 'short']))
    .min(1)
    .max(3),
  /** Questions the set already has, so new ones don't repeat them. */
  avoid: z.array(z.string().max(400)).max(120),
});

// Gemini fills one flat shape for every kind (simpler for it to get right); it's turned into
// the real question kinds below, and anything that doesn't add up is dropped.
const GenQuestionSchema = z.object({
  type: z.enum(['mc', 'tf', 'short']),
  question: z.string(),
  options: z.array(z.string()).describe('mc: exactly 4 options. tf and short: empty list'),
  answerIndex: z.number().int().describe('mc: index (0 to 3) of the right option. Others: 0'),
  answerTrue: z.boolean().describe('tf: true if the statement is true. Others: false'),
  answerText: z.string().describe('short: the answer in 1 to 4 words. Others: empty'),
  accept: z
    .array(z.string())
    .describe(
      'short: other answers that should also count (spellings, short forms). Others: empty',
    ),
  why: z.string().describe('One sentence on why the answer is right'),
});
const GenSchema = z.object({ questions: z.array(GenQuestionSchema) });

type QuizInput = z.infer<typeof QuizInputSchema>;
type GenQuestion = z.infer<typeof GenQuestionSchema>;

const DIFFICULTY: Record<QuizInput['difficulty'], string> = {
  easy: 'Easy: check the main ideas and definitions.',
  mixed: 'Mixed: some easy recall, most need understanding, a few need applying ideas.',
  hard: 'Hard: test understanding and applying ideas, with close, believable wrong options.',
};

const KIND_LABEL = {
  mc: 'multiple choice (4 options)',
  tf: 'true or false',
  short: 'short answer',
};

/** The three question kinds, as the page reads them (src/apps/ai-notes/logic/notes.ts). */
type Question =
  | { type: 'tf'; question: string; answer: boolean; why: string }
  | { type: 'short'; question: string; answer: string; accept: string[]; why: string }
  | { type: 'mc'; question: string; options: string[]; answer: number; why: string };

/** Turns Gemini's flat answer into proper questions, dropping any that don't add up. */
export function toQuestions(gen: readonly GenQuestion[]): Question[] {
  return gen.flatMap((g): Question[] => {
    const base = { question: g.question.trim(), why: g.why.trim() };
    if (!base.question) return [];
    if (g.type === 'tf') return [{ ...base, type: 'tf' as const, answer: g.answerTrue }];
    if (g.type === 'short') {
      const answer = g.answerText.trim();
      if (!answer || answer.length > 120) return [];
      const accept = g.accept.map((a) => a.trim()).filter((a) => a && a.length <= 120);
      return [{ ...base, type: 'short' as const, answer, accept: accept.slice(0, 8) }];
    }
    const options = g.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 6) return [];
    if (g.answerIndex < 0 || g.answerIndex >= options.length) return [];
    return [{ ...base, type: 'mc' as const, options, answer: g.answerIndex }];
  });
}

async function moreQuestions(input: QuizInput) {
  const instructions = [
    `Write ${input.count} new quiz questions for a university or school student revising this material.`,
    'Use ONLY the material below. Every answer must be clearly supported by it.',
    `Question kinds, spread roughly evenly: ${input.kinds.map((k) => KIND_LABEL[k]).join(', ')}.`,
    DIFFICULTY[input.difficulty],
    'Short answers must be 1 to 4 words that a student could type, with no ambiguity.',
    'True or false: make about half of them false, and make false ones subtly wrong.',
    'Write in the same language as the material. Plain and friendly. No em dashes.',
    input.avoid.length
      ? `Do not repeat or reword these existing questions:\n${input.avoid.map((q) => `- ${q}`).join('\n')}`
      : '',
    SAFETY_NOTE,
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
    output: { schema: GenSchema },
    config: { temperature: 0.5 },
  });
  if (!output) throw new Error('No questions came back');
  return toQuestions(output.questions).slice(0, input.count);
}

/** POST /api/ai-notes with { text } or { pdfBase64, fileName } -> notes as JSON.
 * With { mode: 'quiz', count, difficulty, kinds, avoid, ...the same source } -> { questions }. */
export async function handleAiNotesRequest(request: Request): Promise<Response> {
  const refused = await guardAiRequest(request, 'notes', NOTES_PER_MINUTE, { signIn: true });
  if (refused) return refused;

  const body: unknown = await request.json().catch(() => null);
  if ((body as { mode?: unknown } | null)?.mode === 'quiz') return handleQuiz(body);

  const parsed = InputSchema.safeParse(body);
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

async function handleQuiz(body: unknown): Promise<Response> {
  const parsed = QuizInputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Bad input' }, { status: 400 });
  const input = parsed.data;
  if (input.pdfBase64 && (input.pdfBase64.length * 3) / 4 > MAX_PDF_BYTES) {
    return Response.json({ error: 'File too big (3 MB max)' }, { status: 413 });
  }
  if (!input.pdfBase64 && !(input.text ?? '').trim()) {
    return Response.json({ error: 'Nothing to read' }, { status: 400 });
  }
  try {
    const questions = await moreQuestions(input);
    return Response.json({ questions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return aiErrorResponse(e, 'ai-notes quiz', 'Could not make questions.');
  }
}
