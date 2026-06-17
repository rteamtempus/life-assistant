-- ============================================================
-- MCP read-mostly role (handoff §6)
--
-- Bucket B (the Sunday deep-reflection MCP connection) must NOT get a broad
-- write path to this tender data. Stand up a dedicated, mostly-read role and
-- point the MCP Postgres connection at THIS role — not the service key.
--
-- This is NOT in supabase/migrations/ on purpose: it sets a login password,
-- which should never be committed. Run it by hand against your project
-- (Supabase Studio → SQL editor, or psql), substituting a real secret:
--
--   psql "$SUPABASE_DB_URL" -v mcp_pw="'a-long-random-secret'" -f mcp_readonly_role.sql
-- ============================================================

-- 1. The role. Replace the password before running (or pass -v mcp_pw=...).
create role mcp_reader login password :mcp_pw;

-- 2. Read access to the data tables.
grant usage on schema public to mcp_reader;
grant select on all tables in schema public to mcp_reader;
alter default privileges in schema public
  grant select on tables to mcp_reader;

-- 3. A single, deliberate write path: appending to the reflections table the
--    interactive Sunday session co-authors (§3 Bucket B). Keep this list TIGHT.
--    Everything else stays read-only.
grant insert on public.reflections to mcp_reader;
create policy "mcp inserts reflections" on public.reflections
  for insert to mcp_reader with check (true);

-- 4. Make sure the role is bound by RLS like everyone else. Add a read policy
--    scoped to mcp_reader on each table the MCP is allowed to see, e.g.:
-- create policy "mcp reads entries" on public.entries
--   for select to mcp_reader using (true);
