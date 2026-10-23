// Vercel function: POST /api/pages-takedown -> removes one Lepak Page and its files (admins
// only). See _lib/pagesTakedown.ts. Needs SUPABASE_SERVICE_ROLE_KEY in Vercel.
import { handlePagesTakedownRequest } from './_lib/pagesTakedown.js';

export function POST(request: Request): Promise<Response> {
  return handlePagesTakedownRequest(request);
}
