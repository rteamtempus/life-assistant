-- ============================================================
-- 0010_urge_detail — richer urge capture.
-- Urges can now be detected from any dump (journal/check-in/brain-dump), so we
-- store what triggered it and what kind it was, alongside acted_on/what_helped.
-- ============================================================

alter table urges add column trigger text;  -- antecedent: what set it off
alter table urges add column kind text;      -- porn | nicotine | scroll | other
