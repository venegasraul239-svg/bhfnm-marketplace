-- 0005_rls_helper_recursion_fix.sql
--
-- FIX: anon catalog queries failed with 54001 "stack depth limit exceeded"
-- (products pages 404). Cause: RLS policy cycle —
--   products policy → is_admin()/my_vendor_id() → SELECT profiles/vendors
--   → those tables' policies → is_admin() → SELECT profiles → policy → …
--
-- SECURITY DEFINER makes the helpers evaluate WITHOUT re-triggering RLS
-- (the standard Supabase pattern for role-check helpers). Both functions
-- only read the caller's own row by auth.uid(), so this leaks nothing.

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function my_vendor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from vendors where owner_id = auth.uid() limit 1;
$$;
