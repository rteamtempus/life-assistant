import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { DumpKind, EventDraft } from './models';

@Injectable({ providedIn: 'root' })
export class ExtractionService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Run the extract Edge Function over a transcript and return candidate events
   * as drafts (pre-selected to include). The user confirms/edits via chips
   * before anything is saved.
   */
  async extract(transcript: string, kind: DumpKind): Promise<EventDraft[]> {
    const { data, error } = await this.supabase.invoke<{
      events: Omit<EventDraft, 'include' | 'source'>[];
    }>('extract', { transcript, kind, now: new Date().toISOString() });
    if (error) throw error;

    return (data?.events ?? []).map((e) => ({
      category: e.category,
      label: e.label ?? null,
      amount: e.amount ?? null,
      unit: e.unit ?? null,
      valence: e.valence ?? null,
      occurred_at: e.occurred_at ?? null,
      note: e.note ?? null,
      confidence: e.confidence ?? 0,
      source: 'ai',
      include: true,
    }));
  }
}
