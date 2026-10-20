// Supabase setup for Lepak Pages. The URL and anon key are public by design:
// security comes from supabase/schema.sql (database functions + storage policies).
// Loaded on demand so pages that don't need it stay small.

import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anonKey);

let ready: Promise<SupabaseClient> | null = null;

/**
 * Supabase client, signed in as an invisible guest (anonymous sign-in).
 * The guest id stays the same in this browser, which is what makes you a page's owner.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseEnabled) return Promise.reject(new Error('Supabase is not configured'));
  ready ??= (async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'lepak.supabase.auth' },
    });
    const { data } = await client.auth.getSession();
    if (!data.session) {
      const { error } = await client.auth.signInAnonymously();
      if (error) throw error;
    }
    return client;
  })();
  ready.catch(() => {
    ready = null; // let the next call try again
  });
  return ready;
}

/** Public URL of a file in the pages bucket. */
export function pageFileUrl(path: string): string {
  return `${url}/storage/v1/object/public/pages/${path.split('/').map(encodeURIComponent).join('/')}`;
}
