import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

/**
 * Gate the app behind a Supabase session. RLS is scoped to authenticated
 * users (handoff §6), so an unauthenticated client can read/write nothing —
 * this guard just routes them to sign-in rather than letting calls fail.
 *
 * The PIN / biometric app-lock (§6) is a separate, additional layer planned
 * on top of this; this only establishes "who is talking to the database".
 */
export const authGuard: CanActivateFn = () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (supabase.session()) return true;
  return router.parseUrl('/sign-in');
};
