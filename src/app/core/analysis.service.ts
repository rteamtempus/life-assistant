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
      // supabase-js wraps non-2xx responses; the real message is in the body.
      const body = await this.readError(error);
      throw new Error(body ?? error.message);
    }
    if (!data?.analysis) throw new Error('No analysis returned.');
    return data.analysis;
  }

  /** Pull the function's JSON error body ({error: "..."}) out of a FunctionsHttpError. */
  private async readError(error: unknown): Promise<string | null> {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        return body?.error ?? null;
      } catch {
        return null;
      }
    }
    return null;
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
