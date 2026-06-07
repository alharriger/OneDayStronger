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
**What:** Apply a consistent visual language across every screen using new designs created in Claude Design. Implement one group at a time; each item is its own commit, verified on device before moving to the next. Designs will be shared by the user before each group starts.

**Status:** TODAY SCREENS — NEEDS REWORK. A first implementation pass was completed on branch `feature/b5-today-screens` but does not match the designs (see P9/P10 in pitfalls.md). Rework in progress.

#### Required process for every B5 screen (non-negotiable after P9/P10):
1. User re-shares the design file for the screen in the current conversation
2. Extract full written spec before writing any code (every component, color, spacing, interaction)
3. Identify shared components that appear on this screen and prior screens — build shared components as their own unit first
4. Implement exactly one screen
5. Run dev server, compare to design element-by-element, log every match/mismatch
6. Fix all mismatches before committing
7. Present audit log to user alongside implementation; user tests on device
8. Only commit and move to next screen after user approval

#### B5 Phase 0 Shared Components — ✅ COMPLETE (2026-06-06)

Built and verified on device. Committed on `feature/b5-today-screens`.
- **AppTabBar:** custom tab bar with 2px primary active indicator at top of active tab, hidden routes (`log-workout`, `post-workout-checkin`), correct Phosphor icons + Lato 700 uppercase labels
- **PhaseBadge:** top/bottom 1px color borders spanning full card width, 6×6 dot, Lato 700 11px uppercase, primary/danger color variants
- **PainScale:** custom PanResponder slider (replaces native slider), 56px right-aligned value, 28×28 square thumb with grip lines, 11-tick marks

#### B5-T: Today Screen (IN PROGRESS)

**B5-T1: Check-in state — ✅ COMPLETE (2026-06-06, commit dc2c02c)**
All known issues resolved: phase badge below hero, lineStrong top border, correct typography, PainScale with square thumb + 56px right-aligned value + semantic fill colors, primary arrow button. Pitfall P11 added (negative letterSpacing clipping on iOS).

---

#### B5-T: Today Screen (NEEDS REWORK — designs shared, first pass rejected)

**Known issues from first pass (all must be fixed):**

**B5-T1: Check-in state (GenerateWorkout screen):**
- Phase badge missing under hero header
- Missing horizontal line separator
- "How are you feeling today?" — wrong font size and weight
- Body paragraph — wrong font/size
- PainScale component: wrong thumb shape, value display wrong (number should be right-aligned), scale labels wrong
- Button: text should be left-aligned with an icon, not centered
- Slider and number colors wrong

**B5-T2: Generating state — SKIPPED**
No design file provided. Generating state stays as existing LoadingState component.

**B5-T3: Today's Workout screen — IN PROGRESS**
Implementation plan (confirmed 2026-06-06):
- New StatStrip shared component (reused on B5-T5): flex row, N columns, top lineStrong border, bottom line border, each column has value (JBMono 500 22px) + optional unit (JBMono 600 11px primary) + label (eyebrow)
- PreWorkoutRow: add tempo + isLast props; annotation format → `{LOAD} · TEMPO {TEMPO} · REST {REST}s` (JBMono 10px 0.06em uppercase); prescription format → `{n} × {reps}` (no "sets"); fix gap/padding
- useTodayWorkout: add currentWeek (from started_at) + totalWeeks (from estimated_duration_weeks) — no new DB query
- today.tsx WorkoutDisplay: remove left-border explanation card → collapsible plain text (3 lines, Read more toggle); add StatStrip; update exercise section header; PreWorkoutRow gets tempo + isLast; Button hero→primary + arrow; ghost CTA rebuild (44px, lineFaint border, space-between)
- Header hero title: "Today's session." when workout_ready, "Today" otherwise
- WEEK stat column hidden if currentWeek or totalWeeks is null

**B5-T3: Workout display / Today's Workout screen:**
- Hero text should say "Today's session" not "Today"
- Phase badge missing under hero
- Streak strip missing (appears below hero area)
- Workout description: current left-border card does not match the design alert style
- "By the numbers" stat section missing
- Start workout button: wrong alignment (should be left-aligned with arrow icon), not centered
- "Update this workout" row does not follow design

**B5-T4: Log workout / In Progress screen:**
- Date line missing from header
- Title content wrong (user prefers "Today's Workout" label over what designs say for that field)
- Phase badge missing
- In-progress indicator missing
- Checkbox marker on InProgressRow is wrong — remove the check box square from left side
- Complete workout button: wrong alignment and color
- Divider line between exercises missing

**B5-T5: Post-workout check-in screen:**
- Screen title wrong (hyphenated word, should match design wording)
- Phase badge missing
- PainScale sliders: wrong thumb selector, value numbers misaligned and miscolored
- "By the numbers" stat strip missing the duration field
- Log workout button: wrong color and alignment
- Missing back button (needed in case user tapped Complete by accident)

**B5-T6: Workout complete screen (existing, needs rework):**
- "By the numbers" stat strip wrong, does not match design layout
- Missing divider underneath "What you did" section
- Checkmarks are circles — should be squares (matches design system: no border radius)
- Next workout row missing the "Next workout" label
- Streak bar direction wrong (should progress left-to-right with oldest on left)

#### B5-P: Plan Pages (2 items)
- **B5-P1: Plan page** — phase cards, accordion, phase badges, criteria row, jump UI
- **B5-P2: Post-onboarding plan preview** — the plan summary screen shown immediately after plan generation during onboarding

#### B5-O: Onboarding Flow (3 items)
- **B5-O1: Welcome / landing page** — the entry point before sign-up/sign-in
- **B5-O2: Intake pages 1–3** — first half of intake questions (injury description, onset, mechanism)
- **B5-O3: Intake pages 4–6 + plan generation** — second half of intake + the generating/loading state during plan creation

*Note: B5-O overlaps with B6 (pill selection). Implement B5-O first for visual design, then B6 for interaction redesign — or combine if designs already show pill selectors.*

#### B5-S: Supporting Screens (2 items)
- **B5-S1: Profile page** — user profile, injury status update, settings
- **B5-S2: History page** — ⚠️ may not exist yet; confirm whether this is a new screen or an existing one. If new, scope includes creating the screen and its route before applying the design.

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
