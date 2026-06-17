import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Analysis } from './models';

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly supabase = inject(SupabaseService);

  /** Trigger an analysis over [start, end] (YYYY-MM-DD). Returns the saved row. */
  async run(
    periodStart: string,
    periodEnd: string,
    trigger: 'morning' | 'weekly' | 'manual' = 'manual',
  ): Promise<Analysis> {
    const { data, error } = await this.supabase.invoke<{ analysis: Analysis }>(
      'analyze',
      { period_start: periodStart, period_end: periodEnd, trigger },
    );
    if (error) {
      // Surface the function's own message (e.g. "no data in that range").
      const ctx = (error as { context?: { error?: string } }).context;
      throw new Error(ctx?.error ?? error.message);
    }
    if (!data?.analysis) throw new Error('No analysis returned.');
    return data.analysis;
  }

  async list(): Promise<Analysis[]> {
    const { data, error } = await this.supabase.client
      .from('analyses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Analysis[];
  }
}
