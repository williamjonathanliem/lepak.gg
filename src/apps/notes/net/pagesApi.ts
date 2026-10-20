// Talks to Supabase for Lepak Pages. All reads and writes go through the database
// functions in supabase/schema.sql, which do the permission checks.

import { getSupabase, pageFileUrl } from '../../../lib/supabase';
import { readStorage, writeStorage } from '../../../lib/storage';
import { rememberPage, type MyPage, type PageKind } from '../logic/pages';

export interface PageRecord {
  slug: string;
  kind: PageKind;
  title: string;
  body: string | null;
  file_path: string | null;
  visibility: 'unlisted' | 'public';
  updated_at: string;
  is_owner: boolean;
}

export type CreateResult = 'ok' | 'taken' | 'reserved' | 'need-invite' | 'signed-out';

export interface SiteFile {
  path: string; // relative, e.g. "css/style.css"
  data: Blob;
  type: string;
}

export async function getPage(slug: string): Promise<PageRecord | null> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('get_page', { p_slug: slug });
  if (error) throw error;
  return ((data as PageRecord[] | null) ?? [])[0] ?? null;
}

export async function createPage(input: {
  slug: string;
  kind: PageKind;
  title: string;
  body: string | null;
  filePath: string | null;
  editKey: string;
}): Promise<CreateResult> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('create_page', {
    p_slug: input.slug,
    p_kind: input.kind,
    p_title: input.title,
    p_body: input.body,
    p_file_path: input.filePath,
    p_edit_key: input.editKey,
  });
  if (error) throw error;
  return data as CreateResult;
}

export async function updatePage(input: {
  slug: string;
  editKey: string | null;
  title?: string;
  body?: string;
  filePath?: string;
}): Promise<boolean> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('update_page', {
    p_slug: input.slug,
    p_edit_key: input.editKey,
    p_title: input.title ?? null,
    p_body: input.body ?? null,
    p_file_path: input.filePath ?? null,
    p_visibility: null,
  });
  if (error) throw error;
  return data === true;
}

/** Deletes the page and, when this browser owns it, its files too. */
export async function deletePage(slug: string, editKey: string | null): Promise<boolean> {
  const sb = await getSupabase();
  // Files first, while we still own the page (the storage rules check ownership).
  await removeFiles(slug).catch(() => {
    // Not the owner's browser: files are left for the nightly clean-up.
  });
  const { data, error } = await sb.rpc('delete_page', { p_slug: slug, p_edit_key: editKey });
  if (error) throw error;
  forgetPage(slug);
  return data === true;
}

export async function reportPage(slug: string): Promise<void> {
  const sb = await getSupabase();
  await sb.rpc('report_page', { p_slug: slug });
}

export async function redeemInvite(code: string): Promise<boolean> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('redeem_html_invite', { p_code: code });
  if (error) throw error;
  return data === true;
}

export async function canHostHtml(): Promise<boolean> {
  const sb = await getSupabase();
  const { data } = await sb.rpc('can_host_html');
  return data === true;
}

/** Uploads files under <slug>/. Calls onProgress after each file. */
export async function uploadFiles(
  slug: string,
  files: SiteFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const sb = await getSupabase();
  let done = 0;
  for (const f of files) {
    const { error } = await sb.storage
      .from('pages')
      .upload(`${slug}/${f.path}`, f.data, { contentType: f.type, upsert: false });
    if (error) throw error;
    onProgress?.(++done, files.length);
  }
}

async function removeFiles(slug: string): Promise<void> {
  const sb = await getSupabase();
  // Walk the folder tree (sites can have sub-folders).
  const paths: string[] = [];
  const walk = async (prefix: string) => {
    const { data, error } = await sb.storage.from('pages').list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const item of data ?? []) {
      const full = `${prefix}/${item.name}`;
      if (item.id === null)
        await walk(full); // folder
      else paths.push(full);
    }
  };
  await walk(slug);
  if (paths.length) await sb.storage.from('pages').remove(paths);
}

export { pageFileUrl };

// ---------- pages made on this device ----------

const MY_PAGES_KEY = 'lepak.pages.mine';

export function myPages(): MyPage[] {
  try {
    return JSON.parse(readStorage(MY_PAGES_KEY) ?? '[]') as MyPage[];
  } catch {
    return [];
  }
}

export function savePageLocally(page: MyPage) {
  writeStorage(MY_PAGES_KEY, JSON.stringify(rememberPage(myPages(), page)));
}

export function forgetPage(slug: string) {
  writeStorage(MY_PAGES_KEY, JSON.stringify(myPages().filter((p) => p.slug !== slug)));
}

/** The edit key for a page, from the URL (#k=...) or from this device's list. */
export function editKeyFor(slug: string, hash: string): string | null {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('k');
  return fromHash ?? myPages().find((p) => p.slug === slug)?.editKey ?? null;
}
