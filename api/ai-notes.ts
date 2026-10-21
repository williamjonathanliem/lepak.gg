// Vercel function: POST /api/ai-notes -> study notes made by Gemini (through Genkit).
// See _lib/aiNotes.ts. Needs the GEMINI_API_KEY environment variable in Vercel.
import { handleAiNotesRequest } from './_lib/aiNotes';

export function POST(request: Request): Promise<Response> {
  return handleAiNotesRequest(request);
}
