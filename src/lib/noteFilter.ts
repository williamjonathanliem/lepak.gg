import { hasProfanity } from './profanity';

// Quick checks for anything people post publicly (wall notes). Runs in the browser for
// instant feedback and again on the server (api/_lib/wallPost.ts), where it can't be
// skipped. Catches the obvious stuff; the server's AI check catches the rest (bullying,
// hate, self-harm and so on, in any language).

export type FilterHit = 'rude' | 'contact';

// Malay, Manglish and common Malaysian Chinese / Tamil swears. Whole words only, after
// undoing tricks like b4b1 or p.u.k.i. Mild slang (sial, bodoh) is left to the AI check,
// which can tell a joke from an attack.
const LOCAL_SWEARS = [
  'babi',
  'pukimak',
  'puki',
  'pantat',
  'kote',
  'butoh',
  'pepek',
  'kimak',
  'lancau',
  'lanjiao',
  'lanjiau',
  'cibai',
  'cb',
  'knn',
  'kanina',
  'nabei',
  'pundek',
  'punda',
  'bangsat',
  'keparat',
  'sundal',
  'jalang',
  'pelacur',
  'jubur',
  'haramjadah',
  'anakharam',
  'mampus',
];
const PHRASES = ['anak haram', 'haram jadah'];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

/** Lowercase, undo leetspeak, and drop dots or dashes hidden inside words. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/(?<=\p{L})[.\-_*]+(?=\p{L})/gu, '');
}

function hasLocalSwear(text: string): boolean {
  const norm = normalise(text);
  const words = norm.split(/[^\p{L}]+/u).filter(Boolean);
  if (words.some((w) => LOCAL_SWEARS.includes(w))) return true;
  // Two-word ones written apart ("anak haram").
  const spaced = ` ${words.join(' ')} `;
  if (PHRASES.some((p) => spaced.includes(` ${p} `))) return true;
  // Letters spaced out ("p u k i"): join runs of single letters only, so normal words
  // side by side ("pun dah") never get glued into something rude.
  const runs = norm.split(/(?:^|\s)\p{L}{2,}(?:\s|$)|[^\p{L}\s]+/u);
  return runs.some((r) => {
    const glued = r.replace(/\s+/g, '');
    return glued.length >= 3 && LOCAL_SWEARS.some((sw) => glued.includes(sw));
  });
}

const LINK =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|my|gg|io|xyz|ly|me|co|app|link|info|biz)\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
// 8 or more digits, allowing spaces, dots or dashes between them (phone numbers, IC numbers).
const LONG_NUMBER = /(?:\d[\s.-]?){8,}/;

export function filterText(text: string): FilterHit | null {
  if (LINK.test(text) || EMAIL.test(text) || LONG_NUMBER.test(text)) return 'contact';
  if (hasProfanity(text) || hasLocalSwear(text)) return 'rude';
  return null;
}
