-- ============================================================
-- 0007_v2_schema — pivot to the data-instrument model.
--
-- New core loop: Dump -> Extract -> Analyze. Everything you track is a generic,
-- timestamped `event` with provenance (ai|manual, which dump it came from,
-- confidence, confirmed). Adding a new tracker later = zero schema work.
--
-- The v1 coach/capture tables are dropped (only disposable test data existed).
-- ============================================================

-- ---- drop v1 functions ----
drop function if exists match_entry_insights(vector, int);
drop function if exists top_tools(int);

-- ---- drop v1 tables ----
drop table if exists coach_sessions cascade;
drop table if exists self_memos cascade;
drop table if exists entry_insights cascade;
drop table if exists entries cascade;
drop table if exists check_ins cascade;
drop table if exists tool_uses cascade;
drop table if exists tools cascade;
drop table if exists media cascade;
drop table if exists urge_events cascade;
drop table if exists daily_log cascade;
drop table if exists reflections cascade;

-- ---- storage: retarget audio policies to entry-audio only ----
-- (The hosted platform forbids direct DELETE on storage tables, so the now-
-- unused 'self-memos' bucket is left in place — remove it from the dashboard if
-- desired. Tightening the policies to entry-audio makes it inaccessible anyway.)
drop policy if exists "owner reads audio" on storage.objects;
drop policy if exists "owner writes audio" on storage.objects;
drop policy if exists "owner updates audio" on storage.objects;
drop policy if exists "owner deletes audio" on storage.objects;

create policy "owner reads audio" on storage.objects
  for select to authenticated using (bucket_id = 'entry-audio');
create policy "owner writes audio" on storage.objects
  for insert to authenticated with check (bucket_id = 'entry-audio');
create policy "owner updates audio" on storage.objects
  for update to authenticated using (bucket_id = 'entry-audio');
create policy "owner deletes audio" on storage.objects
  for delete to authenticated using (bucket_id = 'entry-audio');

-- ============ DUMPS — raw brain-dumps (voice/text), the source of everything ============
create table dumps (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  occurred_at timestamptz not null default now(),  -- when the content is "about" (editable)
  kind        text not null check (kind in ('checkin','journal_morning','journal_evening','urge','adhoc')),
  audio_path  text,                                 -- Storage path (null for typed)
  transcript  text,
  status      text not null default 'pending'
              check (status in ('pending','transcribing','transcribed','extracting','done','error')),
  error       text
);

-- ============ EVENTS — the generic timestamped tracker (food, water, meds, ...) ============
-- category is intentionally free text (no enum) so new trackers need no schema change.
-- Canonical categories: food, water, medication, tool, sleep, tiredness, mood,
-- activity, social, symptom, substance. (sleep uses details->>'subtype' = wake|winddown)
create table events (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  occurred_at    timestamptz not null default now(),
  category       text not null,
  label          text,                  -- "oatmeal", "Vyvanse", "10-min walk"
  amount         numeric,               -- 16, 400, 30 ...
  unit           text,                  -- oz, mg, min, hours, /10 ...
  valence        int,                   -- optional -2..2 felt-worse..felt-better hint
  note           text,
  details        jsonb not null default '{}',
  source         text not null default 'manual' check (source in ('ai','manual')),
  source_dump_id uuid references dumps(id) on delete set null,
  confidence     real,                  -- 0..1 for ai-extracted
  confirmed      boolean not null default false  -- user confirmed via chips (manual = true)
);

-- ============ URGES — simplified, two-stage (no AI coach) ============
create table urges (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  occurred_at      timestamptz not null default now(),
  initial_dump_id  uuid references dumps(id) on delete set null,  -- in-the-moment dump
  followup_dump_id uuid references dumps(id) on delete set null,  -- later "did I use?" dump
  intensity        int,
  acted_on         boolean,             -- null until follow-up
  what_helped      text,
  resolved         boolean not null default false
);

-- ============ ANALYSES — every report the user triggers (or scheduled) ============
create table analyses (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  period_start    date not null,
  period_end      date not null,
  trigger         text not null default 'manual' check (trigger in ('morning','weekly','manual')),
  model           text,
  summary         text,
  helped          jsonb not null default '[]',   -- [{item, why, evidence}]
  hurt            jsonb not null default '[]',
  patterns        jsonb not null default '[]',
  recommendations jsonb not null default '[]'     -- [{text, rationale}]
);

-- ============ EXPERIMENTS — insight -> experiment -> progress loop ============
create table experiments (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  text               text not null,
  rationale          text,
  source_analysis_id uuid references analyses(id) on delete set null,
  status             text not null default 'active' check (status in ('active','paused','done','dropped')),
  started_on         date,
  ended_on           date
);

-- ---- indexes ----
create index dumps_created_at_idx on dumps (created_at desc);
create index dumps_unfinished_idx on dumps (status) where status <> 'done';
create index events_occurred_at_idx on events (occurred_at desc);
create index events_category_idx on events (category, occurred_at desc);
create index events_source_dump_idx on events (source_dump_id);
create index urges_occurred_at_idx on urges (occurred_at desc);
create index analyses_period_idx on analyses (period_end desc);
create index experiments_status_idx on experiments (status);

-- ---- RLS: single authenticated owner full access; anon/public none ----
do $$
declare
  t text;
  tables text[] := array['dumps','events','urges','analyses','experiments'];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %1$I on %1$I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
