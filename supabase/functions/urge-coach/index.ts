// urge-coach — one live turn of the hands-free urge-coach loop (handoff §8).
// Trigger: tap, real-time. Model: Gemini Flash (latency > depth; turns tiny).
// NOT batch — must be instant. The API is stateless, so the full session is
// passed each turn.
//
// Guardrails (§6): warm, calm, non-shaming. No diagnosis. No crisis handling
// beyond gentle grounding + "bring this to your therapist." Tone configurable.

import { corsHeaders, json } from '../_shared/cors.ts';
import { callGemini, Content, MODELS } from '../_shared/gemini.ts';

const COACH_SYSTEM = [
  'You are a warm, calm grounding coach for someone riding out an urge',
  '(porn, nicotine, scrolling). You are NOT a therapist and never claim to',
  'be. Rules: one short question or reflection at a time; never shame, never',
  'lecture, never diagnose; no streaks or failure framing; getting here at',
  'all is a win and you say so. Focus on the antecedent — what they were',
  'feeling just before — and on the underlying need (stimulation, escape,',
  'rest). If they are in real crisis, gently steer to their therapist or a',
  'crisis line; do not try to handle it yourself. Keep replies to 1-2 short',
  'spoken sentences — this is read aloud.',
].join(' ');

interface Body {
  // Prior turns of THIS session (client keeps the running transcript).
  messages: { role: 'coach' | 'user'; text: string }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { messages }: Body = await req.json();

    // Opening turn: coach speaks first (§8.2).
    const contents: Content[] =
      !messages || messages.length === 0
        ? [
            {
              role: 'user',
              parts: [
                {
                  text: '[The user just tapped "I\'m having an urge." Open gently with one short grounding line.]',
                },
              ],
            },
          ]
        : messages.map((m) => ({
            // Gemini roles: the coach is the model, the person is the user.
            role: m.role === 'coach' ? 'model' : 'user',
            parts: [{ text: m.text }],
          }));

    const reply = await callGemini({
      model: MODELS.flash,
      system: COACH_SYSTEM,
      contents,
      maxTokens: 256,
      temperature: 0.8,
      thinkingBudget: 0, // instant, short replies — thinking would truncate them
    });

    return json({ reply });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
