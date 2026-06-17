import { Injectable, signal } from '@angular/core';
import {
  AuthChangeEvent,
  createClient,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Thin singleton wrapper around the Supabase client.
 *
 * The anon key is client-safe (handoff §6) — every privileged operation is
 * gated by RLS, and all secret-bearing work (Anthropic / Whisper / TTS) runs
 * in Edge Functions. Components talk to the typed feature services, not this
 * directly, but they reach the raw client through `.client` when needed.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  /** Reactive auth session — null until signed in. Drives the AuthGuard. */
  readonly session = signal<Session | null>(null);

  constructor() {
    this.client = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );

    this.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
    });

    this.client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        this.session.set(session);
      },
    );
  }

  get isConfigured(): boolean {
    return (
      !!environment.supabaseUrl &&
      !environment.supabaseUrl.includes('__SET_IN_ENV__') &&
      !!environment.supabaseAnonKey &&
      !environment.supabaseAnonKey.includes('__SET_IN_ENV__')
    );
  }

  signInWithPassword(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  signOut() {
    return this.client.auth.signOut();
  }

  /** Invoke a deployed Edge Function (transcription, structuring, coach…). */
  invoke<T>(name: string, body: Record<string, unknown>) {
    return this.client.functions.invoke<T>(name, { body });
  }
}
