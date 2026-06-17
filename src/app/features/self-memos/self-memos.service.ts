import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { SelfMemo } from '../../core/models';

const MEMO_BUCKET = 'self-memos';

export interface PlayableMemo extends SelfMemo {
  /** Short-lived signed URL for playback. */
  signedUrl: string | null;
}

/**
 * Future-self memos (handoff §8.5): recorded when calm, played back mid-urge.
 * "You, earlier, talking you down" — often more landable than any coach line.
 */
@Injectable({ providedIn: 'root' })
export class SelfMemosService {
  private readonly supabase = inject(SupabaseService);

  async record(blob: Blob, mimeType: string, forContext: string): Promise<void> {
    const { data: userData } = await this.supabase.client.auth.getUser();
    const uid = userData.user?.id ?? 'anon';
    const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;

    const up = await this.supabase.client.storage
      .from(MEMO_BUCKET)
      .upload(path, blob, { contentType: mimeType });
    if (up.error) throw up.error;

    const { error } = await this.supabase.client
      .from('self_memos')
      .insert({ audio_path: path, for_context: forContext });
    if (error) throw error;
  }

  /** List memos, optionally filtered by context, with playback URLs. */
  async list(forContext?: string): Promise<PlayableMemo[]> {
    let q = this.supabase.client
      .from('self_memos')
      .select('*')
      .order('created_at', { ascending: false });
    if (forContext) q = q.eq('for_context', forContext);
    const { data, error } = await q;
    if (error) throw error;

    const memos = (data ?? []) as SelfMemo[];
    return Promise.all(
      memos.map(async (m) => ({
        ...m,
        signedUrl: await this.signedUrl(m.audio_path),
      })),
    );
  }

  private async signedUrl(path: string): Promise<string | null> {
    const { data } = await this.supabase.client.storage
      .from(MEMO_BUCKET)
      .createSignedUrl(path, 60 * 10);
    return data?.signedUrl ?? null;
  }
}
