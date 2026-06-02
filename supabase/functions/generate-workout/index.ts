/**
 * generate-workout edge function
 *
 * Called after the user submits a check-in.
 * Workout type is determined deterministically from the condition module
 * before any LLM call:
 *   pain ≥ 8  → insert safety_event + return rest_recommendation (no LLM call)
 *   pain 4–7  → modified workout (LLM generates exercises within reduced load/set bounds)
 *   pain 0–3  → standard workout (LLM generates exercises per phase prescription)
 *
 * RAG removed — clinical context comes from the condition module.
 * On schema validation failure: one automatic retry.
 * On second failure: return yesterday's workout with fallback banner.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callLLM } from '../_shared/llm.ts';
import { logLlmCall } from '../_shared/llm_logger.ts';
import { validateGenerateWorkoutResponse, type GenerateWorkoutResponse } from '../_shared/validation.ts';
import { getFallbackWorkout } from './fallback.ts';
import {
  loadConditionModule,
  renderTemplate,
  type ConditionModule,
} from '../_shared/conditionModule.ts';
import { resolveWorkoutModification } from '../_shared/workoutModification.ts';

const PROMPT_VERSION = 'generate-workout-v2';

// ─── Workout JSON schema (injected into system prompt template) ───────────────

const WORKOUT_SCHEMA = `{
  "workout_type": "'standard' | 'modified' | 'rest_recommendation'",
  "plain_language_explanation": "string — 2–4 sentences explaining today's workout to the user. If rest is recommended, explain kindly.",
  "exercises": [
    {
      "exercise_name": "string — must match a name from the prescribed exercises list above",
      "sets": "integer",
      "reps": "string",
      "load": "string",
      "tempo": "string",
      "rest_seconds": "integer",
      "notes": "string"
    }
  ]
}`;

// ─── High-pain rest recommendation ───────────────────────────────────────────

const HIGH_PAIN_EXPLANATION =
  "Your pain level is high today. Rest is the most important thing you can do right now — exercise would likely set back your recovery. Take the day off, use gentle movement if comfortable, and check in again tomorrow. If pain persists at this level, please consider reaching out to a healthcare professional.";

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(
  module: ConditionModule,
  conditionId: string,
  protocolVersion: string,
  workoutType: 'standard' | 'modified',
  painLevel: number,
  sorenessLevel: number,
  phaseExercises: Array<Record<string, unknown>>,
  recentCheckIns: Array<{ pain_level: number; checked_in_at: string }>,
  schedulingContext: string,
): string {
  const modRule = resolveWorkoutModification(painLevel, module.protocol.workout_modification_rules);

  const exercisesStr = phaseExercises.map((e) =>
    `- ${e.exercise_name ?? 'Exercise'}: ${e.prescribed_sets} sets × ${e.prescribed_reps}, load: ${e.load_target ?? 'bodyweight'}, tempo: ${e.tempo ?? 'controlled'}, rest: ${e.rest_seconds ?? 60}s`
  ).join('\n');

  const recentStr = recentCheckIns.length > 0
    ? recentCheckIns.map((c) => `Pain ${c.pain_level}/10 on ${new Date(c.checked_in_at).toLocaleDateString()}`).join('; ')
    : 'No prior check-ins.';

  return renderTemplate(module.workout_system_prompt_template, {
    condition_name: module.protocol.meta.condition_name,
    condition_id: conditionId,
    protocol_version: protocolVersion,
    workout_modification_rules: JSON.stringify(modRule, null, 2),
    phase_exercises: exercisesStr,
    pain_level: String(painLevel),
    soreness_level: String(sorenessLevel),
    recent_checkins: recentStr,
    workout_schema: WORKOUT_SCHEMA,
    scheduling_context: schedulingContext,
  }) + `\n\nworkout_type for this session: "${workoutType}" — use this value exactly in your response.`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { sessionId, checkInId, isoDate, dayOfWeek, timeOfDay } = body as {
      sessionId: string;
      checkInId: string;
      isoDate?: string;
      dayOfWeek?: string;
      timeOfDay?: string;
    };

    const schedulingContext = (() => {
      const date = isoDate ?? new Date().toISOString().split('T')[0];
      const day = dayOfWeek ?? new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const h = new Date().getHours();
      const time = timeOfDay ?? (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening');
      return `${day}, ${date} (${time})`;
    })();

    if (!sessionId || !checkInId) {
      return new Response(JSON.stringify({ error: 'sessionId and checkInId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: checkIn } = await supabase
      .from('check_ins')
      .select('pain_level, soreness_level')
      .eq('id', checkInId)
      .single();

    if (!checkIn) {
      return new Response(JSON.stringify({ error: 'Check-in not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const painLevel = checkIn.pain_level as number;
    const sorenessLevel = checkIn.soreness_level as number;

    // High pain — deterministic rest recommendation, no LLM call
    if (painLevel >= 8) {
      await supabase.from('safety_events').insert({
        user_id: user.id,
        session_id: sessionId,
        trigger: 'high_pain_checkin',
        pain_level_reported: painLevel,
        details: `Check-in pain level ${painLevel}/10 exceeded threshold. Rest recommended.`,
        professional_care_acknowledged: false,
      });

      const { data: workout } = await supabase
        .from('generated_workouts')
        .insert({
          session_id: sessionId,
          check_in_id: checkInId,
          workout_type: 'rest_recommendation',
          plain_language_explanation: HIGH_PAIN_EXPLANATION,
          prompt_version: PROMPT_VERSION,
        })
        .select('id')
        .single();

      return new Response(
        JSON.stringify({
          workoutId: workout?.id,
          workout_type: 'rest_recommendation',
          plain_language_explanation: HIGH_PAIN_EXPLANATION,
          exercises: [],
          safetyFlagged: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Deterministic workout type for pain 0–7
    const workoutType: 'standard' | 'modified' = painLevel <= 3 ? 'standard' : 'modified';

    // Fetch session → phase (with plan for condition_id + protocol_version)
    const { data: session } = await supabase
      .from('sessions')
      .select('plan_phase_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [
      { data: phaseWithPlan },
      { data: phaseExercises },
      { data: recentCheckIns },
    ] = await Promise.all([
      supabase
        .from('plan_phases')
        .select('phase_number, name, description, plan_id, recovery_plans(condition_id, protocol_version)')
        .eq('id', session.plan_phase_id)
        .single(),
      supabase
        .from('phase_exercises')
        .select('*')
        .eq('phase_id', session.plan_phase_id)
        .order('order_index'),
      supabase
        .from('check_ins')
        .select('pain_level, checked_in_at')
        .eq('user_id', user.id)
        .order('checked_in_at', { ascending: false })
        .limit(3),
    ]);

    const plan = (phaseWithPlan?.recovery_plans as Record<string, unknown> | null);
    const conditionId = (plan?.condition_id as string) ?? 'pht';
    const protocolVersion = (plan?.protocol_version as string) ?? '1.0';

    const conditionModule = await loadConditionModule(supabase, conditionId);

    const exercisesForPrompt = (phaseExercises ?? []).map((e: Record<string, unknown>) => ({
      exercise_name: (e.name as string) ?? 'Exercise',
      prescribed_sets: e.prescribed_sets,
      prescribed_reps: e.prescribed_reps,
      load_target: e.load_target,
      tempo: e.tempo,
      rest_seconds: e.rest_seconds,
    }));

    const systemPrompt = buildSystemPrompt(
      conditionModule,
      conditionId,
      protocolVersion,
      workoutType,
      painLevel,
      sorenessLevel,
      exercisesForPrompt,
      (recentCheckIns ?? []) as Array<{ pain_level: number; checked_in_at: string }>,
      schedulingContext,
    );

    const userMessage = 'Generate the workout for today.';

    let callResult: Awaited<ReturnType<typeof callLLM>>;
    try {
      callResult = await callLLM(systemPrompt, userMessage);
    } catch (llmErr) {
      console.warn('[generate-workout] LLM first attempt failed, retrying in 4s:', (llmErr as Error).message);
      await new Promise((resolve) => setTimeout(resolve, 4000));
      callResult = await callLLM(systemPrompt, userMessage);
    }
    let parsed: GenerateWorkoutResponse;
    let validationError: string | null = null;

    try {
      const json = JSON.parse(callResult.content);
      parsed = validateGenerateWorkoutResponse(json);
    } catch (err) {
      validationError = (err as Error).message;

      const retryMessage = `Your previous response failed schema validation: ${validationError}\nPlease fix the JSON and try again.`;
      callResult = await callLLM(systemPrompt, retryMessage);

      try {
        const json = JSON.parse(callResult.content);
        parsed = validateGenerateWorkoutResponse(json);
        validationError = null;
      } catch {
        await logLlmCall({
          supabase, userId: user.id, edgeFunction: 'generate-workout',
          promptVersion: PROMPT_VERSION,
          inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
          latencyMs: callResult.latencyMs, success: false,
          errorMessage: validationError ?? 'Unknown validation error',
        });

        const fallback = await getFallbackWorkout(supabase, user.id);
        if (fallback) {
          return new Response(JSON.stringify(fallback), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({ error: 'We had trouble generating your workout. Please try again.', retryable: true }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    await logLlmCall({
      supabase, userId: user.id, edgeFunction: 'generate-workout',
      promptVersion: PROMPT_VERSION,
      inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
      latencyMs: callResult.latencyMs, success: true,
    });

    const { data: dbWorkout, error: workoutError } = await supabase
      .from('generated_workouts')
      .insert({
        session_id: sessionId,
        check_in_id: checkInId,
        workout_type: parsed!.workout_type,
        plain_language_explanation: parsed!.plain_language_explanation,
        prompt_version: PROMPT_VERSION,
      })
      .select('id')
      .single();

    if (workoutError || !dbWorkout) throw new Error(`Failed to insert workout: ${workoutError?.message}`);

    if (parsed!.exercises.length > 0) {
      const exerciseRows = parsed!.exercises.map((e, i) => ({
        generated_workout_id: dbWorkout.id,
        exercise_name: e.exercise_name,
        sets: e.sets,
        reps: e.reps,
        load: e.load,
        tempo: e.tempo,
        rest_seconds: e.rest_seconds,
        order_index: i,
        notes: e.notes,
      }));

      const { error: exError } = await supabase.from('generated_workout_exercises').insert(exerciseRows);
      if (exError) throw new Error(`Failed to insert workout exercises: ${exError.message}`);
    }

    return new Response(
      JSON.stringify({ workoutId: dbWorkout.id, ...parsed!, safetyFlagged: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('generate-workout error:', err);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', retryable: true }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
