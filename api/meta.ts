// Vercel function: GET /api/meta?url=https://... -> the page's citation details as JSON.
// Used by Cite to turn any link into a reference. See _lib/fetchMeta.ts for the safety checks.
import { handleMetaRequest } from './_lib/fetchMeta';

export function GET(request: Request): Promise<Response> {
  return handleMetaRequest(request);
}
