// Resolve the calling user from the request's JWT. The client invokes these
// functions via supabase.functions.invoke, which forwards the signed-in user's
// Authorization: Bearer <jwt> header. The service-role admin client bypasses
// RLS, so multi-user functions MUST derive the owner here and scope their
// queries by it — otherwise one user's report would read another's data.
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Returns the authenticated user's id, or null if the request is unauthenticated. */
export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
