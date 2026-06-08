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

## P6 — Client-side DELETE operations silently fail without RLS DELETE policies

**What went wrong:**
`jumpToPhase` called `supabase.from('check_ins').delete()` and `supabase.from('generated_workouts').delete()` using the user JWT. Because no RLS DELETE policies existed on those tables, Supabase returned success with 0 rows affected — no error thrown, no indication anything was skipped. The check-in and workout persisted and the Today screen never reset.

**How it was diagnosed:**
User reported that phase jump appeared to succeed but Today still showed the old workout rather than the check-in screen. Checked `0002_rls_policies.sql` — confirmed only SELECT and INSERT policies existed. No DELETE policies anywhere. Added DELETE policies via `0008_rls_delete_policies.sql` and the flow worked immediately.

**How to work going forward:**
- Before writing any client-side delete (user JWT, not service role), check that a matching RLS DELETE policy exists.
- When writing a new table's RLS block, include DELETE policy alongside SELECT/INSERT — it is almost always needed for client-facing tables.
- After adding a delete in a service function, run a quick sanity query to confirm rows were actually removed.

---

## P7 — Multiple independent systems firing the same UI notification causes stacking banners

**What went wrong:**
Plan change notifications had two independent paths: `notifyPlanChanged()` set a `showPlanChangedBanner` inline toast, AND `getUnseenEvents()` fetched a `plan_evolution_events` row to show an `EvolutionEventBanner`. Both triggered on plan change, both rendered simultaneously, producing two visible banners at once — one plain, one rich.

**How it was diagnosed:**
User reported seeing "Your plan has been updated" toast AND "You've advanced to a new phase" event banner at the same time after a phase jump.

**How to work going forward:**
- Designate a single authoritative notification path before building any notification feature.
- When adding a new notification trigger, audit all existing notification systems to ensure only one fires per event.
- Inline toast state (`showXBanner`) is a red flag when a DB-backed event system (`plan_evolution_events`) already exists — the DB-backed system is always authoritative.

---

## P8 — Time-based exercise reps collide with "reps" unit labels

**What went wrong:**
PHT condition module exercises use `hold_seconds` in their prescription, which the generate-workout function stores as a string like `"45s"` or `"45 seconds"` in the `reps` field of `generated_workout_exercises`. Components that display prescription data appended " reps" unconditionally — producing broken text like "45s reps" or "45 seconds reps". Additionally, `reps_per_set` in `exercise_logs` may be empty even after a completed workout (the logging flow doesn't enforce per-set rep entry), so any completion summary that tries to total logged reps will silently get 0.

**How it was diagnosed:**
User reported reps showed as 0 on the completion screen and chip labels were wrong on workout cards. Traced: ExerciseCard prescription used `\`${exercise.reps} reps\`` unconditionally; completion view summed `reps_per_set` arrays which were empty. Inspected condition module seed — confirmed hold exercises use `hold_seconds`, not `reps`.

**How to work going forward:**
- Any component displaying a prescription `reps` value must detect time-based strings before appending units. Pattern:
  ```typescript
  const isTime = /\d+\s*(s|sec|seconds?)\b/i.test(reps);
  const display = isTime ? reps.replace(/\s*seconds?\b/gi, 's') : `${reps} reps`;
  ```
- Reference implementations: `formatReps()` in `ExerciseCard.tsx`, `formatCompletedReps()` in `today.tsx`.
- Never assume `reps_per_set` is populated — always fall back to `prescribedReps` when computing totals for completion summaries.

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

---

## P9 — Implementing UI screens from summarized design context produces implementations that don't match the designs

**What went wrong:**
The 7 Claude Design files (screens.jsx, components.jsx, README.md, etc.) were shared in a previous conversation. When that context was compressed, the file contents were reduced to high-level summary descriptions — approximate measurements, component names, and partial specs. The implementation was built entirely from those summaries. The result: every screen had systematic mismatches against the actual designs across typography, spacing, colors, component shapes, missing elements (phase badge, streak strip, "By the numbers" stat section), and interaction details (slider thumb shape, button alignment, active tab indicator).

The specific elements missed in aggregate:
- Phase badge component (missing on all screens)
- Tab bar active indicator (2px primary rule at top of active tab)
- PainScale: wrong thumb shape, wrong value alignment, wrong colors
- Stat strip ("By the numbers") layout wrong on multiple screens
- Typography sizes and weights off throughout
- Button alignment, icon presence, and color variants wrong
- Hero text content wrong on multiple screens
- Streak bar direction inverted
- Checkmarks rendered as circles (should be squares)
- Multiple missing sections per screen

**Why this is a test failure, not just a visual issue:**
Design compliance for a UI feature IS the acceptance test. Shipping a screen that doesn't match the design is equivalent to shipping code where the tests fail — the feature is not done. The visual audit against the design must be run and passed before a UI commit is valid.

**How to work going forward:**

**Before starting any UI implementation session:**
1. The user must re-share the design file(s) for the screen(s) being worked on. Summarized descriptions from a prior compressed session are not sufficient and must never be used as the sole spec.
2. If design files are not in the current conversation, stop and ask for them. Do not proceed from memory or prior summaries.

**Scope: one screen per implementation unit:**
3. Implement exactly one screen per pull request or commit. Never implement 2+ screens in one session. Each screen has 10–30 individual design details; doing multiple at once guarantees misses.
4. Before writing any code, extract a written spec from the design file: every component, every text style, every color token, every spacing value, every interaction. List them explicitly so they can be checked.

**The visual audit is the test — run it before committing:**
5. After implementing a screen, run the dev server and open the screen in the iOS simulator.
6. Compare the running screen against the design file side-by-side, element by element. For each element record: ✅ matches / ❌ mismatch (with description). This audit log is part of the deliverable.
7. Fix every mismatch before committing. Do not commit a screen with known visual failures.
8. Present the audit results to the user alongside the implementation. Never claim a screen is complete without showing the audit.

**Shared components first:**
9. Before implementing any screen, identify components that appear on multiple screens (e.g., the phase badge, the pain scale, the stat strip). Build those shared components correctly once, then reference them in every screen. Never inline a shared component in one screen and duplicate it in another.

---

## P11 — Negative `letterSpacing` on large Text nodes causes right-side glyph clipping on iOS

**What went wrong:**
`PainScale` used `letterSpacing: -2.24` (`-0.04em` at 56px) on a large Lato 900 Black value number. The number was visibly cut off on the right side. Three fix attempts were made before the root cause was understood:
1. `paddingRight: 4` on the parent View — wrong level, didn't help
2. `marginRight: 6` on the Text — external to the text frame, didn't help
3. Only after forced diagnosis: root cause identified and resolved

**Root cause:**
In React Native on iOS, negative `letterSpacing` causes the Text node's layout frame to be computed as `glyph_advance_width + letterSpacing` (narrower than the natural advance width). The glyph ink still extends to the full natural advance width. On iOS, text renders within its computed layout frame — ink beyond the right frame boundary is clipped. `marginRight` creates space outside the text frame and has no effect on this clipping. `paddingRight` on the Text itself would expand the frame, but the cleanest fix is to simply remove the negative letterSpacing.

**How to work going forward:**
- Do not apply negative `letterSpacing` to Text nodes with `fontSize` ≥ 24px. The tight-tracking effect is barely perceptible at large sizes and is not worth the clipping risk.
- If negative letterSpacing is required by design at large sizes, use `paddingRight` on the Text element (not `marginRight`, not padding on the parent) to expand the text frame.
- When a glyph appears clipped on one side, diagnose the clip boundary before trying fixes: is it the text node's own frame, a parent View boundary, or the ScrollView? `marginRight`/`paddingRight` on a parent and `paddingRight` on the text itself are different operations with different effects.

---

## P10 — Trying to go fast by doing too much at once is slower than doing one thing correctly

**What went wrong:**
B5-T (Today screen UI consistency) was scoped as 5 screens + 4 new components + tab bar + navigation changes, all implemented in a single session without the user reviewing intermediate results. The belief was that batching would be faster. The actual result: every screen had mismatches, every screen needs rework, and the total time spent will be 2–3× what a screen-by-screen approach would have taken.

**Why batching UI work backfires:**
- Design details compound: each screen has ~20 details; 5 screens = ~100 details. At scale, missed details are inevitable.
- No intermediate feedback: the user catches issues at the end, not during. All rework lands at once.
- Context is finite: implementing 5 screens while holding the design spec for all 5 in working memory means the spec for each screen gets less attention.

**How to work going forward:**
- The unit of UI work is one screen. Plan → confirm → implement → audit → user tests → commit. One screen at a time.
- "Moving fast" in UI work means: never rework. One correct screen in one session beats five wrong screens that each need a fix pass.
- If a session is scoped for multiple screens, treat them as sequential: finish and ship screen 1 before starting screen 2. Never parallelize screen implementations.
- Shared components (like phase badge, stat strip) are an exception: they should be built first as their own unit of work before any screen work begins, since every screen depends on them.

---

## P12 — `lineHeight < fontSize` clips text ascenders on iOS

**What went wrong:**
Welcome screen hero title used `lineHeight: 72 * 0.91 = 65.5` (less than `fontSize: 72`). The tops of "One Day" / "Stronger." were visibly clipped. The HTML/CSS design prototype showed no clipping because CSS `line-height` only controls leading — it does not clip rendered glyphs. React Native's `Text` component uses `lineHeight` as its actual layout height, and iOS clips to that boundary. At 72px, ascenders extend ~6px above the layout box and are cut off.

**Root cause:**
`Text` component height = `lineHeight`. When `lineHeight < fontSize`, glyph ascenders extend above the layout height and are clipped by iOS.

**How to work going forward:**
- `lineHeight` must be `>= fontSize` for all `Text` elements. This is a hard floor, not a guideline.
- To achieve tight visual spacing between two separate `Text` lines, use `marginTop` (negative) on the second line rather than setting `lineHeight` below `fontSize`.
- This constraint does not apply in HTML/CSS design prototypes — never port a CSS `line-height < 1` value directly to React Native without checking it against this rule.

---

## P13 — `Animated.loop` inside a component breaks `jest.useFakeTimers()` tests

**What went wrong:**
`SpinnerRing` was defined inline in `plan-generation.tsx`. It used `Animated.loop(Animated.timing(..., { duration: 900 }))` started in a `useEffect`. The plan generation tests use `jest.useFakeTimers()` and `jest.advanceTimersByTimeAsync(11000)` to skip the 10-second auto-retry delay. The looping animation created recurring RAF callbacks in the JS layer. When fake timers advanced 11 seconds, the animation's ~12 loop iterations consumed timer budget and the 10-second `setTimeout` delay never resolved correctly. 6 of 9 error-state tests failed silently — they never reached the error UI.

**Root cause:**
`Animated.loop` with `useNativeDriver: true` falls back to JS-based RAF in Jest (no native bridge). Fake timers intercept RAF. The animation's repeated short-duration timers saturate the fake clock before the test's intentional long delay can fire.

**How to work going forward:**
- Any component that uses `Animated.loop` must live in its own file so tests that need fake timers can mock it: `jest.mock('@/components/ui/SpinnerRing', () => ({ SpinnerRing: () => null }))`.
- When a test uses `jest.useFakeTimers()` and an async flow suddenly stops reaching its expected state, check for looping animations in the component tree — they are the likely culprit.
- `Animated.timing` (non-looping, one-shot) does not exhibit this problem and can stay inline.
