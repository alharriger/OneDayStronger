/**
 * evolve-plan edge function
 *
 * Called fire-and-forget from useWorkoutLogging after a workout log is saved.
 * Evaluates the current plan phase against progression/regression criteria and
 * either advances, regresses, holds, or does nothing.
 *
 * Body: { sessionId: string; workoutLogId: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { evaluatePlanProgress } from './evaluator.ts';

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
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
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
  let sessionId: string;
  let workoutLogId: string;
  try {
    const body = await req.json();
    sessionId = body.sessionId;
    workoutLogId = body.workoutLogId;
    if (!sessionId || !workoutLogId) throw new Error('Missing required fields');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Fetch active plan + phase ──────────────────────────────────────────────
  const { data: plan } = await supabase
    .from('recovery_plans')
    .select('id, user_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!plan) {
    return new Response(JSON.stringify({ decision: 'continue', reason: 'No active plan' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: activePhase } = await supabase
    .from('plan_phases')
    .select('*')
    .eq('plan_id', plan.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!activePhase) {
    return new Response(JSON.stringify({ decision: 'continue', reason: 'No active phase' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Extract criteria (stored as JSON in DB)
  const progressionCriteria = activePhase.progression_criteria as {
    pain_threshold: number;
    load_tolerance_pct: number;
    consistency_pct: number;
    window_days: number;
  };
  const regressionCriteria = activePhase.regression_criteria as {
    pain_consecutive_sessions: number;
    missed_sessions_window: number;
  };

  const windowDays = progressionCriteria.window_days ?? 14;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartDate = windowStart.toISOString().split('T')[0];

  // ── Fetch data for evaluation ──────────────────────────────────────────────

  // Check-ins in window
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('pain_level, checked_in_at')
    .eq('user_id', user.id)
    .gte('checked_in_at', windowStart.toISOString())
    .order('checked_in_at', { ascending: false });

  // Sessions for this plan phase in window
  const { data: sessions } = await supabase
    .from('sessions')
    .select('status, scheduled_date')
    .eq('user_id', user.id)
    .eq('plan_phase_id', activePhase.id)
    .gte('scheduled_date', windowStartDate)
    .order('scheduled_date', { ascending: false });

  // Phase exercises (prescription)
  const { data: phaseExercises } = await supabase
    .from('phase_exercises')
    .select('prescribed_sets')
    .eq('phase_id', activePhase.id);

  // Workout logs for sessions in window → exercise logs
  const sessionIds = (sessions ?? []).map((s: { status: string; scheduled_date: string } & { id?: string }) => s).filter((s) => (s as Record<string, unknown>).id).map((s) => (s as Record<string, unknown>).id as string);

  let exerciseLogs: Array<{ sets_completed: number | null }> = [];
  if (sessionIds.length > 0) {
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select('id')
      .in('session_id', sessionIds);

    const workoutLogIds = (workoutLogs ?? []).map((w: { id: string }) => w.id);
    if (workoutLogIds.length > 0) {
      const { data: exLogs } = await supabase
        .from('exercise_logs')
        .select('sets_completed')
        .in('workout_log_id', workoutLogIds);
      exerciseLogs = exLogs ?? [];
    }
  }

  // ── Evaluate ───────────────────────────────────────────────────────────────
  const result = evaluatePlanProgress({
    windowStartDate,
    progressionCriteria,
    regressionCriteria,
    recentCheckIns: (checkIns ?? []).map((c: { pain_level: number; checked_in_at: string }) => ({
      pain_level: c.pain_level,
      checked_in_at: c.checked_in_at,
    })),
    sessions: (sessions ?? []).map((s: { status: string; scheduled_date: string }) => ({
      status: s.status as 'completed' | 'skipped' | 'scheduled' | 'rest_day',
      scheduled_date: s.scheduled_date,
    })),
    exerciseLogs,
    phaseExercises: (phaseExercises ?? []).map((e: { prescribed_sets: number | null }) => ({
      prescribed_sets: e.prescribed_sets,
    })),
  });

  // ── continue: do nothing ───────────────────────────────────────────────────
  if (result.decision === 'continue') {
    return new Response(JSON.stringify({ decision: 'continue', rationale: result.rationale }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Fetch all phases for phase transitions ─────────────────────────────────
  const { data: allPhases } = await supabase
    .from('plan_phases')
    .select('id, phase_number, status')
    .eq('plan_id', plan.id)
    .order('phase_number', { ascending: true });

  const phases = allPhases ?? [];
  const currentIdx = phases.findIndex((p: { id: string }) => p.id === activePhase.id);

  let eventId: string | null = null;

  // ── progress ───────────────────────────────────────────────────────────────
  if (result.decision === 'progress') {
    const nextPhase = phases[currentIdx + 1];

    if (!nextPhase) {
      // Final phase completed — mark plan complete
      await supabase
        .from('recovery_plans')
        .update({ status: 'completed' })
        .eq('id', plan.id);

      await supabase
        .from('plan_phases')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', activePhase.id);
    } else {
      // Advance to next phase
      await supabase
        .from('plan_phases')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', activePhase.id);

      await supabase
        .from('plan_phases')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', nextPhase.id);
    }

    const { data: event } = await supabase
      .from('plan_evolution_events')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        from_phase_id: activePhase.id,
        to_phase_id: nextPhase?.id ?? null,
        workout_log_id: workoutLogId,
        event_type: 'progression',
        rationale: result.rationale,
        triggered_by: 'auto',
        seen: false,
      })
      .select('id')
      .single();

    eventId = event?.id ?? null;
  }

  // ── regress ────────────────────────────────────────────────────────────────
  if (result.decision === 'regress') {
    const prevPhase = currentIdx > 0 ? phases[currentIdx - 1] : null;

    if (prevPhase) {
      await supabase
        .from('plan_phases')
        .update({ status: 'regressed_from' })
        .eq('id', activePhase.id);

      await supabase
        .from('plan_phases')
        .update({ status: 'active', started_at: new Date().toISOString(), completed_at: null })
        .eq('id', prevPhase.id);
    }
    // If already on phase 1, just insert the event without changing phases

    const { data: event } = await supabase
      .from('plan_evolution_events')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        from_phase_id: activePhase.id,
        to_phase_id: prevPhase?.id ?? null,
        workout_log_id: workoutLogId,
        event_type: 'regression',
        rationale: result.rationale,
        triggered_by: 'auto',
        seen: false,
      })
      .select('id')
      .single();

    eventId = event?.id ?? null;
  }

  // ── hold ───────────────────────────────────────────────────────────────────
  if (result.decision === 'hold') {
    const { data: event } = await supabase
      .from('plan_evolution_events')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        from_phase_id: activePhase.id,
        to_phase_id: null,
        workout_log_id: workoutLogId,
        event_type: 'hold',
        rationale: result.rationale,
        triggered_by: 'auto',
        seen: false,
      })
      .select('id')
      .single();

    eventId = event?.id ?? null;
  }

  return new Response(
    JSON.stringify({ decision: result.decision, rationale: result.rationale, eventId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
