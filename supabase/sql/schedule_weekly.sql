-- ============================================================
-- pg_cron schedule for the weekly auto-summary (handoff §3, §10 Phase 4).
-- Run by hand against your project once the function is deployed. Reuses the
-- 'edge_fn_bearer' Vault secret created in schedule_nightly.sql.
-- ============================================================

-- Sundays 03:00 UTC (after the nightly run). Adjust to your timezone.
select cron.schedule(
  'weekly-summary',
  '0 3 * * 0',
  $$
  select net.http_post(
    url     := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/weekly-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_fn_bearer')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- select cron.unschedule('weekly-summary');
