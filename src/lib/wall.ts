import { firebaseEnabled, getFirebase } from './firebase';
import { filterText } from './noteFilter';

// The Wall: sticky notes on the landing page. Ideas, bugs, love. Anyone can post (one note a
// minute), tap +1 on others, report bad ones, and take down their own. Stored in Realtime
// Database as
//   wall/{noteId}:             { text, kind, color, nick, uid, updatedAt, approved? }
//   wallPlus/{noteId}/{uid}:    true
//   wallReports/{noteId}/{uid}: true
//   wallLast/{uid}:            when this guest last posted (server only)
//   wallBans/{uid}:            when an admin banned this guest (server and admins only)
// New notes go through /api/wall, which checks them (word lists + AI) before saving; the
// rules don't let browsers create notes themselves. Notes delete themselves after 30 days
// (scripts/cleanup).

export const wallEnabled = firebaseEnabled;

export const NOTE_MIN = 3;
export const NOTE_MAX = 140;
/** Reports from different people that hide a note until an admin looks at it. */
export const HIDE_AFTER_REPORTS = 3;
export const NOTE_KINDS = ['idea', 'bug', 'love'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
/** Post-it colours. Notes store the index so the palette can change later. */
export const NOTE_COLORS = ['#ffd23f', '#ff8fd0', '#7ee081', '#4fd1e8'] as const;

export interface WallNote {
  id: string;
  text: string;
  kind: NoteKind;
  color: number;
  nick: string;
  uid: string;
  at: number;
  plus: number;
  reports: number;
  /** An admin looked at it and kept it: reports no longer hide it. */
  approved: boolean;
  /** Reported enough to hide it from everyone until an admin decides. */
  hidden: boolean;
  mine: boolean;
  plussed: boolean;
  reported: boolean;
}

/** Why a note was refused. The same codes come back from /api/wall. */
export type NoteError =
  | 'too-short'
  | 'too-long'
  | 'rude'
  | 'contact'
  | 'slow'
  | 'banned'
  | 'unsafe'
  | 'self-harm'
  | 'busy'
  | 'signin'
  | 'setup'
  | 'failed';

export function checkNote(
  raw: string,
): { ok: true; text: string } | { ok: false; error: NoteError } {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length < NOTE_MIN) return { ok: false, error: 'too-short' };
  if (text.length > NOTE_MAX) return { ok: false, error: 'too-long' };
  const hit = filterText(text);
  if (hit) return { ok: false, error: hit };
  return { ok: true, text };
}

export type WallSort = 'top' | 'new';

/** Most +1s first (newest breaks ties), or just newest first. */
export function sortNotes(notes: readonly WallNote[], by: WallSort): WallNote[] {
  return [...notes].sort((a, b) => (by === 'top' ? b.plus - a.plus : 0) || b.at - a.at);
}

interface RawNote {
  text?: unknown;
  kind?: unknown;
  color?: unknown;
  nick?: unknown;
  uid?: unknown;
  updatedAt?: unknown;
  approved?: unknown;
}

type Votes = Record<string, Record<string, unknown>> | null;

/** Turns the database snapshot into notes, skipping anything malformed. */
export function readNotes(
  raw: Record<string, RawNote> | null,
  plus: Votes,
  reports: Votes,
  uid: string,
): WallNote[] {
  const out: WallNote[] = [];
  for (const [id, n] of Object.entries(raw ?? {})) {
    if (typeof n.text !== 'string' || typeof n.nick !== 'string') continue;
    if (!NOTE_KINDS.includes(n.kind as NoteKind)) continue;
    const voters = plus?.[id] ?? {};
    const reporters = reports?.[id] ?? {};
    const reportCount = Object.keys(reporters).length;
    const approved = n.approved === true;
    out.push({
      id,
      text: n.text,
      kind: n.kind as NoteKind,
      color: typeof n.color === 'number' ? n.color % NOTE_COLORS.length : 0,
      nick: n.nick,
      uid: typeof n.uid === 'string' ? n.uid : '',
      at: typeof n.updatedAt === 'number' ? n.updatedAt : 0,
      plus: Object.keys(voters).length,
      reports: reportCount,
      approved,
      hidden: !approved && reportCount >= HIDE_AFTER_REPORTS,
      mine: n.uid === uid,
      plussed: uid in voters,
      reported: uid in reporters,
    });
  }
  return out;
}

/** Live notes, hidden ones included (the page decides what to show). Calls onError if the
 * wall can't be read (offline, rules not published). */
export function watchWall(cb: (notes: WallNote[]) => void, onError: () => void): () => void {
  const offs: (() => void)[] = [];
  let cancelled = false;
  void (async () => {
    const [{ db, uid }, { ref, onValue }] = await Promise.all([
      getFirebase(),
      import('firebase/database'),
    ]);
    if (cancelled) return;
    let notes: Record<string, RawNote> | null = null;
    let plus: Votes = null;
    let reports: Votes = null;
    let ready = 0;
    const emit = () => {
      if (ready === 7) cb(readNotes(notes, plus, reports, uid));
    };
    const listen = (path: string, bit: number, set: (v: unknown) => void) =>
      onValue(
        ref(db, path),
        (s) => {
          set(s.val());
          ready |= bit;
          emit();
        },
        onError,
      );
    offs.push(
      listen('wall', 1, (v) => (notes = v as typeof notes)),
      listen('wallPlus', 2, (v) => (plus = v as Votes)),
      listen('wallReports', 4, (v) => (reports = v as Votes)),
    );
  })().catch(onError);
  return () => {
    cancelled = true;
    for (const off of offs) off();
  };
}

/** A refused note, with the reason the page should show. */
export class NoteRefused extends Error {
  constructor(readonly code: NoteError) {
    super(code);
  }
}

const KNOWN: readonly string[] = [
  'too-short',
  'too-long',
  'rude',
  'contact',
  'slow',
  'banned',
  'unsafe',
  'self-harm',
  'busy',
  'signin',
  'setup',
  'failed',
];

/** Sends a note to /api/wall, which checks it and saves it. Throws NoteRefused. */
export async function postNote(note: {
  text: string;
  kind: NoteKind;
  color: number;
  nick: string;
}): Promise<void> {
  const { auth } = await getFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new NoteRefused('signin');
  let res: Response;
  try {
    res = await fetch('/api/wall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(note),
    });
  } catch {
    throw new NoteRefused('failed');
  }
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as { code?: string };
  if (body.code && KNOWN.includes(body.code)) throw new NoteRefused(body.code as NoteError);
  throw new NoteRefused(res.status === 429 ? 'slow' : 'failed');
}

export async function removeNote(id: string): Promise<void> {
  const [{ db }, { ref, remove }] = await Promise.all([getFirebase(), import('firebase/database')]);
  // Its +1s and reports belong to other people; the nightly clean-up drops them.
  await remove(ref(db, `wall/${id}`));
}

async function toggleMine(path: string, on: boolean) {
  const [{ db, uid }, { ref, set, remove }] = await Promise.all([
    getFirebase(),
    import('firebase/database'),
  ]);
  const r = ref(db, `${path}/${uid}`);
  await (on ? set(r, true) : remove(r));
}

export const setPlus = (id: string, on: boolean) => toggleMine(`wallPlus/${id}`, on);
export const setReport = (id: string, on: boolean) => toggleMine(`wallReports/${id}`, on);
