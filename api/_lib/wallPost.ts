// The Wall: every new sticky note comes through here, so the checks can't be skipped.
// Used by /api/wall (Vercel) and the dev server (vite.config.ts).
//
//   1. quick checks: length, swears (English + Malay/Manglish), links, emails, phone numbers
//   2. is this guest banned, or posting more than once a minute?
//   3. Gemini reads it for anything the word lists miss: bullying, hate, sexual content,
//      self-harm, personal info about someone. If Gemini can't be reached, the note is
//      NOT posted (we never let unchecked notes through).
//   4. saved with full rights (the database rules don't let browsers create notes)

import { ServerValue } from 'firebase-admin/database';
import { z } from 'genkit';
import { filterText } from '../../src/lib/noteFilter.js';
import { SAFETY_NOTE, generateWithFallback, guardAiRequest, isBusyError } from './ai.js';
import { adminConfigured, adminDb, userFrom } from './firebaseAdmin.js';

const NOTES_PER_MINUTE = 6; // per IP; the per-guest limit (1 a minute) is checked below
const POST_GAP_MS = 60_000;

const InputSchema = z.object({
  text: z.string().trim().min(3).max(140),
  kind: z.enum(['idea', 'bug', 'love']),
  color: z.number().int().min(0).max(3),
  nick: z.string().trim().min(2).max(16),
});

const VerdictSchema = z.object({
  allowed: z.boolean(),
  reason: z
    .enum(['ok', 'bullying', 'hate', 'sexual', 'self-harm', 'personal-info', 'spam', 'other'])
    .describe('ok when allowed, otherwise the main problem'),
});

/** What the page shows for each refusal (the codes match WALL.errors in the copy). */
export type WallCode =
  | 'too-short'
  | 'too-long'
  | 'rude'
  | 'contact'
  | 'slow'
  | 'banned'
  | 'unsafe'
  | 'self-harm'
  | 'busy'
  | 'signin'
  | 'setup'
  | 'failed';

const refuse = (code: WallCode, status: number) => Response.json({ code }, { status });

async function moderate(text: string, nick: string) {
  const { output } = await generateWithFallback({
    prompt: [
      'You moderate a public sticky-note wall on a free website for Malaysian students.',
      'Notes are ideas, bug reports or kind words about the site. Notes may be in English,',
      'Bahasa Malaysia, Manglish, Chinese or Tamil, often with slang.',
      'Allow normal feedback, jokes and mild slang (lah, sia, bodoh said about a game).',
      'Refuse: bullying or insults aimed at a person, hate against any group, sexual content,',
      'self-harm or suicide talk, personal info about someone (full names with gossip,',
      'addresses, schools plus class), spam or ads, and anything a teacher would not want',
      'on a classroom wall.',
      SAFETY_NOTE,
      '',
      `Nickname: ${JSON.stringify(nick)}`,
      `Note: ${JSON.stringify(text)}`,
    ].join('\n'),
    output: { schema: VerdictSchema },
    config: { temperature: 0 },
  });
  if (!output) throw new Error('No verdict came back');
  return output;
}

/** POST /api/wall with { text, kind, color, nick } and the guest's Firebase ID token. */
export async function handleWallRequest(request: Request): Promise<Response> {
  const refused = guardAiRequest(request, 'wall', NOTES_PER_MINUTE);
  if (refused) return refused;
  if (!adminConfigured()) {
    return refuse('setup', 503);
  }

  const uid = await userFrom(request);
  if (!uid) return refuse('signin', 401);

  const body: unknown = await request.json().catch(() => null);
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    const len =
      typeof (body as { text?: unknown })?.text === 'string'
        ? (body as { text: string }).text.trim().length
        : 0;
    return refuse(len > 140 ? 'too-long' : 'too-short', 400);
  }
  const note = { ...parsed.data, text: parsed.data.text.replace(/\s+/g, ' ') };

  const hit = filterText(note.text) ?? (filterText(note.nick) === 'rude' ? 'rude' : null);
  if (hit) return refuse(hit, 400);

  const db = adminDb();
  const [ban, last] = await Promise.all([
    db.ref(`wallBans/${uid}`).get(),
    db.ref(`wallLast/${uid}`).get(),
  ]);
  if (ban.exists()) return refuse('banned', 403);
  if (typeof last.val() === 'number' && Date.now() - (last.val() as number) < POST_GAP_MS) {
    return refuse('slow', 429);
  }

  try {
    const verdict = await moderate(note.text, note.nick);
    if (!verdict.allowed) {
      console.info(`wall: refused (${verdict.reason})`);
      return refuse(verdict.reason === 'self-harm' ? 'self-harm' : 'unsafe', 400);
    }
  } catch (e) {
    console.error('wall moderation failed:', e instanceof Error ? e.message : e);
    return refuse(isBusyError(e) ? 'busy' : 'failed', 503);
  }

  const id = db.ref('wall').push().key!;
  await db.ref().update({
    [`wall/${id}`]: { ...note, uid, updatedAt: ServerValue.TIMESTAMP },
    [`wallLast/${uid}`]: ServerValue.TIMESTAMP,
  });
  return Response.json({ id }, { headers: { 'Cache-Control': 'no-store' } });
}
