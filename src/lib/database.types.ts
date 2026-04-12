// =============================================================================
// One Day Stronger — Database Types
// =============================================================================
// This file is generated from the Supabase schema.
// Regenerate with: npx supabase gen types typescript --local > src/lib/database.types.ts
//
// DO NOT EDIT MANUALLY — run the generate command after any migration.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          age: number | null;
          gender: string | null;
          rehab_goal: 'return_to_running' | 'pain_free_daily' | 'return_to_sport' | 'other' | null;
          onboarding_step: 'intake' | 'goal' | 'generating' | 'complete';
          notification_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          age?: number | null;
          gender?: string | null;
          rehab_goal?: 'return_to_running' | 'pain_free_daily' | 'return_to_sport' | 'other' | null;
          onboarding_step?: 'intake' | 'goal' | 'generating' | 'complete';
          notification_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          age?: number | null;
          gender?: string | null;
          rehab_goal?: 'return_to_running' | 'pain_free_daily' | 'return_to_sport' | 'other' | null;
          onboarding_step?: 'intake' | 'goal' | 'generating' | 'complete';
          notification_time?: string | null;
          updated_at?: string;
        };
      };

      injury_intake: {
        Row: {
          id: string;
          user_id: string;
          injury_onset_date: string | null;
          mechanism: 'gradual' | 'acute' | 'post_surgery' | 'unknown' | null;
          prior_treatment: string | null;
          irritability_level: 'low' | 'moderate' | 'high' | null;
          training_background: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          injury_onset_date?: string | null;
          mechanism?: 'gradual' | 'acute' | 'post_surgery' | 'unknown' | null;
          prior_treatment?: string | null;
          irritability_level?: 'low' | 'moderate' | 'high' | null;
          training_background?: string | null;
          created_at?: string;
        };
        Update: never; // immutable
      };

      injury_status: {
        Row: {
          id: string;
          user_id: string;
          pain_level_baseline: number | null;
          current_symptoms: string | null;
          last_flare_date: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pain_level_baseline?: number | null;
          current_symptoms?: string | null;
          last_flare_date?: string | null;
          updated_at?: string;
        };
        Update: {
          pain_level_baseline?: number | null;
          current_symptoms?: string | null;
          last_flare_date?: string | null;
          updated_at?: string;
        };
      };

      recovery_plans: {
        Row: {
          id: string;
          user_id: string;
          status: 'active' | 'completed' | 'paused' | 'superseded';
          rehab_goal: string | null;
          plain_language_summary: string | null;
          prompt_version: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: 'active' | 'completed' | 'paused' | 'superseded';
          rehab_goal?: string | null;
          plain_language_summary?: string | null;
          prompt_version: string;
          generated_at?: string;
        };
        Update: {
          status?: 'active' | 'completed' | 'paused' | 'superseded';
          plain_language_summary?: string | null;
        };
      };

      plan_phases: {
        Row: {
          id: string;
          plan_id: string;
          phase_number: number;
          name: string;
          description: string | null;
          plain_language_summary: string | null;
          estimated_duration_weeks: number | null;
          status: 'upcoming' | 'active' | 'completed' | 'regressed_from';
          progression_criteria: Json;
          regression_criteria: Json;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          plan_id: string;
          phase_number: number;
          name: string;
          description?: string | null;
          plain_language_summary?: string | null;
          estimated_duration_weeks?: number | null;
          status?: 'upcoming' | 'active' | 'completed' | 'regressed_from';
          progression_criteria?: Json;
          regression_criteria?: Json;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          status?: 'upcoming' | 'active' | 'completed' | 'regressed_from';
          started_at?: string | null;
          completed_at?: string | null;
        };
      };

      exercises: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          instructions: string | null;
          category: 'isometric' | 'eccentric' | 'strength' | 'mobility' | 'cardio';
          video_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          instructions?: string | null;
          category: 'isometric' | 'eccentric' | 'strength' | 'mobility' | 'cardio';
          video_url?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          instructions?: string | null;
          category?: 'isometric' | 'eccentric' | 'strength' | 'mobility' | 'cardio';
          video_url?: string | null;
        };
      };

      phase_exercises: {
        Row: {
          id: string;
          phase_id: string;
          exercise_id: string | null;
          prescribed_sets: number | null;
          prescribed_reps: string | null;
          load_target: string | null;
          tempo: string | null;
          rest_seconds: number | null;
          order_index: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          phase_id: string;
          exercise_id?: string | null;
          prescribed_sets?: number | null;
          prescribed_reps?: string | null;
          load_target?: string | null;
          tempo?: string | null;
          rest_seconds?: number | null;
          order_index?: number;
          notes?: string | null;
        };
        Update: {
          prescribed_sets?: number | null;
          prescribed_reps?: string | null;
          load_target?: string | null;
          tempo?: string | null;
          rest_seconds?: number | null;
          order_index?: number;
          notes?: string | null;
        };
      };

      sessions: {
        Row: {
          id: string;
          user_id: string;
          plan_phase_id: string | null;
          scheduled_date: string;
          session_type: 'training' | 'rest' | 'modified';
          status: 'scheduled' | 'completed' | 'skipped' | 'rest_day';
          skip_reason: 'life' | 'pain' | 'travel' | 'other' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_phase_id?: string | null;
          scheduled_date: string;
          session_type: 'training' | 'rest' | 'modified';
          status?: 'scheduled' | 'completed' | 'skipped' | 'rest_day';
          skip_reason?: 'life' | 'pain' | 'travel' | 'other' | null;
          created_at?: string;
        };
        Update: {
          status?: 'scheduled' | 'completed' | 'skipped' | 'rest_day';
          skip_reason?: 'life' | 'pain' | 'travel' | 'other' | null;
          session_type?: 'training' | 'rest' | 'modified';
        };
      };

      check_ins: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          pain_level: number;
          soreness_level: number;
          triggered_by: 'notification' | 'inline' | 'manual' | 're_checkin_after_gap';
          checked_in_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          pain_level: number;
          soreness_level: number;
          triggered_by: 'notification' | 'inline' | 'manual' | 're_checkin_after_gap';
          checked_in_at?: string;
        };
        Update: never; // immutable
      };

      generated_workouts: {
        Row: {
          id: string;
          session_id: string;
          check_in_id: string | null;
          workout_type: 'standard' | 'modified' | 'rest_recommendation';
          plain_language_explanation: string | null;
          prompt_version: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          check_in_id?: string | null;
          workout_type: 'standard' | 'modified' | 'rest_recommendation';
          plain_language_explanation?: string | null;
          prompt_version: string;
          generated_at?: string;
        };
        Update: never; // immutable
      };

      generated_workout_exercises: {
        Row: {
          id: string;
          generated_workout_id: string;
          exercise_id: string | null;
          exercise_name: string;
          sets: number | null;
          reps: string | null;
          load: string | null;
          tempo: string | null;
          rest_seconds: number | null;
          order_index: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          generated_workout_id: string;
          exercise_id?: string | null;
          exercise_name: string;
          sets?: number | null;
          reps?: string | null;
          load?: string | null;
          tempo?: string | null;
          rest_seconds?: number | null;
          order_index?: number;
          notes?: string | null;
        };
        Update: never; // immutable
      };

      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          generated_workout_id: string | null;
          difficulty_rating: number | null;
          session_notes: string | null;
          pain_during_session: number | null;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          generated_workout_id?: string | null;
          difficulty_rating?: number | null;
          session_notes?: string | null;
          pain_during_session?: number | null;
          completed_at?: string;
        };
        Update: {
          difficulty_rating?: number | null;
          session_notes?: string | null;
          pain_during_session?: number | null;
        };
      };

      exercise_logs: {
        Row: {
          id: string;
          workout_log_id: string;
          exercise_id: string | null;
          exercise_name: string;
          sets_completed: number | null;
          reps_per_set: Json | null;
          weight_per_set: Json | null;
          modifications: string | null;
        };
        Insert: {
          id?: string;
          workout_log_id: string;
          exercise_id?: string | null;
          exercise_name: string;
          sets_completed?: number | null;
          reps_per_set?: Json | null;
          weight_per_set?: Json | null;
          modifications?: string | null;
        };
        Update: never; // immutable
      };

      plan_evolution_events: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          from_phase_id: string | null;
          to_phase_id: string | null;
          workout_log_id: string | null;
          event_type: 'progression' | 'regression' | 'hold' | 'plan_revised';
          rationale: string | null;
          triggered_by: 'auto' | 'user_initiated';
          seen: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          from_phase_id?: string | null;
          to_phase_id?: string | null;
          workout_log_id?: string | null;
          event_type: 'progression' | 'regression' | 'hold' | 'plan_revised';
          rationale?: string | null;
          triggered_by: 'auto' | 'user_initiated';
          seen?: boolean;
          created_at?: string;
        };
        Update: {
          seen?: boolean;
        };
      };

      safety_events: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          trigger: 'high_pain_checkin' | 'high_pain_logging' | 'atypical_symptoms' | 'intake_flagged';
          pain_level_reported: number | null;
          details: string | null;
          professional_care_acknowledged: boolean;
          acknowledged_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          trigger: 'high_pain_checkin' | 'high_pain_logging' | 'atypical_symptoms' | 'intake_flagged';
          pain_level_reported?: number | null;
          details?: string | null;
          professional_care_acknowledged?: boolean;
          acknowledged_at?: string | null;
          created_at?: string;
        };
        Update: {
          professional_care_acknowledged?: boolean;
          acknowledged_at?: string | null;
        };
      };

      llm_call_logs: {
        Row: {
          id: string;
          user_id: string | null;
          edge_function: 'generate-plan' | 'generate-workout' | 'evolve-plan' | 'revise-plan';
          model: string;
          prompt_version: string;
          input_tokens: number | null;
          output_tokens: number | null;
          latency_ms: number | null;
          success: boolean;
          error_message: string | null;
          called_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          edge_function: 'generate-plan' | 'generate-workout' | 'evolve-plan' | 'revise-plan';
          model: string;
          prompt_version: string;
          input_tokens?: number | null;
          output_tokens?: number | null;
          latency_ms?: number | null;
          success: boolean;
          error_message?: string | null;
          called_at?: string;
        };
        Update: never; // immutable
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
