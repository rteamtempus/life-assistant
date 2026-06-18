// analyze — the payoff (handoff pivot, Stage 5). Trigger: tap or schedule.
// Model: gemini-2.5-flash. Reads a date range of events + dumps (journals/
// check-ins) + urges and writes a warm, non-clinical breakdown of what helped,
// what hurt, patterns, and concrete recommendations — saved as an `analyses`
// row the user can revisit.
//
// Presence not absence; observations not diagnoses (§1, §6).
// Secret: GEMINI_API_KEY.

import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase-admin.ts';
import { callGemini, MODELS } from '../_shared/gemini.ts';

interface Body {
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  trigger?: 'morning' | 'weekly' | 'manual';
}

const SYSTEM = [
  'You are a warm, sharp personal analyst for one person who tracks their daily',
  'life to feel better. You are supportive and non-clinical: observations and',
  'hypotheses, never diagnoses, never shame. You are given a date range of their',
  'logged events (food, water, meds, sleep, tiredness, mood, tools, activities,',
  'social, symptoms, substances), their journal/check-in transcripts, and any',
  'urges.',
  '',
  'Find what genuinely seemed to HELP them feel better and what seemed to HURT,',
  'reasoning from patterns in THEIR data (e.g. timing, co-occurrence, lead/lag',
  'like "earlier wind-down -> better next morning") AND from general knowledge of',
  'what tends to help what (hydration, protein, light, movement, sleep timing,',
  'med timing, etc). Tie claims to evidence from the data. Be honest about',
  'uncertainty; correlation is not proof — frame gently, as things to notice or',
  'bring to a therapist.',
  '',
  'Then give a few concrete, kind recommendations for what to do more / less of.',
  '',
  'You may also be given the user\'s ACTIVE EXPERIMENTS — things they decided to',
  'try. For each, assess honestly from the data: adherence (did they actually do',
  'it, and how consistently) and effect (did it seem to help, hurt, or unclear).',
  'Be encouraging about effort, never shaming about misses.',
  '',
  'Return ONLY JSON: {"summary": string (a few warm sentences),',
  '"helped": [{"item": string, "why": string, "evidence": string}],',
  '"hurt": [{"item": string, "why": string, "evidence": string}],',
  '"patterns": [string], "recommendations": [{"text": string, "rationale": string}],',
  '"experiment_progress": [{"experiment": string, "adherence": string, "effect": string}]}.',
  'If there are no active experiments, return [] for experiment_progress.',
].join('\n');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { period_start, period_end, trigger }: Body = await req.json();
    if (!period_start || !period_end) {
      return json({ error: 'period_start and period_end (YYYY-MM-DD) required' }, 400);
    }
    const startIso = `${period_start}T00:00:00.000Z`;
    const endIso = `${period_end}T23:59:59.999Z`;

    const supabase = adminClient();
    const [events, dumps, urges, experiments] = await Promise.all([
      supabase
        .from('events')
        .select('category, label, amount, unit, valence, note, occurred_at')
        .gte('occurred_at', startIso)
        .lte('occurred_at', endIso)
        .order('occurred_at', { ascending: true }),
      supabase
        .from('dumps')
        .select('kind, occurred_at, transcript, summary')
        .not('transcript', 'is', null)
        .gte('occurred_at', startIso)
        .lte('occurred_at', endIso)
        .order('occurred_at', { ascending: true }),
      supabase
        .from('urges')
        .select('occurred_at, acted_on, what_helped')
        .gte('occurred_at', startIso)
        .lte('occurred_at', endIso),
      supabase
        .from('experiments')
        .select('text, rationale, started_on')
        .eq('status', 'active'),
    ]);

    const payload = {
      range: { from: period_start, to: period_end },
      events: events.data ?? [],
      // Prefer the distilled summary; fall back to the raw transcript.
      journals_and_checkins: (dumps.data ?? []).map((d) => ({
        kind: d.kind,
        occurred_at: d.occurred_at,
        text: d.summary ?? d.transcript,
      })),
      urges: urges.data ?? [],
      active_experiments: experiments.data ?? [],
    };

    const hasData =
      (events.data?.length ?? 0) +
        (dumps.data?.length ?? 0) +
        (urges.data?.length ?? 0) >
      0;
    if (!hasData) {
      return json({ error: 'no data logged in that range yet' }, 422);
    }

    const raw = await callGemini({
      model: MODELS.flash,
      system: SYSTEM,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Here is the data as JSON:\n\n${JSON.stringify(payload)}` }],
        },
      ],
      maxTokens: 8192,
      temperature: 0.5,
      json: true,
      thinkingBudget: 2048,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { summary: raw, helped: [], hurt: [], patterns: [], recommendations: [], experiment_progress: [] };
    }

    const { data, error } = await supabase
      .from('analyses')
      .insert({
        period_start,
        period_end,
        trigger: trigger ?? 'manual',
        model: MODELS.flash,
        summary: parsed.summary ?? null,
        helped: parsed.helped ?? [],
        hurt: parsed.hurt ?? [],
        patterns: parsed.patterns ?? [],
        recommendations: parsed.recommendations ?? [],
        experiment_progress: parsed.experiment_progress ?? [],
      })
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);

    return json({ analysis: data });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
