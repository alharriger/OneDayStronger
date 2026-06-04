-- Add override columns to generated_workouts.
-- Populated when the user taps "Update this workout" on the Today screen.
-- override_type: which option the user chose
-- override_note: free-text note (only for 'other' type)
ALTER TABLE generated_workouts
  ADD COLUMN IF NOT EXISTS override_type text
    CHECK (override_type IN ('advance', 'phase_back', 'other')),
  ADD COLUMN IF NOT EXISTS override_note text;
