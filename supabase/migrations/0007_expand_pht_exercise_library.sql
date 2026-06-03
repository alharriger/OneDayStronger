-- =============================================================================
-- One Day Stronger — PHT Exercise Library Expansion (A3 fix)
-- =============================================================================
-- Phase 3 (heavy_slow_resistance) had only 1 strength_hamstring exercise and
-- zero hip_hinge_loaded exercises despite the phase template referencing both
-- categories. Phase 4 (functional) had only 2 exercises.
--
-- This migration appends clinically appropriate exercises for phases 3–4 based
-- on PHT rehabilitation evidence (Goom, Malliaras, Docking protocols).
-- Existing exercises are untouched.
-- =============================================================================

UPDATE public.condition_modules
SET protocol = jsonb_set(
  protocol,
  '{exercise_library}',
  (protocol->'exercise_library') || '[
    {
      "id": "pht_romanian_deadlift",
      "name": "Romanian Deadlift",
      "category": "hip_hinge_loaded",
      "default_prescription": {
        "sets": 3,
        "reps": "8–10",
        "rest_seconds": 120,
        "tempo": "3-1-2",
        "load_target": "30–50% bodyweight"
      },
      "coaching_cues": [
        "Hinge at hip with soft knee bend",
        "Bar stays close to legs throughout",
        "Stop descent when hamstring load is felt — do not push into stretch",
        "Pain must stay ≤ 3/10"
      ]
    },
    {
      "id": "pht_split_squat",
      "name": "Split Squat",
      "category": "hip_hinge_loaded",
      "default_prescription": {
        "sets": 3,
        "reps": "8–10 per leg",
        "rest_seconds": 90,
        "tempo": "2-1-2",
        "load_target": "light dumbbells"
      },
      "coaching_cues": [
        "Keep front shin vertical",
        "Back knee lowers toward floor",
        "Drive through front heel to return",
        "Avoid trunk pitching forward excessively"
      ]
    },
    {
      "id": "pht_hip_thrust_loaded",
      "name": "Hip Thrust",
      "category": "hip_hinge_loaded",
      "default_prescription": {
        "sets": 3,
        "reps": "10–12",
        "rest_seconds": 90,
        "tempo": "2-1-2",
        "load_target": "light barbell or dumbbell across hips"
      },
      "coaching_cues": [
        "Upper back rests on bench edge",
        "Drive hips to full extension at top",
        "Squeeze glutes hard at the top",
        "Avoid excessive lumbar hyperextension"
      ]
    },
    {
      "id": "pht_lying_leg_curl",
      "name": "Lying Leg Curl",
      "category": "strength_hamstring",
      "default_prescription": {
        "sets": 3,
        "reps": "10–12",
        "rest_seconds": 90,
        "tempo": "3-1-2",
        "load_target": "moderate machine weight"
      },
      "coaching_cues": [
        "Lie face down, pad rests above heel",
        "Curl through full range at slow tempo",
        "Control the return — do not let weight drop",
        "This is a shorter-range hamstring load — good for PHT"
      ]
    },
    {
      "id": "pht_seated_leg_curl",
      "name": "Seated Leg Curl",
      "category": "strength_hamstring",
      "default_prescription": {
        "sets": 3,
        "reps": "10–12",
        "rest_seconds": 90,
        "tempo": "3-1-2",
        "load_target": "moderate machine weight"
      },
      "coaching_cues": [
        "Sit fully back in the seat",
        "Pull through the full range slowly",
        "Control the eccentric return",
        "Hip flexion is fixed by the seat — appropriate for PHT"
      ]
    },
    {
      "id": "pht_single_leg_squat",
      "name": "Single-Leg Squat",
      "category": "functional_movement",
      "default_prescription": {
        "sets": 3,
        "reps": "8–10 per leg",
        "rest_seconds": 90,
        "tempo": "3-1-2"
      },
      "coaching_cues": [
        "Stand on one leg, lower slowly",
        "Keep knee tracking over second toe",
        "Touch a surface lightly if balance is challenging",
        "Maintain level hips throughout"
      ]
    },
    {
      "id": "pht_box_step_down",
      "name": "Box Step-Down",
      "category": "functional_movement",
      "default_prescription": {
        "sets": 3,
        "reps": "10 per leg",
        "rest_seconds": 75,
        "tempo": "3-1-2"
      },
      "coaching_cues": [
        "Stand on a step (20–30cm)",
        "Lower the non-standing foot slowly to just touch the floor",
        "Control the descent through the full range",
        "Return by pressing through heel of standing leg"
      ]
    },
    {
      "id": "pht_hip_thrust_heavy",
      "name": "Heavy Hip Thrust",
      "category": "functional_movement",
      "default_prescription": {
        "sets": 4,
        "reps": "6–8",
        "rest_seconds": 120,
        "tempo": "2-1-2",
        "load_target": "50–70% bodyweight"
      },
      "coaching_cues": [
        "Progress load from earlier hip thrust work",
        "Full hip extension at top — pause 1 second",
        "Drive through both heels equally",
        "Stop if pain exceeds 3/10"
      ]
    },
    {
      "id": "pht_walk_run_progression",
      "name": "Walk-Run Intervals",
      "category": "functional_movement",
      "default_prescription": {
        "sets": 1,
        "reps": "10–15 min total",
        "rest_seconds": 0,
        "tempo": "alternating 1 min walk / 1 min jog"
      },
      "coaching_cues": [
        "Start at a very easy jog pace",
        "Walk if pain rises above 3/10",
        "Monitor symptoms in the 24h after — no flare = progress next session",
        "Build to continuous jogging before adding speed or distance"
      ]
    },
    {
      "id": "pht_double_leg_hop",
      "name": "Double-Leg Hop",
      "category": "plyometric_intro",
      "default_prescription": {
        "sets": 3,
        "reps": "8",
        "rest_seconds": 90,
        "tempo": "explosive"
      },
      "coaching_cues": [
        "Land softly with knees slightly bent",
        "Minimal ground contact time — spring off the floor",
        "Pain must be ≤ 3/10 throughout",
        "Stop if landing feels heavy or painful"
      ]
    },
    {
      "id": "pht_lateral_bound",
      "name": "Lateral Bound",
      "category": "plyometric_intro",
      "default_prescription": {
        "sets": 3,
        "reps": "8 per side",
        "rest_seconds": 90,
        "tempo": "explosive"
      },
      "coaching_cues": [
        "Push off one leg, land on the other",
        "Stick the landing briefly before rebounding",
        "Keep hips level on landing",
        "Pain ≤ 3/10 — stop if you feel tugging at the hamstring attachment"
      ]
    },
    {
      "id": "pht_agility_ladder",
      "name": "Agility Ladder Drills",
      "category": "plyometric_intro",
      "default_prescription": {
        "sets": 3,
        "reps": "2 passes",
        "rest_seconds": 60,
        "tempo": "moderate speed, controlled"
      },
      "coaching_cues": [
        "Start with simple in-out foot patterns",
        "Focus on foot placement accuracy before speed",
        "Increase speed only when pattern is consistent",
        "Warm up with walk-run first"
      ]
    }
  ]'::jsonb
)
WHERE condition_id = 'pht' AND version = '1.0';
