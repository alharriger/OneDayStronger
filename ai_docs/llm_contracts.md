# LLM Contracts

This document is the source of truth for every LLM call in One Day Stronger. It covers:
- The edge function that owns the call
- The prompt template and version
- The Zod validation schema
- Eval cases that cover the expected output range
- Known edge cases and how they're handled

All schemas must be validated before any database write. On schema validation failure: one automatic retry with the error appended to the prompt. On second failure: return a user-facing error with retry option.

---

## 1. `generate-plan-v1`

**Edge function:** `generate-plan`
**Prompt version:** `generate-plan-v1`
**Model:** `APP_ENV=dev` → `claude-haiku-4-5-20251001`, `APP_ENV=prod` → `claude-sonnet-4-6`

### Prompt Template

```
SYSTEM:
You are a physical therapist's clinical assistant helping design a Proximal Hamstring Tendinopathy (PHT) rehabilitation plan. This plan is for an educational tool — you are not providing medical advice, and the user is encouraged to work with a healthcare professional.

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

Generate a plan with 3–5 phases. Each phase must have 3–6 exercises. Total estimated duration should be 12–24 weeks.

USER:
Generate a PHT rehabilitation plan for a user with the following profile:

Age: {{age}}
Gender: {{gender}}
Rehab goal: {{rehab_goal}}
Injury onset date: {{injury_onset_date}}
Mechanism: {{mechanism}}
Prior treatment: {{prior_treatment}}
Irritability level: {{irritability_level}}
Training background: {{training_background}}
Current pain baseline (0–10): {{pain_level_baseline}}
Current symptoms: {{current_symptoms}}
```

### Zod Schema

```typescript
import { z } from 'zod';

const ProgressionCriteriaSchema = z.object({
  pain_threshold: z.number().int().min(0).max(4),
  load_tolerance_pct: z.number().int().min(50).max(100),
  consistency_pct: z.number().int().min(60).max(100),
  window_days: z.number().int().min(7).max(30),
});

const RegressionCriteriaSchema = z.object({
  pain_consecutive_sessions: z.number().int().min(2).max(4),
  missed_sessions_window: z.number().int().min(1).max(10),
});

const PlanExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1),
  load_target: z.string().min(1),
  tempo: z.string().min(1),
  rest_seconds: z.number().int().min(0).max(600),
  notes: z.string(),
});

const PlanPhaseSchema = z.object({
  phase_number: z.number().int().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  plain_language_summary: z.string().min(1),
  estimated_duration_weeks: z.number().int().min(1).max(26),
  progression_criteria: ProgressionCriteriaSchema,
  regression_criteria: RegressionCriteriaSchema,
  exercises: z.array(PlanExerciseSchema).min(1).max(8),
});

export const GeneratePlanResponseSchema = z.object({
  plain_language_summary: z.string().min(1),
  phases: z.array(PlanPhaseSchema).min(2).max(6),
});

export type GeneratePlanResponse = z.infer<typeof GeneratePlanResponseSchema>;
```

### Eval Cases

| Case | Input signal | Expected behavior |
|---|---|---|
| Low irritability, gradual onset, runner | irritability=low, mechanism=gradual, goal=return_to_running | 4–5 phases; Phase 1 isometrics; final phase includes running reintegration |
| High irritability, acute onset | irritability=high, mechanism=acute | Phase 1 pain_threshold ≤ 2; no eccentric loading in Phase 1; longer estimated_duration_weeks in early phases |
| Post-surgery | mechanism=post_surgery | Phases account for surgical recovery; Phase 1 very conservative loads |
| Pain-free daily goal | goal=pain_free_daily | Plan de-emphasizes return-to-sport load; final phase focuses on functional daily tasks |
| Sedentary training background | training_background describes sedentary lifestyle | Lower load_target values; longer estimated_duration_weeks across phases |
| Schema validation failure | Malformed JSON returned | Retry once with error appended; on second failure return user-facing error |

### Known Edge Cases

- **Exercise name mismatch:** LLM may invent exercise names not in the library. The edge function resolves exercises by fuzzy name match against the `exercises` table; unmatched exercises are inserted with `exercise_id = null` and `exercise_name` preserved as free text.
- **Missing `notes` field:** Zod coerces missing `notes` to empty string via `.default('')` in edge function preprocessing.
- **Phase count out of range:** If LLM returns < 2 phases, validation fails and triggers retry.
- **Safety flag:** If intake indicates neurological symptoms or acute trauma (detected in prior_treatment or current_symptoms), `generate-plan` inserts a `safety_event` before writing the plan and returns the safety advisory alongside the plan.

---

## 2. `generate-workout-v1`

**Edge function:** `generate-workout`
**Prompt version:** `generate-workout-v1`
**Model:** `APP_ENV=dev` → `claude-haiku-4-5-20251001`, `APP_ENV=prod` → `claude-sonnet-4-6`

### Prompt Template

```
SYSTEM:
You are assisting a PHT rehabilitation app in generating a daily workout based on the user's check-in data and their current recovery phase prescription.

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

For rest_recommendation, exercises array must be empty [].

USER:
Generate a workout for today.

Today's check-in:
  Pain level: {{pain_level}}/10
  Soreness level: {{soreness_level}}/10

Last 3 check-ins (most recent first):
{{recent_checkins}}

Current recovery phase:
  Phase {{phase_number}}: {{phase_name}}
  Description: {{phase_description}}

Prescribed exercises for this phase:
{{prescribed_exercises}}
```

### Zod Schema

```typescript
import { z } from 'zod';

const WorkoutExerciseSchema = z.object({
  exercise_name: z.string().min(1),
  sets: z.number().int().min(0).max(10),
  reps: z.string().min(1),
  load: z.string().min(1),
  tempo: z.string().min(1),
  rest_seconds: z.number().int().min(0).max(600),
  notes: z.string(),
});

export const GenerateWorkoutResponseSchema = z.object({
  workout_type: z.enum(['standard', 'modified', 'rest_recommendation']),
  plain_language_explanation: z.string().min(1),
  exercises: z.array(WorkoutExerciseSchema),
}).refine(
  (data) => data.workout_type !== 'rest_recommendation' || data.exercises.length === 0,
  { message: 'rest_recommendation must have empty exercises array' }
);

export type GenerateWorkoutResponse = z.infer<typeof GenerateWorkoutResponseSchema>;
```

### Eval Cases

| Case | Input signal | Expected behavior |
|---|---|---|
| Low pain standard day | pain_level=2, soreness=3 | workout_type="standard"; exercises match phase prescription |
| Moderate pain modified | pain_level=5, soreness=4 | workout_type="modified"; sets/load reduced vs prescription |
| High pain rest day | pain_level=8 | workout_type="rest_recommendation"; exercises=[] |
| Trending pain increase | 3 recent check-ins: 2→4→6 | LLM should be conservative; modified or rest recommended |
| Pain level=3 with high soreness | pain_level=3, soreness=8 | Modified workout with reduced volume even though pain is low |
| Schema validation failure | Malformed JSON | Retry once; on second failure show yesterday's workout with fallback banner |

### Known Edge Cases

- **Fallback on failure:** If `generate-workout` fails twice, the client shows yesterday's generated workout (from local cache or last DB record) with the banner: "Using your last workout — we'll try again tomorrow."
- **Safety block:** If `pain_level ≥ 8`, the edge function does NOT call Claude at all — it directly inserts a `safety_event` and returns `workout_type = "rest_recommendation"` with a pre-written explanation string. Claude is not called for high-pain days.
- **No prior check-ins:** For new users on Day 1, `recent_checkins` is passed as "No prior check-ins." LLM should treat as Day 1 start.

---

## 3. `evolve-plan-v1`

**Edge function:** `evolve-plan`
**LLM call:** None — this is a pure TypeScript evaluator.
**Prompt version:** N/A

The plan evolution logic is deterministic. It runs after every `workout_log` insert and evaluates three dimensions against the current phase's `progression_criteria` and `regression_criteria` JSONB fields.

### Evaluator Logic (TypeScript)

```typescript
// Located in: supabase/functions/evolve-plan/evaluator.ts

type EvolveDecision = 'progress' | 'regress' | 'hold' | 'continue';

interface EvolveInput {
  phaseProgressionCriteria: {
    pain_threshold: number;        // max avg pain to progress
    load_tolerance_pct: number;    // min % of prescribed load achieved
    consistency_pct: number;       // min session completion rate
    window_days: number;
  };
  phaseRegressionCriteria: {
    pain_consecutive_sessions: number;
    missed_sessions_window: number;
  };
  recentCheckIns: Array<{ pain_level: number; checked_in_at: string }>;
  sessions: Array<{ status: string; scheduled_date: string }>;
  exerciseLogs: Array<{ sets_completed: number; reps_per_set: number[] }>;
  phaseExercises: Array<{ prescribed_sets: number; prescribed_reps: string }>;
}

// Decision:
// 1. Average pain over window_days
// 2. Load tolerance: avg sets_completed / prescribed_sets over window
// 3. Consistency: completed sessions / total scheduled sessions over window
//
// IF all three meet progression_criteria → 'progress'
// ELSE IF pain trending up (pain_consecutive_sessions) OR
//         missed > missed_sessions_window → 'regress'
// ELSE IF signals conflict → 'hold'
// ELSE → 'continue'
```

### Eval Cases

| Case | Input signal | Expected decision |
|---|---|---|
| All criteria met | avg pain ≤ threshold, load ≥ target, consistency ≥ target | progress |
| Pain spiking | 3 consecutive sessions with pain > threshold | regress |
| Missed sessions | 4 missed sessions in window | regress |
| Pain OK, load not met | avg pain low, load_tolerance 60% vs 85% target | hold |
| Consistency OK, pain borderline | consistency met, pain = threshold exactly | hold |
| New phase, window not elapsed | < window_days have passed | continue (no evaluation yet) |

### Known Edge Cases

- **Not enough data:** If fewer sessions than window_days / 7 have been completed, return `continue` without evaluation.
- **Phase transition race condition:** The edge function checks that the current phase hasn't already been transitioned before writing a `plan_evolution_event`.
- **No next phase:** If progressing from the final phase, set plan status to `completed` instead of creating a new phase.

---

## 4. `revise-plan-v1`

**Edge function:** `revise-plan`
**Prompt version:** `revise-plan-v1`
**Model:** `APP_ENV=dev` → `claude-haiku-4-5-20251001`, `APP_ENV=prod` → `claude-sonnet-4-6`

### Prompt Template

```
SYSTEM:
(Same as generate-plan-v1 system prompt)

USER:
A user's injury status has changed. Revise their rehabilitation plan accordingly.

Original intake:
{{original_intake}}

Original plan summary:
{{original_plan_summary}}

Current phase ({{phase_number}} of {{total_phases}}): {{current_phase_name}}
Completed phases: {{completed_phase_numbers}}

Updated injury status:
  New pain baseline: {{new_pain_baseline}}/10
  Current symptoms: {{new_current_symptoms}}
  Last flare date: {{last_flare_date}}

Generate a revised plan. If the user has already completed phases, do not regenerate those phases — start the revised plan from the next phase onward. Adjust phase parameters based on the new status.
```

### Zod Schema

Same as `GeneratePlanResponseSchema` (generate-plan-v1). The response schema is identical.

### Eval Cases

| Case | Input signal | Expected behavior |
|---|---|---|
| Status improved | pain_baseline decreases | Next phase more aggressive; shorter estimated_duration_weeks |
| Status worsened | pain_baseline increases | Next phase more conservative; regression_criteria more sensitive |
| Flare reported | last_flare_date recent | Revised plan includes modified protocol / lower pain_threshold |
| Completed 2 of 4 phases | completed_phase_numbers=[1,2] | Revised plan phases start at 3; phases 1–2 not regenerated |
| Schema validation failure | Malformed JSON | Retry once; on failure retain current plan; show retry button |

### Known Edge Cases

- **Plan supersession:** The edge function sets the old `recovery_plans.status = 'superseded'` only after the new plan is fully written and validated. Never supersede before the new plan is committed.
- **Session continuity:** The current in-progress session is not disrupted by plan revision — revision takes effect on the next scheduled session.
