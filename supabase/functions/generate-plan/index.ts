/**
 * generate-plan edge function
 *
 * Called after the user completes intake + goal selection.
 * Builds a Claude prompt from intake data, validates the response,
 * inserts the plan + phases + phase_exercises into the database,
 * then marks onboarding complete.
 *
 * One automatic retry on schema validation failure.
 * Safety check: if intake flags neurological/acute symptoms, inserts
 * a safety_event and returns the advisory alongside the plan.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callClaude } from '../_shared/claude.ts';
import { logLlmCall } from '../_shared/llm_logger.ts';
import { validateGeneratePlanResponse, type GeneratePlanResponse, type PlanPhase } from '../_shared/validation.ts';

const PROMPT_VERSION = 'generate-plan-v1';

// ─── Safety keyword detection ─────────────────────────────────────────────────

const SAFETY_KEYWORDS = [
  'neurological', 'numbness', 'tingling', 'radiating', 'nerve',
  'paralysis', 'weakness', 'bladder', 'bowel', 'acute trauma',
  'fracture', 'dislocation', 'severe swelling', 'unable to walk',
  'post_surgery',
];

function hasSafetyFlag(text: string): boolean {
  const lower = text.toLowerCase();
  return SAFETY_KEYWORDS.some((k) => lower.includes(k));
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a physical therapist's clinical assistant helping design a Proximal Hamstring Tendinopathy (PHT) rehabilitation plan. This plan is for an educational tool — you are not providing medical advice, and the user is encouraged to work with a healthcare professional.

PHT clinical principles you must follow:
- Avoid compressive hip flexion loads in early rehab (seated stretching, forward bends at full hip flexion)
- Begin with isometric holds, progress to eccentric loading, then functional strengthening
- Pain during exercise should remain ≤ 3/10 — do not prescribe exercises that will predictably exceed this
- Tendons require adequate load to heal; rest alone is not recommended
- Progression should be gradual — a phase should last at least 3–4 weeks before advancing

Your response MUST be valid JSON matching the schema below. No other text, markdown, or explanation — JSON only.

Schema:
{
  "plain_language_summary": "string — 2–4 sentences describing the overall plan in plain language. Address the user directly (use 'you'). Mention the number of phases and approximate total timeline.",
  "phases": [
    {
      "phase_number": "integer starting at 1",
      "name": "string — short phase name e.g. 'Pain Management & Isometrics'",
      "description": "string — clinical description of this phase's focus",
      "plain_language_summary": "string — 2–3 sentences explaining this phase to the user in plain language",
      "estimated_duration_weeks": "integer — realistic minimum weeks for this phase",
      "progression_criteria": {
        "pain_threshold": "integer 0–4 — maximum average pain_level to progress",
        "load_tolerance_pct": "integer 50–100 — minimum % of prescribed load achieved to progress",
        "consistency_pct": "integer 60–100 — minimum session completion rate to progress",
        "window_days": "integer — evaluation window in days (typically 10–21)"
      },
      "regression_criteria": {
        "pain_consecutive_sessions": "integer 2–4 — consecutive sessions above pain threshold before regressing",
        "missed_sessions_window": "integer — missed sessions within window_days before regressing"
      },
      "exercises": [
        {
          "name": "string — must match an exercise name in the library where possible",
          "sets": "integer",
          "reps": "string — e.g. '8–12' or '45s hold'",
          "load_target": "string — e.g. 'bodyweight', 'light resistance band', '20% bodyweight'",
          "tempo": "string — e.g. '3-1-3' (eccentric-pause-concentric) or 'controlled'",
          "rest_seconds": "integer",
          "notes": "string — optional coaching cue or modification; empty string if none"
        }
      ]
    }
  ]
}

Generate a plan with 3–5 phases. Each phase must have 3–6 exercises. Total estimated duration should be 12–24 weeks.`;

function buildUserMessage(intake: Record<string, unknown>, status: Record<string, unknown>): string {
  return `Generate a PHT rehabilitation plan for a user with the following profile:

Age: ${intake.age ?? 'unknown'}
Gender: ${intake.gender ?? 'unknown'}
Rehab goal: ${intake.rehab_goal ?? 'unknown'}
Injury onset date: ${intake.injury_onset_date ?? 'unknown'}
Mechanism: ${intake.mechanism ?? 'unknown'}
Prior treatment: ${intake.prior_treatment ?? 'none reported'}
Irritability level: ${intake.irritability_level ?? 'unknown'}
Training background: ${intake.training_background ?? 'unknown'}
Current pain baseline (0–10): ${status.pain_level_baseline ?? 'unknown'}
Current symptoms: ${status.current_symptoms ?? 'none reported'}`;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function insertPlan(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planData: GeneratePlanResponse,
  rehabGoal: string,
): Promise<string> {
  const { data: plan, error } = await supabase
    .from('recovery_plans')
    .insert({
      user_id: userId,
      status: 'active',
      rehab_goal: rehabGoal,
      plain_language_summary: planData.plain_language_summary,
      prompt_version: PROMPT_VERSION,
    })
    .select('id')
    .single();

  if (error || !plan) throw new Error(`Failed to insert recovery_plan: ${error?.message}`);
  return plan.id as string;
}

async function insertPhases(
  supabase: ReturnType<typeof createClient>,
  planId: string,
  phases: PlanPhase[],
): Promise<string[]> {
  const phaseIds: string[] = [];

  for (const [i, phase] of phases.entries()) {
    const { data: dbPhase, error: phaseError } = await supabase
      .from('plan_phases')
      .insert({
        plan_id: planId,
        phase_number: phase.phase_number,
        name: phase.name,
        description: phase.description,
        plain_language_summary: phase.plain_language_summary,
        estimated_duration_weeks: phase.estimated_duration_weeks,
        status: i === 0 ? 'active' : 'upcoming',
        progression_criteria: phase.progression_criteria,
        regression_criteria: phase.regression_criteria,
      })
      .select('id')
      .single();

    if (phaseError || !dbPhase) throw new Error(`Failed to insert phase ${phase.phase_number}: ${phaseError?.message}`);
    phaseIds.push(dbPhase.id as string);

    // Insert phase exercises
    for (const [ei, exercise] of phase.exercises.entries()) {
      // Try to resolve exercise by name from the library
      const { data: libExercise } = await supabase
        .from('exercises')
        .select('id')
        .ilike('name', exercise.name)
        .maybeSingle();

      const { error: exError } = await supabase.from('phase_exercises').insert({
        phase_id: dbPhase.id,
        exercise_id: libExercise?.id ?? null,
        prescribed_sets: exercise.sets,
        prescribed_reps: exercise.reps,
        load_target: exercise.load_target,
        tempo: exercise.tempo,
        rest_seconds: exercise.rest_seconds,
        order_index: ei,
        notes: exercise.notes,
      });

      if (exError) throw new Error(`Failed to insert phase_exercise: ${exError.message}`);
    }
  }

  return phaseIds;
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

  // Authenticate request
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
    // Fetch intake and status
    const [{ data: intake }, { data: status }, { data: profile }] = await Promise.all([
      supabase.from('injury_intake').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('injury_status').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).single(),
      supabase.from('profiles').select('rehab_goal').eq('user_id', user.id).single(),
    ]);

    if (!intake || !status || !profile) {
      return new Response(JSON.stringify({ error: 'Intake data not found. Please complete the intake form first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety check — check symptoms for red flags before calling LLM
    const symptomsText = `${status.current_symptoms ?? ''} ${intake.prior_treatment ?? ''} ${intake.mechanism ?? ''}`;
    const safetyFlagged = hasSafetyFlag(symptomsText);
    let safetyEventId: string | null = null;

    if (safetyFlagged) {
      const { data: safetyEvent } = await supabase
        .from('safety_events')
        .insert({
          user_id: user.id,
          trigger: 'intake_flagged',
          pain_level_reported: status.pain_level_baseline,
          details: 'Intake responses indicate symptoms that may require professional evaluation before starting a rehab program.',
          professional_care_acknowledged: false,
        })
        .select('id')
        .single();
      safetyEventId = safetyEvent?.id ?? null;
    }

    const userMessage = buildUserMessage(
      { ...intake, rehab_goal: profile.rehab_goal },
      status,
    );

    // First attempt
    let callResult = await callClaude(SYSTEM_PROMPT, userMessage);
    let parsed: GeneratePlanResponse;
    let validationError: string | null = null;

    try {
      const json = JSON.parse(callResult.content);
      parsed = validateGeneratePlanResponse(json);
    } catch (err) {
      validationError = (err as Error).message;

      // One automatic retry with error appended
      const retryMessage = `${userMessage}\n\nYour previous response failed schema validation with this error: ${validationError}\nPlease fix the JSON and try again.`;
      callResult = await callClaude(SYSTEM_PROMPT, retryMessage);

      try {
        const json = JSON.parse(callResult.content);
        parsed = validateGeneratePlanResponse(json);
        validationError = null;
      } catch (retryErr) {
        // Log failed call and return user-facing error
        await logLlmCall({
          supabase, userId: user.id, edgeFunction: 'generate-plan',
          promptVersion: PROMPT_VERSION,
          inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
          latencyMs: callResult.latencyMs, success: false,
          errorMessage: (retryErr as Error).message,
        });

        return new Response(
          JSON.stringify({
            error: 'We had trouble generating your plan. Please try again.',
            retryable: true,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Log successful call
    await logLlmCall({
      supabase, userId: user.id, edgeFunction: 'generate-plan',
      promptVersion: PROMPT_VERSION,
      inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
      latencyMs: callResult.latencyMs, success: true,
    });

    // Insert plan, phases, and exercises
    const planId = await insertPlan(supabase, user.id, parsed!, profile.rehab_goal);
    await insertPhases(supabase, planId, parsed!.phases);

    // Mark onboarding complete
    await supabase
      .from('profiles')
      .update({ onboarding_step: 'complete' })
      .eq('user_id', user.id);

    // Create first session
    const today = new Date().toISOString().split('T')[0];
    const { data: firstPhase } = await supabase
      .from('plan_phases')
      .select('id')
      .eq('plan_id', planId)
      .eq('phase_number', 1)
      .single();

    if (firstPhase) {
      await supabase.from('sessions').insert({
        user_id: user.id,
        plan_phase_id: firstPhase.id,
        scheduled_date: today,
        session_type: 'training',
        status: 'scheduled',
      });
    }

    return new Response(
      JSON.stringify({
        planId,
        safetyFlagged,
        safetyEventId,
        summary: parsed!.plain_language_summary,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('generate-plan error:', err);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', retryable: true }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
