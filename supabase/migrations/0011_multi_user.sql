-- ============================================================
-- 0011_multi_user — turn the single-user app into a per-user app.
--
-- Until now this was deliberately single-user: no user_id columns, and every
-- RLS policy was `using (true)` (any authenticated account saw everything).
-- This migration:
--   1. adds an owner (user_id) to each user-data table,
--   2. backfills all existing rows to the original owner,
--   3. makes user_id default to the caller (auth.uid()) and NOT NULL,
--   4. replaces the open RLS policies with per-owner ones,
--   5. scopes the audio Storage bucket to each user's own folder.
--
-- Client inserts need NO code change: the `default auth.uid()` stamps the owner
-- automatically from the signed-in user's JWT. Only the service-role Edge
-- Functions (which bypass RLS) must set/scope user_id explicitly — see the
-- analyze/summarize/transcribe functions.
-- ============================================================

-- ---- 0. identify the original owner (the one existing account) ----
-- All pre-existing data belongs to Rory. Resolve the UID once and reuse it.
-- If the email ever changes, update this single line.
do $$
declare
  owner_id uuid;
  t text;
  -- The live v2 user-data tables. (reflections was created in 0006 and dropped
  -- in 0007, so it's intentionally absent.)
  user_tables text[] := array[
    'dumps', 'events', 'urges', 'analyses', 'experiments'
  ];
begin
  select id into owner_id from auth.users where email = 'rorycteam@gmail.com';
  if owner_id is null then
    -- Fall back to the oldest account if the email lookup misses, so the
    -- migration is still safe to run on a fresh/renamed project.
    select id into owner_id from auth.users order by created_at asc limit 1;
  end if;

  foreach t in array user_tables loop
    -- skip any table that isn't present in this environment
    continue when to_regclass(t) is null;

    -- 1. add the owner column (nullable for now so the backfill can fill it)
    execute format('alter table %I add column if not exists user_id uuid references auth.users(id) on delete cascade;', t);

    -- 2. backfill existing rows to the original owner (no-op on empty tables)
    if owner_id is not null then
      execute format('update %I set user_id = %L where user_id is null;', t, owner_id);
    end if;

    -- 3. owner is required going forward, and defaults to the caller
    execute format('alter table %I alter column user_id set default auth.uid();', t);
    execute format('alter table %I alter column user_id set not null;', t);

    -- index the owner for the per-user filters that now run on every query
    execute format('create index if not exists %I on %I (user_id);', t || '_user_id_idx', t);

    -- 4. swap the open policy for a per-owner one. The v2 policies are named
    --    after their table; reflections' policy is also named "reflections".
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t, t);
    execute format($f$
      create policy %1$I on %1$I
        for all
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ---- 5. Storage: each user only reaches their own `${uid}/...` folder ----
-- Audio paths are already written as `<uid>/<date>/<uuid>.<ext>`
-- (see dumps.service.ts), so the first path segment is the owner's UID.
drop policy if exists "owner reads audio" on storage.objects;
drop policy if exists "owner writes audio" on storage.objects;
drop policy if exists "owner updates audio" on storage.objects;
drop policy if exists "owner deletes audio" on storage.objects;

create policy "owner reads audio" on storage.objects
  for select to authenticated
  using (bucket_id = 'entry-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner writes audio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'entry-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner updates audio" on storage.objects
  for update to authenticated
  using (bucket_id = 'entry-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes audio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'entry-audio' and (storage.foldername(name))[1] = auth.uid()::text);
