/**
 * RAG (Retrieval-Augmented Generation) helper.
 *
 * At query time:
 *   1. Embeds the query string via Gemini text-embedding-004 (768-dim, free tier)
 *   2. Runs a cosine similarity search against knowledge_chunks via search_knowledge RPC
 *   3. Formats retrieved chunks as a <clinical_reference> block for prompt injection
 *
 * Usage in edge functions:
 *   const chunks = await retrieveKnowledge(supabase, queryText);
 *   const systemPromptWithContext = SYSTEM_PROMPT + formatKnowledgeContext(chunks);
 *
 * Failures should be caught and swallowed by the caller — degraded behaviour
 * (no RAG context) is preferable to blocking workout/plan generation.
 */
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface KnowledgeChunk {
  id: string;
  content: string;
  source: string;
  category: string | null;
  similarity: number;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini Embedding API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const values: number[] = data.embedding?.values;

  if (!Array.isArray(values) || values.length !== 768) {
    throw new Error(`Unexpected embedding dimensions: got ${values?.length ?? 0}, expected 768`);
  }

  return values;
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieves the top-k most relevant knowledge chunks for a given query.
 * Returns an empty array if the knowledge base is empty — callers should
 * handle this gracefully (no RAG context injected into prompt).
 */
export async function retrieveKnowledge(
  supabase: SupabaseClient,
  queryText: string,
  matchCount = 5,
  category?: string,
): Promise<KnowledgeChunk[]> {
  const embedding = await embedText(queryText);

  const { data, error } = await supabase.rpc('search_knowledge', {
    query_embedding: embedding,
    match_count:     matchCount,
    category_filter: category ?? null,
  });

  if (error) {
    throw new Error(`search_knowledge RPC error: ${error.message}`);
  }

  return (data as KnowledgeChunk[]) ?? [];
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats retrieved chunks into a prompt-ready context block.
 * Returns an empty string if no chunks — SYSTEM_PROMPT + '' = unchanged prompt.
 *
 * The <clinical_reference> XML tag is semantically distinct from the JSON schema
 * instructions in the system prompt, preventing the LLM from confusing context
 * with output format instructions.
 */
export function formatKnowledgeContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return '';

  const body = chunks
    .map((chunk, i) => `[${i + 1}] Source: ${chunk.source}\n${chunk.content.trim()}`)
    .join('\n\n---\n\n');

  return `\n\n<clinical_reference>\nThe following PHT clinical reference material has been retrieved to inform your response. Use it as supporting context — do not quote it verbatim.\n\n${body}\n</clinical_reference>`;
}
