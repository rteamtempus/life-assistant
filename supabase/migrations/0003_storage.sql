-- ============================================================
-- 0003_storage — private audio buckets (handoff §7)
--   entry-audio : voice brain-dumps awaiting transcription
--   self-memos  : future-self recordings played back mid-urge
-- Both private; access only via the authenticated session + signed URLs.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('entry-audio', 'entry-audio', false),
  ('self-memos', 'self-memos', false)
on conflict (id) do nothing;

-- Authenticated owner may read/write objects in these buckets.
create policy "owner reads audio"
  on storage.objects for select to authenticated
  using (bucket_id in ('entry-audio', 'self-memos'));

create policy "owner writes audio"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('entry-audio', 'self-memos'));

create policy "owner updates audio"
  on storage.objects for update to authenticated
  using (bucket_id in ('entry-audio', 'self-memos'));

create policy "owner deletes audio"
  on storage.objects for delete to authenticated
  using (bucket_id in ('entry-audio', 'self-memos'));
