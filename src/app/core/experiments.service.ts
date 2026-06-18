import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Experiment } from './models';

@Injectable({ providedIn: 'root' })
export class ExperimentsService {
  private readonly supabase = inject(SupabaseService);

  /** Start an experiment, usually from an analysis recommendation. */
  async create(
    text: string,
    rationale: string | null,
    sourceAnalysisId: string | null,
  ): Promise<Experiment> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.supabase.client
      .from('experiments')
      .insert({
        text,
        rationale,
        source_analysis_id: sourceAnalysisId,
        status: 'active',
        started_on: today,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Experiment;
  }

  async list(): Promise<Experiment[]> {
    const { data, error } = await this.supabase.client
      .from('experiments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Experiment[];
  }

  async setStatus(
    id: string,
    status: Experiment['status'],
  ): Promise<void> {
    const patch: Partial<Experiment> = { status };
    if (status === 'done' || status === 'dropped') {
      patch.ended_on = new Date().toISOString().slice(0, 10);
    }
    const { error } = await this.supabase.client
      .from('experiments')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
  }
}
