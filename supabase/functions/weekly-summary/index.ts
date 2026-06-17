// weekly-summary — the first-pass weekly report (handoff §3 Bucket A, §5, §10
// Phase 4). Trigger: pg_cron weekly. Model: Gemini Pro — once a week, so quality
// is cheap. Reads the week's insights/check-ins/urges/tool-uses and writes a
// warm, non-clinical reflection row. The Sunday MCP deep-dive reads the same
// row and goes further (Bucket B).
//
// Presence, not absence (§1.1): highlight what happened and what helped. Gentle
// observations only — never diagnoses (§6).

import { json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { callGemini, MODELS } from '../_shared/gemini.ts';

const SYSTEM = [
  "You write a warm weekly reflection for one person's private regulation",
  'journal. You are supportive and non-clinical — observations, never',
  'diagnosis, never shame (§1.4, §6). Emphasize presence: what they did,',
  'what helped, urges they rode out (a win that counts). Note gentle patterns',
  '(e.g. rising activation across days, recurring stressors) as curiosities to',
  'bring to their therapist, not verdicts. Return ONLY JSON with keys:',
  'summary (a few warm sentences), highlights (array of strings),',
  'gentle_observations (array of strings), therapist_note (a short paragraph',
  'they could bring to a session).',
].join(' ');

Deno.serve(async () => {
  try {
    const supabase = adminClient();
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startIso = start.toISOString();

    const [insights, checkIns, urges, toolUses] = await Promise.all([
      supabase.from('entry_insights').select('mood, energy, tags, stressors, what_helped, summary'),
      supabase.from('check_ins').select('mood, energy, activation, note, created_at').gte('created_at', startIso),
      supabase.from('urge_events').select('kind, rode_out, acted_on, intensity, underlying_need, antecedent_state, occurred_at').gte('occurred_at', startIso),
      supabase.from('tool_uses').select('tool_id, used_at').gte('used_at', startIso),
    ]);

    const payload = {
      check_ins: checkIns.data ?? [],
      urges: urges.data ?? [],
      tool_use_count: (toolUses.data ?? []).length,
      insights: insights.data ?? [],
    };

    const raw = await callGemini({
      model: MODELS.flashLite,
      system: SYSTEM,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Here is the week's data as JSON. Write the reflection.\n\n${JSON.stringify(payload)}`,
            },
          ],
        },
      ],
      maxTokens: 2048,
      temperature: 0.5,
      json: true,
      thinkingBudget: 0, // flash-lite, well-scoped task — keep the budget for output
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { summary: raw, highlights: [], gentle_observations: [], therapist_note: null };
    }

    const { data, error } = await supabase
      .from('reflections')
      .insert({
        period: 'week',
        period_start: startIso.slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        summary: parsed.summary ?? null,
        highlights: parsed.highlights ?? [],
        gentle_observations: parsed.gentle_observations ?? [],
        therapist_note: parsed.therapist_note ?? null,
      })
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, reflection_id: data.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
