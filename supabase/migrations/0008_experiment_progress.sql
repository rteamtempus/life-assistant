-- ============================================================
-- 0008_experiment_progress — close the insight->experiment->progress loop.
-- Each analysis can now report how the user's active experiments are going
-- (adherence + observed effect), so progress shows up over time.
-- ============================================================

alter table analyses
  add column experiment_progress jsonb not null default '[]';
