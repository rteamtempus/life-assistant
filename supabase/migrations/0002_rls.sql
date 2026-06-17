-- ============================================================
-- 0002_rls — Row Level Security (handoff §6: RLS on every table)
--
-- This is a single-user app, so the policy is simple: the one authenticated
-- account may do everything; the anon/public role may do nothing. There are
-- no user_id columns because there is exactly one user — but RLS still stands
-- so a leaked anon key (which ships in the client) grants zero data access.
--
-- The MCP read-mostly role (§6) is provisioned separately in 0004.
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'entries', 'entry_insights', 'check_ins', 'tools', 'tool_uses',
    'media', 'urge_events', 'coach_sessions', 'self_memos', 'daily_log'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
    -- Full access for the authenticated owner.
    execute format($f$
      create policy %1$I on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;
