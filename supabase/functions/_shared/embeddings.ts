// Embeddings for semantic recall (handoff §5). Google Gemini embeddings —
// gemini-embedding-001 with output dimensionality pinned to 1536 so it matches
// vector(1536) in 0001_init.sql (the model is Matryoshka-trained, so 1536 is a
// supported truncation). No schema change needed.
//
// We store/query with cosine distance (vector_cosine_ops), which is scale-
// invariant, so the sub-3072 vectors don't need renormalizing for ranking.
//
// Secret: GEMINI_API_KEY.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBED_MODEL = 'gemini-embedding-001';
export const EMBED_DIMS = 1536;

// RETRIEVAL_DOCUMENT when embedding stored entries, RETRIEVAL_QUERY when
// embedding the live "how I feel" query — improves match quality.
export type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export async function embed(
  text: string,
  taskType: EmbedTask = 'RETRIEVAL_DOCUMENT',
): Promise<number[]> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `${BASE}/models/${EMBED_MODEL}:embedContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBED_DIMS,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini embeddings ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.embedding.values as number[];
}
