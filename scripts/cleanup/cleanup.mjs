// Nightly clean-up: deletes old data so nothing lives longer than it should.
// Runs in GitHub Actions (.github/workflows/cleanup.yml). Keep these numbers in sync with
// the Privacy page (src/pages/Legal.tsx).
//
//   1 day    game rooms, bingo, Watch Together / Device Drop rooms (rtc), live note editing,
//            study rooms, live quiz rooms, Sudoku Race and Ketik Race rooms
//   14 days  shared whiteboards (drawings + pictures), free-time polls
//   30 days  after the last change and the last due date: deadline boards
//
// It also keeps the front-page wall from going empty: if fewer than WALL_MIN notes are up,
// it adds team notes (signed "Lepak team", shown with a TEAM badge). They are prompts and
// news from us, never made-up reviews.
//   30 days  votes, notes on the landing wall, Lepak Pages (+ files), guest accounts nobody has used
//
// Env (GitHub secrets):
//   FIREBASE_SERVICE_ACCOUNT   the service account JSON (whole file contents)
//   FIREBASE_DATABASE_URL      e.g. https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app
//   SUPABASE_URL               e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  the secret service_role key
//
// `node cleanup.mjs --dry-run` only prints what it would delete.

import { createClient } from '@supabase/supabase-js';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const DAY = 24 * 60 * 60 * 1000;
const RETENTION = {
  'rooms/katabomb': 1 * DAY,
  bingo: 1 * DAY,
  rtc: 1 * DAY,
  collab: 1 * DAY, // live note editing; the saved note lives in Supabase
  boards: 14 * DAY,
  study: 1 * DAY,
  sudokuRace: 1 * DAY,
  ketik: 1 * DAY,
  quiz: 1 * DAY,
  free: 14 * DAY,
  wall: 30 * DAY, // landing page notes; updatedAt is when it was posted
};
const VOTES_MS = 30 * DAY;
const GUEST_MS = 30 * DAY;

const dryRun = process.argv.includes('--dry-run');
const now = Date.now();
const log = (...a) => console.log(dryRun ? '[dry run]' : '', ...a);

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

// ---------- Firebase ----------

async function cleanFirebase() {
  initializeApp({
    credential: cert(JSON.parse(need('FIREBASE_SERVICE_ACCOUNT'))),
    databaseURL: need('FIREBASE_DATABASE_URL'),
  });
  const db = getDatabase();

  // Rooms, bingo, rtc, boards: anything not updated within its window (or with no date).
  for (const [path, keep] of Object.entries(RETENTION)) {
    const cutoff = now - keep;
    const snap = await db.ref(path).orderByChild('updatedAt').endAt(cutoff).get();
    const old = Object.keys(snap.val() ?? {});
    log(`${path}: ${old.length} older than ${keep / DAY} day(s)`);
    if (!dryRun && old.length) {
      await db.ref(path).update(Object.fromEntries(old.map((k) => [k, null])));
    }
  }

  // Votes: value is the time it was cast. Old-style `true` votes get today's date,
  // so they expire 30 days from the first run.
  const votes = (await db.ref('votes').get()).val() ?? {};
  const patch = {};
  for (const [app, voters] of Object.entries(votes)) {
    for (const [uid, at] of Object.entries(voters ?? {})) {
      if (at === true) patch[`${app}/${uid}`] = now;
      else if (typeof at !== 'number' || at < now - VOTES_MS) patch[`${app}/${uid}`] = null;
    }
  }
  const dropped = Object.values(patch).filter((v) => v === null).length;
  log(`votes: ${dropped} expired, ${Object.keys(patch).length - dropped} dated`);
  if (!dryRun && Object.keys(patch).length) await db.ref('votes').update(patch);

  // Deadline boards: 30 days after the last change, but never while a deadline is still coming.
  const boards = (await db.ref('deadlines').get()).val() ?? {};
  const oldBoards = Object.entries(boards)
    .filter(([, b]) => {
      const lastDue = Math.max(0, ...Object.values(b?.items ?? {}).map((i) => i?.due ?? 0));
      return !(b?.updatedAt > now - 30 * DAY) && lastDue < now - 30 * DAY;
    })
    .map(([code]) => code);
  log(`deadlines: ${oldBoards.length} boards past their 30 days`);
  if (!dryRun && oldBoards.length) {
    await db.ref('deadlines').update(Object.fromEntries(oldBoards.map((k) => [k, null])));
  }

  await topUpWall(db);

  // Wall leftovers: +1s and reports on notes that are gone, post-limit stamps older than a
  // day, and bans older than 30 days.
  const notes = (await db.ref('wall').get()).val() ?? {};
  const leftovers = {};
  for (const list of ['wallPlus', 'wallReports']) {
    const all = (await db.ref(list).get()).val() ?? {};
    for (const id of Object.keys(all)) if (!(id in notes)) leftovers[`${list}/${id}`] = null;
  }
  const last = (await db.ref('wallLast').get()).val() ?? {};
  for (const [uid, at] of Object.entries(last))
    if (!(at > now - DAY)) leftovers[`wallLast/${uid}`] = null;
  const bans = (await db.ref('wallBans').get()).val() ?? {};
  for (const [uid, at] of Object.entries(bans))
    if (!(at > now - 30 * DAY)) leftovers[`wallBans/${uid}`] = null;
  log(`wall: ${Object.keys(leftovers).length} leftovers (+1s, reports, stamps, old bans)`);
  if (!dryRun && Object.keys(leftovers).length) await db.ref().update(leftovers);

  // Guest accounts (anonymous sign-ins) not used for 30 days.
  const auth = getAuth();
  const stale = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      const anonymous = u.providerData.length === 0;
      const last = Date.parse(
        u.metadata.lastRefreshTime ?? u.metadata.lastSignInTime ?? u.metadata.creationTime,
      );
      if (anonymous && last < now - GUEST_MS) stale.push(u.uid);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  log(`firebase guests: ${stale.length} unused for 30 days`);
  if (!dryRun) {
    for (let i = 0; i < stale.length; i += 1000) {
      await auth.deleteUsers(stale.slice(i, i + 1000));
    }
  }
}

// ---------- keeping the wall alive ----------

const WALL_MIN = 3;
const TEAM_UID = 'lepak-team';
// Always on the wall (put back if gone): things we're asking people to vote on.
export const PINNED_TEAM_NOTES = [
  {
    kind: 'idea',
    text: 'Account system? We’re building it: sync your notes, flashcards and streaks across devices. +1 if you want it.',
  },
];
// Rotated through by the month, so the wall doesn't show the same three every time.
const TEAM_NOTES = [
  { kind: 'idea', text: 'What game should we build next? Stick your idea here.' },
  { kind: 'idea', text: 'Found a bug? Tell us which app and what happened.' },
  { kind: 'love', text: 'Thanks for lepaking with us. Everything here stays free.' },
  { kind: 'idea', text: 'Which daily puzzle do you play first? +1 your favourite idea.' },
  { kind: 'idea', text: 'Lecturers: want a class mode? Tell us what you need.' },
  { kind: 'idea', text: 'Want KataBomb in Bahasa Melayu? Say so here.' },
  { kind: 'love', text: 'New apps land every few weeks. Check the Index.' },
  { kind: 'idea', text: 'What would make studying for finals less painful?' },
];

export async function topUpWall(db) {
  const notes = Object.values((await db.ref('wall').get()).val() ?? {});
  const up = new Set(notes.map((n) => n?.text));
  const pinned = PINNED_TEAM_NOTES.filter((n) => !up.has(n.text));
  if (pinned.length && !dryRun) {
    const patch = {};
    pinned.forEach((n, i) => {
      patch[db.ref('wall').push().key] = {
        text: n.text,
        kind: n.kind,
        color: 3 - (i % 4),
        nick: 'Lepak team',
        uid: TEAM_UID,
        pinned: true,
        updatedAt: now + 1, // newest, so it shows near the top under "New"
      };
    });
    await db.ref('wall').update(patch);
  }
  log(`wall: ${pinned.length} pinned team notes put back`);
  pinned.forEach((n) => up.add(n.text));
  const count = notes.length + pinned.length;
  const missing = WALL_MIN - count;
  if (missing <= 0) {
    log('wall: enough notes, no top-up');
    return;
  }
  const start = new Date(now).getUTCMonth() % TEAM_NOTES.length;
  const picks = [];
  for (let k = 0; k < TEAM_NOTES.length && picks.length < missing; k++) {
    const note = TEAM_NOTES[(start + k) % TEAM_NOTES.length];
    if (!up.has(note.text)) picks.push(note);
  }
  log(`wall: ${count} notes up, adding ${picks.length} team notes`);
  if (dryRun) return;
  const patch = {};
  picks.forEach((n, i) => {
    patch[db.ref('wall').push().key] = {
      text: n.text,
      kind: n.kind,
      color: i % 4,
      nick: 'Lepak team',
      uid: TEAM_UID,
      updatedAt: now - i, // keeps their order stable
    };
  });
  await db.ref('wall').update(patch);
}

// ---------- Supabase (Lepak Pages) ----------

async function listFiles(sb, prefix) {
  const out = [];
  const { data, error } = await sb.storage.from('pages').list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    // Folders come back with no id; look inside them.
    if (item.id === null) out.push(...(await listFiles(sb, path)));
    else out.push(path);
  }
  return out;
}

async function cleanSupabase() {
  const sb = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: slugs, error } = await sb.rpc('stale_pages');
  if (error) throw error;
  log(`pages: ${slugs.length} not visited or edited for 30 days`);
  for (const slug of slugs) {
    const files = await listFiles(sb, slug);
    log(`  ${slug} (${files.length} files)`);
    if (dryRun) continue;
    for (let i = 0; i < files.length; i += 100) {
      const { error: e } = await sb.storage.from('pages').remove(files.slice(i, i + 100));
      if (e) throw e;
    }
    const { error: e } = await sb.from('pages').delete().eq('slug', slug);
    if (e) throw e;
  }

  // Guest accounts with no pages left and no sign-in for 30 days.
  const { data: owners, error: ownersError } = await sb.from('pages').select('owner_uid');
  if (ownersError) throw ownersError;
  const hasPages = new Set(owners.map((o) => o.owner_uid));
  const stale = [];
  for (let page = 1; ; page++) {
    const { data, error: e } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (e) throw e;
    for (const u of data.users) {
      const last = Date.parse(u.last_sign_in_at ?? u.created_at);
      if (u.is_anonymous && !hasPages.has(u.id) && last < now - GUEST_MS) stale.push(u.id);
    }
    if (data.users.length < 1000) break;
  }
  log(`supabase guests: ${stale.length} unused for 30 days`);
  if (!dryRun) {
    for (const id of stale) {
      const { error: e } = await sb.auth.admin.deleteUser(id);
      if (e) console.warn(`could not delete guest ${id}: ${e.message}`);
    }
  }
}

// Run both; one failing shouldn't stop the other, but the job should still go red.
const results = await Promise.allSettled([cleanFirebase(), cleanSupabase()]);
let failed = false;
for (const [i, r] of results.entries()) {
  if (r.status === 'rejected') {
    failed = true;
    console.error(`${i === 0 ? 'Firebase' : 'Supabase'} clean-up failed:`, r.reason);
  }
}
process.exit(failed ? 1 : 0);
