// extract — brain-dump transcript -> candidate structured events (Gemini Flash-
// Lite, JSON mode). STATELESS: it does not write to the DB. The client shows the
// candidates as confirm-chips; only what the user confirms gets saved. This is
// the engine behind "mention it in a dump, it gets tracked — no forms."
//
// Secret: GEMINI_API_KEY.

import { corsHeaders, json } from '../_shared/cors.ts';
import { callGemini, MODELS } from '../_shared/gemini.ts';

interface Body {
  transcript: string;
  kind?: string; // dump kind, for light context
  now?: string;  // client's current ISO datetime, for resolving "9am" etc.
}

const SYSTEM = [
  'You read a personal brain-dump (journal / check-in / note) and pull out the',
  'trackable things mentioned. You are precise and conservative: only extract',
  'what is actually stated or strongly implied — never invent. Each item is one',
  'event.',
  '',
  'Categories (use exactly these strings; pick the best fit):',
  '- food        (label = what was eaten; amount/unit if given)',
  '- water       (amount + unit, e.g. 16 oz; a "glass" ≈ 8 oz)',
  '- medication  (label = med name; amount+unit like 400 mg if given)',
  '- tool        (label = the regulating thing done, e.g. "10-min walk", "NSDR")',
  '- sleep       (details.subtype = "wake" or "winddown"; occurred_at = the time)',
  '- tiredness   (amount = 0..10, 10 = exhausted)',
  '- mood        (amount = -5..5, negative = low; note = the feeling described)',
  '- activity    (label = notable activity, e.g. "worked out", "doctor appt")',
  '- social      (label = who / interaction, e.g. "call with boss")',
  '- symptom     (label = physical/mental symptom, e.g. "headache", "anxious")',
  '- substance   (label = nicotine/alcohol/etc; for porn/scroll urges use the urge flow)',
  '',
  'Time: the provided "now" includes the user\'s LOCAL UTC offset. If the dump',
  'states a time ("took meds at 9", "woke at 6:30"), set occurred_at to a full',
  'ISO-8601 timestamp resolved against "now" and KEEP THAT SAME OFFSET — do not',
  'convert to UTC/Z. Example: if now = 2026-06-17T21:00:00-04:00 and they say',
  '"took meds at 9am", return "2026-06-17T09:00:00-04:00". If no time is given,',
  'set occurred_at to null.',
  '',
  'valence (optional, integer -2..2): if the person clearly frames something as',
  'making them feel worse (-) or better (+), set it; otherwise null.',
  '',
  'Return ONLY JSON: {"events": [{"category": string, "label": string|null,',
  '"amount": number|null, "unit": string|null, "valence": integer|null,',
  '"occurred_at": string|null, "note": string|null, "confidence": number}]}.',
  'confidence is 0..1 (how sure you are this was really mentioned). If nothing',
  'trackable is present, return {"events": []}.',
].join('\n');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { transcript, kind, now }: Body = await req.json();
    if (!transcript?.trim()) return json({ events: [] });

    const raw = await callGemini({
      model: MODELS.flashLite,
      system: SYSTEM,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `now = ${now ?? 'unknown'}\nkind = ${kind ?? 'adhoc'}\n\nBrain-dump:\n"""\n${transcript}\n"""`,
            },
          ],
        },
      ],
      maxTokens: 2048,
      temperature: 0.2,
      json: true,
      thinkingBudget: 0,
    });

    let parsed: { events?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const events = Array.isArray(parsed.events) ? parsed.events : [];
    return json({ events });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
