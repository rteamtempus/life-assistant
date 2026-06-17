// surface — "I feel ___ → here's what worked" (handoff §9, the payoff layer).
// Trigger: tap. Embeds the stated feeling, finds the most similar past moments
// via match_entry_insights, and returns what helped then. Tool ranking is done
// client-side via the top_tools RPC (no secret needed), so this function is
// purely the semantic half — and it degrades gracefully: if the embedding key
// isn't set yet, it returns an empty match list instead of erroring.

import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { embed } from '../_shared/embeddings.ts';

interface Match {
  entry_id: string;
  summary: string | null;
  what_helped: string[];
  similarity: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { feeling }: { feeling: string } = await req.json();
    if (!feeling?.trim()) return json({ error: 'feeling required' }, 400);

    let matches: Match[] = [];
    try {
      const embedding = await embed(feeling, 'RETRIEVAL_QUERY');
      const supabase = adminClient();
      const { data, error } = await supabase.rpc('match_entry_insights', {
        query_embedding: embedding,
        match_count: 5,
      });
      if (error) throw error;
      matches = (data ?? []) as Match[];
    } catch (e) {
      // No key yet, or nothing embedded yet — return empty, not an error.
      console.warn('semantic recall unavailable', e);
    }

    // Flatten what-helped across the closest moments, most-similar first,
    // de-duplicated, capped — a short, honest "this helped before" list.
    const seen = new Set<string>();
    const whatHelped: string[] = [];
    for (const m of matches) {
      for (const h of m.what_helped ?? []) {
        const key = h.trim().toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          whatHelped.push(h.trim());
        }
      }
    }

    return json({
      what_helped: whatHelped.slice(0, 6),
      moments: matches
        .filter((m) => m.summary)
        .slice(0, 3)
        .map((m) => ({ summary: m.summary, similarity: m.similarity })),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
