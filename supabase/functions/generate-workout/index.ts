/**
 * generate-workout edge function
 *
 * Called after the user submits a check-in.
 * Decides whether to call Claude or short-circuit based on pain level:
 *   pain ≥ 8  → insert safety_event + return rest_recommendation (no Claude call)
 *   pain 4–7  → call Claude with modified protocol
 *   pain 0–3  → call Claude with standard protocol
 *
 * On schema validation failure: one automatic retry.
 * On second failure: return yesterday's workout with fallback banner.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callClaude } from '../_shared/claude.ts';
import { logLlmCall } from '../_shared/llm_logger.ts';
import { validateGenerateWorkoutResponse, type GenerateWorkoutResponse } from '../_shared/validation.ts';
import { getFallbackWorkout } from './fallback.ts';

const PROMPT_VERSION = 'generate-workout-v1';

// ─── High-pain rest recommendation (no Claude call) ───────────────────────────

const HIGH_PAIN_EXPLANATION =
  "Your pain level is high today. Rest is the most important thing you can do right now — exercise would likely set back your recovery. Take the day off, use gentle movement if comfortable, and check in again tomorrow. If pain persists at this level, please consider reaching out to a healthcare professional.";

// ─── Prompt builder ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are assisting a PHT rehabilitation app in generating a daily workout based on the user's check-in data and their current recovery phase prescription.

Rules you must follow:
- If pain_level ≥ 8: return workout_type = "rest_recommendation". Do NOT prescribe exercises.
- If pain_level 4–7: return workout_type = "modified". Reduce sets and/or load by 30–50% from the phase prescription. Avoid any hip-flexion-dominant exercises.
- If pain_level 0–3: return workout_type = "standard". Follow the phase prescription with minor adjustments as clinically appropriate.
- Never prescribe an exercise that involves sustained hip flexion > 60° in early phases (Phase 1 or Phase 2).
- Pain during exercise should be ≤ 3/10. If an exercise predictably exceeds this, substitute or reduce load.

Your response MUST be valid JSON matching this schema. No other text — JSON only.

Schema:
{
  "workout_type": "'standard' | 'modified' | 'rest_recommendation'",
  "plain_language_explanation": "string — 2–4 sentences explaining today's workout to the user in plain language. If rest is recommended, explain why kindly and what they should expect.",
  "exercises": [
    {
      "exercise_name": "string",
      "sets": "integer",
      "reps": "string",
      "load": "string",
      "tempo": "string",
      "rest_seconds": "integer",
      "notes": "string"
    }
  ]
}

For rest_recommendation, exercises array must be empty [].`;

function buildUserMessage(
  painLevel: number,
  sorenessLevel: number,
  recentCheckIns: Array<{ pain_level: number; checked_in_at: string }>,
  phase: Record<string, unknown>,
  phaseExercises: Array<Record<string, unknown>>,
): string {
  const recentStr = recentCheckIns.length > 0
    ? recentCheckIns.map((c) => `  - Pain ${c.pain_level}/10 on ${new Date(c.checked_in_at).toLocaleDateString()}`).join('\n')
    : '  No prior check-ins.';

  const exercisesStr = phaseExercises.map((e) =>
    `  - ${e.exercise_name ?? 'Exercise'}: ${e.prescribed_sets} sets × ${e.prescribed_reps}, load: ${e.load_target ?? 'bodyweight'}, tempo: ${e.tempo ?? 'controlled'}, rest: ${e.rest_seconds ?? 60}s`
  ).join('\n');

  return `Generate a workout for today.

Today's check-in:
  Pain level: ${painLevel}/10
  Soreness level: ${sorenessLevel}/10

Last 3 check-ins (most recent first):
${recentStr}

Current recovery phase:
  Phase ${phase.phase_number}: ${phase.name}
  Description: ${phase.description}

Prescribed exercises for this phase:
${exercisesStr}`;
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
    const { sessionId, checkInId } = body as { sessionId: string; checkInId: string };

    if (!sessionId || !checkInId) {
      return new Response(JSON.stringify({ error: 'sessionId and checkInId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch check-in
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

    // High pain — no Claude call, insert safety event, return rest recommendation
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

    // Fetch session → phase → exercises and recent check-ins
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

    const [{ data: phase }, { data: phaseExercises }, { data: recentCheckIns }] = await Promise.all([
      supabase.from('plan_phases').select('phase_number, name, description').eq('id', session.plan_phase_id).single(),
      supabase.from('phase_exercises').select('*, exercises(name)').eq('phase_id', session.plan_phase_id).order('order_index'),
      supabase.from('check_ins').select('pain_level, checked_in_at').eq('user_id', user.id).order('checked_in_at', { ascending: false }).limit(3),
    ]);

    const exercisesForPrompt = (phaseExercises ?? []).map((e: Record<string, unknown>) => ({
      exercise_name: (e.exercises as Record<string, unknown>)?.name ?? 'Exercise',
      prescribed_sets: e.prescribed_sets,
      prescribed_reps: e.prescribed_reps,
      load_target: e.load_target,
      tempo: e.tempo,
      rest_seconds: e.rest_seconds,
    }));

    const userMessage = buildUserMessage(
      painLevel,
      sorenessLevel,
      (recentCheckIns ?? []) as Array<{ pain_level: number; checked_in_at: string }>,
      phase ?? {},
      exercisesForPrompt,
    );

    // First attempt
    let callResult = await callClaude(SYSTEM_PROMPT, userMessage);
    let parsed: GenerateWorkoutResponse;
    let validationError: string | null = null;

    try {
      const json = JSON.parse(callResult.content);
      parsed = validateGenerateWorkoutResponse(json);
    } catch (err) {
      validationError = (err as Error).message;

      const retryMessage = `${userMessage}\n\nYour previous response failed schema validation: ${validationError}\nPlease fix the JSON and try again.`;
      callResult = await callClaude(SYSTEM_PROMPT, retryMessage);

      try {
        const json = JSON.parse(callResult.content);
        parsed = validateGenerateWorkoutResponse(json);
        validationError = null;
      } catch {
        // Log failure and return fallback
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

    // Log success
    await logLlmCall({
      supabase, userId: user.id, edgeFunction: 'generate-workout',
      promptVersion: PROMPT_VERSION,
      inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
      latencyMs: callResult.latencyMs, success: true,
    });

    // Persist workout
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

    // Persist exercises
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
      JSON.stringify({
        workoutId: dbWorkout.id,
        ...parsed!,
        safetyFlagged: false,
      }),
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
