/**
 * Shared Claude API wrapper for all edge functions.
 *
 * Model selection:
 *   APP_ENV=prod  → claude-sonnet-4-6
 *   APP_ENV=dev   → claude-haiku-4-5-20251001  (cost-saving gate)
 */

const PROD_MODEL = 'claude-sonnet-4-6';
const DEV_MODEL = 'claude-haiku-4-5-20251001';

export function getModel(): string {
  return Deno.env.get('APP_ENV') === 'prod' ? PROD_MODEL : DEV_MODEL;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Calls the Claude Messages API and returns the text response with usage stats.
 * Throws on non-2xx HTTP status.
 */
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096,
): Promise<ClaudeCallResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = getModel();
  const startMs = Date.now();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startMs;

  const content: string = data.content?.[0]?.text ?? '';
  const inputTokens: number = data.usage?.input_tokens ?? 0;
  const outputTokens: number = data.usage?.output_tokens ?? 0;

  return { content, inputTokens, outputTokens, latencyMs };
}
