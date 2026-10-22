// Vercel function: POST /api/wall -> checks a sticky note (word lists + Gemini) and saves it.
// See _lib/wallPost.ts. Needs GEMINI_API_KEY and FIREBASE_SERVICE_ACCOUNT in Vercel.
import { handleWallRequest } from './_lib/wallPost.js';

export function POST(request: Request): Promise<Response> {
  return handleWallRequest(request);
}
