// "Got a code?": works out which app a room code belongs to, so people only type the code.
// Checks each multiplayer app's room in Firebase (all readable by any signed-in guest, see
// database.rules.json) and returns every match, best first.

import { JOINABLE } from '../apps/groups';

export interface RoomMatch {
  id: string;
  name: string;
  path: string;
}

/** Where each app keeps a room, and how to tell it exists. */
const PROBES: { id: string; paths: (code: string) => string[]; check?: (v: unknown) => boolean }[] =
  [
    { id: 'katabomb', paths: (c) => [`rooms/katabomb/${c}/state/hostId`] },
    { id: 'bingo', paths: (c) => [`bingo/${c}/game/hostId`] },
    // A brand-new board has people on it but nothing drawn yet.
    { id: 'whiteboard', paths: (c) => [`boards/${c}/updatedAt`, `boards/${c}/presence`] },
    { id: 'watch', paths: (c) => [`rtc/${c}/meta/app`], check: (v) => v === 'watch' },
    { id: 'device-drop', paths: (c) => [`rtc/${c}/meta/app`], check: (v) => v === 'drop' },
    { id: 'notes-to-game', paths: (c) => [`quiz/${c}/game/hostId`] },
    { id: 'study-room', paths: (c) => [`study/${c}/timer/focusMin`] },
    { id: 'free-time-finder', paths: (c) => [`free/${c}/meta/owner`] },
    { id: 'deadlines', paths: (c) => [`deadlines/${c}/meta/owner`] },
  ];

export async function findRoom(code: string): Promise<RoomMatch[]> {
  const [{ getFirebase }, { get, ref }] = await Promise.all([
    import('./firebase'),
    import('firebase/database'),
  ]);
  const { db } = await getFirebase();
  const found = await Promise.all(
    PROBES.map(async (p) => {
      for (const path of p.paths(code)) {
        try {
          const snap = await get(ref(db, path));
          if (snap.exists() && (p.check ? p.check(snap.val()) : true)) return p.id;
        } catch {
          // no permission or offline: treat as not found
        }
      }
      return null;
    }),
  );
  return JOINABLE.filter((j) => found.includes(j.id)).map((j) => ({
    id: j.id,
    name: j.name,
    path: j.path(code),
  }));
}
