-- =============================================================================
-- One Day Stronger — Gluteal Tendinopathy Condition Module Seed
-- =============================================================================
-- Inserts the Gluteal Tendinopathy (GT) protocol. This is the second condition
-- supported by the structured knowledge layer. Protocol v1.0.
--
-- GT affects the gluteal tendons (primarily gluteus medius and minimus) at
-- their insertion on the greater trochanter. Key difference from PHT:
-- compression comes from hip adduction/internal rotation, not hip flexion.
-- =============================================================================

insert into public.condition_modules (
  condition_id,
  version,
  protocol,
  plan_system_prompt_template,
  workout_system_prompt_template
) values (
  'gt',
  '1.0',
  '{
    "meta": {
      "condition_id": "gt",
      "condition_name": "Gluteal Tendinopathy",
      "affected_structure": "gluteal tendons (gluteus medius/minimus) at greater trochanter"
    },
    "load_management": {
      "acceptable_pain_during_exercise": 3,
      "pain_settling_window_hours": 24,
      "compression_avoidance": [
        "hip adduction across midline (crossing legs/feet)",
        "stretching into hip adduction or internal rotation (pigeon pose, IT band stretches)",
        "hip drop in single-leg standing",
        "sitting with legs crossed",
        "sleeping on affected side without pillow between knees"
      ]
    },
    "irritability_levels": {
      "high": {
        "criteria_description": "Pain > 5/10 during ADLs, rest pain, or symptoms lasting > 2h after light activity",
        "starting_phase_type": "isometric",
        "load_instruction": "isometric hip abduction only; keep hip in neutral — no adduction past midline"
      },
      "moderate": {
        "criteria_description": "Pain with activity, settles within 1–2h, minimal rest pain",
        "starting_phase_type": "isometric",
        "load_instruction": "isometrics + light isotonic hip abduction; monitor 24h response"
      },
      "low": {
        "criteria_description": "Pain only with high-load activities, settles quickly",
        "starting_phase_type": "isotonic_eccentric",
        "load_instruction": "may progress to isotonic and loading faster; avoid compression positions"
      }
    },
    "workout_modification_rules": {
      "pain_0_3": {
        "type": "standard",
        "instruction": "Follow phase prescription as written"
      },
      "pain_4_7": {
        "type": "modified",
        "set_reduction_pct": 40,
        "load_reduction_pct": 40,
        "avoid_categories": ["hip_adduction_loaded"],
        "instruction": "Reduce sets and load 30–50%. Avoid any loaded hip adduction. Focus isometric or light isotonic hip abduction in neutral."
      },
      "pain_8_10": {
        "type": "rest_recommendation",
        "instruction": "Rest. Do not prescribe exercises. Recommend active rest and clinical review."
      }
    },
    "phase_templates": [
      {
        "type": "isometric",
        "default_number": 1,
        "default_name": "Pain Management & Isometrics",
        "clinical_rationale": "Isometric hip abduction in neutral reduces pain sensitization without compressive tendon load from adduction",
        "typical_duration_weeks": { "min": 3, "max": 6 },
        "exercise_categories": ["isometric_hip_abductor", "hip_stabilizer"],
        "progression_criteria": {
          "pain_threshold": 3,
          "load_tolerance_pct": 75,
          "consistency_pct": 70,
          "window_days": 14
        },
        "regression_triggers": {
          "pain_consecutive_sessions": 2,
          "missed_sessions_window": 3
        }
      },
      {
        "type": "isotonic_eccentric",
        "default_number": 2,
        "default_name": "Isotonic Loading",
        "clinical_rationale": "Controlled isotonic hip abduction through range builds tendon and muscle capacity without compressive positions",
        "typical_duration_weeks": { "min": 4, "max": 8 },
        "exercise_categories": ["isotonic_hip_abductor", "hip_hinge_neutral"],
        "progression_criteria": {
          "pain_threshold": 3,
          "load_tolerance_pct": 80,
          "consistency_pct": 75,
          "window_days": 21
        },
        "regression_triggers": {
          "pain_consecutive_sessions": 2,
          "missed_sessions_window": 4
        }
      },
      {
        "type": "heavy_slow_resistance",
        "default_number": 3,
        "default_name": "Heavy Slow Resistance",
        "clinical_rationale": "Progressive loading of the gluteal tendon through single-leg functional movements builds capacity for daily activity demands",
        "typical_duration_weeks": { "min": 4, "max": 6 },
        "exercise_categories": ["single_leg_loaded", "hip_abductor_loaded"],
        "progression_criteria": {
          "pain_threshold": 3,
          "load_tolerance_pct": 85,
          "consistency_pct": 75,
          "window_days": 21
        },
        "regression_triggers": {
          "pain_consecutive_sessions": 2,
          "missed_sessions_window": 4
        }
      },
      {
        "type": "functional",
        "default_number": 4,
        "default_name": "Functional Strengthening",
        "clinical_rationale": "Sport-specific and daily-life loading patterns with progressive single-leg challenge prepare for return to goal activity",
        "typical_duration_weeks": { "min": 4, "max": 8 },
        "exercise_categories": ["functional_movement", "plyometric_intro"],
        "progression_criteria": {
          "pain_threshold": 3,
          "load_tolerance_pct": 90,
          "consistency_pct": 80,
          "window_days": 21
        },
        "regression_triggers": {
          "pain_consecutive_sessions": 3,
          "missed_sessions_window": 4
        }
      }
    ],
    "exercise_library": [
      {
        "id": "gt_iso_wall_press",
        "name": "Isometric Wall Press",
        "category": "isometric_hip_abductor",
        "default_prescription": { "sets": 3, "hold_seconds": 45, "rest_seconds": 90, "tempo": "sustained" },
        "high_irritability_modification": { "sets": 2, "hold_seconds": 30 },
        "coaching_cues": [
          "Stand side-on to a wall, press outer foot firmly into wall",
          "Keep hip in neutral — do not let it drift inward",
          "Pain must stay ≤ 3/10"
        ]
      },
      {
        "id": "gt_iso_sidelying_abduction",
        "name": "Isometric Side-Lying Hip Abduction",
        "category": "isometric_hip_abductor",
        "default_prescription": { "sets": 3, "hold_seconds": 30, "rest_seconds": 60, "tempo": "sustained" },
        "coaching_cues": [
          "Lie on unaffected side, lift top leg to hip height",
          "Hold still — do not pulse or move through range",
          "Keep hip slightly forward (not rolled back)"
        ]
      },
      {
        "id": "gt_hip_hike",
        "name": "Hip Hike",
        "category": "hip_stabilizer",
        "default_prescription": { "sets": 3, "reps": "12 per side", "rest_seconds": 60, "tempo": "2-1-2" },
        "coaching_cues": [
          "Stand on one leg on a step, let opposite hip drop then hike up",
          "Control the drop slowly — this is the working phase",
          "Do not lean your trunk to compensate"
        ]
      },
      {
        "id": "gt_sidelying_abduction",
        "name": "Side-Lying Hip Abduction",
        "category": "isotonic_hip_abductor",
        "default_prescription": { "sets": 3, "reps": "15 per side", "rest_seconds": 60, "tempo": "2-1-2", "load_target": "light resistance band" },
        "coaching_cues": [
          "Lift leg to hip height only — do not go higher",
          "Keep toes pointing forward, not to ceiling",
          "Progress band resistance when 15 reps feel easy"
        ]
      },
      {
        "id": "gt_clamshell",
        "name": "Clamshell",
        "category": "isotonic_hip_abductor",
        "default_prescription": { "sets": 3, "reps": "15 per side", "rest_seconds": 45, "tempo": "2-1-2", "load_target": "light resistance band" },
        "coaching_cues": [
          "Keep feet together, rotate top knee toward ceiling",
          "Keep pelvis still — no rocking back",
          "Focus on external rotation, not just abduction"
        ]
      },
      {
        "id": "gt_standing_hip_abduction",
        "name": "Standing Hip Abduction",
        "category": "isotonic_hip_abductor",
        "default_prescription": { "sets": 3, "reps": "12 per side", "rest_seconds": 60, "tempo": "2-1-2", "load_target": "resistance band at ankles" },
        "coaching_cues": [
          "Hold a surface for balance if needed",
          "Lift leg directly to the side — not forward or back",
          "Keep standing hip neutral — do not hike or lean"
        ]
      },
      {
        "id": "gt_single_leg_stance",
        "name": "Single-Leg Stance",
        "category": "single_leg_loaded",
        "default_prescription": { "sets": 3, "hold_seconds": 30, "rest_seconds": 60, "tempo": "sustained" },
        "coaching_cues": [
          "Keep hip level — no drop on the swing side",
          "Slight forward lean from ankle is acceptable",
          "Progress: eyes open → eyes closed → unstable surface"
        ]
      },
      {
        "id": "gt_lateral_band_walk",
        "name": "Lateral Band Walk",
        "category": "hip_abductor_loaded",
        "default_prescription": { "sets": 3, "reps": "15 steps per direction", "rest_seconds": 75, "tempo": "controlled", "load_target": "resistance band above knees" },
        "coaching_cues": [
          "Keep slight squat position throughout",
          "Step sideways keeping toes forward — avoid hip drop",
          "Band tension should be constant — feet never fully together"
        ]
      },
      {
        "id": "gt_lateral_step_up",
        "name": "Lateral Step-Up",
        "category": "single_leg_loaded",
        "default_prescription": { "sets": 3, "reps": "10 per leg", "rest_seconds": 75, "tempo": "2-1-2" },
        "coaching_cues": [
          "Step laterally onto a low step (15–20cm)",
          "Drive through the heel of the stepping leg",
          "Control the lowering phase — do not drop"
        ]
      },
      {
        "id": "gt_single_leg_squat",
        "name": "Single-Leg Squat",
        "category": "functional_movement",
        "default_prescription": { "sets": 3, "reps": "8 per leg", "rest_seconds": 90, "tempo": "3-1-2" },
        "coaching_cues": [
          "Keep knee tracking over second toe — no inward collapse",
          "Shallow depth only (30°) until pain-free",
          "Use a wall for support initially if balance is challenging"
        ]
      },
      {
        "id": "gt_figure_8_walk",
        "name": "Figure-of-8 Walk",
        "category": "functional_movement",
        "default_prescription": { "sets": 3, "reps": "3 circuits", "rest_seconds": 60, "tempo": "controlled" },
        "coaching_cues": [
          "Walk a figure-of-8 pattern around two cones (~2m apart)",
          "Maintain upright posture — avoid trunk sway",
          "Progress speed gradually when pain-free at slow pace"
        ]
      },
      {
        "id": "gt_running_progression",
        "name": "Walk-Run Progression",
        "category": "plyometric_intro",
        "default_prescription": { "sets": 1, "reps": "20 min session", "rest_seconds": 0, "tempo": "controlled" },
        "coaching_cues": [
          "Start with 1 min walk / 1 min jog intervals",
          "Increase run intervals by 1 min per session when pain-free",
          "Stop if lateral hip pain exceeds 3/10"
        ]
      }
    ],
    "safety_keywords": [
      "neurological", "numbness", "tingling", "radiating", "nerve",
      "paralysis", "weakness", "bladder", "bowel", "acute trauma",
      "fracture", "dislocation", "severe swelling", "unable to walk",
      "post_surgery", "avulsion", "bursitis"
    ],
    "return_to_activity_criteria": [
      "Complete functional phase without symptom flare",
      "Single-leg stance ≥ 30s pain-free on affected side",
      "Single-leg squat technique equal to unaffected side",
      "Walk-run progression established without pain flare",
      "No pain with prolonged walking or stair climbing"
    ]
  }',
  -- plan_system_prompt_template (same structure as PHT — condition-agnostic)
  'You are a clinical assistant for a {{condition_name}} rehabilitation app. This is an educational tool — not medical advice.

CONDITION PROTOCOL ({{condition_id}} v{{protocol_version}}):
{{protocol_json}}

USER PROFILE:
Irritability: {{irritability_level}} — {{irritability_description}}
Starting phase: Phase {{starting_phase_number}} ({{starting_phase_type}})
{{intake_summary}}

TASK — Generate a personalized rehabilitation plan:
- Select exercises ONLY from the exercise_library in the protocol above
- Generate {{phase_count}} phases following the phase_templates sequence
- 3–6 exercises per phase from the appropriate exercise_categories for each phase type
- Calibrate sets/reps/load for {{irritability_level}} irritability per protocol bounds
- Write plain-language summaries addressing this user''s specific goal and background

Return valid JSON matching this schema only — no other text:
{{plan_schema}}',
  -- workout_system_prompt_template (same structure as PHT — condition-agnostic)
  'You are generating a daily workout for a {{condition_name}} rehabilitation app.
Protocol: {{condition_id}} v{{protocol_version}}

Workout modification rules (apply based on today''s pain level):
{{workout_modification_rules}}

Current phase exercises (prescribed):
{{phase_exercises}}

Today''s context: pain {{pain_level}}/10, soreness {{soreness_level}}/10
Recent check-ins: {{recent_checkins}}

Return valid JSON matching this schema only — no other text:
{{workout_schema}}'
);
