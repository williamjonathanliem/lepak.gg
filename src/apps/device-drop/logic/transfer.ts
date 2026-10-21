// Device Drop transfer rules. Pure: no React, no network.
//
// Over one ordered data channel, a file goes as:
//   { t: 'file', id, name, size, mime }   then the bytes in chunks   then { t: 'end', id }
// Text snippets go as { t: 'text', id, text }. Either side can cancel with { t: 'cancel', id }.

import { z } from 'zod';

export const CHUNK_BYTES = 64 * 1024;
/** Stop queueing chunks when this much is waiting to go out, so memory stays low. */
export const HIGH_WATER = 4 * 1024 * 1024;
export const LOW_WATER = 1024 * 1024;
export const MAX_TEXT = 20_000;

export const ControlSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('file'),
    id: z.string().max(40),
    name: z.string().max(255),
    size: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    mime: z.string().max(120),
  }),
  z.object({ t: z.literal('end'), id: z.string().max(40) }),
  z.object({ t: z.literal('cancel'), id: z.string().max(40) }),
  z.object({ t: z.literal('text'), id: z.string().max(40), text: z.string().max(MAX_TEXT) }),
]);

export type Control = z.infer<typeof ControlSchema>;

export function parseControl(raw: string): Control | null {
  try {
    const r = ControlSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** File names from another device are shown and used for saving, so keep them tame. */
export function safeName(name: string): string {
  const clean = [...name]
    .map((ch) => (ch.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(ch) ? '_' : ch))
    .join('')
    .trim()
    .slice(0, 120);
  return clean && !/^\.+$/.test(clean) ? clean : 'file';
}

export function chunkCount(size: number, chunk = CHUNK_BYTES): number {
  return Math.max(1, Math.ceil(size / chunk));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Speed in bytes/second and seconds left, from how much moved since the start. */
export function speedAndEta(
  done: number,
  total: number,
  startedAt: number,
  now: number,
): { speed: number; eta: number | null } {
  const secs = (now - startedAt) / 1000;
  if (secs <= 0.2 || done <= 0) return { speed: 0, eta: null };
  const speed = done / secs;
  return { speed, eta: Math.max(0, (total - done) / speed) };
}

export type Direction = 'out' | 'in';
export type ItemStatus = 'waiting' | 'sending' | 'done' | 'cancelled' | 'failed';

export interface Item {
  id: string;
  dir: Direction;
  kind: 'file' | 'text';
  name: string;
  size: number;
  mime: string;
  done: number;
  status: ItemStatus;
  startedAt: number;
  text?: string;
}

/**
 * Builds incoming files from control messages and chunks.
 * Returns what changed so the UI can update; finished files come out as Blobs.
 */
export class Assembler {
  private current: {
    id: string;
    parts: BlobPart[];
    got: number;
    size: number;
    mime: string;
  } | null = null;

  /** A control message arrived. Returns a finished file or text, if any. */
  control(
    c: Control,
  ):
    | { type: 'start'; id: string; name: string; size: number; mime: string }
    | { type: 'file'; id: string; blob: Blob }
    | { type: 'text'; id: string; text: string }
    | { type: 'cancel'; id: string }
    | { type: 'bad' } {
    switch (c.t) {
      case 'file':
        this.current = { id: c.id, parts: [], got: 0, size: c.size, mime: c.mime };
        return { type: 'start', id: c.id, name: safeName(c.name), size: c.size, mime: c.mime };
      case 'end': {
        const cur = this.current;
        this.current = null;
        if (!cur || cur.id !== c.id || cur.got !== cur.size) return { type: 'bad' };
        return { type: 'file', id: c.id, blob: new Blob(cur.parts, { type: cur.mime }) };
      }
      case 'cancel':
        if (this.current?.id === c.id) this.current = null;
        return { type: 'cancel', id: c.id };
      case 'text':
        return { type: 'text', id: c.id, text: c.text };
    }
  }

  /** Some bytes arrived. Returns the file id and bytes so far, or null if unexpected. */
  chunk(data: ArrayBuffer): { id: string; got: number } | null {
    const cur = this.current;
    if (!cur || cur.got + data.byteLength > cur.size) return null;
    cur.parts.push(data);
    cur.got += data.byteLength;
    return { id: cur.id, got: cur.got };
  }
}

/** A friendly name for this device, shown to the other side. */
export function deviceName(ua: string): string {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Device';
}
