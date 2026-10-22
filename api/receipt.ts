// Vercel function: POST /api/receipt -> the items and charges on a receipt photo, read by
// Gemini. See _lib/receipt.ts. Needs GEMINI_API_KEY in Vercel.
import { handleReceiptRequest } from './_lib/receipt.js';

export function POST(request: Request): Promise<Response> {
  return handleReceiptRequest(request);
}
