-- Update 002 (2026-10-20): Word (.docx) pages, owner file reads, and a check of the invite code.
-- Run in Supabase > SQL Editor. Safe to run more than once.
-- (schema.sql already contains all of this for fresh installs.)

-- 1. Allow 'doc' pages (a .docx shown with its original layout)
alter table public.pages drop constraint if exists pages_kind_check;
alter table public.pages add constraint pages_kind_check
  check (kind in ('note', 'pdf', 'html', 'doc'));

-- 2. Let .docx files into the bucket
update storage.buckets
   set allowed_mime_types = array[
     'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'text/html', 'text/css', 'text/javascript', 'application/javascript',
     'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
     'font/woff', 'font/woff2', 'application/json', 'text/plain']
 where id = 'pages';

-- 3. Owners can read/list their own page's files (needed to delete a page's files)
drop policy if exists "pages: owner reads" on storage.objects;
create policy "pages: owner reads" on storage.objects for select to authenticated
  using (bucket_id = 'pages' and public.can_write_page_files((storage.foldername(name))[1]));

-- 4. Check: should return one row, html_invite | 64.
--    If it returns nothing, run your invite line on its own (see the bottom of schema.sql).
select key, length(value) as hash_length from private.settings;
