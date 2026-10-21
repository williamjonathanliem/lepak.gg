-- Lepak Pages now expire after 30 days without a visit or edit (was 90).
-- Run once in the Supabase SQL editor. The nightly clean-up job (scripts/cleanup) calls this.

create or replace function public.stale_pages() returns setof text
language sql stable security definer set search_path = '' as $$
  select slug from public.pages
   where greatest(updated_at, last_seen_at) < now() - interval '30 days'
$$;

revoke execute on function public.stale_pages() from public, anon, authenticated;
