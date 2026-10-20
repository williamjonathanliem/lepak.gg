-- Update 003 (2026-10-20): fixes the Supabase Security Advisor warning
-- "Function private.hash has a role mutable search_path". Safe to run more than once.
create or replace function private.hash(t text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(t, 'sha256'), 'hex')
$$;
