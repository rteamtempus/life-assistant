// stt — ephemeral speech-to-text for live coach turns (handoff §8.3). Unlike
// `transcribe` (which persists a journal entry), this just turns one spoken
// turn into text and returns it — nothing is stored. Gemini, server-side (§5).
//
// Accepts multipart/form-data with an `audio` file. Secret: GEMINI_API_KEY.

import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { corsHeaders, json } from '../_shared/cors.ts';
import { transcribeAudio } from '../_shared/gemini.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return json({ error: 'audio file required (multipart field "audio")' }, 400);
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    const mimeType = audio.type || 'audio/webm';
    const text = await transcribeAudio(encodeBase64(bytes), mimeType);

    return json({ text });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
