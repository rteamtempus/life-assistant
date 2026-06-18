import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Dump, DumpKind, DumpStatus } from './models';

const AUDIO_BUCKET = 'entry-audio';

@Injectable({ providedIn: 'root' })
export class DumpsService {
  private readonly supabase = inject(SupabaseService);

  private extForMime(mime: string): string {
    if (mime.includes('mp4')) return 'm4a';
    if (mime.includes('ogg')) return 'ogg';
    return 'webm';
  }

  /** Upload dump audio to Storage, return the path. */
  async uploadAudio(blob: Blob, mime: string): Promise<string> {
    const { data: u } = await this.supabase.client.auth.getUser();
    const uid = u.user?.id ?? 'anon';
    const ext = this.extForMime(mime);
    const path = `${uid}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const up = await this.supabase.client.storage
      .from(AUDIO_BUCKET)
      .upload(path, blob, { contentType: mime, upsert: false });
    if (up.error) throw up.error;
    return path;
  }

  async create(
    kind: DumpKind,
    fields: { audio_path?: string; transcript?: string; status: DumpStatus },
  ): Promise<Dump> {
    const { data, error } = await this.supabase.client
      .from('dumps')
      .insert({
        kind,
        audio_path: fields.audio_path ?? null,
        transcript: fields.transcript ?? null,
        status: fields.status,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Dump;
  }

  /** Transcribe a dump's audio via the Edge Function; returns the transcript. */
  async transcribe(dumpId: string, audioPath: string): Promise<string> {
    const { data, error } = await this.supabase.invoke<{ transcript: string }>(
      'transcribe',
      { dump_id: dumpId, audio_path: audioPath },
    );
    if (error) throw error;
    return data?.transcript ?? '';
  }

  setStatus(id: string, status: DumpStatus, error?: string) {
    return this.supabase.client
      .from('dumps')
      .update({ status, error: error ?? null })
      .eq('id', id);
  }

  /** Generate (and store) the relevant-data digest for a dump via Edge Function. */
  async summarize(dumpId: string): Promise<string> {
    const { data, error } = await this.supabase.invoke<{ summary: string }>(
      'summarize',
      { dump_id: dumpId },
    );
    if (error) throw error;
    return data?.summary ?? '';
  }

  async list(): Promise<Dump[]> {
    const { data, error } = await this.supabase.client
      .from('dumps')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Dump[];
  }

  async get(id: string): Promise<Dump | null> {
    const { data, error } = await this.supabase.client
      .from('dumps')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return (data as Dump) ?? null;
  }
}
