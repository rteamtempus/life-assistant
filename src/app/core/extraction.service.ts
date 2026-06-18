import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { DumpKind, EventDraft, UrgeDraft } from './models';
import { localIsoNow } from './datetime';

export interface ExtractionResult {
  events: EventDraft[];
  urges: UrgeDraft[];
}

@Injectable({ providedIn: 'root' })
export class ExtractionService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Run the extract Edge Function over a transcript and return candidate events
   * AND urges as drafts (pre-selected to include). The user confirms/edits via
   * chips before anything is saved. `referenceIso` lets a backfill resolve times
   * against the original dump rather than now.
   */
  async extract(
    transcript: string,
    kind: DumpKind,
    referenceIso?: string,
  ): Promise<ExtractionResult> {
    const { data, error } = await this.supabase.invoke<{
      events: Omit<EventDraft, 'include' | 'source'>[];
      urges: Omit<UrgeDraft, 'include'>[];
    }>('extract', { transcript, kind, now: referenceIso ?? localIsoNow() });
    if (error) throw error;

    const events: EventDraft[] = (data?.events ?? []).map((e) => ({
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

    const urges: UrgeDraft[] = (data?.urges ?? []).map((u) => ({
      kind: u.kind ?? 'other',
      occurred_at: u.occurred_at ?? null,
      acted_on: u.acted_on ?? null,
      trigger: u.trigger ?? null,
      what_helped: u.what_helped ?? null,
      intensity: u.intensity ?? null,
      include: true,
    }));

    return { events, urges };
  }
}
