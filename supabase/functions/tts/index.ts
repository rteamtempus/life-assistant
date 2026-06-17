// tts — speak the coach's line (handoff §5: Google Cloud TTS Chirp 3 HD, the
// likeable voice reused from the household app). Returns base64 MP3 the client
// plays through an <audio> element unlocked by the urge-tap gesture (§7).
//
// Secret: GOOGLE_TTS_API_KEY (a Cloud API key with Text-to-Speech enabled).
// Voice is overridable so the tone is configurable (§6).

import { corsHeaders, json } from '../_shared/cors.ts';

const DEFAULT_VOICE = 'en-US-Chirp3-HD-Achernar';

interface Body {
  text: string;
  voice?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { text, voice }: Body = await req.json();
    if (!text?.trim()) return json({ error: 'text required' }, 400);

    const key = Deno.env.get('GOOGLE_TTS_API_KEY');
    if (!key) return json({ error: 'GOOGLE_TTS_API_KEY not set' }, 503);

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'en-US', name: voice ?? DEFAULT_VOICE },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.96 },
        }),
      },
    );
    if (!res.ok) {
      return json({ error: `google tts ${res.status}: ${await res.text()}` }, 502);
    }

    const data = await res.json();
    // audioContent is already base64; the client builds a data: URL from it.
    return json({ audio: data.audioContent as string, mime: 'audio/mpeg' });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
