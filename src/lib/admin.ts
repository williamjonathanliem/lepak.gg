import { getFirebase } from './firebase';
import { TEAM_UID, type NoteKind } from './wall';

// Admin tools for /admin. Being an admin means: signed in with the email account made in
// the Firebase console, AND listed at admins/{uid}: true (only addable from the console).
// The database rules check that list, so these calls fail for everyone else even if they
// find the page.

export interface AdminSession {
  uid: string;
  email: string | null;
  /** A guest (anonymous) session, not a real sign-in. */
  guest: boolean;
  admin: boolean;
}

export async function adminSession(): Promise<AdminSession> {
  const [{ auth, db, uid }, { ref, get }] = await Promise.all([
    getFirebase(),
    import('firebase/database'),
  ]);
  const user = auth.currentUser;
  const guest = !user || user.isAnonymous;
  let admin = false;
  if (!guest) {
    try {
      admin = (await get(ref(db, `admins/${uid}`))).val() === true;
    } catch {
      admin = false;
    }
  }
  return { uid, email: user?.email ?? null, guest, admin };
}

/** Signs in with email + password, then reloads so every part of the site uses the new user. */
export async function adminSignIn(email: string, password: string): Promise<void> {
  const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([
    getFirebase(),
    import('firebase/auth'),
  ]);
  await signInWithEmailAndPassword(auth, email, password);
  location.reload();
}

/** Back to being a normal guest (a fresh one). */
export async function adminSignOut(): Promise<void> {
  const [{ auth }, { signOut }] = await Promise.all([getFirebase(), import('firebase/auth')]);
  await signOut(auth);
  location.reload();
}

// ---------- rooms ----------

export interface RoomKind {
  id: string;
  label: string;
  path: string;
  /** Where to open it, if it has a page. */
  href?: (code: string, data: Record<string, unknown>) => string | undefined;
  /** Who's in it right now. */
  people: (data: Record<string, unknown>) => number;
}

const count = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v).length : 0);

export const ROOM_KINDS: RoomKind[] = [
  {
    id: 'katabomb',
    label: 'KataBomb',
    path: 'rooms/katabomb',
    href: (c) => `/katabomb/r/${c}`,
    people: (d) => count(d.presence),
  },
  {
    id: 'bingo',
    label: 'Bingo',
    path: 'bingo',
    href: (c) => `/bingo/r/${c}`,
    people: (d) => count(d.players),
  },
  {
    id: 'boards',
    label: 'Whiteboards',
    path: 'boards',
    href: (c) => `/whiteboard/r/${c}`,
    people: (d) => count(d.presence),
  },
  {
    id: 'rtc',
    label: 'Watch Together + Device Drop',
    path: 'rtc',
    href: (c, d) => {
      const app = (d.meta as { app?: string } | undefined)?.app;
      return app === 'watch' ? `/watch/r/${c}` : app === 'drop' ? `/drop/r/${c}` : undefined;
    },
    people: (d) => count(d.peers),
  },
  {
    id: 'collab',
    label: 'Live note editing',
    path: 'collab',
    people: (d) => count(d.peers),
  },
  {
    id: 'quiz',
    label: 'Notes → Game',
    path: 'quiz',
    href: (c) => `/notes-game/r/${c}`,
    people: (d) => count(d.players),
  },
  {
    id: 'ketik',
    label: 'Ketik Race',
    path: 'ketik',
    href: (c) => `/ketik/r/${c}`,
    people: (d) => count(d.racers),
  },
  {
    id: 'sudokuRace',
    label: 'Sudoku Race',
    path: 'sudokuRace',
    href: (c) => `/sudoku-race/r/${c}`,
    people: (d) => count(d.racers),
  },
  {
    id: 'study',
    label: 'Study Room',
    path: 'study',
    href: (c) => `/study/r/${c}`,
    people: (d) => count(d.people),
  },
  {
    id: 'free',
    label: 'Free-Time Finder',
    path: 'free',
    href: (c) => `/free/r/${c}`,
    people: (d) => count(d.people),
  },
  {
    id: 'deadlines',
    label: 'Deadlines',
    path: 'deadlines',
    href: (c) => `/deadlines/r/${c}`,
    people: (d) => count(d.items),
  },
];

export interface RoomRow {
  code: string;
  updatedAt: number;
  people: number;
  href?: string;
  /** For rtc: which app. */
  note?: string;
}

/** The 100 most recently used rooms of one kind. */
export async function listRooms(kind: RoomKind): Promise<RoomRow[]> {
  const [{ db }, { ref, get, query, orderByChild, limitToLast }] = await Promise.all([
    getFirebase(),
    import('firebase/database'),
  ]);
  const snap = await get(query(ref(db, kind.path), orderByChild('updatedAt'), limitToLast(100)));
  const all = (snap.val() ?? {}) as Record<string, Record<string, unknown>>;
  return Object.entries(all)
    .map(([code, d]) => ({
      code,
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
      people: kind.people(d),
      href: kind.href?.(code, d),
      note: (d.meta as { app?: string } | undefined)?.app,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function patch(updates: Record<string, unknown>) {
  const [{ db }, { ref, update }] = await Promise.all([getFirebase(), import('firebase/database')]);
  await update(ref(db), updates);
}

export const closeRoom = (kind: RoomKind, code: string) =>
  patch({ [`${kind.path}/${code}`]: null });

// ---------- wall ----------

/** Posts a note as the Lepak team (shown with a TEAM badge). */
export async function postTeamNote(note: {
  text: string;
  kind: NoteKind;
  color: number;
  pinned: boolean;
}): Promise<void> {
  const [{ db }, { ref, push, set, serverTimestamp }] = await Promise.all([
    getFirebase(),
    import('firebase/database'),
  ]);
  await set(push(ref(db, 'wall')), {
    ...note,
    nick: 'Lepak team',
    uid: TEAM_UID,
    updatedAt: serverTimestamp(),
  });
}

export const setNoteKind = (id: string, kind: NoteKind) => patch({ [`wall/${id}/kind`]: kind });
export const setPinned = (id: string, pinned: boolean) =>
  patch({ [`wall/${id}/pinned`]: pinned || null });

export const approveNote = (id: string) =>
  patch({ [`wall/${id}/approved`]: true, [`wallReports/${id}`]: null });

export const deleteNote = (id: string) =>
  patch({ [`wall/${id}`]: null, [`wallPlus/${id}`]: null, [`wallReports/${id}`]: null });

/** Bans a guest from the wall for 30 days and takes down all their notes. */
export async function banAuthor(uid: string, noteIds: readonly string[]): Promise<void> {
  const { serverTimestamp } = await import('firebase/database');
  const updates: Record<string, unknown> = { [`wallBans/${uid}`]: serverTimestamp() };
  for (const id of noteIds) {
    updates[`wall/${id}`] = null;
    updates[`wallPlus/${id}`] = null;
    updates[`wallReports/${id}`] = null;
  }
  await patch(updates);
}

export const unban = (uid: string) => patch({ [`wallBans/${uid}`]: null });

export function watchBans(cb: (bans: { uid: string; at: number }[]) => void): () => void {
  let off: (() => void) | null = null;
  let cancelled = false;
  void (async () => {
    const [{ db }, { ref, onValue }] = await Promise.all([
      getFirebase(),
      import('firebase/database'),
    ]);
    if (cancelled) return;
    off = onValue(ref(db, 'wallBans'), (s) => {
      const all = (s.val() ?? {}) as Record<string, number>;
      cb(Object.entries(all).map(([uid, at]) => ({ uid, at })));
    });
  })();
  return () => {
    cancelled = true;
    off?.();
  };
}

// ---------- votes ----------

export const resetVotes = (appId: string) => patch({ [`votes/${appId}`]: null });

// ---------- Lepak Pages ----------

/** A Lepak Page as the admin list shows it (no content, no secrets). */
export interface PageRow {
  slug: string;
  kind: string;
  title: string;
  visibility: string;
  reports: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

/** Calls the admin-only Pages endpoint with this account's sign-in token
 * (api/_lib/pagesTakedown.ts checks the account is an admin). */
async function pagesAdmin<T>(payload: object): Promise<T> {
  const { auth } = await getFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in again.');
  const res = await fetch('/api/pages-takedown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Server answered ${res.status}`);
  return body;
}

/** Every live page, most reported first, then newest. */
export async function listPages(): Promise<PageRow[]> {
  return (await pagesAdmin<{ pages: PageRow[] }>({ action: 'list' })).pages;
}

/** Takes a Lepak Page down for good: the page and all its files. Returns how many files
 * went with it. */
export async function takePageDown(page: string): Promise<{ slug: string; files: number }> {
  return pagesAdmin<{ slug: string; files: number }>({ page });
}
