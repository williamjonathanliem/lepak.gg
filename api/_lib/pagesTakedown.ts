// Lepak Pages takedowns from /admin: deletes one page and all its files. Used by
// /api/pages-takedown (Vercel) and the dev server (vite.config.ts).
//
// Only admins: the request must carry a Firebase sign-in token for an account listed at
// admins/{uid}: true (the same list the database rules use).
// Env (server only, never VITE_):
//   SUPABASE_SERVICE_ROLE_KEY  the secret service_role key (it skips Supabase's access rules)
//   SUPABASE_URL               optional; falls back to VITE_SUPABASE_URL

import { fromOurSite } from './fetchMeta.js';
import { userFrom } from './idToken.js';

/** Same shape the database allows for slugs (supabase/schema.sql). */
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * The page slug from whatever the admin pasted: a full link (https://.../n/my-notes),
 * a path (/n/my-notes/files/x.pdf) or just the slug. Null if it isn't a valid slug.
 */
export function slugFrom(input: string): string | null {
  let text = input.trim();
  try {
    text = new URL(text).pathname;
  } catch {
    // not a full link: a path or a bare slug
  }
  // A link or path must point at a page (/n/...); only a bare name is taken as the slug.
  const fromPath = /^\/?n\/([^/?#]+)/.exec(text);
  if (!fromPath && text.includes('/')) return null;
  const slug = (fromPath ? fromPath[1]! : text).toLowerCase();
  return SLUG.test(slug) ? slug : null;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** One row of the admin list: everything but the page's content and secrets. */
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

/** How many pages the admin list shows (most reported first, then newest). */
const LIST_LIMIT = 500;

/**
 * POST /api/pages-takedown with an admin's Firebase token, and either
 *   { action: 'list' }  -> { pages: PageRow[] }
 *   { page }            -> takes that page down (link or slug)
 */
export async function handlePagesTakedownRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!fromOurSite(request)) return json({ error: 'Not allowed' }, 403);

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return json({ error: 'Takedowns are not set up on this server yet.' }, 503);
  }

  const uid = await userFrom(request);
  if (!uid) return json({ error: 'Sign in as an admin first.' }, 401);
  let admin: typeof import('./firebaseAdmin.js');
  try {
    admin = await import('./firebaseAdmin.js');
  } catch (e) {
    console.error('takedown: could not load firebase-admin:', e instanceof Error ? e.message : e);
    return json({ error: 'Server problem. Try again.' }, 500);
  }
  if (!admin.adminConfigured()) return json({ error: 'Admin is not set up on this server.' }, 503);
  const isAdmin = (await admin.adminDb().ref(`admins/${uid}`).get()).val() === true;
  if (!isAdmin) return json({ error: 'Admins only.' }, 403);

  const body = (await request.json().catch(() => null)) as {
    page?: unknown;
    action?: unknown;
  } | null;

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body?.action === 'list') {
    const { data, error } = await sb
      .from('pages')
      .select('slug, kind, title, visibility, reports, created_at, updated_at, last_seen_at')
      .order('reports', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);
    if (error) {
      console.error('pages list failed:', error.message);
      return json({ error: 'Could not reach Lepak Pages. Try again.' }, 502);
    }
    return json({ pages: (data ?? []) as PageRow[] });
  }

  const slug = typeof body?.page === 'string' ? slugFrom(body.page) : null;
  if (!slug) return json({ error: "That doesn't look like a page link." }, 400);

  const { data: page, error: findError } = await sb
    .from('pages')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle();
  if (findError) {
    console.error('takedown: lookup failed:', findError.message);
    return json({ error: 'Could not reach Lepak Pages. Try again.' }, 502);
  }
  if (!page) return json({ error: `No page called /n/${slug}.` }, 404);

  try {
    const files = await listFiles(sb, slug);
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await sb.storage.from('pages').remove(files.slice(i, i + 100));
      if (error) throw error;
    }
    const { error } = await sb.from('pages').delete().eq('slug', slug);
    if (error) throw error;
    console.info(`takedown: /n/${slug} removed by ${uid} (${files.length} files)`);
    return json({ slug, files: files.length });
  } catch (e) {
    console.error('takedown failed:', e instanceof Error ? e.message : e);
    return json({ error: 'Could not remove it. Try again.' }, 502);
  }
}

type Storage = {
  storage: {
    from(bucket: string): {
      list(
        prefix: string,
        options: { limit: number },
      ): Promise<{ data: { name: string; id: string | null }[] | null; error: unknown }>;
    };
  };
};

/** Every file under a page's folder, folders included (same walk as scripts/cleanup). */
async function listFiles(sb: Storage, prefix: string): Promise<string[]> {
  const out: string[] = [];
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
