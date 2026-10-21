// AI Notes, browser side. Pure helpers: check what the server sent, turn notes into
// markdown for Lepak Pages, pick bingo words, and read text out of PowerPoint slides.

import { z } from 'zod';

export const NotesSchema = z.object({
  title: z.string().max(200),
  summary: z.string().max(5000),
  keyPoints: z.array(z.string().max(500)).max(20),
  terms: z.array(z.object({ term: z.string().max(100), meaning: z.string().max(500) })).max(30),
  flashcards: z.array(z.object({ front: z.string().max(300), back: z.string().max(600) })).max(30),
  quiz: z
    .array(
      z.object({
        question: z.string().max(400),
        options: z.array(z.string().max(200)).min(2).max(6),
        answer: z.number().int().min(0),
        why: z.string().max(500),
      }),
    )
    .max(15),
});

export type Notes = z.infer<typeof NotesSchema>;

/** Notes as markdown, ready to publish as a Lepak Page. */
export function toMarkdown(n: Notes): string {
  const out = [`# ${n.title}`, '', n.summary.trim(), ''];
  if (n.keyPoints.length) out.push('## Key points', '', ...n.keyPoints.map((p) => `- ${p}`), '');
  if (n.terms.length) {
    out.push('## Key terms', '', ...n.terms.map((t) => `- **${t.term}**: ${t.meaning}`), '');
  }
  if (n.flashcards.length) {
    out.push('## Flashcards', '', ...n.flashcards.map((c) => `- **${c.front}**: ${c.back}`), '');
  }
  if (n.quiz.length) {
    out.push('## Quick quiz', '');
    n.quiz.forEach((q, i) => {
      out.push(`${i + 1}. ${q.question}`);
      q.options.forEach((o, j) => out.push(`   - ${String.fromCharCode(65 + j)}. ${o}`));
      const right = q.options[q.answer];
      out.push(`   - *Answer: ${right ?? '?'}. ${q.why}*`, '');
    });
  }
  out.push(
    '---',
    '',
    '*Made with Lepak AI Notes. AI can get things wrong: check anything important.*',
  );
  return out.join('\n');
}

/** Short words and phrases for a revision bingo: the key terms, then short flashcard fronts. */
export function bingoWords(n: Notes): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of [...n.terms.map((t) => t.term), ...n.flashcards.map((c) => c.front)]) {
    const clean = w.trim();
    if (!clean || clean.length > 40 || clean.endsWith('?')) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** The visible text of one slide's XML: every <a:t> run, one paragraph per line. */
export function slideText(xml: string): string {
  const paragraphs = xml.split(/<\/a:p>/);
  const lines: string[] = [];
  for (const p of paragraphs) {
    const runs = [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) =>
      (m[1] ?? '').replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e] ?? ''),
    );
    const line = runs.join('').trim();
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

/** All slides' text from a .pptx file, in slide order. */
export async function pptxToText(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name),
  });
  return Object.keys(files)
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
    .map((name, i) => {
      const text = slideText(strFromU8(files[name]!));
      return text ? `Slide ${i + 1}\n${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

// ---------- dropped files ----------

export const MAX_PDF_BYTES = 3 * 1024 * 1024; // sent as-is to Gemini, so it must stay small
export const MAX_OTHER_BYTES = 30 * 1024 * 1024; // read on the device; only the text is sent

export type AiFileKind = 'pdf' | 'pptx' | 'docx' | 'text' | 'unsupported';

export function aiFileKind(name: string): AiFileKind {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.pptx')) return 'pptx';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.txt') || n.endsWith('.md')) return 'text';
  return 'unsupported';
}

const KIND_LABEL: Record<AiFileKind, string> = {
  pdf: 'PDF',
  pptx: 'PowerPoint slides',
  docx: 'Word document',
  text: 'Text',
  unsupported: 'Not supported (use .pdf, .pptx, .docx or .txt)',
};

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
}

/** The honest checklist shown when a file is dropped on AI Notes. */
export function aiFileChecks(
  file: { name: string; size: number },
  saved = 'Notes saved on this device for 7 days',
): { label: string; ok: boolean }[] {
  const kind = aiFileKind(file.name);
  const max = kind === 'pdf' ? MAX_PDF_BYTES : MAX_OTHER_BYTES;
  const ok = kind !== 'unsupported';
  return [
    { label: `Type: ${KIND_LABEL[kind]}`, ok },
    { label: `Size: ${mb(file.size)} of ${mb(max)} max`, ok: file.size <= max },
    {
      label:
        kind === 'pdf'
          ? 'Sent to Gemini to read, then forgotten'
          : 'Read on your device: only the text is sent',
      ok,
    },
    { label: saved, ok },
  ];
}
