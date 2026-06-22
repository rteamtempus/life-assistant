// transcribe — dump audio -> text (Gemini). Downloads the dump's audio from
// Storage, transcribes it, writes the transcript + status back on the dump, and
// returns the transcript so the client can immediately run extraction.
//
// Secret: GEMINI_API_KEY.

import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { getUserId } from '../_shared/auth.ts';
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

    // Scope to the caller: the audio path is `<uid>/...`, so a user may only
    // transcribe files in their own folder.
    const userId = await getUserId(req);
    if (!userId) return json({ error: 'unauthorized' }, 401);
    if (audio_path.split('/')[0] !== userId) {
      return json({ error: 'forbidden' }, 403);
    }

    const supabase = adminClient();

    const { data: file, error: dlErr } = await supabase.storage
      .from('entry-audio')
      .download(audio_path);
    if (dlErr || !file) {
      await supabase.from('dumps').update({ status: 'error', error: `download failed: ${dlErr?.message}` }).eq('id', dump_id).eq('user_id', userId);
      return json({ error: `download failed: ${dlErr?.message}` }, 500);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || 'audio/webm';
    const transcript = await transcribeAudio(encodeBase64(bytes), mimeType);

    const { error: upErr } = await supabase
      .from('dumps')
      .update({ transcript, status: 'transcribed' })
      .eq('id', dump_id)
      .eq('user_id', userId);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ transcript });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
