import { effect, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../core/supabase.service';
import { TarotProfile } from './models';

/**
 * Owns the user's `tarot_profiles` row.
 *
 * The tarot tables share this Supabase database; the profile row is created
 * lazily, client-side, the first time we see a session — an idempotent upsert.
 * (Activates when you enter the Tarot app; harmless no-op if you never do.)
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase = inject(SupabaseService);

  readonly profile = signal<TarotProfile | null>(null);

  private ensuredFor: string | null = null;

  constructor() {
    effect(() => {
      const session = this.supabase.session();
      const userId = session?.user?.id ?? null;
      if (!userId) {
        this.ensuredFor = null;
        this.profile.set(null);
        return;
      }
      if (this.ensuredFor === userId) return;
      this.ensuredFor = userId;
      void this.ensure(userId);
    });
  }

  private async ensure(userId: string): Promise<void> {
    const meta = this.supabase.session()?.user?.user_metadata as
      | { display_name?: string }
      | undefined;

    await this.supabase.client
      .from('tarot_profiles')
      .upsert(
        { id: userId, display_name: meta?.display_name ?? null },
        { onConflict: 'id', ignoreDuplicates: true },
      );

    const { data } = await this.supabase.client
      .from('tarot_profiles')
      .select('id, display_name, use_reversals, default_deck_id, default_set_id, default_spread_id')
      .eq('id', userId)
      .single();

    if (data) this.profile.set(data as TarotProfile);
  }
}
