// nightly-analysis — the clock-triggered batch job (handoff §3 Bucket A, §5,
// §10 Phase 2). Trigger: pg_cron → this function (see sql/schedule_nightly.sql).
//
// Walks the day's unprocessed-but-transcribed entries, structures each with
// Gemini Pro (quality shows here), computes its embedding, writes
// entry_insights, and flips processed.
//
// COST NOTE: Gemini offers a Batch mode (~50% off, async) and context caching.
// For a single user's handful of entries/night the saving is cents, so this
// runs synchronously for simplicity + robustness. If volume ever grows, swap
// structureTranscript() for a Batch submission + a polling follow-up.

import { json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { MODELS } from '../_shared/gemini.ts';
import { structureTranscript } from '../_shared/structuring.ts';
import { embed } from '../_shared/embeddings.ts';

Deno.serve(async () => {
  try {
    const supabase = adminClient();

    // Everything still unprocessed that has a transcript to work from. (Not
    // time-boxed: if a night was missed, it catches up rather than dropping
    // entries — "track presence", nothing falls through.)
    const { data: entries, error } = await supabase
      .from('entries')
      .select('id, transcript')
      .eq('processed', false)
      .not('transcript', 'is', null);
    if (error) return json({ error: error.message }, 500);

    if (!entries || entries.length === 0) {
      return json({ ok: true, processed: 0, note: 'nothing to do' });
    }

    let processed = 0;
    const failures: { id: string; error: string }[] = [];

    for (const entry of entries) {
      try {
        const insight = await structureTranscript(
          entry.transcript as string,
          // Flash with thinking off: structured extraction is well-defined, so
          // this is fast, cheap, and returns clean JSON.
          MODELS.flash,
        );

        let embedding: number[] | null = null;
        try {
          embedding = await embed(
            insight.summary ?? (entry.transcript as string),
            'RETRIEVAL_DOCUMENT',
          );
        } catch (e) {
          console.warn(`embedding failed for ${entry.id}`, e);
        }

        const { error: insErr } = await supabase
          .from('entry_insights')
          .insert({ entry_id: entry.id, ...insight, embedding });
        if (insErr) throw insErr;

        await supabase
          .from('entries')
          .update({ processed: true })
          .eq('id', entry.id);
        processed++;
      } catch (e) {
        // One bad entry must not sink the whole run.
        failures.push({ id: entry.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return json({ ok: true, processed, failed: failures.length, failures });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
