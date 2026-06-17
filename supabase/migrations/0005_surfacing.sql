-- ============================================================
-- 0005_surfacing — the payoff layer (handoff §9)
--
--  match_entry_insights : semantic recall — given how you feel right now
--    (as an embedding), find the most similar past moments and what helped.
--  top_tools            : rank your tools by your own usage history, so the
--    deck surfaces what actually works for you, not a generic list.
-- ============================================================

-- Semantic recall over entry_insights. Called from the `surface` Edge Function
-- (which holds the embedding provider key). SECURITY INVOKER → still bound by
-- RLS, but the function runs under the service role there.
create or replace function match_entry_insights(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  entry_id uuid,
  summary text,
  what_helped jsonb,
  tags jsonb,
  similarity float
)
language sql
stable
as $$
  select
    ei.entry_id,
    ei.summary,
    ei.what_helped,
    ei.tags,
    1 - (ei.embedding <=> query_embedding) as similarity
  from entry_insights ei
  where ei.embedding is not null
  order by ei.embedding <=> query_embedding
  limit match_count;
$$;

-- History-based tool ranking. Safe for the authenticated client to call
-- directly (no AI / no secret needed) — powers "here's what's worked" today,
-- before any embeddings exist.
create or replace function top_tools(match_count int default 6)
returns table (
  id uuid,
  name text,
  category text,
  is_energizing boolean,
  uses bigint,
  last_used timestamptz
)
language sql
stable
as $$
  select
    t.id,
    t.name,
    t.category,
    t.is_energizing,
    count(tu.id) as uses,
    max(tu.used_at) as last_used
  from tools t
  left join tool_uses tu on tu.tool_id = t.id
  where t.archived = false
  group by t.id
  order by uses desc, last_used desc nulls last, t.name
  limit match_count;
$$;

-- Optional ANN index for when entry_insights grows. Harmless to create early;
-- pgvector falls back to exact scan until there's enough data to matter.
create index if not exists entry_insights_embedding_idx
  on entry_insights using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
