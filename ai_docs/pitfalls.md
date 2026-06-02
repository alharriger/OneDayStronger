# Pitfalls

This document tracks mistakes made during development, how they were diagnosed, and the process changes put in place to prevent recurrence. Review this before starting any task in the relevant category.

---

## P1 — Deleting `profiles` during test account reset breaks the FK chain for all subsequent onboarding

**What went wrong:**
A raw SQL reset deleted the `profiles` row for a test user. Because the user still exists in `auth.users`, the `on_auth_user_created` trigger does not re-fire, so no profile row is re-created. All tables that have `FK → profiles.user_id` (`injury_intake`, `injury_status`, `safety_events`, `sessions`, etc.) then fail on insert during the next onboarding run with a foreign key constraint error.

**How it was diagnosed:**
User reported "Could not save — insert or update on table injury_intake violates foreign key constraint injury_intake_user_id_fkey". Checked the FK definition with `information_schema` — confirmed it references `profiles.user_id`, not `auth.users`. Realised the profile row was gone because the raw SQL reset had deleted it.

**How to work going forward:**
- Never delete the `profiles` row. Instead, UPSERT it back to `onboarding_step = 'intake'` with all nullable columns set to NULL.
- Never use ad-hoc SQL for test account resets. Always use `scripts/reset-test-accounts.mjs`, which already handles this correctly (delete then re-insert profile row).
- If raw SQL is ever necessary, trace the full FK dependency chain before deleting any row.

---

## P2 — LLM double-failure in edge functions produces a 500 with no log entry and a generic client error

**What went wrong:**
`revise-plan` (and originally `generate-workout`) has a retry pattern: first LLM call fails → 4s sleep → second LLM call. If the second call also fails, the outer `catch` fires and returns a 500. Two problems:
1. `logLlmCall` is never called in this path, so the failure is invisible in `llm_call_logs`.
2. The client (`invokeRevisePlan`) checks `if (error)` first and returns `error.message`, which is the generic Supabase SDK string "Edge Function returned a non-2xx status code" — not the descriptive message the function put in the response body.

**How it was diagnosed:**
User saw "Could not revise plan — Edge Function returned a non-2xx status code". Checked `llm_call_logs` — no entry for the call. Checked Postgres logs — no DB errors at the failure timestamp. Execution time was 4,592ms, consistent with: first LLM call fails fast + 4,000ms forced sleep + second LLM call fails fast. Confirmed this is a transient Groq+Gemini failure, not a code logic error — but it is invisible and shows a useless error message.

**How to work going forward:**
- Every failure path in an edge function that returns a non-2xx must call `logLlmCall` with `success: false` before returning. Unlogged failures cannot be diagnosed.
- When fixing a bug that involves a failure mode: before marking the fix "done", verify the failure is now logged and the client shows a useful message.
- In client service functions, prefer `data?.error` over `error.message` when the edge function is responsible for writing the error body. Pattern:
  ```typescript
  const message = data?.error ?? error?.message ?? 'Unknown error';
  ```

---

## P3 — Deploying an edge function change without verifying the DB schema it touches

**What went wrong:**
`copyCompletedPhases` was written and deployed (revise-plan v18) without:
- Verifying column-by-column that every field in the INSERT matched the actual `plan_phases` schema
- Running the test suite before deployment
- Querying the DB to confirm what data the function would actually operate on

The function was then given to the user to test without knowing whether it would even execute correctly.

**How it was diagnosed:**
User reported an error immediately after deployment. The function was untested and the column set was assumed rather than verified.

**How to work going forward:**
Before any edge function change is deployed:
1. Read the full current function top-to-bottom.
2. List every table and column the change reads or writes. Query `information_schema` or `list_tables` to confirm they exist.
3. Run `npm run test:ci` — all tests must pass.
4. After deployment, run SQL queries to confirm the DB is in the expected state before asking the user to test.
5. When asking the user to test: state exactly what was changed, what was verified, what scenario to run, and what the expected outcome is.

---

## P5 — Gemini fallback model name went stale, silently breaking all LLM fallbacks

**What went wrong:**
`_shared/llm.ts` referenced `gemini-2.0-flash-exp` (the old experimental model) in both the constant and the API URL. Google retired this model. When Groq fails for any reason (rate limit, transient error), `callLLM` falls back to Gemini — which now returns a 404. Because `callLLM` surfaces only the Gemini error (not the original Groq error), the Groq failure was invisible. The result: every single revise-plan call failed for days, logged only as a Gemini 404.

**How it was diagnosed:**
Added `logLlmCall` to the previously-unlogged double-failure path (P2 fix). The first log entry immediately showed the Gemini 404 error with the model-not-found message.

**How to work going forward:**
- When the Gemini model is updated, deploy all three edge functions (generate-plan, generate-workout, revise-plan) — they all share `_shared/llm.ts`.
- Treat any "model not found" error from either provider as a deployment blocker, not a transient failure.
- Periodically verify that fallback paths still work — a broken fallback is worse than no fallback because it masks the primary failure.

---

## P4 — Passing an event type to a component that doesn't handle it causes a silent crash

**What went wrong:**
`revise-plan` inserts a `plan_evolution_events` row with `event_type: 'plan_revised'`. `getUnseenEvents` returns all event types including this one. `today.tsx` passed it to `EvolutionEventBanner` via a TypeScript cast. `EvolutionEventBanner` looks up a config object keyed by `EventType` — `'plan_revised'` is not in that union, so `config['plan_revised']` is `undefined`, and destructuring it crashes the render.

**How it was diagnosed:**
User reported "Cannot read property 'color' of undefined". Traced: `revise-plan` inserts `plan_revised` event → `getUnseenEvents` returns it → `today.tsx` passes it to `EvolutionEventBanner` → `config[eventType]` is `undefined` → crash.

**How to work going forward:**
- When a component renders data from a discriminated union or a keyed config object, always add a null guard before destructuring: `const entry = config[key]; if (!entry) return null;`
- When an edge function writes a new `event_type` value to the DB, trace every consumer of that table to confirm none will break on the new value.
- TypeScript casts (`as SomeType`) at data boundaries (DB → component) are a red flag — they suppress the compiler check that would have caught this. Prefer runtime filtering before the cast.
