-- ============================================================
-- pg_cron schedule for the nightly batch (handoff §3, §10 Phase 2)
--
-- Runs after midnight, calls the nightly-analysis Edge Function, which submits
-- the day's entries to the Anthropic Batch API. Run this by hand against your
-- project once the function is deployed (it needs your project ref + a secret).
--
-- Requires the pg_cron and pg_net extensions (enable in Studio → Database →
-- Extensions, or below).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the function's service-role bearer once in Vault, don't inline it here.
-- select vault.create_secret('eyJ...service-role-jwt...', 'edge_fn_bearer');

-- 02:30 every day. Adjust to your timezone (cron runs in UTC).
select cron.schedule(
  'nightly-analysis',
  '30 2 * * *',
  $$
  select net.http_post(
    url     := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/nightly-analysis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_fn_bearer')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To inspect or remove later:
--   select * from cron.job;
--   select cron.unschedule('nightly-analysis');
