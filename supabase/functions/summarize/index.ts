// summarize — distill a dump (journal/check-in/etc.) into a concise digest of
// the relevant, trackable, emotionally-salient details, and store it on the
// dump. Used both right after capture and to backfill older entries. Analysis
// later reads this instead of the full rambling transcript.
//
// Model: gemini-3.1-flash-lite (cheap). Secret: GEMINI_API_KEY.

import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { callGemini, MODELS } from '../_shared/gemini.ts';

const SYSTEM = [
  'You distill a personal journal/check-in into a concise digest for later',
  'trend analysis. Keep everything that matters — what they did, ate, drank,',
  'took (with times if stated), sleep, energy/tiredness, mood, stressors, what',
  'helped or hurt, notable events and people — and drop rambling and filler.',
  'Warm and factual, not clinical. A few tight sentences or short bullet lines.',
  'Plain text only (no JSON, no preamble).',
].join(' ');

interface Body {
  dump_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { dump_id }: Body = await req.json();
    if (!dump_id) return json({ error: 'dump_id required' }, 400);

    const supabase = adminClient();
    const { data: dump, error } = await supabase
      .from('dumps')
      .select('id, kind, transcript')
      .eq('id', dump_id)
      .single();
    if (error || !dump?.transcript) {
      return json({ error: 'dump not found or has no transcript' }, 404);
    }

    const summary = await callGemini({
      model: MODELS.flashLite,
      system: SYSTEM,
      contents: [
        { role: 'user', parts: [{ text: `(${dump.kind})\n\n${dump.transcript}` }] },
      ],
      maxTokens: 1024,
      temperature: 0.3,
      thinkingBudget: 0,
    });

    const { error: upErr } = await supabase
      .from('dumps')
      .update({ summary })
      .eq('id', dump_id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ summary });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
