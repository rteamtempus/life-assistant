// invite-signup — gated account creation. The only way to create an account
// (public sign-up is disabled at the Auth layer), so AI-cost abuse from random
// strangers is closed off: you must present the shared INVITE_CODE secret.
//
// Flow: the sign-up screen POSTs { email, password, code }. We check the code
// against the server-side secret, then create the user via the service-role
// admin API with email_confirm:true (immediately usable, no email infra). The
// client then signs in normally.
//
// This function is deployed with verify_jwt = false because the caller is, by
// definition, not yet authenticated. The invite code is the gate instead.
//
// Secret: INVITE_CODE.

import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';

interface Body {
  email?: string;
  password?: string;
  code?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { email, password, code }: Body = await req.json();

    // Expected/user-correctable failures return HTTP 200 with { ok:false, error }
    // so supabase.functions.invoke surfaces the message to the client (it buries
    // the body of non-2xx responses). Non-2xx is reserved for real server faults.
    const expected = Deno.env.get('INVITE_CODE');
    if (!expected) return json({ error: 'sign-up is not configured' }, 500);
    if (!code || code.trim() !== expected) {
      return json({ ok: false, error: 'That invite code is not valid.' });
    }

    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return json({ ok: false, error: 'A valid email is required.' });
    }
    if (!password || password.length < 6) {
      return json({ ok: false, error: 'Password must be at least 6 characters.' });
    }

    const supabase = adminClient();
    const { error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true, // no email round-trip; account is usable immediately
    });
    if (error) {
      const msg = /already.*registered|exists/i.test(error.message)
        ? 'An account with that email already exists. Try signing in.'
        : error.message;
      return json({ ok: false, error: msg });
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
