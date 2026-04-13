/**
 * revise-plan edge function
 *
 * Triggered from the profile screen when the user's injury status changes
 * meaningfully (pain baseline shifts ≥ 2 points). Generates a revised plan
 * for the remaining phases and supersedes the old plan.
 *
 * Body: {
 *   injuryStatus: {
 *     pain_level_baseline: number;
 *     current_symptoms: string;
 *     last_flare_date: string | null;
 *   }
 * }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callClaude } from '../_shared/claude.ts';
import { logLlmCall } from '../_shared/llm_logger.ts';
import { validateGeneratePlanResponse, type GeneratePlanResponse, type PlanPhase } from '../_shared/validation.ts';

const PROMPT_VERSION = 'revise-plan-v1';

// ─── System prompt (shared with generate-plan) ────────────────────────────────

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

Generate 2–5 phases. Each phase must have 3–6 exercises.`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildReviseUserMessage(params: {
  intake: Record<string, unknown>;
  originalSummary: string;
  currentPhaseNumber: number;
  totalPhases: number;
  currentPhaseName: string;
  completedPhaseNumbers: number[];
  newStatus: { pain_level_baseline: number; current_symptoms: string; last_flare_date: string | null };
}): string {
  const {
    intake, originalSummary, currentPhaseNumber, totalPhases,
    currentPhaseName, completedPhaseNumbers, newStatus,
  } = params;

  const completedStr = completedPhaseNumbers.length > 0
    ? completedPhaseNumbers.join(', ')
    : 'None';

  return `A user's injury status has changed. Revise their rehabilitation plan accordingly.

Original intake:
  Age: ${intake.age ?? 'unknown'}
  Gender: ${intake.gender ?? 'unknown'}
  Injury onset date: ${intake.injury_onset_date ?? 'unknown'}
  Mechanism: ${intake.mechanism ?? 'unknown'}
  Prior treatment: ${intake.prior_treatment ?? 'none reported'}
  Irritability level: ${intake.irritability_level ?? 'unknown'}
  Training background: ${intake.training_background ?? 'unknown'}

Original plan summary:
${originalSummary}

Current phase (${currentPhaseNumber} of ${totalPhases}): ${currentPhaseName}
Completed phases: ${completedStr}

Updated injury status:
  New pain baseline: ${newStatus.pain_level_baseline}/10
  Current symptoms: ${newStatus.current_symptoms || 'none reported'}
  Last flare date: ${newStatus.last_flare_date ?? 'not reported'}

Generate a revised plan. If the user has already completed phases, do not regenerate those phases — start the revised plan from the current phase onward. Adjust phase parameters based on the new status. The first phase in your response corresponds to the user's current phase (phase ${currentPhaseNumber}).`;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function insertRevisedPhases(
  supabase: ReturnType<typeof createClient>,
  planId: string,
  phases: PlanPhase[],
): Promise<void> {
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
        started_at: i === 0 ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (phaseError || !dbPhase) {
      throw new Error(`Failed to insert revised phase ${phase.phase_number}: ${phaseError?.message}`);
    }

    for (const [ei, exercise] of phase.exercises.entries()) {
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
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let injuryStatus: { pain_level_baseline: number; current_symptoms: string; last_flare_date: string | null };
  try {
    const body = await req.json();
    injuryStatus = body.injuryStatus;
    if (!injuryStatus || typeof injuryStatus.pain_level_baseline !== 'number') {
      throw new Error('Missing required injuryStatus fields');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // ── Fetch existing plan + phases + intake ────────────────────────────────
    const [{ data: plan }, { data: intake }] = await Promise.all([
      supabase
        .from('recovery_plans')
        .select('id, plain_language_summary')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('injury_intake')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!plan) {
      return new Response(JSON.stringify({ error: 'No active plan to revise.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: phases } = await supabase
      .from('plan_phases')
      .select('id, phase_number, name, status')
      .eq('plan_id', plan.id)
      .order('phase_number', { ascending: true });

    const allPhases = phases ?? [];
    const activePhase = allPhases.find((p: { status: string }) => p.status === 'active') ?? allPhases[0];
    const completedPhases = allPhases.filter(
      (p: { status: string; phase_number: number }) => p.status === 'completed'
    );
    const completedPhaseNumbers = completedPhases.map((p: { phase_number: number }) => p.phase_number);

    // ── Build prompt ───────────────────────────────────────────────────────
    const userMessage = buildReviseUserMessage({
      intake: intake ?? {},
      originalSummary: plan.plain_language_summary ?? 'No summary available.',
      currentPhaseNumber: activePhase?.phase_number ?? 1,
      totalPhases: allPhases.length,
      currentPhaseName: activePhase?.name ?? 'Unknown',
      completedPhaseNumbers,
      newStatus: injuryStatus,
    });

    // ── Call Claude (one retry on schema failure) ──────────────────────────
    let callResult = await callClaude(SYSTEM_PROMPT, userMessage);
    let parsed: GeneratePlanResponse;
    let validationError: string | null = null;

    try {
      const json = JSON.parse(callResult.content);
      parsed = validateGeneratePlanResponse(json);
    } catch (err) {
      validationError = (err as Error).message;
      const retryMessage = `${userMessage}\n\nYour previous response failed schema validation: ${validationError}\nPlease fix the JSON and try again.`;
      callResult = await callClaude(SYSTEM_PROMPT, retryMessage);

      try {
        const json = JSON.parse(callResult.content);
        parsed = validateGeneratePlanResponse(json);
        validationError = null;
      } catch (retryErr) {
        await logLlmCall({
          supabase, userId: user.id, edgeFunction: 'revise-plan',
          promptVersion: PROMPT_VERSION,
          inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
          latencyMs: callResult.latencyMs, success: false,
          errorMessage: (retryErr as Error).message,
        });

        return new Response(
          JSON.stringify({
            error: 'We had trouble revising your plan. Your current plan is still active. Please try again.',
            retryable: true,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    await logLlmCall({
      supabase, userId: user.id, edgeFunction: 'revise-plan',
      promptVersion: PROMPT_VERSION,
      inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
      latencyMs: callResult.latencyMs, success: true,
    });

    // ── Insert new plan ────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('rehab_goal')
      .eq('user_id', user.id)
      .single();

    const { data: newPlan, error: planError } = await supabase
      .from('recovery_plans')
      .insert({
        user_id: user.id,
        status: 'active',
        rehab_goal: profile?.rehab_goal ?? null,
        plain_language_summary: parsed!.plain_language_summary,
        prompt_version: PROMPT_VERSION,
      })
      .select('id')
      .single();

    if (planError || !newPlan) {
      throw new Error(`Failed to insert revised plan: ${planError?.message}`);
    }

    await insertRevisedPhases(supabase, newPlan.id, parsed!.phases);

    // ── Supersede old plan (only after new plan is fully written) ──────────
    await supabase
      .from('recovery_plans')
      .update({ status: 'superseded' })
      .eq('id', plan.id);

    // ── Record the revision event ──────────────────────────────────────────
    await supabase.from('plan_evolution_events').insert({
      user_id: user.id,
      plan_id: newPlan.id,
      from_phase_id: activePhase?.id ?? null,
      to_phase_id: null,
      workout_log_id: null,
      event_type: 'plan_revised',
      rationale: `Plan revised due to updated injury status (pain baseline: ${injuryStatus.pain_level_baseline}/10).`,
      triggered_by: 'user_initiated',
      seen: false,
    });

    return new Response(
      JSON.stringify({ planId: newPlan.id, summary: parsed!.plain_language_summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('revise-plan error:', err);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Your current plan is still active.', retryable: true }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
