// Vercel function: POST /api/ai-slides -> a slide outline, or a full deck, made by Gemini
// through Genkit. See _lib/aiSlides.ts. Needs GEMINI_API_KEY in Vercel.
import { handleAiSlidesRequest } from './_lib/aiSlides.js';

export function POST(request: Request): Promise<Response> {
  return handleAiSlidesRequest(request);
}
