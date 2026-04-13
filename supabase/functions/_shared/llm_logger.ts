/**
 * Logs every LLM call to the llm_call_logs table.
 * Operational monitoring only — no raw prompts or LLM output stored here.
 *
 * Failures are swallowed so that a logging error never blocks the main flow.
 */
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getModel } from './claude.ts';

export type EdgeFunctionName =
  | 'generate-plan'
  | 'generate-workout'
  | 'evolve-plan'
  | 'revise-plan';

export interface LogLlmCallParams {
  supabase: SupabaseClient;
  userId: string | null;
  edgeFunction: EdgeFunctionName;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

export async function logLlmCall(params: LogLlmCallParams): Promise<void> {
  try {
    const { supabase, userId, edgeFunction, promptVersion, inputTokens, outputTokens, latencyMs, success, errorMessage } = params;
    await supabase.from('llm_call_logs').insert({
      user_id: userId,
      edge_function: edgeFunction,
      model: getModel(),
      prompt_version: promptVersion,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: latencyMs,
      success,
      error_message: errorMessage ?? null,
      called_at: new Date().toISOString(),
    });
  } catch {
    // Never block the main flow on logging failure
  }
}
