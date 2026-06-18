-- ============================================================
-- 0009_dump_summary — store an AI digest of each dump.
-- Journals/check-ins can ramble; the summary captures the relevant, trackable,
-- emotionally-salient bits. Analysis reads the summary (when present) instead
-- of the full transcript, and the entries screen shows summary-first.
-- ============================================================

alter table dumps
  add column summary text;
