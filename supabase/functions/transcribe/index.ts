// transcribe — dump audio -> text (Gemini). Downloads the dump's audio from
// Storage, transcribes it, writes the transcript + status back on the dump, and
// returns the transcript so the client can immediately run extraction.
//
// Secret: GEMINI_API_KEY.

import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { transcribeAudio } from '../_shared/gemini.ts';

interface Body {
  dump_id: string;
  audio_path: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { dump_id, audio_path }: Body = await req.json();
    if (!dump_id || !audio_path) {
      return json({ error: 'dump_id and audio_path are required' }, 400);
    }

    const supabase = adminClient();

    const { data: file, error: dlErr } = await supabase.storage
      .from('entry-audio')
      .download(audio_path);
    if (dlErr || !file) {
      await supabase.from('dumps').update({ status: 'error', error: `download failed: ${dlErr?.message}` }).eq('id', dump_id);
      return json({ error: `download failed: ${dlErr?.message}` }, 500);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || 'audio/webm';
    const transcript = await transcribeAudio(encodeBase64(bytes), mimeType);

    const { error: upErr } = await supabase
      .from('dumps')
      .update({ transcript, status: 'transcribed' })
      .eq('id', dump_id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ transcript });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
