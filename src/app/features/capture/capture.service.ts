import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Entry, EntryKind } from '../../core/models';

const AUDIO_BUCKET = 'entry-audio';

@Injectable({ providedIn: 'root' })
export class CaptureService {
  private readonly supabase = inject(SupabaseService);

  private extForMime(mimeType: string): string {
    if (mimeType.includes('mp4')) return 'm4a';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
  }

  /**
   * The capture path (handoff §7, §10 Phase 1):
   *   1. upload audio to Storage
   *   2. insert an `entries` row immediately (capture is never blocked on AI)
   *   3. fire-and-forget the transcription Edge Function
   *
   * The nightly batch (Phase 2) later flips `processed` and writes insights.
   */
  async saveVoiceEntry(
    blob: Blob,
    mimeType: string,
    kind: EntryKind,
  ): Promise<Entry> {
    const { data: userData } = await this.supabase.client.auth.getUser();
    const uid = userData.user?.id ?? 'anon';
    const ext = this.extForMime(mimeType);
    // Date math is fine at runtime in the browser; only the workflow sandbox forbids it.
    const path = `${uid}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

    const upload = await this.supabase.client.storage
      .from(AUDIO_BUCKET)
      .upload(path, blob, { contentType: mimeType, upsert: false });
    if (upload.error) throw upload.error;

    const { data, error } = await this.supabase.client
      .from('entries')
      .insert({ kind, audio_path: path, processed: false })
      .select()
      .single();
    if (error) throw error;

    // Best-effort transcription; failure here must not lose the capture.
    this.supabase
      .invoke('transcribe', { entry_id: data.id, audio_path: path })
      .catch((e) => console.warn('transcription kickoff failed', e));

    return data as Entry;
  }

  /** Save a typed entry (fallback when speaking isn't possible). */
  async saveTextEntry(transcript: string, kind: EntryKind): Promise<Entry> {
    const { data, error } = await this.supabase.client
      .from('entries')
      .insert({ kind, transcript, processed: false })
      .select()
      .single();
    if (error) throw error;
    return data as Entry;
  }
}
