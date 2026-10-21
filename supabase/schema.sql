-- Lepak Pages: database setup for Supabase.
-- Run once in Supabase > SQL Editor (paste all, click Run). Safe to re-run.
--
-- How it's locked down:
--   * Nobody reads or writes the pages table directly. Everything goes through the
--     functions below, which check who you are (Supabase anonymous sign-in) or your
--     secret edit key. So unlisted pages can't be listed or scraped.
--   * HTML hosting needs an invite code. The code is stored hashed in a schema the
--     API can't see. Set it yourself (see the bottom of this file); it never goes in the repo.
--   * Files live in the public "pages" bucket under <slug>/..., and only the page's
--     owner can upload there.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private; -- not exposed through the Supabase API

-- ---------- tables ----------

create table if not exists public.pages (
  slug          text primary key
                check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  owner_uid     uuid not null,
  kind          text not null check (kind in ('note', 'pdf', 'html', 'doc')),
  title         text not null default '' check (char_length(title) <= 120),
  body          text check (char_length(body) <= 200000), -- markdown for notes
  file_path     text check (char_length(file_path) <= 300), -- entry file for pdf/html
  visibility    text not null default 'unlisted' check (visibility in ('unlisted', 'public')),
  edit_key_hash text not null,
  reports       int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- Upgrade older installs: allow 'doc' (a .docx shown with its original layout).
alter table public.pages drop constraint if exists pages_kind_check;
alter table public.pages add constraint pages_kind_check
  check (kind in ('note', 'pdf', 'html', 'doc'));

alter table public.pages enable row level security; -- no policies = no direct access
revoke all on public.pages from anon, authenticated;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);

create table if not exists private.html_hosts (
  uid        uuid primary key,
  granted_at timestamptz not null default now()
);

create table if not exists private.invite_attempts (
  uid uuid not null,
  at  timestamptz not null default now()
);

-- Slugs nobody can take.
create table if not exists private.reserved_slugs (slug text primary key);
insert into private.reserved_slugs (slug) values
  ('new'), ('edit'), ('admin'), ('api'), ('www'), ('lepak'), ('hub'), ('help'),
  ('login'), ('settings'), ('about'), ('terms'), ('privacy')
on conflict do nothing;

-- ---------- helpers ----------

create or replace function private.hash(t text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(t, 'sha256'), 'hex')
$$;

create or replace function private.is_html_host(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.html_hosts h where h.uid = u)
$$;

-- Owner set the invite code (run by you in the SQL editor, never from the app).
create or replace function private.set_html_invite(code text) returns void
language sql security definer set search_path = '' as $$
  insert into private.settings (key, value) values ('html_invite', private.hash(code))
  on conflict (key) do update set value = excluded.value
$$;

-- ---------- functions the app calls ----------

-- Read one page by slug. Also notes the visit (at most once an hour) so active pages
-- don't get cleaned up. Never returns the edit key hash.
create or replace function public.get_page(p_slug text)
returns table (slug text, kind text, title text, body text, file_path text,
               visibility text, updated_at timestamptz, is_owner boolean)
language plpgsql security definer set search_path = '' as $$
begin
  update public.pages p set last_seen_at = now()
   where p.slug = p_slug and p.last_seen_at < now() - interval '1 hour';
  return query
    select p.slug, p.kind, p.title, p.body, p.file_path, p.visibility, p.updated_at,
           (p.owner_uid = auth.uid())
      from public.pages p
     where p.slug = p_slug;
end $$;

-- Claim a slug and publish. Returns 'ok', 'taken', 'reserved', 'need-invite' or 'signed-out'.
create or replace function public.create_page(
  p_slug text, p_kind text, p_title text, p_body text, p_file_path text, p_edit_key text
) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return 'signed-out'; end if;
  if char_length(p_edit_key) < 20 then raise exception 'edit key too short'; end if;
  if exists (select 1 from private.reserved_slugs r where r.slug = p_slug) then return 'reserved'; end if;
  if p_kind = 'html' and not private.is_html_host(auth.uid()) then return 'need-invite'; end if;
  insert into public.pages (slug, owner_uid, kind, title, body, file_path, edit_key_hash)
  values (p_slug, auth.uid(), p_kind, coalesce(p_title, ''), p_body, p_file_path,
          private.hash(p_edit_key));
  return 'ok';
exception when unique_violation then
  return 'taken';
end $$;

-- Edit a page: allowed for the owner's browser, or anyone holding the edit key.
create or replace function public.update_page(
  p_slug text, p_edit_key text, p_title text, p_body text, p_file_path text, p_visibility text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.pages p
     set title = coalesce(p_title, p.title),
         body = coalesce(p_body, p.body),
         file_path = coalesce(p_file_path, p.file_path),
         visibility = coalesce(p_visibility, p.visibility),
         updated_at = now()
   where p.slug = p_slug
     and (p.owner_uid = auth.uid() or p.edit_key_hash = private.hash(coalesce(p_edit_key, '')));
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.delete_page(p_slug text, p_edit_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.pages p
   where p.slug = p_slug
     and (p.owner_uid = auth.uid() or p.edit_key_hash = private.hash(coalesce(p_edit_key, '')));
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.report_page(p_slug text) returns void
language sql security definer set search_path = '' as $$
  update public.pages set reports = reports + 1 where slug = p_slug
$$;

-- Unlock HTML hosting with the invite code. 5 tries per hour per guest.
create or replace function public.redeem_html_invite(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare good text;
begin
  if auth.uid() is null then return false; end if;
  if (select count(*) from private.invite_attempts a
       where a.uid = auth.uid() and a.at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  insert into private.invite_attempts (uid) values (auth.uid());
  select s.value into good from private.settings s where s.key = 'html_invite';
  if good is null or private.hash(p_code) <> good then return false; end if;
  insert into private.html_hosts (uid) values (auth.uid()) on conflict do nothing;
  return true;
end $$;

create or replace function public.can_host_html() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_html_host(auth.uid())
$$;

-- Used by the storage policies: may this guest write files for this slug?
create or replace function public.can_write_page_files(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pages p
     where p.slug = p_slug and p.owner_uid = auth.uid()
       and (p.kind <> 'html' or private.is_html_host(auth.uid()))
  )
$$;

-- For the nightly clean-up job (service key only): pages untouched for 30 days.
create or replace function public.stale_pages() returns setof text
language sql stable security definer set search_path = '' as $$
  select slug from public.pages
   where greatest(updated_at, last_seen_at) < now() - interval '30 days'
$$;

revoke execute on function public.stale_pages() from public, anon, authenticated;
grant execute on function
  public.get_page(text),
  public.create_page(text, text, text, text, text, text),
  public.update_page(text, text, text, text, text, text),
  public.delete_page(text, text),
  public.report_page(text),
  public.redeem_html_invite(text),
  public.can_host_html(),
  public.can_write_page_files(text)
to anon, authenticated;

-- ---------- file storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pages', 'pages', true, 10485760, -- 10 MB per file
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/html', 'text/css', 'text/javascript', 'application/javascript',
        'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
        'font/woff', 'font/woff2', 'application/json', 'text/plain']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owners can list/read their own page's files through the API (needed for "replace file"
-- uploads and for deleting a page's files). Everyone else still opens files through the
-- public URL, but can't list the bucket, so unlisted slugs stay hidden.
drop policy if exists "pages: owner reads" on storage.objects;
create policy "pages: owner reads" on storage.objects for select to authenticated
  using (bucket_id = 'pages' and public.can_write_page_files((storage.foldername(name))[1]));

drop policy if exists "pages: owner uploads" on storage.objects;
create policy "pages: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'pages' and public.can_write_page_files((storage.foldername(name))[1]));

drop policy if exists "pages: owner updates" on storage.objects;
create policy "pages: owner updates" on storage.objects for update to authenticated
  using (bucket_id = 'pages' and public.can_write_page_files((storage.foldername(name))[1]));

drop policy if exists "pages: owner deletes" on storage.objects;
create policy "pages: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'pages' and public.can_write_page_files((storage.foldername(name))[1]));

-- ---------- set your HTML invite code ----------
-- Run this line by itself in the SQL editor, with your own code (long is better, e.g. 4 random words).
-- Re-run it any time to change the code. Don't put the real code in this file.
--
--   select private.set_html_invite('your-secret-code-here');
