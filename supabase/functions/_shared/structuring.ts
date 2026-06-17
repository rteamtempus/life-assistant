// Shared structuring logic (handoff §3 Bucket A). One transcript → structured
// insight. Used by BOTH the on-demand `structure-entry` function (tap) and the
// `nightly-analysis` batch — same prompt, same shape, so insights are
// consistent however they're produced.
//
// Observations only — never diagnose, never shame (§1.4, §6).

import { callGemini } from './gemini.ts';

export interface StructuredInsight {
  mood: number | null;
  energy: number | null;
  tags: string[];
  people: string[];
  stressors: string[];
  what_helped: string[];
  summary: string | null;
}

export const STRUCTURING_SYSTEM = [
  'You structure a personal voice-journal entry into JSON. You are a warm,',
  'non-clinical assistant. Observations only — never diagnose, never shame.',
  'Return ONLY a JSON object, no prose, with exactly these keys:',
  'mood (integer -5..5 or null — overall felt tone),',
  'energy (integer -5..5 or null — activation level; this feeds a bipolar',
  'early-warning signal, so read it carefully),',
  'tags (array of short theme strings),',
  'people (array of names/relationships mentioned),',
  'stressors (array of what weighed on them),',
  'what_helped (array of anything that eased things),',
  'summary (one warm, plain sentence — what this entry was about).',
  'Use null or empty arrays when a field genuinely is not present. Do not invent.',
].join(' ');

export async function structureTranscript(
  transcript: string,
  model: string,
): Promise<StructuredInsight> {
  const raw = await callGemini({
    model,
    system: STRUCTURING_SYSTEM,
    contents: [{ role: 'user', parts: [{ text: transcript }] }],
    maxTokens: 1024,
    temperature: 0.3,
    json: true,
    thinkingBudget: 0, // deterministic extraction; thinking would truncate the JSON
  });

  let parsed: Partial<StructuredInsight>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  }

  return {
    mood: parsed.mood ?? null,
    energy: parsed.energy ?? null,
    tags: parsed.tags ?? [],
    people: parsed.people ?? [],
    stressors: parsed.stressors ?? [],
    what_helped: parsed.what_helped ?? [],
    summary: parsed.summary ?? null,
  };
}
