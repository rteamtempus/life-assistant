-- ============================================================
-- 0004_seed_starter_tools — a small, gentle starter deck so the Tools screen
-- isn't empty on day one (handoff §1.2: no blank surfaces). Edit freely in-app;
-- these are just a beginning.
--
-- Guarded so it only ever runs into an empty table — re-applying (or a future
-- migration replay) won't create duplicates, and it never touches tools the
-- owner has added themselves.
-- ============================================================

insert into tools (name, category, description, is_energizing)
select * from (values
  ('Glass of water', 'regulation', 'Start here. Low effort, real signal.', false),
  ('10-minute walk', 'regulation', 'Outside if you can.', false),
  ('Box breathing', 'regulation', 'In 4, hold 4, out 4, hold 4.', false),
  ('NSDR / yoga nidra', 'regulation', 'For the crash hours.', false),
  ('Morning light', 'morning', 'A few minutes facing the window.', false),
  ('Meds + note the time', 'morning', 'Especially the Vyvanse kick-in window.', false),
  ('Dim the lights', 'nightly', 'Signal to the body it is winding down.', false),
  ('Wind-down playlist', 'nightly', 'Same few songs every night.', false),
  ('Cold water on face', 'dopamine', 'A clean reset.', true),
  ('Favorite upbeat song', 'dopamine', 'A lift — notice if you are already climbing.', true)
) as seed(name, category, description, is_energizing)
where not exists (select 1 from tools);
