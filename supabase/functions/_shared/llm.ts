/**
 * Shared LLM wrapper for all edge functions.
 * Replaces _shared/claude.ts — ANTHROPIC_API_KEY is no longer used.
 *
 * Primary:  Groq (llama-3.3-70b-versatile) — free tier, fast JSON output
 * Fallback: Gemini 2.0 Flash — automatic on any Groq error or rate limit
 *
 * Return interface is identical to the former ClaudeCallResult so all three
 * call sites (generate-plan, generate-workout, revise-plan) are drop-in replacements.
 */

const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

// Tracks which model was actually used on the last successful call in this isolate.
// Deno edge functions are isolated per invocation — this is safe.
let _lastModelUsed = GROQ_MODEL;

export function getModel(): string {
  return _lastModelUsed;
}

export interface LLMCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

const GROQ_TIMEOUT_MS   = 20_000;
const GEMINI_TIMEOUT_MS = 25_000;

async function callGroq(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<LLMCallResult> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const startMs = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GROQ_HTTP_${response.status}: ${body}`);
  }

  const data = await response.json();
  return {
    content:      data.choices?.[0]?.message?.content ?? '',
    inputTokens:  data.usage?.prompt_tokens     ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    latencyMs:    Date.now() - startMs,
  };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<LLMCallResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const startMs = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: maxTokens,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return {
    content:      data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    inputTokens:  data.usageMetadata?.promptTokenCount     ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    latencyMs:    Date.now() - startMs,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls Groq first. On any error (rate limit, network, non-2xx),
 * falls back to Gemini 2.0 Flash automatically.
 * Throws only if both providers fail.
 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096,
): Promise<LLMCallResult> {
  try {
    const result = await callGroq(systemPrompt, userMessage, maxTokens);
    _lastModelUsed = GROQ_MODEL;
    return result;
  } catch (err) {
    console.warn(`[llm] Groq failed (${(err as Error).message}), falling back to Gemini`);
    const result = await callGemini(systemPrompt, userMessage, maxTokens);
    _lastModelUsed = GEMINI_MODEL;
    return result;
  }
}
