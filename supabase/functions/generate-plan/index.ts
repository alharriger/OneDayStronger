/**
 * generate-plan edge function
 *
 * Called after the user completes intake + goal selection.
 * Loads the condition module for the user's condition, builds a templated system prompt,
 * classifies irritability deterministically, validates the LLM response
 * (including exercise library check), inserts the plan + phases + exercises,
 * then marks onboarding complete.
 *
 * One automatic retry on schema validation failure.
 * Safety check: keywords matched against condition module safety_keywords list.
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

const PROMPT_VERSION = 'generate-plan-v3';

// ─── Plan JSON schema (injected into system prompt template) ──────────────────

const PLAN_SCHEMA = `{
  "plain_language_summary": "string — 2–4 sentences describing the overall plan in plain language. Address the user directly (use 'you'). Mention the number of phases and approximate total timeline.",
  "phases": [
    {
      "phase_number": "integer starting at 1",
      "name": "string — short phase name",
      "description": "string — clinical description of this phase's focus",
      "plain_language_summary": "string — 2–3 sentences explaining this phase to the user in plain language",
      "estimated_duration_weeks": "integer — realistic minimum weeks for this phase",
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
          "reps": "string — e.g. '8–12' or '45s hold'",
          "load_target": "string — e.g. 'bodyweight', 'light resistance band'",
          "tempo": "string — e.g. '3-1-3' or 'controlled'",
          "rest_seconds": "integer",
          "notes": "string — coaching cue or empty string"
        }
      ]
    }
  ]
}`;

// ─── Safety keyword detection ─────────────────────────────────────────────────

function hasSafetyFlag(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(
  module: ConditionModule,
  irritabilityLevel: 'high' | 'moderate' | 'low',
  intake: Record<string, unknown>,
  rehabGoal: string,
): string {
  const irritabilityConfig = module.protocol.irritability_levels[irritabilityLevel];
  const startingPhaseTemplate = module.protocol.phase_templates.find(
    (pt) => pt.type === irritabilityConfig.starting_phase_type,
  ) ?? module.protocol.phase_templates[0];

  const intakeSummary = [
    `Age: ${intake.age ?? 'unknown'}`,
    `Gender: ${intake.gender ?? 'unknown'}`,
    `Rehab goal: ${rehabGoal}`,
    `Injury onset: ${intake.injury_onset_date ?? 'unknown'}`,
    `Mechanism: ${intake.mechanism ?? 'unknown'}`,
    `Prior treatment: ${intake.prior_treatment ?? 'none reported'}`,
    `Training background: ${intake.training_background ?? 'unknown'}`,
  ].join('\n');

  return renderTemplate(module.plan_system_prompt_template, {
    condition_name: module.protocol.meta.condition_name,
    condition_id: module.condition_id,
    protocol_version: module.version,
    protocol_json: JSON.stringify(module.protocol, null, 2),
    irritability_level: irritabilityLevel,
    irritability_description: irritabilityConfig.criteria_description,
    starting_phase_number: String(startingPhaseTemplate.default_number),
    starting_phase_type: startingPhaseTemplate.type,
    intake_summary: intakeSummary,
    phase_count: String(module.protocol.phase_templates.length),
    plan_schema: PLAN_SCHEMA,
  });
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function insertPlan(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planData: GeneratePlanResponse,
  rehabGoal: string,
  conditionId: string,
  protocolVersion: string,
): Promise<string> {
  const { data: plan, error } = await supabase
    .from('recovery_plans')
    .insert({
      user_id: userId,
      status: 'active',
      rehab_goal: rehabGoal,
      plain_language_summary: planData.plain_language_summary,
      prompt_version: PROMPT_VERSION,
      condition_id: conditionId,
      protocol_version: protocolVersion,
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
  // Insert all phases in parallel — they are independent of each other
  const phaseRecords = await Promise.all(
    phases.map(async (phase, i) => {
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
      return { phaseId: dbPhase.id as string, phase };
    }),
  );

  // For each phase: resolve exercise library IDs in parallel, then bulk insert all exercises
  await Promise.all(
    phaseRecords.map(async ({ phaseId, phase }) => {
      const resolvedExercises = await Promise.all(
        phase.exercises.map(async (exercise, ei) => {
          const { data: libExercise } = await supabase
            .from('exercises')
            .select('id')
            .ilike('name', exercise.name)
            .maybeSingle();

          return {
            phase_id: phaseId,
            exercise_id: libExercise?.id ?? null,
            prescribed_sets: exercise.sets,
            prescribed_reps: exercise.reps,
            load_target: exercise.load_target,
            tempo: exercise.tempo,
            rest_seconds: exercise.rest_seconds,
            order_index: ei,
            notes: exercise.notes,
          };
        }),
      );

      const { error: exError } = await supabase.from('phase_exercises').insert(resolvedExercises);
      if (exError) throw new Error(`Failed to insert phase_exercises for phase ${phaseId}: ${exError.message}`);
    }),
  );

  return phaseRecords.map((r) => r.phaseId);
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

  // condition_id defaults to 'pht' — condition selection UI is Phase 2 scope.
  // Passed in the request body to allow future multi-condition support without
  // a redeploy.
  let conditionId = 'pht';
  try {
    const body = await req.clone().json();
    if (typeof body?.conditionId === 'string' && body.conditionId.length > 0) {
      conditionId = body.conditionId;
    }
  } catch { /* no body or non-JSON — use default */ }

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
    // Load condition module + user data in parallel
    const [
      conditionModule,
      { data: intake },
      { data: status },
      { data: profile },
    ] = await Promise.all([
      loadConditionModule(supabase, conditionId),
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

    // Safety check — match against condition module keywords
    const symptomsText = `${status.current_symptoms ?? ''} ${intake.prior_treatment ?? ''} ${intake.mechanism ?? ''}`;
    const safetyFlagged = hasSafetyFlag(symptomsText, conditionModule.protocol.safety_keywords);
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

    // Classify irritability deterministically from intake data
    const irritabilityLevel: 'high' | 'moderate' | 'low' =
      (intake.irritability_level as 'high' | 'moderate' | 'low') ??
      classifyIrritability(
        status.pain_level_baseline as number ?? 5,
        false,
        1,
      );

    const systemPrompt = buildSystemPrompt(
      conditionModule,
      irritabilityLevel,
      intake,
      profile.rehab_goal ?? '',
    );

    const validExerciseNames = buildExerciseNameSet(conditionModule);

    const isMock = Deno.env.get('MOCK_LLM') === 'true';
    let parsed: GeneratePlanResponse;

    if (isMock) {
      console.log('[generate-plan] MOCK_LLM=true — using hardcoded plan');
      parsed = {
        plain_language_summary:
          'Your 3-phase PHT rehabilitation plan is designed to gradually load your hamstring tendon over approximately 16 weeks. You will start with isometric holds to reduce pain, progress to eccentric loading to rebuild tendon strength, and finish with functional movements to return to your goal activity. Work within the pain guidelines and do not rush progressions.',
        phases: [
          {
            phase_number: 1,
            name: 'Pain Management & Isometrics',
            description: 'Establish pain-free tendon loading using isometric contractions to reduce pain sensitization.',
            plain_language_summary: 'This phase uses static holds to wake up your hamstring without aggravating the tendon. Most people notice reduced pain within 2–3 weeks. Keep pain at or below 3/10 during every exercise.',
            estimated_duration_weeks: 4,
            progression_criteria: { pain_threshold: 2, load_tolerance_pct: 80, consistency_pct: 70, window_days: 14 },
            regression_criteria: { pain_consecutive_sessions: 2, missed_sessions_window: 3 },
            exercises: [
              { name: 'Isometric Hamstring Bridge', sets: 3, reps: '45s hold', load_target: 'bodyweight', tempo: 'controlled', rest_seconds: 90, notes: 'Press heel into floor, hold. Stop if pain exceeds 3/10.' },
              { name: 'Wall Sit', sets: 3, reps: '30s hold', load_target: 'bodyweight', tempo: 'controlled', rest_seconds: 60, notes: 'Keep hips at 90°. Avoid deeper flexion early on.' },
              { name: 'Prone Hip Extension', sets: 3, reps: '12', load_target: 'bodyweight', tempo: '2-1-2', rest_seconds: 60, notes: 'Squeeze glute and hamstring at top. Minimal lumbar extension.' },
              { name: 'Supine Hip Flexion Hold', sets: 3, reps: '30s hold', load_target: 'bodyweight', tempo: 'controlled', rest_seconds: 60, notes: 'Lie on back, lift knee to 90°, hold. Avoid breath holding.' },
              { name: 'Clam Shell', sets: 3, reps: '15 per side', load_target: 'light resistance band', tempo: '2-1-2', rest_seconds: 45, notes: 'Keep pelvis stable. Progress band resistance when movement feels easy.' },
            ],
          },
          {
            phase_number: 2,
            name: 'Eccentric Loading',
            description: 'Progressive eccentric hamstring loading to stimulate tendon remodelling and strength.',
            plain_language_summary: 'In this phase you will slow down the lowering part of each exercise to place a controlled load on the tendon. This is the most important phase for long-term recovery. Some discomfort (≤3/10) during exercise is acceptable as long as it settles within 24 hours.',
            estimated_duration_weeks: 6,
            progression_criteria: { pain_threshold: 3, load_tolerance_pct: 85, consistency_pct: 75, window_days: 21 },
            regression_criteria: { pain_consecutive_sessions: 2, missed_sessions_window: 4 },
            exercises: [
              { name: 'Nordic Hamstring Curl', sets: 3, reps: '6', load_target: 'bodyweight', tempo: '4-0-1', rest_seconds: 120, notes: 'Lower slowly over 4 seconds. Use hands to return if needed.' },
              { name: 'Single-Leg Romanian Deadlift', sets: 3, reps: '8–10', load_target: 'light resistance band', tempo: '3-1-2', rest_seconds: 90, notes: 'Hinge at hip, keep spine neutral. Limit forward lean initially.' },
              { name: 'Isometric Hamstring Bridge', sets: 2, reps: '30s hold', load_target: 'bodyweight', tempo: 'controlled', rest_seconds: 60, notes: 'Used as warm-up before eccentric work.' },
              { name: 'Seated Hip Hinge', sets: 3, reps: '10', load_target: 'bodyweight', tempo: '3-1-2', rest_seconds: 75, notes: 'Sit at edge of chair. Lean forward from hip, not waist. Feel stretch at hamstring attachment.' },
              { name: 'Step-Up', sets: 3, reps: '10 per leg', load_target: 'bodyweight', tempo: '2-1-2', rest_seconds: 60, notes: 'Use a low step initially (20 cm). Drive through heel of the front foot.' },
            ],
          },
          {
            phase_number: 3,
            name: 'Functional Strengthening',
            description: 'Sport-specific and daily-life loading patterns to prepare for return to goal activity.',
            plain_language_summary: 'The final phase bridges the gap between rehab exercises and your everyday activities or sport. You will add speed, load, and complexity. Progress only when pain stays below 3/10 and you feel confident in the movements.',
            estimated_duration_weeks: 6,
            progression_criteria: { pain_threshold: 3, load_tolerance_pct: 90, consistency_pct: 80, window_days: 21 },
            regression_criteria: { pain_consecutive_sessions: 3, missed_sessions_window: 4 },
            exercises: [
              { name: 'Deadlift', sets: 3, reps: '8', load_target: '30% bodyweight', tempo: '2-1-2', rest_seconds: 120, notes: 'Add load gradually. Stop if pain exceeds 3/10.' },
              { name: 'Single-Leg Romanian Deadlift', sets: 3, reps: '10–12', load_target: '20% bodyweight', tempo: '3-1-2', rest_seconds: 90, notes: 'Progress to dumbbell or kettlebell.' },
              { name: 'Walking Lunge', sets: 3, reps: '10 per leg', load_target: 'bodyweight', tempo: 'controlled', rest_seconds: 75, notes: 'Keep torso upright and avoid deep hip flexion if painful.' },
              { name: 'Nordic Hamstring Curl', sets: 4, reps: '8', load_target: 'bodyweight', tempo: '4-0-1', rest_seconds: 120, notes: 'Progress from Phase 2. Aim for full range without hand support.' },
              { name: 'Sprint Drill — A-March', sets: 3, reps: '20m', load_target: 'bodyweight', tempo: 'controlled', rest_seconds: 60, notes: 'High knee drive. Pain must stay below 3/10 throughout.' },
            ],
          },
        ],
      };
      await logLlmCall({
        supabase, userId: user.id, edgeFunction: 'generate-plan',
        promptVersion: `${PROMPT_VERSION}-mock`,
        inputTokens: 0, outputTokens: 0,
        latencyMs: 0, success: true,
      });
    } else {
      const userMessage = 'Generate the rehabilitation plan now.';

      // First attempt — retry once after 8s if both providers fail (gives Groq RPM window time to clear)
      let callResult: Awaited<ReturnType<typeof callLLM>>;
      try {
        callResult = await callLLM(systemPrompt, userMessage);
      } catch (llmErr) {
        console.warn('[generate-plan] LLM first attempt failed, retrying in 8s:', (llmErr as Error).message);
        await new Promise((resolve) => setTimeout(resolve, 8000));
        try {
          callResult = await callLLM(systemPrompt, userMessage);
        } catch (retryLlmErr) {
          await logLlmCall({
            supabase, userId: user.id, edgeFunction: 'generate-plan',
            promptVersion: PROMPT_VERSION,
            inputTokens: 0, outputTokens: 0,
            latencyMs: 0, success: false,
            errorMessage: `Both providers failed after retry: ${(retryLlmErr as Error).message}`,
          });
          return new Response(
            JSON.stringify({
              error: 'We had trouble reaching our AI service. Please try again in a moment.',
              retryable: true,
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
      let validationError: string | null = null;

      try {
        const json = JSON.parse(callResult.content);
        parsed = validateGeneratePlanResponse(json, validExerciseNames);
      } catch (err) {
        validationError = (err as Error).message;

        const retryMessage = `Your previous response failed schema validation with this error: ${validationError}\nPlease fix the JSON and try again.`;
        callResult = await callLLM(systemPrompt, retryMessage);

        try {
          const json = JSON.parse(callResult.content);
          parsed = validateGeneratePlanResponse(json, validExerciseNames);
          validationError = null;
        } catch (retryErr) {
          await logLlmCall({
            supabase, userId: user.id, edgeFunction: 'generate-plan',
            promptVersion: PROMPT_VERSION,
            inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
            latencyMs: callResult.latencyMs, success: false,
            errorMessage: (retryErr as Error).message,
          });

          return new Response(
            JSON.stringify({ error: 'We had trouble generating your plan. Please try again.', retryable: true }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      await logLlmCall({
        supabase, userId: user.id, edgeFunction: 'generate-plan',
        promptVersion: PROMPT_VERSION,
        inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
        latencyMs: callResult.latencyMs, success: true,
      });
    }

    const planId = await insertPlan(
      supabase, user.id, parsed!, profile.rehab_goal,
      conditionModule.condition_id, conditionModule.version,
    );
    await insertPhases(supabase, planId, parsed!.phases);

    await supabase.from('profiles').update({ onboarding_step: 'complete' }).eq('user_id', user.id);

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
      JSON.stringify({ planId, safetyFlagged, safetyEventId, summary: parsed!.plain_language_summary }),
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
