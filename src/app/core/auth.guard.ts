import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

/**
 * Gate the app behind a Supabase session. RLS is scoped to authenticated
 * users (handoff §6), so an unauthenticated client can read/write nothing —
 * this guard just routes them to sign-in rather than letting calls fail.
 *
 * The session is restored from storage asynchronously at startup, so on a cold
 * load the reactive `session()` signal may not be populated yet. We therefore
 * await getSession() (which reads storage + refreshes if needed) before
 * deciding — otherwise a fresh load / reload bounces a signed-in user to
 * sign-in even though their session is valid.
 *
 * The PIN / biometric app-lock (§6) is a separate, additional layer planned
 * on top of this; this only establishes "who is talking to the database".
 */
export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Fast path: signal already restored (in-app navigation).
  if (supabase.session()) return true;

  // Cold path: wait for the persisted session to load.
  const { data } = await supabase.client.auth.getSession();
  if (data.session) {
    supabase.session.set(data.session);
    return true;
  }
  return router.parseUrl('/sign-in');
};
