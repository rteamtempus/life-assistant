import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { CoachMessage, UrgeEvent, UrgeKind } from '../../core/models';

/** Coach turn shape exchanged with the urge-coach Edge Function. */
export interface CoachTurn {
  role: 'coach' | 'user';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class UrgeService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Step 1 of the loop (handoff §8.1): create the urge_events row immediately
   * with acted_on = null. Logging the urge AT ALL is the win — separate from
   * whether it was acted on. Returns the new row.
   */
  async startUrge(kind: UrgeKind): Promise<UrgeEvent> {
    const { data, error } = await this.supabase.client
      .from('urge_events')
      .insert({ kind, acted_on: null })
      .select()
      .single();
    if (error) throw error;
    return data as UrgeEvent;
  }

  /** Close-out (§8.6): rode_out / acted_on / intensity / underlying need etc. */
  async closeUrge(
    id: string,
    fields: Partial<
      Pick<
        UrgeEvent,
        | 'acted_on'
        | 'rode_out'
        | 'intensity'
        | 'antecedent_state'
        | 'antecedent_note'
        | 'underlying_need'
        | 'what_helped'
        | 'time_of_day'
      >
    >,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('urge_events')
      .update(fields)
      .eq('id', id);
    if (error) throw error;
  }

  /** Get the next coach line. Stateless API — pass the whole session each turn. */
  async coachReply(messages: CoachTurn[]): Promise<string> {
    const { data, error } = await this.supabase.invoke<{ reply: string }>(
      'urge-coach',
      { messages },
    );
    if (error) throw error;
    return data?.reply ?? '';
  }

  /** Persist the full turn-by-turn transcript (§8.3, coach_sessions). */
  async saveSession(urgeEventId: string, messages: CoachMessage[]): Promise<void> {
    const { error } = await this.supabase.client
      .from('coach_sessions')
      .insert({ urge_event_id: urgeEventId, messages });
    if (error) throw error;
  }

  /** Synthesize a coach line to speech (best-effort; null if TTS not live). */
  async speak(text: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.invoke<{ audio: string; mime: string }>(
        'tts',
        { text },
      );
      if (error || !data?.audio) return null;
      return `data:${data.mime};base64,${data.audio}`;
    } catch {
      return null;
    }
  }

  /** Transcribe one spoken turn (best-effort; null if STT not live). */
  async transcribeTurn(blob: Blob, mimeType: string): Promise<string | null> {
    try {
      const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
      const fd = new FormData();
      fd.append('audio', blob, `turn.${ext}`);
      const { data, error } = await this.supabase.invoke<{ text: string }>(
        'stt',
        fd as unknown as Record<string, unknown>,
      );
      if (error) return null;
      return data?.text ?? null;
    } catch {
      return null;
    }
  }
}
