-- =============================================================================
-- One Day Stronger — PHT Condition Module Seed
-- =============================================================================
-- Inserts the Proximal Hamstring Tendinopathy (PHT) protocol. This is the
-- only condition supported in MVP. Protocol v1.0.
-- =============================================================================

insert into public.condition_modules (
  condition_id,
  version,
  protocol,
  plan_system_prompt_template,
  workout_system_prompt_template
) values (
  'pht',
  '1.0',
  '{
    "meta": {
      "condition_id": "pht",
      "condition_name": "Proximal Hamstring Tendinopathy",
      "affected_structure": "proximal hamstring tendon at ischial tuberosity"
    },
    "load_management": {
      "acceptable_pain_during_exercise": 3,
      "pain_settling_window_hours": 24,
      "compression_avoidance": [
        "hip flexion > 70° under load",
        "prolonged sitting on hard surfaces",
        "hamstring stretching — contraindicated throughout rehabilitation"
      ]
    },
    "irritability_levels": {
      "high": {
        "criteria_description": "Pain > 5/10 during ADLs, rest pain, or symptoms lasting > 2h after light activity",
        "starting_phase_type": "isometric",
        "load_instruction": "isometrics only at comfortable hip angles; no loaded hip flexion"
      },
      "moderate": {
        "criteria_description": "Pain with activity, settles within 1–2h, minimal rest pain",
        "starting_phase_type": "isometric",
        "load_instruction": "isometrics + light isotonic; monitor 24h response"
      },
      "low": {
        "criteria_description": "Pain only with high-load activities, settles quickly",
        "starting_phase_type": "isotonic_eccentric",
        "load_instruction": "may progress through eccentric loading faster"
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
        "avoid_categories": ["hip_flexion_dominant"],
        "instruction": "Reduce sets and load 30–50%. Avoid hip-flexion-dominant exercises. Focus isometric or low-load isotonic."
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
        "clinical_rationale": "Static loading at tolerated angles reduces pain sensitization without compressive tendon load",
        "typical_duration_weeks": { "min": 3, "max": 6 },
        "exercise_categories": ["isometric_hamstring", "hip_abductor"],
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
        "default_name": "Eccentric Loading",
        "clinical_rationale": "Slow eccentric contraction stimulates tendon remodeling — the most important phase for structural recovery",
        "typical_duration_weeks": { "min": 4, "max": 8 },
        "exercise_categories": ["eccentric_hamstring", "hip_hinge_eccentric"],
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
        "clinical_rationale": "Full-range isotonic loading at slow tempo with progressive load builds tendon capacity",
        "typical_duration_weeks": { "min": 4, "max": 6 },
        "exercise_categories": ["strength_hamstring", "hip_hinge_loaded"],
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
        "clinical_rationale": "Sport-specific and daily-life loading patterns prepare for return to goal activity",
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
        "id": "pht_iso_hamstring_bridge",
        "name": "Isometric Hamstring Bridge",
        "category": "isometric_hamstring",
        "default_prescription": { "sets": 3, "hold_seconds": 45, "rest_seconds": 90, "tempo": "sustained" },
        "high_irritability_modification": { "sets": 2, "hold_seconds": 30 },
        "coaching_cues": [
          "Press heel firmly into surface",
          "Squeeze glute and hamstring equally",
          "Pain must stay ≤ 3/10"
        ]
      },
      {
        "id": "pht_iso_wall_sit",
        "name": "Wall Sit",
        "category": "isometric_hamstring",
        "default_prescription": { "sets": 3, "hold_seconds": 30, "rest_seconds": 60, "tempo": "sustained" },
        "coaching_cues": [
          "Keep hips at 90°",
          "Avoid deeper flexion early on"
        ]
      },
      {
        "id": "pht_prone_hip_extension",
        "name": "Prone Hip Extension",
        "category": "isometric_hamstring",
        "default_prescription": { "sets": 3, "reps": "12", "rest_seconds": 60, "tempo": "2-1-2" },
        "coaching_cues": [
          "Squeeze glute and hamstring at top",
          "Minimal lumbar extension"
        ]
      },
      {
        "id": "pht_supine_hip_flexion_hold",
        "name": "Supine Hip Flexion Hold",
        "category": "isometric_hamstring",
        "default_prescription": { "sets": 3, "hold_seconds": 30, "rest_seconds": 60, "tempo": "sustained" },
        "coaching_cues": [
          "Lie on back, lift knee to 90°",
          "Avoid breath holding"
        ]
      },
      {
        "id": "pht_clam_shell",
        "name": "Clam Shell",
        "category": "hip_abductor",
        "default_prescription": { "sets": 3, "reps": "15 per side", "rest_seconds": 45, "tempo": "2-1-2", "load_target": "light resistance band" },
        "coaching_cues": [
          "Keep pelvis stable",
          "Progress band resistance when movement feels easy"
        ]
      },
      {
        "id": "pht_nordic_hamstring_curl",
        "name": "Nordic Hamstring Curl",
        "category": "eccentric_hamstring",
        "default_prescription": { "sets": 3, "reps": "6", "rest_seconds": 120, "tempo": "4-0-1" },
        "coaching_cues": [
          "Lower slowly over 4 seconds",
          "Use hands to return if needed"
        ]
      },
      {
        "id": "pht_single_leg_rdl",
        "name": "Single-Leg Romanian Deadlift",
        "category": "hip_hinge_eccentric",
        "default_prescription": { "sets": 3, "reps": "8–10", "rest_seconds": 90, "tempo": "3-1-2", "load_target": "light resistance band" },
        "coaching_cues": [
          "Hinge at hip, keep spine neutral",
          "Limit forward lean initially"
        ]
      },
      {
        "id": "pht_seated_hip_hinge",
        "name": "Seated Hip Hinge",
        "category": "hip_hinge_eccentric",
        "default_prescription": { "sets": 3, "reps": "10", "rest_seconds": 75, "tempo": "3-1-2" },
        "coaching_cues": [
          "Sit at edge of chair",
          "Lean forward from hip, not waist",
          "Feel stretch at hamstring attachment"
        ]
      },
      {
        "id": "pht_step_up",
        "name": "Step-Up",
        "category": "hip_hinge_eccentric",
        "default_prescription": { "sets": 3, "reps": "10 per leg", "rest_seconds": 60, "tempo": "2-1-2" },
        "coaching_cues": [
          "Use a low step initially (20cm)",
          "Drive through heel of front foot"
        ]
      },
      {
        "id": "pht_deadlift",
        "name": "Deadlift",
        "category": "strength_hamstring",
        "default_prescription": { "sets": 3, "reps": "8", "rest_seconds": 120, "tempo": "2-1-2", "load_target": "30% bodyweight" },
        "coaching_cues": [
          "Add load gradually",
          "Stop if pain exceeds 3/10"
        ]
      },
      {
        "id": "pht_walking_lunge",
        "name": "Walking Lunge",
        "category": "functional_movement",
        "default_prescription": { "sets": 3, "reps": "10 per leg", "rest_seconds": 75, "tempo": "controlled" },
        "coaching_cues": [
          "Keep torso upright",
          "Avoid deep hip flexion if painful"
        ]
      },
      {
        "id": "pht_sprint_drill_a_march",
        "name": "Sprint Drill — A-March",
        "category": "plyometric_intro",
        "default_prescription": { "sets": 3, "reps": "20m", "rest_seconds": 60, "tempo": "controlled" },
        "coaching_cues": [
          "High knee drive",
          "Pain must stay below 3/10 throughout"
        ]
      }
    ],
    "safety_keywords": [
      "neurological", "numbness", "tingling", "radiating", "nerve",
      "paralysis", "weakness", "bladder", "bowel", "acute trauma",
      "fracture", "dislocation", "severe swelling", "unable to walk", "post_surgery"
    ],
    "return_to_activity_criteria": [
      "Complete functional phase without symptom flare",
      "Single-leg strength within 10% of unaffected side",
      "Walk-run progression established without pain flare",
      "No pain with extended daily activities"
    ]
  }',
  -- plan_system_prompt_template
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
  -- workout_system_prompt_template
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
