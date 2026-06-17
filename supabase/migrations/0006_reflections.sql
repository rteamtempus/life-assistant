-- ============================================================
-- 0006_reflections — weekly auto-summary storage (handoff §3 Bucket A, §10
-- Phase 4). The weekly-summary Edge Function (clock → batch) writes a first-
-- pass report here; the interactive Sunday MCP deep-dive (Bucket B) reads the
-- same row and goes deeper on top of it (§3).
-- ============================================================

create table reflections (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  period              text not null default 'week' check (period in ('week','month')),
  period_start        date not null,
  period_end          date not null,
  summary             text,                  -- the warm narrative
  highlights          jsonb default '[]',    -- things that went well / were done
  gentle_observations jsonb default '[]',    -- patterns, never diagnoses (§6)
  therapist_note      text                   -- optional draft for a session
);

create index reflections_period_idx on reflections (period_end desc);

alter table reflections enable row level security;

create policy reflections on reflections
  for all
  to authenticated
  using (true)
  with check (true);
