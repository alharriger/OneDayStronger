# Current Sprint Plan — Phase 1 Completion

## Context

Planning session conducted 2026-05-22. Phase A (condition modules) is complete and stable. This sprint closes out Phase 1 by fixing known bugs, adding remaining MVP features, and cleaning up scope. After this sprint, the app should be ready for personal-use Phase 1 evaluation.

**Working branch strategy:** One feature branch per group. Never develop on `main`.

---

## Execution Order

Work through these groups sequentially. Do not start a group until the prior one is complete and tested.

---

## Deferred Infrastructure

### INF-1. Fix Gemini LLM fallback
**Status:** MOCK_LLM=true is set — safe to continue development. Come back to this before turning mock off.
**Problem:** Gemini `gemini-2.0-flash` returns `limit: 0` quota error on the current API key. Groq is the primary and works, but the fallback is broken.
**Fix:** Create a new API key from a brand-new Google Cloud project at aistudio.google.com → "Create API key in new project". Key should start with `AIza`. Update `GEMINI_API_KEY` Supabase secret. Set `MOCK_LLM=false` only after confirming the fallback works.

---

## ⚡ Critical Gaps — COMPLETED

### G1. No completed workout state — Today shows "Start workout" after completion
**Status:** ✅ COMPLETE (2026-06-02)

### G2. Stale SQLite cache shows old workout after plan revision
**Status:** ✅ COMPLETE (2026-06-02, commit b0a2829)

### G3. evolve-plan doesn't notify the app — phase changes invisible until relaunch
**Status:** ✅ COMPLETE (2026-06-02, commit b0a2829)

### G4. Workout Complete screen redesign
**Status:** ✅ COMPLETE (2026-06-03, merged to main)

---

## Group A — Bugs

### A1. Exercise names showing as "Exercise" — CONFIRMED RESOLVED
No code change needed.

### A2. Plan page + Today screen don't refresh after any plan-changing action
Resolved by G1-G3.

### A3. Latter phase exercises not appropriately advanced — condition_modules seed data
**Status:** ✅ COMPLETE — migration `0007_expand_pht_exercise_library.sql` already deployed.

### A4. Plan UX issues
**Status:** ✅ COMPLETE
- "Sample workout" label: already correct
- "I'm here" label: already correct
- Exercise cap (mock capped at 3): fixed — `generate-workout` mock now uses `.slice(0, 6)`
- Text overflow fixes: completed

---

## Group B — New MVP Features

### B1. Plan generation: day and time aware
**Status:** ✅ COMPLETE — already fully implemented. `generate-plan` and `generate-workout` both accept `isoDate`, `dayOfWeek`, `timeOfDay` from client and build a `schedulingContext` string threaded into the LLM prompt. Client (`useTodayWorkout.ts`) already passes all three fields on every workout generation call.

### B2. Evolve-plan: post-workout feedback + days between workouts
**Status:** ✅ COMPLETE (evaluator + tests) — `evaluator.ts` already has `recentWorkoutLogs`, `difficultyHoldThreshold`, `sessionGapRegressionDays` inputs, computes `avgDifficulty` + `maxSessionGapDays`, and fires hold/regression decisions accordingly. Full test coverage in `evolvePlan.evaluator.test.ts`.
**Known bug (fix folded into B3):** `evolve-plan/index.ts` sessions query selects only `status, scheduled_date` — missing `id`. This means `sessionIds` is always empty and workout logs are never fetched, so the difficulty/gap signals never receive real data. One-line fix: add `id` to the select.

### B3. "Update this workout" feature
**Status:** IN PROGRESS
**What:** New entry at the bottom of Today screen's workout view. Gives user three options:
- **Challenge me more** — regenerate today's workout using next-phase exercises (no permanent phase change)
- **Ease it up** — regenerate today's workout using current-phase exercises with conservative parameters (lower end of prescribed ranges, focus on form and pain management; no permanent phase change)
- **Something else** — free text field; workout regenerated with the user's note as context

**MVP behavior — all three options regenerate today's workout only, no phase change:**
- *Advance:* Fetches next phase's exercises; passes `overridePhaseId` to `generate-workout`. Stores `override_type: 'advance'` on `generated_workouts`.
- *Phase Back:* Passes `overrideType: 'phase_back'` to `generate-workout`; prompt instructs LLM to use conservative end of current phase prescription. No `jumpToPhase` call. Stores `override_type: 'phase_back'`.
- *Other:* Passes `overrideNote` to `generate-workout`; appended to user message. Stores `override_type: 'other', override_note: <text>`.

**V2 decision deferred:** Whether phase advancement/regression decisions should be LLM-driven or fully on-device deterministic logic is an open architectural question. Documented in Group D. For MVP all three options are workout-only overrides with no plan state change.

**New columns needed on `generated_workouts`:**
```
override_type   text nullable  ('advance' | 'phase_back' | 'other' | null)
override_note   text nullable
```

**Edge function changes:** `generate-workout` accepts optional `overridePhaseId`, `overrideNote`, `overrideType`. When `overridePhaseId` present, fetches exercises from that phase. When `overrideNote` present, appends to user message. Stores override fields on insert.

### B4. Global view refresh after any plan-regeneration trigger
**Status:** ✅ COMPLETE — covered by G1-G3 + A2.

### B5. UI design consistency pass — all screens to match completed workout page
**What:** The completed workout screen (WorkoutCompletedView) established a refined visual language: mono date header, Lato 900 hero title, section eyebrows in caps, structured stat strips, left-stripe cards. All other app screens (Today check-in, Today workout view, Plan, Log Workout, onboarding) should be audited and updated to match this design language for a cohesive first-use experience.
**Scope:** Audit each screen against the completed workout design reference. Apply consistent header pattern (mono date + hero title), typography scale, color token usage, and card/section structure. No new components unless truly necessary — update existing styles.
**Constraint:** Do screens one at a time; each screen update is its own commit. Verify on device before moving to the next.

### B6. Intake/onboarding flow: replace open text fields with pill selection
**What:** The current onboarding uses open text inputs for fields that have a known answer set (e.g. injury mechanism, activity level, goals). Replace these with tappable pill/chip selectors so the user never types in a free-text field unless the answer genuinely can't be enumerated.
**Scope:** Audit every intake question. For each question with a bounded answer set, replace the `TextInput` with a row of selectable pills (single or multi-select as appropriate). Free-text fields that remain should be short and clearly labeled (e.g. "Describe your injury in your own words").
**Design:** Pills should follow the existing chip style from ExerciseCard. Selected state = moss fill + inkOnDark text. Unselected = surfaceStrong background + ink text.
**Schema:** No DB changes needed — the stored values are the same; only the capture UI changes.

---

## Group C — Descoping (PRD + docs updates)

Remove from MVP scope in PRD and architecture docs:
- **CS-07 Rest Day and Off-Schedule Handling** → move to future milestone
- **FR-09 Push Notifications** → move to future milestone
- **FR-04** morning push notification trigger → descoped; inline/manual check-in covers Phase 1

No code changes needed — these are doc-only updates. Update `prd.md` and note descoping clearly in the scope table.

---

## Group D — V2 Additions to Document

Add to PRD V2 section (doc only, no code):
- **External workout logging:** User can log rehab done outside the app. Counts toward consistency scoring in evolution. Architecture note: needs `external_workout_logs` table or a `is_external` flag on `sessions`.
- **Updated onboarding flow:** Align intake questions with a structured clinical assessment (PT-style progressive questioning).
- **Phase start selection:** After plan generation during onboarding, user can select which phase to start from.
- **"Need additional help":** Button below "Start Workout" on Today screen; opens a separate page where user specifies what they need help with.
- **Evaluation and profile management redesign:** Establish a uniform, consistent process for when plan changes are triggered across all flows (profile updates, check-ins, phase jumps, workout completion). Define a single formula/framework rather than the current ad-hoc per-flow logic. Specifically: clarify what triggers revise-plan vs. notifyPlanChanged only vs. silently updates.
- **On-device exercise logic feasibility spike:** Investigate whether all workout generation logic (exercise selection, sets/reps/load calibration, modification rules) can run entirely on-device without edge function API calls. Questions to answer: Can the condition module + phase prescription data be bundled into the app? Is the LLM call strictly necessary or is it doing deterministic selection that could be rule-based? What would the offline/latency tradeoffs look like? Output: a short technical brief with a recommendation (keep API calls, move fully on-device, or hybrid).
- **LLM vs. on-device logic for workout override decisions (B3 follow-up):** The "Update this workout" feature (B3) was implemented as workout-only overrides with no LLM phase evaluation. V2 should determine: should the Phase Back option trigger actual plan phase changes based on LLM or deterministic criteria? Should Advance be a multi-session tracked progression signal feeding into `evolve-plan`? This is the same question as the on-device spike above but specifically applied to the override flow.

---

## Post-V1: Portfolio Distribution

### PD-1. Web version for portfolio/resume access

**Goal:** Anyone with a browser can access the app at a URL — no app store, no install, no Apple Developer account required. Primary use: portfolio link on resume to demonstrate AI-assisted app development.

**Approach:** Deploy Expo web build to Vercel or Netlify (both free). React Native Web is already supported by the stack; Supabase auth and edge functions work on web without changes.

**Work required:**
- Stub out or gate `expo-sqlite` (local cache) — does not work on web; app will crash without a fallback
- Gate `expo-notifications` — not supported on web; can be a no-op for demo purposes
- Gate `expo-secure-store` if referenced — falls back to AsyncStorage on web
- Audit remaining native modules for web compatibility
- Configure `app.json` web output
- Deploy to Vercel/Netlify; confirm auth flow, check-in, workout generation, and plan screen all work in browser
- Add URL to resume/portfolio

**Trade-offs to accept:**
- UI is designed for mobile; it will display as a narrow mobile-width layout in desktop browsers — acceptable for portfolio demo
- Local caching (offline mode) won't work on web — acceptable for demo use
- Push notifications won't work on web — acceptable (already descoped from MVP)

**Platform notes:**
- iOS distribution to others requires Apple Developer Account ($99/year) — defer until budget allows
- Android distribution to others: EAS Internal Distribution (free) generates a shareable APK download link; Play Store is $25 one-time — both are post-V1 decisions

---

## Completion Criteria

The sprint is done when:
- [x] G1-G3 fixed and verified (Today screen completed state, cache invalidation, evolve-plan notification)
- [x] G4 Workout Complete screen redesigned and verified on device
- [x] All Group A bugs fixed and verified on device
- [x] B1 day/time context passing through plan generation (already complete)
- [x] B2 difficulty + gap signals in evolve-plan evaluator, with tests (already complete; sessions bug fix in B3)
- [ ] B3 "Update this workout" works for all three options (workout-only overrides, no phase change)
- [ ] All views refresh correctly after any plan-change event
- [ ] Group C descoping reflected in PRD and architecture docs
- [ ] Group D V2 additions documented in PRD
- [ ] B5 UI consistency pass complete across all screens
- [ ] B6 Intake pill selection implemented for all bounded-answer fields
- [ ] All tests passing
- [ ] Memory files updated to reflect completion
