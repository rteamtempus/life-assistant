import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { EventDraft, LogEvent } from './models';

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly supabase = inject(SupabaseService);

  /** Persist the confirmed drafts as events linked to their source dump. */
  async saveDrafts(
    drafts: EventDraft[],
    sourceDumpId: string | null,
    fallbackOccurredAt: string,
  ): Promise<void> {
    const rows = drafts
      .filter((d) => d.include)
      .map((d) => ({
        category: d.category,
        label: d.label,
        amount: d.amount,
        unit: d.unit,
        valence: d.valence,
        note: d.note,
        occurred_at: d.occurred_at ?? fallbackOccurredAt,
        source: d.source,
        source_dump_id: sourceDumpId,
        confidence: d.source === 'ai' ? d.confidence : null,
        confirmed: true,
      }));
    if (rows.length === 0) return;
    const { error } = await this.supabase.client.from('events').insert(rows);
    if (error) throw error;
  }

  /** Events on a given local day (for the review screens, stage 4). */
  async listForDay(dayIso: string): Promise<LogEvent[]> {
    const start = new Date(dayIso);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const { data, error } = await this.supabase.client
      .from('events')
      .select('*')
      .gte('occurred_at', start.toISOString())
      .lt('occurred_at', end.toISOString())
      .order('occurred_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as LogEvent[];
  }

  update(id: string, patch: Partial<LogEvent>) {
    return this.supabase.client.from('events').update(patch).eq('id', id);
  }

  remove(id: string) {
    return this.supabase.client.from('events').delete().eq('id', id);
  }
}
