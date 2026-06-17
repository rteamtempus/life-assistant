-- ============================================================
-- 0001_init — core schema (handoff §4)
-- Single-user, but designed clean. pgvector powers semantic recall.
-- ============================================================

create extension if not exists vector;

-- ============ CAPTURE ============
create table entries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  kind          text not null check (kind in ('morning','night','adhoc')),
  audio_path    text,                 -- Supabase Storage path
  transcript    text,
  processed     boolean not null default false  -- nightly batch flips this
);

-- AI-derived, written by the nightly batch job (never block capture on this)
create table entry_insights (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid references entries(id) on delete cascade,
  mood          int,                  -- e.g. -5..+5, nullable
  energy        int,                  -- activation proxy, key for bipolar early-warning
  tags          jsonb default '[]',
  people        jsonb default '[]',
  stressors     jsonb default '[]',
  what_helped   jsonb default '[]',
  summary       text,
  -- dim depends on embedding provider (§5). 1536 = OpenAI text-embedding-3-small.
  -- If you pick Voyage AI, change this to match (e.g. 1024) before going live.
  embedding     vector(1536)
);

-- Fast structured check-in (no full journal) — for intra-day granularity
create table check_ins (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  mood          int,
  energy        int,
  activation    int,                  -- watch this for the climb signature
  note          text
);

-- ============ TOOL DECK ============
create table tools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null check (category in ('morning','nightly','regulation','dopamine')),
  description   text,
  is_energizing boolean not null default false,  -- the orange "climb" flag
  media_url     text,                 -- optional linked clip
  archived      boolean not null default false
);

create table tool_uses (
  id            uuid primary key default gen_random_uuid(),
  tool_id       uuid references tools(id),
  used_at       timestamptz not null default now(),
  duration_min  int,                  -- spoken estimate is fine
  note          text
);

-- ============ MEDIA LIBRARY ============
-- tagged by NEED, not title, so it surfaces by feeling
create table media (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  url           text not null,
  need_tags     jsonb default '[]',   -- ['sleep','anxiety','crash','focus']
  source        text,
  archived      boolean not null default false
);

-- ============ RECOVERY / NUMBING ============
-- Track the urge as a first-class event, SEPARATE from use.
-- Logs whether or not the user acted — "urges ridden out" is the win metric.
create table urge_events (
  id              uuid primary key default gen_random_uuid(),
  occurred_at     timestamptz not null default now(),
  kind            text not null check (kind in ('porn','nicotine','scroll','other')),
  acted_on        boolean,            -- null = still in the moment
  rode_out        boolean,
  intensity       int,                -- 1..10
  -- the leverage is the ANTECEDENT, not the act (DBT chain analysis):
  antecedent_state text,              -- what state/feeling right before
  antecedent_note  text,
  time_of_day      text,              -- derived bucket; expect clusters (pre-meds AM, post-bedtime PM)
  underlying_need  text,              -- stimulation / escape / break / ...
  what_helped      text
);

-- ============ URGE COACH SESSIONS ============
create table coach_sessions (
  id            uuid primary key default gen_random_uuid(),
  urge_event_id uuid references urge_events(id),
  started_at    timestamptz not null default now(),
  messages      jsonb default '[]'    -- full turn-by-turn transcript
);

-- ============ FUTURE-SELF MEMOS ============
-- recorded when calm; played back mid-urge
create table self_memos (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  audio_path    text not null,
  for_context   text                  -- 'urge','crash','hard-morning'
);

-- ============ OPTIONAL DAILY ROLLUP ============
-- everything brain-dumpable; do NOT make these required forms
create table daily_log (
  log_date      date primary key,
  water_note    text,
  food_note     text,
  med_note      text,                 -- timing, esp. Vyvanse kick-in window
  numbing_note  text
);

-- Helpful indexes for the surfacing/ranking queries (§9).
create index entries_created_at_idx on entries (created_at desc);
create index entries_processed_idx on entries (processed) where processed = false;
create index entry_insights_entry_id_idx on entry_insights (entry_id);
create index tool_uses_used_at_idx on tool_uses (used_at desc);
create index tool_uses_tool_id_idx on tool_uses (tool_id);
create index check_ins_created_at_idx on check_ins (created_at desc);
create index urge_events_occurred_at_idx on urge_events (occurred_at desc);
