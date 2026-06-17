// Service-role client for Edge Functions. The service key bypasses RLS and
// must NEVER reach the browser (handoff §6: keys server-side only). It is
// injected by the Supabase runtime as SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2';

export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}
