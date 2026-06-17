// Gemini helper for all generative + transcription work (handoff §5 routing,
// adapted: this project uses Google Gemini, not Anthropic/OpenAI).
//
// Models (verify before relying — these move): gemini-2.5-flash (live coach,
// on-demand structuring, transcription) and gemini-3.1-flash-lite (cheapest —
// the weekly batch summary). See MODELS below.
//
// Secret: GEMINI_API_KEY (Google AI Studio key).
//
// COST NOTE: Gemini's equivalent of Anthropic prompt-caching is explicit
// context caching (CachedContent API). Our system prompts are small, so it's
// skipped for now — wire it in later if batch volume grows.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const MODELS = {
  flash: 'gemini-2.5-flash',
  // Owner's preferred low-cost model for the heavier batch work (replaces
  // 2.5-pro). Verify the exact id against Google's model list — it moves.
  flashLite: 'gemini-3.1-flash-lite',
} as const;

export interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export interface Content {
  role?: 'user' | 'model';
  parts: Part[];
}

export interface CallOpts {
  model: string;
  /** System instruction (warm coach framing, output contract, …). */
  system?: string;
  contents: Content[];
  maxTokens?: number;
  temperature?: number;
  /** Force a JSON response (structuring / summaries). */
  json?: boolean;
  /**
   * Gemini 2.5 "thinking" budget, in tokens. Thinking shares the
   * maxOutputTokens budget, so for short, well-defined tasks (the live coach,
   * JSON extraction) set this to 0 to disable it — otherwise thinking can eat
   * the whole budget and the visible reply comes back truncated/empty.
   * Note: flash/flash-lite accept 0; gemini-2.5-pro has a minimum (don't pass 0).
   */
  thinkingBudget?: number;
}

function key(): string {
  const k = Deno.env.get('GEMINI_API_KEY');
  if (!k) throw new Error('GEMINI_API_KEY not set');
  return k;
}

export async function callGemini(opts: CallOpts): Promise<string> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.json) generationConfig.responseMimeType = 'application/json';
  if (opts.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
  }

  const body: Record<string, unknown> = {
    contents: opts.contents,
    generationConfig,
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const res = await fetch(
    `${BASE}/models/${opts.model}:generateContent?key=${key()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p: Part) => p.text ?? '')
    .filter(Boolean)
    .join('')
    .trim();
}

/** Transcribe audio with Gemini (handoff §5: STT server-side). `data` is
 *  base64-encoded audio. Gemini handles common audio mime types directly. */
export async function transcribeAudio(
  data: string,
  mimeType: string,
  model: string = MODELS.flash,
): Promise<string> {
  return callGemini({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Transcribe this audio verbatim. Return only the spoken words, with no commentary, labels, or timestamps.',
          },
          { inline_data: { mime_type: mimeType, data } },
        ],
      },
    ],
    maxTokens: 2048,
    temperature: 0,
    thinkingBudget: 0, // straight transcription — no thinking needed
  });
}
