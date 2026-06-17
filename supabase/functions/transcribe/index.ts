// transcribe — voice dump → text (handoff §5). Trigger: fire-and-forget by the
// client right after capture; also safe to re-run from the nightly batch for any
// entry still missing a transcript.
//
// Downloads the audio from Storage and transcribes it with Gemini (audio
// understanding), then writes the transcript back onto the entry. Leaves
// processed = false so the nightly batch still structures + embeds it.
//
// Secret: GEMINI_API_KEY.
//
// AUDIO FORMAT NOTE: MediaRecorder yields audio/webm (Chrome) or audio/mp4
// (Safari). Gemini reliably handles common audio mime types; if a particular
// container is rejected, the simplest fix is to record in a supported format
// (see audio-recorder.service.ts) rather than transcode server-side.

import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { transcribeAudio } from '../_shared/gemini.ts';

interface Body {
  entry_id: string;
  audio_path: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { entry_id, audio_path }: Body = await req.json();
    if (!entry_id || !audio_path) {
      return json({ error: 'entry_id and audio_path are required' }, 400);
    }

    const supabase = adminClient();

    const { data: file, error: dlErr } = await supabase.storage
      .from('entry-audio')
      .download(audio_path);
    if (dlErr || !file) {
      return json({ error: `download failed: ${dlErr?.message}` }, 500);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || 'audio/webm';
    const transcript = await transcribeAudio(encodeBase64(bytes), mimeType);

    const { error: upErr } = await supabase
      .from('entries')
      .update({ transcript })
      .eq('id', entry_id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true, entry_id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
