import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Dump, Urge } from './models';

export interface UrgeWithDumps extends Urge {
  initial?: Pick<Dump, 'transcript' | 'created_at'> | null;
  followup?: Pick<Dump, 'transcript' | 'created_at'> | null;
}

@Injectable({ providedIn: 'root' })
export class UrgesService {
  private readonly supabase = inject(SupabaseService);

  /** Create the urge record for an in-the-moment dump (acted_on unknown). */
  async createForDump(initialDumpId: string): Promise<Urge> {
    const { data, error } = await this.supabase.client
      .from('urges')
      .insert({ initial_dump_id: initialDumpId, resolved: false })
      .select()
      .single();
    if (error) throw error;
    return data as Urge;
  }

  /** Past urges, newest first, with their dump transcripts for review. */
  async listRecent(limit = 30): Promise<UrgeWithDumps[]> {
    const { data, error } = await this.supabase.client
      .from('urges')
      .select(
        'id, created_at, occurred_at, acted_on, what_helped, resolved, initial_dump_id, followup_dump_id, intensity, ' +
          'initial:initial_dump_id(transcript, created_at), followup:followup_dump_id(transcript, created_at)',
      )
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as UrgeWithDumps[];
  }

  /** Attach a follow-up dump + outcome (did I use? what helped?). */
  async resolve(
    urgeId: string,
    followupDumpId: string,
    actedOn: boolean,
    whatHelped: string | null,
  ) {
    const { error } = await this.supabase.client
      .from('urges')
      .update({
        followup_dump_id: followupDumpId,
        acted_on: actedOn,
        what_helped: whatHelped,
        resolved: true,
      })
      .eq('id', urgeId);
    if (error) throw error;
  }
}
