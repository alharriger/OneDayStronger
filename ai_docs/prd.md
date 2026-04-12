# One Day Stronger — PRD

## Overview

One Day Stronger is a mobile rehab companion for people who need structured physical therapy but lack consistent access to it. The app guides users through a personalized, adaptive recovery plan — monitoring symptoms, evolving exercises based on progress, and tracking goals over time.

> One Day Stronger is an educational tool and is not a substitute for professional medical care.

## Problem Statement

Two years ago, I tore my proximal hamstring. After a full year of physical therapy, I wasn't fully recovered — and the injury flared again just as PT ended and I began a year-long sabbatical with no fixed location and inconsistent insurance coverage. I had the motivation to keep rehabbing. I just didn't have the infrastructure.

That gap is more common than it should be. Rehab is expensive, location-dependent, and time-intensive. People navigating injury recovery often face a hard choice: pay out of pocket for ongoing PT, try to piece together a plan from generic online resources, or stop rehabbing altogether. None of these are good options — and the consequences, like re-injury or chronic pain, are real.

One Day Stronger exists for the people in that gap.

## Objectives

One Day Stronger aims to give users a structured, adaptive path to recovery that meets them where they are — physically, geographically, and financially.

The application will:

- Give users a clear, evolving picture of their injury status and what their symptoms may indicate
- Generate and adapt a personalized recovery plan based on the user's goals, history, and day-to-day progress
- Track progress in a way that keeps users motivated and helps them know when to push, when to rest, and when to seek professional care

## User Experience

### Target Users

One Day Stronger is built for individuals navigating a recovery journey that requires structured, ongoing rehabilitation. The app is designed to serve three user types over time:

- **Injury recovery** — individuals rehabbing a musculoskeletal injury without consistent access to in-person PT
- **Post-surgery recovery** — individuals following a surgical procedure that requires a structured rehab protocol
- **Illness recovery** — individuals managing a condition that requires physical rehabilitation over time

> **MVP focus:** The initial release will exclusively support users with Proximal Hamstring Tendinopathy (PHT). All onboarding flows, plan logic, exercise libraries, and symptom monitoring are scoped to PHT in the MVP.

### Key User Journeys

**Authentication**
- User creates an account with email and password
- Returning users authenticate to access their profile, plan, and history
- **Edge case:** If a user attempts to access the app without authenticating, they are routed to login. Session expiry prompts re-authentication without losing unsaved progress.

**First Time Setup**
- User completes a structured intake covering basic information (age, gender, email) and PHT-specific history (injury onset, mechanism, prior treatment, irritability level, training background)
- Setup concludes with the user defining their rehab goal (e.g., return to running, pain-free daily life, return to sport)
- App generates an initial recovery plan based on intake responses and goal
- **Edge case:** If a user abandons setup mid-flow, progress is saved and they are returned to where they left off on next open. If intake responses suggest symptoms outside the PHT profile (e.g., acute trauma, neurological symptoms), the app surfaces a prompt to seek professional evaluation before continuing.

**Account Profile**
- User can view all intake responses submitted during setup (read-only)
- User can update current injury status fields at any time
- Updating injury status can trigger a recovery plan revision, which the user must confirm before it takes effect
- **Edge case:** If a user updates their profile with information that significantly changes their injury picture (e.g., new flare-up, change in pain pattern), the app flags this and prompts a plan review rather than silently updating in the background.

**Recovery Plan**
- App generates a phased recovery plan using intake data and rehab goal
- User can view the plan at a high level (week-by-week) and see their current phase
- **Edge case:** If the user requests a change that would be contraindicated (e.g., skipping a phase, dramatically increasing load), the app explains why it's not recommended and offers a safer alternative rather than complying blindly.

*V2: Backward/forward phase navigation. Natural language input field for plan questions and adjustments.*

**Day-by-Day Recovery**
- Each morning, the app prompts the user to log pain level (0–10) and soreness at the PHT site before generating a workout
- Based on check-in data, the app either generates the planned workout, a modified version, or a rest recommendation — with a plain-language explanation in each case
- Workout detail includes exercise name, sets, reps, load, tempo, and rest intervals
- **Edge case:** If a user skips the morning check-in and opens the workout directly, the app prompts check-in inline before surfacing the plan. If the app hasn't been opened in 3+ days, it prompts a re-check-in before resuming the plan as normal.

**Track Progress**
- After completing a workout, the user logs actual weight, reps completed, and any modifications made per exercise
- User provides a subjective rating of overall session difficulty and how it felt
- **Edge case:** If a user reports significant pain during a session (e.g., >5/10), the app flags this before allowing them to log completion and recommends rest or a plan review.

*V2: Partial workout auto-save. Post-workout session summary card.*

**Evolve Plans**
- The plan evolution engine evaluates session data across three dimensions: pain trend (check-in scores over time), load tolerance (weight and reps completed vs. targets), and consistency (sessions completed vs. scheduled)
- **Progression:** When a user meets phase criteria across all three dimensions over a defined window, the app advances them to the next phase and notifies them with an explanation of what changes
- **Regression:** When warning signals appear — pain trending up across 2+ sessions, missed sessions, or a user-reported flare — the app steps back to a prior phase or modified protocol and explains the decision
- **Edge case:** If evolution logic produces conflicting signals (e.g., pain is low but load tolerance hasn't improved), the app defaults to holding the current phase and flags it for the user rather than making an arbitrary call.

*V2: Plateau detection — if a user has been in a phase longer than expected without meeting progression or regression criteria, the app surfaces a check-in to understand what may be blocking progress.*

### Core Scenarios

Core scenarios describe the key situations the system must handle reliably in the MVP. Each scenario defines the trigger, what the app does, and the expected outcome.

**CS-01: New User Onboarding**
Trigger: User opens the app for the first time and creates an account.
- User completes the intake questionnaire covering basic demographics, PHT-specific injury history (onset, mechanism, prior treatment, irritability level), and current training background
- User defines their rehab goal (e.g., return to running, pain-free daily life, return to sport)
- App generates an initial recovery plan based on intake data and goal
- User is shown a plain-language summary of their plan with a projected phase timeline

Expected Outcome: User exits onboarding with a personalized, stage-appropriate recovery plan ready for Day 1.

---

**CS-02: Daily Check-In and Workout Generation**
Trigger: User opens the app on a training day or is prompted by a morning push notification.
- App prompts user for current pain level (0–10) and soreness level at the proximal hamstring site
- App evaluates check-in data against thresholds defined in the recovery plan
- If within acceptable range: app generates that day's workout with full exercise detail (name, sets, reps, load, tempo, rest)
- If pain is elevated (e.g., >3/10 at rest or >5/10 during last session): app flags this, adjusts the day's plan to a modified or rest protocol, and explains why
- If the app hasn't been opened in 3+ days: app prompts a re-check-in before resuming the plan

Expected Outcome: User receives a contextually appropriate workout or rest recommendation grounded in their reported symptoms.

---

**CS-03: Workout Logging and Progress Capture**
Trigger: User completes a workout and logs results.
- User inputs actual weight used, reps completed, and any modifications made per exercise
- User rates overall workout difficulty and provides a subjective note on how the session felt
- If user reports significant pain (>5/10) mid-log, app flags this and recommends rest or a plan review before confirming completion
- App stores session data and updates the user's progress log

Expected Outcome: Workout data is captured accurately and available for the plan evolution engine to use in future sessions.

---

**CS-04: Plan Progression**
Trigger: App detects that user has met progression criteria across pain trend, load tolerance, and consistency over a defined window.
- App evaluates cumulative session data and confirms criteria are met across all three dimensions
- App automatically advances user to the next phase and notifies user with a plain-language explanation of what changes and why
- User can review the updated plan

Expected Outcome: User progresses through recovery phases at a pace driven by their actual data, not a fixed calendar.

---

**CS-05: Plan Regression**
Trigger: App detects warning signals — pain trending up across 2+ consecutive sessions, missed workouts, or a user-flagged flare-up.
- App identifies the regression pattern and moves user back to a prior phase or modified protocol
- App explains the decision in plain language and sets expectations for re-progression
- User receives a revised plan view showing the adjusted path forward
- If evolution logic produces conflicting signals, app defaults to holding the current phase and flags it for the user rather than making an arbitrary call

Expected Outcome: Flare-ups are caught early and the plan adapts before the user is set back significantly.

---

**CS-06: User-Initiated Plan Update**
Trigger: User updates their injury status or profile with meaningful new information (e.g., new flare-up, change in pain pattern, updated rehab goal).
- User edits injury status fields in their profile
- App flags the change and prompts the user to confirm a plan review before applying updates
- App adjusts the recovery plan accordingly and shows the user what changed and why
- If the requested change would be contraindicated, app explains why and offers a safer alternative

Expected Outcome: The plan stays relevant as the user's situation evolves, without requiring a full restart.

---

**CS-07: Rest Day and Off-Schedule Handling**
Trigger: User opens the app on a non-training day, or has not logged a workout within the expected window.
- On rest days: app confirms rest and optionally surfaces an educational tip about PHT recovery
- If user has missed scheduled sessions: app prompts user to log a reason (life, pain, travel) and adjusts the plan timeline without invalidating prior progress

Expected Outcome: Gaps in training are handled gracefully and the plan adjusts without punishing the user.

---

**CS-08: Safety Guardrails and Disclaimer Surfacing**
Trigger: User reports symptoms outside the expected PHT profile (e.g., sharp radiating pain, numbness, sudden acute injury) or pain levels that cross a defined safety threshold.
- App pauses plan generation and surfaces a prominent advisory recommending the user consult a medical professional before continuing
- App logs the event but does not generate a modified workout until the user confirms they have sought or plan to seek professional guidance
- Disclaimer is surfaced at key moments: onboarding, plan generation, and any high-pain check-in

Expected Outcome: The app acts within its scope as an educational tool and routes users to professional care when symptoms exceed its guardrails.

## Functional Requirements

- **FR-01: User Authentication**
  - Support account creation and login via email and password
  - Persist sessions across app closes
  - Restrict all app content to authenticated users

- **FR-02: Intake and Profile**
  - Collect and store structured intake on first use: demographics and PHT-specific injury history
  - Allow users to view intake responses post-setup (read-only)
  - Allow users to edit injury status fields at any time
  - Trigger a plan revision confirmation flow when injury status is updated

- **FR-03: Recovery Plan Generation**
  - Generate a phased recovery plan via LLM API using intake data and rehab goal
  - Structure the plan into phases with exercises, load targets, and progression criteria
  - Store the generated plan so it is retrievable without a new API call on each view
  - Surface a plain-language phase summary to the user after generation

- **FR-04: Daily Check-In**
  - Send a morning push notification prompting pain (0–10) and soreness logging
  - Allow check-in to be completed inline if the notification is dismissed
  - Store each check-in with a timestamp against the user's session record
  - Prompt a fresh check-in if the app has not been opened in 3+ days

- **FR-05: Workout Generation**
  - Generate a daily workout based on current plan phase and most recent check-in data
  - Include full exercise detail: name, description, sets, reps, load, tempo, and rest
  - Generate a modified or rest protocol if pain exceeds defined thresholds, with a plain-language explanation
  - Block workout generation until check-in is complete

- **FR-06: Workout Logging**
  - Allow users to log actual weight, reps, and modifications per exercise
  - Collect a subjective difficulty rating and optional free-text session note
  - Surface a warning and prompt rest or plan review if pain >5/10 is reported during logging
  - Store all logged data against the user's session record

- **FR-07: Plan Evolution**
  - Continuously evaluate session data across pain trend, load tolerance, and training consistency
  - Advance user to next phase and notify them when all progression criteria are met over a defined window
  - Step user back and notify them when regression signals appear across 2+ consecutive sessions
  - Hold current phase and surface a flag to the user when evolution signals conflict

- **FR-08: Safety Guardrails**
  - Define pain and symptom thresholds that trigger an advisory pause on plan generation
  - Surface a prominent recommendation to seek professional care when thresholds are crossed
  - Log all safety threshold events against the user's record
  - Display the educational tool disclaimer at onboarding, plan generation, and high-pain check-ins

- **FR-09: Push Notifications**
  - Send a daily morning push notification to prompt check-in
  - Allow users to configure notification delivery time
  - Request notification permissions during onboarding

- **FR-10: Data Persistence**
  - Persist all user data — intake, profile, check-ins, workouts, logs, and plan state — across sessions and devices
  - Ensure no data loss due to app close, device switch, or API failure
  - Support offline viewing of current plan and workout logging, with sync on reconnect

## Nonfunctional Requirements

### Performance

- Daily workout view loads within 3 seconds on a standard LTE connection
- LLM-generated content returns within 10 seconds or surfaces a loading state
- App is usable offline for viewing the current plan and logging workouts, with data syncing on reconnect

### Reliability

- LLM API failures are handled gracefully with a clear error message and retry option
- Session data is never lost due to API or network failures
- Core features target 99.5% uptime

### Usability

- App is operable one-handed on a standard smartphone screen
- Primary actions (check-in, view workout, log session) are reachable within 3 taps from the home screen
- Font sizes and contrast meet WCAG AA accessibility standards
- Medical terminology is always accompanied by a plain-language explanation

### Design Quality

- UI tone is calm and supportive — not clinical or intimidating
- UI follows platform conventions for iOS and Android respectively
- Plan and workout views are scannable at a glance without requiring the user to read dense text

### Security & Data

- All user data is encrypted in transit (TLS) and at rest
- Authentication tokens are stored in the device keychain, not local storage
- App follows HIPAA-adjacent best practices given the sensitive nature of health data
- No user health data is used to train or fine-tune any LLM model without explicit user consent

## Scope

| Project Phase | Scope |
|--------------|-------|
| MVP | PHT users only. Core loop: daily check-in → workout generation → logging → plan adaptation (progression and regression). Basic profile and injury history. Safety guardrails. |
| V2 | Natural language plan input field. Backward/forward plan navigation. Plateau detection in plan evolution. Partial workout auto-save. Post-workout session summary card. Support for users with other diagnosed injuries. |
| V3 | User is experiencing pain and can use the application to begin journaling symptoms without a formal diagnosis. |
| Later | TBD |

### V2 Features

The following features are explicitly out of scope for the MVP but are planned for V2. They are documented here to ensure MVP technical decisions do not inadvertently block their future implementation.

**Natural Language Plan Input** — Users will be able to ask questions about their recovery plan or request adjustments using a natural language input field. In MVP, plan adjustments are handled through structured profile updates only.

**Backward/Forward Plan Navigation** — Users will be able to browse completed phases and preview upcoming phases within their recovery plan. In MVP, users see their current phase only.

**Plateau Detection** — The plan evolution engine will detect when a user has been in a phase longer than expected without meeting either progression or regression criteria. The app will surface a targeted check-in to understand what may be blocking progress. In MVP, the engine handles progression and regression only.

**Partial Workout Auto-Save** — If a user closes the app mid-log, their in-progress workout data will be automatically saved and resumable on next open. In MVP, users should complete logging in a single session.

**Post-Workout Session Summary** — After logging a workout, users will see a summary card confirming what was captured and surfacing any notable signals (e.g., personal bests, pain flags). In MVP, the app confirms logging without a structured summary view.

**Expanded Injury Support** — V2 will extend the app's onboarding flows, plan logic, and exercise library to support users with other diagnosed musculoskeletal injuries beyond PHT.

## Success Metrics

**Phase 1: Personal Use**
- Pain trend — meaningful reduction in self-reported pain score (≥2 points on 0–10 scale) over a 6-week window. This is the only metric that matters right now.
- Plan progression — advancing at least one phase within the first 60 days, indicating the plan is calibrated correctly
- Workout completion — subjective sense that generated workouts are appropriate, progressively challenging, and safe
- Plan accuracy — do the generated exercises, loads, and progressions reflect what a knowledgeable PT would actually prescribe for PHT?
- Safety guardrail quality — are the thresholds catching real warning signals without being overly conservative?

**Phase 2: External Users**
- Engagement: D7 / D30 retention, check-in completion rate (target >70%), workout completion rate (target >65%), session streak length
- Clinical: % of users reporting ≥2 point pain reduction over 6 weeks, plan progression rate within 60 days, safety escalation rate as a calibration signal
- Business: onboarding completion rate (target >80%), App Store rating (target ≥4.3 within 90 days), organic install rate as a proxy for word-of-mouth

## Technical Constraints

**Phase 1: Personal Use**
- React Native (Expo) on personal device only — no App Store submission required yet
- Supabase free tier is sufficient for a single user
- Claude API costs are negligible at personal use volume — no rate limiting or cost controls needed
- Push notifications not required if manual check-in works for now
- Data deletion and right-to-erasure compliance not required at this stage

**Phase 2: External Users**
- iOS 16+ and Android 13+ support via single React Native (Expo) codebase
- App Store and Google Play distribution; must comply with both stores' health app review guidelines
- Supabase Postgres with row-level security enabled for multi-user data isolation
- All LLM API calls made server-side — never directly from the client
- No third-party analytics tools that transmit raw health data
- Full data deletion executable on user request (right to erasure)
- Expo Notifications for push notification delivery at scale
- LLM output validated against a defined schema before being stored or surfaced — no raw model output displayed directly
- Prompt templates versioned server-side so they can be updated without an app release
- Current plan and most recent workout cached locally for offline access
- Workout logging queueable offline with sync on reconnect

## Related Documentation
