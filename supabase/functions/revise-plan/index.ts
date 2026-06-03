/**
 * revise-plan edge function
 *
 * Triggered from the profile screen when the user's injury status changes
 * meaningfully (pain baseline shifts ≥ 2 points). Generates a revised plan
 * for the remaining phases and supersedes the old plan.
 *
 * RAG removed — clinical context comes from the condition module loaded from DB.
 * Protocol version is preserved from the original plan so mid-journey users
 * stay on the protocol they started with until explicitly re-assessed.
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
import { callLLM } from '../_shared/llm.ts';
import { logLlmCall } from '../_shared/llm_logger.ts';
import {
  validateGeneratePlanResponse,
  type GeneratePlanResponse,
  type PlanPhase,
} from '../_shared/validation.ts';
import {
  loadConditionModule,
  buildExerciseNameSet,
  renderTemplate,
  type ConditionModule,
} from '../_shared/conditionModule.ts';
import { classifyIrritability } from '../_shared/irritability.ts';

const PROMPT_VERSION = 'revise-plan-v2';

// ─── Plan JSON schema (same as generate-plan) ─────────────────────────────────

const PLAN_SCHEMA = `{
  "plain_language_summary": "string — 2–4 sentences describing the revised plan in plain language. Address the user directly. Acknowledge the change in their status.",
  "phases": [
    {
      "phase_number": "integer — start from the user's current phase number",
      "name": "string",
      "description": "string — clinical description of this phase's focus",
      "plain_language_summary": "string — 2–3 sentences explaining this phase to the user",
      "estimated_duration_weeks": "integer 1–26",
      "progression_criteria": {
        "pain_threshold": "integer 0–4",
        "load_tolerance_pct": "integer 50–100",
        "consistency_pct": "integer 60–100",
        "window_days": "integer 7–30"
      },
      "regression_criteria": {
        "pain_consecutive_sessions": "integer 2–4",
        "missed_sessions_window": "integer 1–10"
      },
      "exercises": [
        {
          "name": "string — must exactly match an id or name from the exercise_library above",
          "sets": "integer",
          "reps": "string",
          "load_target": "string",
          "tempo": "string",
          "rest_seconds": "integer",
          "notes": "string"
        }
      ]
    }
  ]
}`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(
  module: ConditionModule,
  conditionId: string,
  protocolVersion: string,
  irritabilityLevel: 'high' | 'moderate' | 'low',
  intake: Record<string, unknown>,
  originalSummary: string,
  currentPhaseNumber: number,
  totalPhases: number,
  currentPhaseName: string,
  completedPhaseNumbers: number[],
  newStatus: { pain_level_baseline: number; current_symptoms: string; last_flare_date: string | null },
  schedulingContext: string,
): string {
  const irritabilityConfig = module.protocol.irritability_levels[irritabilityLevel];
  const startingPhaseTemplate = module.protocol.phase_templates.find(
    (pt) => pt.type === irritabilityConfig.starting_phase_type,
  ) ?? module.protocol.phase_templates[0];

  const completedStr = completedPhaseNumbers.length > 0 ? completedPhaseNumbers.join(', ') : 'None';

  const intakeSummary = [
    `Age: ${intake.age ?? 'unknown'}`,
    `Gender: ${intake.gender ?? 'unknown'}`,
    `Injury onset: ${intake.injury_onset_date ?? 'unknown'}`,
    `Mechanism: ${intake.mechanism ?? 'unknown'}`,
    `Prior treatment: ${intake.prior_treatment ?? 'none reported'}`,
    `Training background: ${intake.training_background ?? 'unknown'}`,
    ``,
    `Original plan summary: ${originalSummary}`,
    `Current phase (${currentPhaseNumber} of ${totalPhases}): ${currentPhaseName}`,
    `Completed phases: ${completedStr}`,
    ``,
    `Updated status — new pain baseline: ${newStatus.pain_level_baseline}/10`,
    `Current symptoms: ${newStatus.current_symptoms || 'none reported'}`,
    `Last flare: ${newStatus.last_flare_date ?? 'not reported'}`,
    ``,
    `INSTRUCTION: Generate revised phases starting from phase ${currentPhaseNumber}. Do not regenerate completed phases. Adjust parameters for the updated status.`,
  ].join('\n');

  return renderTemplate(module.plan_system_prompt_template, {
    condition_name: module.protocol.meta.condition_name,
    condition_id: conditionId,
    protocol_version: protocolVersion,
    protocol_json: JSON.stringify(module.protocol, null, 2),
    irritability_level: irritabilityLevel,
    irritability_description: irritabilityConfig.criteria_description,
    starting_phase_number: String(startingPhaseTemplate.default_number),
    starting_phase_type: startingPhaseTemplate.type,
    intake_summary: intakeSummary,
    phase_count: String(totalPhases - completedPhaseNumbers.length),
    plan_schema: PLAN_SCHEMA,
    scheduling_context: schedulingContext,
  });
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function buildExerciseDisplayNameMap(
  library: Array<{ id: string; name: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of library) {
    map.set(entry.id, entry.name);
    map.set(entry.name, entry.name);
  }
  return map;
}

async function insertRevisedPhases(
  supabase: ReturnType<typeof createClient>,
  planId: string,
  phases: PlanPhase[],
  exerciseLibrary: Array<{ id: string; name: string }>,
): Promise<string | null> {
  const displayNames = buildExerciseDisplayNameMap(exerciseLibrary);
  let firstActivePhaseId: string | null = null;

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

    if (i === 0) firstActivePhaseId = dbPhase.id as string;

    const exerciseRows = phase.exercises.map((exercise, ei) => ({
      phase_id: dbPhase.id,
      exercise_id: null,
      name: displayNames.get(exercise.name) ?? exercise.name,
      prescribed_sets: exercise.sets,
      prescribed_reps: exercise.reps,
      load_target: exercise.load_target,
      tempo: exercise.tempo,
      rest_seconds: exercise.rest_seconds,
      order_index: ei,
      notes: exercise.notes,
    }));

    if (exerciseRows.length > 0) {
      const { error: exError } = await supabase.from('phase_exercises').insert(exerciseRows);
      if (exError) throw new Error(`Failed to insert phase_exercises: ${exError.message}`);
    }
  }

  return firstActivePhaseId;
}

async function copyCompletedPhases(
  supabase: ReturnType<typeof createClient>,
  newPlanId: string,
  completedPhases: Array<Record<string, unknown>>,
): Promise<void> {
  for (const phase of completedPhases) {
    const { data: newPhase, error: phaseError } = await supabase
      .from('plan_phases')
      .insert({
        plan_id: newPlanId,
        phase_number: phase.phase_number,
        name: phase.name,
        description: phase.description,
        plain_language_summary: phase.plain_language_summary,
        estimated_duration_weeks: phase.estimated_duration_weeks,
        status: 'completed',
        progression_criteria: phase.progression_criteria,
        regression_criteria: phase.regression_criteria,
        started_at: phase.started_at,
        completed_at: phase.completed_at,
      })
      .select('id')
      .single();

    if (phaseError || !newPhase) {
      throw new Error(`Failed to copy completed phase ${phase.phase_number}: ${phaseError?.message}`);
    }

    const { data: exercises } = await supabase
      .from('phase_exercises')
      .select('name, prescribed_sets, prescribed_reps, load_target, tempo, rest_seconds, order_index, notes')
      .eq('phase_id', phase.id as string)
      .order('order_index');

    if (exercises && exercises.length > 0) {
      const exerciseRows = exercises.map((e: Record<string, unknown>) => ({
        phase_id: newPhase.id,
        exercise_id: null,
        name: e.name,
        prescribed_sets: e.prescribed_sets,
        prescribed_reps: e.prescribed_reps,
        load_target: e.load_target,
        tempo: e.tempo,
        rest_seconds: e.rest_seconds,
        order_index: e.order_index,
        notes: e.notes,
      }));
      const { error: exError } = await supabase.from('phase_exercises').insert(exerciseRows);
      if (exError) throw new Error(`Failed to copy exercises for completed phase ${phase.phase_number}: ${exError.message}`);
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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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
    const [{ data: plan }, { data: intake }] = await Promise.all([
      supabase
        .from('recovery_plans')
        .select('id, plain_language_summary, condition_id, protocol_version')
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

    const conditionId = (plan.condition_id as string) ?? 'pht';
    const protocolVersion = (plan.protocol_version as string) ?? '1.0';

    const [conditionModule, { data: phases }] = await Promise.all([
      loadConditionModule(supabase, conditionId),
      supabase
        .from('plan_phases')
        .select('id, phase_number, name, description, plain_language_summary, estimated_duration_weeks, status, progression_criteria, regression_criteria, started_at, completed_at')
        .eq('plan_id', plan.id)
        .order('phase_number', { ascending: true }),
    ]);

    const validExerciseNames = buildExerciseNameSet(conditionModule);

    const allPhases = phases ?? [];
    const activePhase = allPhases.find((p: { status: string }) => p.status === 'active') ?? allPhases[0];
    const completedPhases = allPhases.filter((p: { status: string }) => p.status === 'completed');
    const completedPhaseNumbers = completedPhases.map((p: { phase_number: number }) => p.phase_number);

    // Classify irritability from updated status
    const irritabilityLevel = classifyIrritability(
      injuryStatus.pain_level_baseline,
      false,
      1,
    );

    const schedulingContext = (() => {
      const now = new Date();
      const h = now.getHours();
      const day = now.toLocaleDateString('en-US', { weekday: 'long' });
      const date = now.toISOString().split('T')[0];
      const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
      return `${day}, ${date} (${time})`;
    })();

    const systemPrompt = buildSystemPrompt(
      conditionModule,
      conditionId,
      protocolVersion,
      irritabilityLevel,
      intake ?? {},
      plan.plain_language_summary ?? 'No summary available.',
      activePhase?.phase_number ?? 1,
      allPhases.length,
      activePhase?.name ?? 'Unknown',
      completedPhaseNumbers,
      injuryStatus,
      schedulingContext,
    );

    const isMock = Deno.env.get('MOCK_LLM') === 'true';
    let parsed: GeneratePlanResponse;

    if (isMock) {
      console.log('[revise-plan] MOCK_LLM=true — returning mock revised plan');
      // Carry exercises forward from original phases so generate-workout has data to work with
      const upcomingPhases = allPhases.filter((p: { status: string }) => p.status === 'active' || p.status === 'upcoming');

      const phasesWithExercises = await Promise.all(
        upcomingPhases.map(async (p: Record<string, unknown>) => {
          const { data: exRows } = await supabase
            .from('phase_exercises')
            .select('name, prescribed_sets, prescribed_reps, load_target, tempo, rest_seconds, notes')
            .eq('phase_id', p.id as string)
            .order('order_index');

          return {
            phase_number: p.phase_number as number,
            name: p.name as string,
            description: (p.description as string) ?? '',
            plain_language_summary: (p.plain_language_summary as string) ?? '',
            estimated_duration_weeks: (p.estimated_duration_weeks as number) ?? 4,
            progression_criteria: (p.progression_criteria as GeneratePlanResponse['phases'][0]['progression_criteria']) ?? { pain_threshold: 3, load_tolerance_pct: 80, consistency_pct: 70, window_days: 14 },
            regression_criteria: (p.regression_criteria as GeneratePlanResponse['phases'][0]['regression_criteria']) ?? { pain_consecutive_sessions: 2, missed_sessions_window: 4 },
            exercises: (exRows ?? []).map((e: Record<string, unknown>) => ({
              name: e.name as string,
              sets: e.prescribed_sets as number,
              reps: e.prescribed_reps as string,
              load_target: (e.load_target as string) ?? 'bodyweight',
              tempo: (e.tempo as string) ?? 'controlled',
              rest_seconds: e.rest_seconds as number,
              notes: (e.notes as string) ?? '',
            })),
          };
        })
      );

      parsed = {
        plain_language_summary: `[Mock revision] Your plan has been updated to reflect your new pain baseline of ${injuryStatus.pain_level_baseline}/10. Continuing from Phase ${activePhase?.phase_number ?? 1}.`,
        phases: phasesWithExercises.length > 0 ? phasesWithExercises : [{
          phase_number: activePhase?.phase_number ?? 1,
          name: activePhase?.name ?? 'Current Phase',
          description: 'Mock revised phase',
          plain_language_summary: 'Mock revised phase for development.',
          estimated_duration_weeks: 4,
          progression_criteria: { pain_threshold: 3, load_tolerance_pct: 80, consistency_pct: 70, window_days: 14 },
          regression_criteria: { pain_consecutive_sessions: 2, missed_sessions_window: 4 },
          exercises: [],
        }],
      };
      await logLlmCall({
        supabase, userId: user.id, edgeFunction: 'revise-plan',
        promptVersion: `${PROMPT_VERSION}-mock`,
        inputTokens: 0, outputTokens: 0, latencyMs: 0, success: true,
      });
    } else {

      const userMessage = 'Generate the revised rehabilitation plan now.';

      let callResult: Awaited<ReturnType<typeof callLLM>>;
      try {
        callResult = await callLLM(systemPrompt, userMessage);
      } catch (llmErr) {
        console.warn('[revise-plan] LLM first attempt failed, retrying in 4s:', (llmErr as Error).message);
        await new Promise((resolve) => setTimeout(resolve, 4000));
        try {
          callResult = await callLLM(systemPrompt, userMessage);
        } catch (retryErr) {
          await logLlmCall({
            supabase, userId: user.id, edgeFunction: 'revise-plan',
            promptVersion: PROMPT_VERSION,
            inputTokens: 0, outputTokens: 0, latencyMs: 0,
            success: false,
            errorMessage: `Both LLM attempts failed. First: ${(llmErr as Error).message}. Retry: ${(retryErr as Error).message}`,
          });
          return new Response(
            JSON.stringify({
              error: 'We had trouble revising your plan. Your current plan is still active. Please try again.',
              retryable: true,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
      let validationError: string | null = null;

      try {
        const json = JSON.parse(callResult.content);
        parsed = validateGeneratePlanResponse(json, validExerciseNames);
      } catch (err) {
        validationError = (err as Error).message;
        const retryMessage = `Your previous response failed schema validation: ${validationError}\nPlease fix the JSON and try again.`;
        callResult = await callLLM(systemPrompt, retryMessage);

        try {
          const json = JSON.parse(callResult.content);
          parsed = validateGeneratePlanResponse(json, validExerciseNames);
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
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      await logLlmCall({
        supabase, userId: user.id, edgeFunction: 'revise-plan',
        promptVersion: PROMPT_VERSION,
        inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
        latencyMs: callResult.latencyMs, success: true,
      });
    } // end else (MOCK_LLM=false)

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
        condition_id: conditionId,
        protocol_version: protocolVersion,
      })
      .select('id')
      .single();

    if (planError || !newPlan) {
      throw new Error(`Failed to insert revised plan: ${planError?.message}`);
    }

    // Copy completed phases from old plan into new plan so history is preserved
    if (completedPhases.length > 0) {
      await copyCompletedPhases(supabase, newPlan.id, completedPhases as Array<Record<string, unknown>>);
    }

    const newActivePhaseId = await insertRevisedPhases(
      supabase, newPlan.id, parsed!.phases, conditionModule.protocol.exercise_library,
    );

    // Supersede old plan only after new plan is fully written
    await supabase.from('recovery_plans').update({ status: 'superseded' }).eq('id', plan.id);

    // Update today's session to the new active phase and clear today's generated
    // workout — the Today screen will auto-regenerate it using the existing check-in.
    // The check-in is preserved so today's pain data informs the new workout.
    if (newActivePhaseId) {
      const today = new Date().toISOString().split('T')[0];
      const { data: todaySession } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('scheduled_date', today)
        .limit(1)
        .maybeSingle();

      if (todaySession) {
        await supabase
          .from('sessions')
          .update({ plan_phase_id: newActivePhaseId })
          .eq('id', todaySession.id);
        await supabase
          .from('generated_workouts')
          .delete()
          .eq('session_id', todaySession.id);
      }
    }

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('revise-plan error:', err);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Your current plan is still active.', retryable: true }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
