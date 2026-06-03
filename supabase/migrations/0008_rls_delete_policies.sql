-- =============================================================================
-- Add DELETE RLS policies for check_ins and generated_workouts.
--
-- These are needed by jumpToPhase (called from the client) to delete today's
-- check-in and workout when the user jumps to a different phase. Without these
-- policies, the client-side deletes silently succeed but affect 0 rows, so the
-- old check-in and workout persist and the Today screen never resets.
-- =============================================================================

create policy "Users can delete their own check-ins"
  on public.check_ins for delete
  using (user_id = auth.uid());

create policy "Users can delete workouts for their own sessions"
  on public.generated_workouts for delete
  using (
    exists (
      select 1 from public.sessions s
      where s.id = generated_workouts.session_id
        and s.user_id = auth.uid()
    )
  );
