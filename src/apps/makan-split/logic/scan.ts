// Receipt scanning, browser side: shrink the photo, send it to /api/receipt, check what
// comes back (api/_lib/receipt.ts).

import { z } from 'zod';
import { aiHeaders } from '../../../lib/aiHeaders';

const MAX_SIDE = 1600;

export const ScanSchema = z.object({
  items: z.array(z.object({ name: z.string().max(40), price: z.number().int().min(0) })).max(60),
  servicePct: z.number().min(0).max(30),
  sstPct: z.number().min(0).max(20),
  discount: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type Scan = z.infer<typeof ScanSchema>;

/** A phone photo is often 4000px and several MB; text stays readable at 1600px as JPEG. */
async function shrink(file: File): Promise<{ imageBase64: string; mimeType: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL('image/jpeg', 0.82);
  return { imageBase64: url.slice(url.indexOf(',') + 1), mimeType: 'image/jpeg' };
}

export async function scanReceipt(file: File, currency: string): Promise<Scan> {
  if (!file.type.startsWith('image/')) throw new Error('Pick a photo of the receipt.');
  let photo;
  try {
    photo = await shrink(file);
  } catch {
    throw new Error('Could not open that photo. Try a JPEG or PNG.');
  }
  const res = await fetch('/api/receipt', {
    method: 'POST',
    headers: aiHeaders(),
    body: JSON.stringify({ ...photo, currency }),
  });
  if (res.status === 404 && res.headers.get('content-type')?.includes('text/html')) {
    throw new Error('Scanning needs the Lepak server, which this copy is not running.');
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? 'Could not read that receipt.');
  }
  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) throw new Error('Could not read that receipt. Try again.');
  return parsed.data;
}
