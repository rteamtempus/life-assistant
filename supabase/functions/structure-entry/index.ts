// structure-entry — turn one transcript into structured insight on demand.
// Trigger: tap (handoff §3 Bucket A, §5). Model: Gemini Flash, real-time.
//
// Writes an entry_insights row (mood/energy/tags/people/stressors/what_helped/
// summary) PLUS the semantic-recall embedding, then flips entries.processed.
// Shares its prompt with the nightly batch via _shared/structuring.ts.

import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { MODELS } from '../_shared/gemini.ts';
import { structureTranscript } from '../_shared/structuring.ts';
import { embed } from '../_shared/embeddings.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { entry_id }: { entry_id: string } = await req.json();
    if (!entry_id) return json({ error: 'entry_id required' }, 400);

    const supabase = adminClient();
    const { data: entry, error } = await supabase
      .from('entries')
      .select('id, transcript')
      .eq('id', entry_id)
      .single();
    if (error || !entry?.transcript) {
      return json({ error: 'entry not found or not yet transcribed' }, 404);
    }

    const insight = await structureTranscript(entry.transcript, MODELS.flash);

    // Embedding for "I feel ___ → what helped" semantic recall (§9).
    let embedding: number[] | null = null;
    try {
      embedding = await embed(insight.summary ?? entry.transcript, 'RETRIEVAL_DOCUMENT');
    } catch (e) {
      console.warn('embedding failed, storing insight without it', e);
    }

    const { error: insErr } = await supabase.from('entry_insights').insert({
      entry_id,
      ...insight,
      embedding,
    });
    if (insErr) return json({ error: insErr.message }, 500);

    await supabase.from('entries').update({ processed: true }).eq('id', entry_id);
    return json({ ok: true, insight });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
