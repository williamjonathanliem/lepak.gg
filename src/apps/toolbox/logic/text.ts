// Word counter and encode/decode helpers. Pure functions.

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number; // at 238 words a minute (adult silent reading average)
  speakingMinutes: number; // at 140 words a minute (presentation pace)
}

export function textStats(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed ? (trimmed.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length : 0;
  return {
    words,
    characters: [...text].length,
    charactersNoSpaces: [...text.replace(/\s/g, '')].length,
    sentences: trimmed
      ? (trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).filter((s) => /\p{L}/u.test(s)).length
      : 0,
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
    readingMinutes: words / 238,
    speakingMinutes: words / 140,
  };
}

export function minutesLabel(m: number): string {
  if (m === 0) return '0 min';
  if (m < 1) return `${Math.max(1, Math.round(m * 60))} sec`;
  const whole = Math.floor(m);
  const secs = Math.round((m - whole) * 60);
  return secs ? `${whole} min ${secs} sec` : `${whole} min`;
}

// ---------- encoding ----------

export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(b64: string): string {
  const bin = atob(b64.trim());
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- number bases ----------

export type Base = 2 | 8 | 10 | 16;

/** Parses a whole number in a base (allows 0b/0o/0x prefixes, spaces and underscores). */
export function parseBase(input: string, base: Base): bigint | null {
  let s = input.trim().replace(/[\s_]/g, '').toLowerCase();
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  s = s.replace(/^0[box]/, '');
  const digits = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/ }[base];
  if (!s || !digits.test(s)) return null;
  let n = 0n;
  for (const ch of s) n = n * BigInt(base) + BigInt(parseInt(ch, 16));
  return neg ? -n : n;
}

export function formatBase(n: bigint, base: Base): string {
  return n.toString(base).toUpperCase();
}
