# Architecture

## Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Backend | Supabase Edge Functions |
| Object Storage | Cloudflare R2 |
| AI | Claude API (claude-sonnet-4-6) |

---

## System Overview

The application has three logical layers:

```
┌─────────────────────────────────┐
│     Mobile App (Expo)           │
│  React Native / TypeScript      │
│  Local cache · Offline queue    │
└────────────┬────────────────────┘
             │ HTTPS / JWT
┌────────────▼────────────────────┐
│       Supabase                  │
│  PostgreSQL · Auth · RLS        │
│  Edge Functions (Deno)          │
└────────┬───────────┬────────────┘
         │           │
┌────────▼───┐  ┌────▼────────────┐
│ Claude API │  │ Cloudflare R2   │
│ (LLM)      │  │ (Object Storage)│
└────────────┘  └─────────────────┘
```

The mobile client communicates directly with Supabase for all data reads and writes. Any operation that requires the Claude API is routed through a Supabase Edge Function — the client never holds or calls the Claude API key directly. Cloudflare R2 stores exercise demo media; the client accesses it via pre-signed URLs generated server-side.

---

## Application Layers

### Mobile App (React Native / Expo)

**Navigation structure:**

```
Auth Stack
  └── Login
  └── Sign Up

Onboarding Stack (first-run only)
  └── Welcome
  └── Intake (multi-step form)
  └── Goal Selection
  └── Plan Generation (loading state)
  └── Plan Summary

Main App (tab navigation)
  └── Today       — check-in, daily workout, rest confirmation
  └── Plan        — current phase view and phase summary
  └── History     — past sessions and logged data
  └── Profile     — intake (read-only), injury status editor, settings
```

**Local data (expo-sqlite):**
- Current active plan phase and all phase exercises
- Today's generated workout
- Pending workout logs queued for sync when offline

**Key libraries:**
- `supabase-js` — database, auth, realtime
- `expo-secure-store` — auth token storage (device keychain)
- `expo-sqlite` — local offline cache and sync queue
- `expo-notifications` — push notification handling

---

### Backend (Supabase Edge Functions)

All business logic that touches external APIs or sensitive operations lives here. The client calls these functions authenticated; the function runs with its own server-side secrets.

| Function | Trigger | Responsibility |
|---|---|---|
| `generate-plan` | After intake completion | Calls Claude with full intake → validates response schema → inserts plan, phases, exercises |
| `generate-workout` | After check-in submitted | Calls Claude with check-in + current phase → validates → inserts generated workout |
| `evolve-plan` | After workout log saved | Evaluates session data across all three dimensions → determines progression / regression / hold |
| `revise-plan` | After injury status update | Calls Claude with updated status + current plan → generates revised plan, supersedes old |
| `r2-presign` | On-demand (admin) | Generates pre-signed Cloudflare R2 URL for exercise video uploads |

---

### External Services

**Claude API** — plan generation, workout generation, plan revision. All calls made from edge functions. API key stored as an edge function secret, never exposed to the client.

**Cloudflare R2** — exercise demo videos and any user media. Client receives pre-signed URLs from the `r2-presign` function; uploads and downloads go directly to R2, not through Supabase.

**Expo Push Notifications** — daily morning check-in reminders. Notification time is user-configurable. Phase 1: manual check-in is sufficient; notification infrastructure added before Phase 2.

---

## Data Model

### Schema

**`profiles`** — extends `auth.users`; created on account creation
```
user_id            uuid  PK  FK → auth.users
age                integer
gender             text
rehab_goal         text        (return_to_running | pain_free_daily | return_to_sport | other)
onboarding_step    text        (intake | goal | generating | complete)
notification_time  time
created_at         timestamptz
updated_at         timestamptz
```

**`injury_intake`** — immutable after onboarding; read-only in profile view
```
id                 uuid  PK
user_id            uuid  FK → profiles
injury_onset_date  date
mechanism          text        (gradual | acute | post_surgery | unknown)
prior_treatment    text
irritability_level text        (low | moderate | high)
training_background text
created_at         timestamptz
```

**`injury_status`** — mutable; updates can trigger plan revision
```
id                 uuid  PK
user_id            uuid  FK → profiles
pain_level_baseline integer     (0–10)
current_symptoms   text
last_flare_date    date
updated_at         timestamptz
```

**`recovery_plans`**
```
id                      uuid  PK
user_id                 uuid  FK → profiles
status                  text  (active | completed | paused | superseded)
rehab_goal              text
plain_language_summary  text
prompt_version          text
generated_at            timestamptz
```

**`plan_phases`**
```
id                      uuid  PK
plan_id                 uuid  FK → recovery_plans
phase_number            integer
name                    text
description             text
plain_language_summary  text
estimated_duration_weeks integer
status                  text  (upcoming | active | completed | regressed_from)
progression_criteria    jsonb   (pain_threshold, load_tolerance_pct, consistency_pct, window_days)
regression_criteria     jsonb   (pain_consecutive_sessions, missed_sessions_window)
started_at              timestamptz
completed_at            timestamptz
```

**`exercises`** — PHT exercise library; admin-managed
```
id           uuid  PK
name         text
description  text
instructions text
category     text  (isometric | eccentric | strength | mobility | cardio)
video_url    text  (Cloudflare R2 path)
created_at   timestamptz
```

**`phase_exercises`** — prescribed exercises per phase
```
id               uuid  PK
phase_id         uuid  FK → plan_phases
exercise_id      uuid  FK → exercises
prescribed_sets  integer
prescribed_reps  text        (e.g. "8–12" or "30s hold")
load_target      text        (e.g. "bodyweight", "light resistance", or kg)
tempo            text        (e.g. "3-1-3")
rest_seconds     integer
order_index      integer
notes            text
```

**`sessions`** — one record per training day
```
id               uuid  PK
user_id          uuid  FK → profiles
plan_phase_id    uuid  FK → plan_phases
scheduled_date   date
session_type     text  (training | rest | modified)
status           text  (scheduled | completed | skipped | rest_day)
skip_reason      text  (life | pain | travel | other)  nullable
created_at       timestamptz
```

**`check_ins`**
```
id             uuid  PK
user_id        uuid  FK → profiles
session_id     uuid  FK → sessions  nullable
pain_level     integer   (0–10)
soreness_level integer   (0–10)
triggered_by   text  (notification | inline | manual | re_checkin_after_gap)
checked_in_at  timestamptz
```

**`generated_workouts`** — LLM output per session
```
id                       uuid  PK
session_id               uuid  FK → sessions
check_in_id              uuid  FK → check_ins
workout_type             text  (standard | modified | rest_recommendation)
plain_language_explanation text
prompt_version           text
generated_at             timestamptz
```

**`generated_workout_exercises`**
```
id                   uuid  PK
generated_workout_id uuid  FK → generated_workouts
exercise_id          uuid  FK → exercises  nullable
exercise_name        text
sets                 integer
reps                 text
load                 text
tempo                text
rest_seconds         integer
order_index          integer
notes                text
```

**`workout_logs`** — user's post-session record
```
id                     uuid  PK
user_id                uuid  FK → profiles
session_id             uuid  FK → sessions
generated_workout_id   uuid  FK → generated_workouts
difficulty_rating      integer   (1–10)
session_notes          text
pain_during_session    integer   (0–10)
completed_at           timestamptz
```

**`exercise_logs`** — per-exercise actuals within a workout log
```
id               uuid  PK
workout_log_id   uuid  FK → workout_logs
exercise_id      uuid  FK → exercises  nullable
exercise_name    text
sets_completed   integer
reps_per_set     jsonb   (array of integers)
weight_per_set   jsonb   (array of floats, in kg; null = bodyweight)
modifications    text
```

**`plan_evolution_events`** — audit trail of all phase changes
```
id              uuid  PK
user_id         uuid  FK → profiles
plan_id         uuid  FK → recovery_plans
from_phase_id   uuid  FK → plan_phases  nullable
to_phase_id     uuid  FK → plan_phases  nullable
event_type      text  (progression | regression | hold | plan_revised)
rationale       text  (plain language shown to user)
triggered_by    text  (auto | user_initiated)
created_at      timestamptz
```

**`safety_events`**
```
id                            uuid  PK
user_id                       uuid  FK → profiles
session_id                    uuid  FK → sessions  nullable
trigger                       text  (high_pain_checkin | high_pain_logging | atypical_symptoms | intake_flagged)
pain_level_reported           integer   nullable
details                       text
professional_care_acknowledged boolean  default false
acknowledged_at               timestamptz  nullable
created_at                    timestamptz
```

---

## Key Flows

### Onboarding

```
1. User creates account
   → Supabase Auth issues JWT
   → profiles row created (onboarding_step = 'intake')

2. User completes intake form (multi-step, progress saved per step)
   → injury_intake row inserted on completion
   → profiles.onboarding_step = 'goal'

3. User selects rehab goal
   → profiles.rehab_goal updated
   → profiles.onboarding_step = 'generating'

4. Client calls generate-plan edge function
   → Claude prompt constructed from intake + goal
   → Response validated against plan schema
   → recovery_plan + plan_phases + phase_exercises inserted
   → profiles.onboarding_step = 'complete'

5. Client displays plan summary screen
   → First session record created for Day 1
```

If onboarding is abandoned mid-flow, `onboarding_step` tracks where to resume on next open.

If intake responses flag atypical symptoms (acute trauma, neurological signs), `generate-plan` inserts a `safety_event` and returns an advisory before creating a plan.

---

### Daily Loop

```
1. Push notification fires at user's configured time
   → User opens app → Today screen

2. Check-in screen (always required before workout)
   → User submits pain (0–10) and soreness (0–10)
   → check_in row inserted
   → If app unopened for 3+ days: triggered_by = 're_checkin_after_gap'

3. Safety evaluation (in generate-workout function)
   → pain_level ≥ 8 OR atypical symptoms reported:
       safety_event inserted, advisory returned, workout blocked
   → pain_level 4–7:
       modified protocol prompt sent to Claude
   → pain_level 0–3:
       standard workout prompt sent to Claude

4. Claude returns structured workout JSON
   → Validated against schema
   → generated_workout + generated_workout_exercises inserted
   → Client displays workout

5. User completes workout → opens log form
   → If pain_during_session > 5: warning surfaced, must acknowledge before submitting
   → workout_log + exercise_logs inserted

6. evolve-plan function triggered
   → Evaluates progression / regression (see Plan Evolution below)
   → plan_evolution_event inserted if phase changes
   → Client notified of any phase change
```

---

### Plan Evolution

Runs after every `workout_log` insert. Queries session data over the window defined in the current phase's `progression_criteria`.

**Three evaluation dimensions:**

| Dimension | Data source | Signal |
|---|---|---|
| Pain trend | `check_ins.pain_level` over window | Average pain vs. phase threshold |
| Load tolerance | `exercise_logs` actual vs. `phase_exercises` targets | % of target load achieved |
| Consistency | `sessions` completed vs. scheduled over window | Completion rate |

**Decision logic:**

```
IF all three dimensions meet progression_criteria thresholds:
  → Advance to next phase
  → Insert plan_evolution_event (type: progression)
  → Notify user with plain-language rationale

ELSE IF pain trending up across 2+ consecutive sessions
  OR missed sessions exceed regression_criteria window:
  → Step back to prior phase (or modified protocol)
  → Insert plan_evolution_event (type: regression)
  → Notify user with plain-language rationale

ELSE IF signals conflict (e.g. pain OK, load tolerance not met):
  → Hold current phase
  → Insert plan_evolution_event (type: hold)
  → Surface flag to user explaining what's holding progression

ELSE:
  → No change, continue current phase
```

---

### User-Initiated Plan Revision

```
1. User edits injury_status fields in Profile
2. App detects meaningful change → prompts plan review confirmation
3. User confirms → client calls revise-plan edge function
4. Edge function:
   → Constructs Claude prompt with updated status + current plan state
   → Validates response
   → Inserts new recovery_plan (status: active)
   → Sets old plan status: superseded
   → Inserts plan_evolution_event (type: plan_revised)
5. Client displays revised plan summary with change explanation
```

---

### Safety Guardrail

Triggered at three points: intake, check-in, workout logging.

```
Trigger conditions:
  - Intake: neurological symptoms, acute trauma indicators
  - Check-in: pain_level ≥ 8, or user reports atypical symptoms
  - Logging: pain_during_session > 5

On trigger:
  → safety_event inserted (professional_care_acknowledged = false)
  → Workout generation blocked
  → Advisory surfaced to user (prominent, not dismissable without acknowledgment)
  → Disclaimer displayed

To resume:
  → User acknowledges advisory
  → safety_event.professional_care_acknowledged = true
  → Workout generation unblocked for next session
```

The disclaimer is also surfaced passively at: onboarding completion, every plan generation, and any check-in where pain ≥ 5.

---

## LLM Integration

### Plan Generation

**Prompt structure:**
- System: PHT clinical context, output JSON schema, educational tool constraints, safety boundaries
- User: structured intake data (age, mechanism, onset, treatment history, irritability level, training background, rehab goal)

**Expected output schema:**
```json
{
  "plain_language_summary": "string",
  "phases": [
    {
      "phase_number": 1,
      "name": "string",
      "description": "string",
      "plain_language_summary": "string",
      "estimated_duration_weeks": 4,
      "progression_criteria": {
        "pain_threshold": 3,
        "load_tolerance_pct": 85,
        "consistency_pct": 80,
        "window_days": 14
      },
      "regression_criteria": {
        "pain_consecutive_sessions": 2,
        "missed_sessions_window": 3
      },
      "exercises": [
        {
          "name": "string",
          "sets": 3,
          "reps": "string",
          "load_target": "string",
          "tempo": "string",
          "rest_seconds": 90,
          "notes": "string"
        }
      ]
    }
  ]
}
```

### Workout Generation

**Prompt structure:**
- System: current phase description, exercise library reference, output schema, pain threshold rules
- User: today's check-in (pain, soreness), last 3 check-in scores, phase prescription

**Expected output schema:**
```json
{
  "workout_type": "standard | modified | rest_recommendation",
  "plain_language_explanation": "string",
  "exercises": [
    {
      "exercise_name": "string",
      "sets": 3,
      "reps": "string",
      "load": "string",
      "tempo": "string",
      "rest_seconds": 90,
      "notes": "string"
    }
  ]
}
```

### Validation and Error Handling

- All Claude responses validated against the relevant JSON schema before any database write
- On schema validation failure: one automatic retry with the error appended to the prompt
- On persistent failure: user-facing error with retry option; raw response logged for debugging
- No raw LLM output is ever surfaced directly to the user or written to the database unvalidated

### Prompt Versioning

- Phase 1: prompt templates in edge function source code, versioned via Git
- Phase 2: prompt templates stored in a `prompt_versions` table, loaded at runtime — allows prompt updates without an app release
- `prompt_version` field on `recovery_plans` and `generated_workouts` tracks which template produced each record

---

## Offline Strategy

### What's cached locally (expo-sqlite)

| Data | When cached | Eviction |
|---|---|---|
| Current plan phase + exercises | On plan generation and each phase change | Replaced on next phase change |
| Today's generated workout | On workout generation | Replaced next day |
| Pending workout log | On submit while offline | Removed after successful sync |

### Offline capabilities

- **View today's workout** — always available from local cache
- **View current plan phase** — always available from local cache
- **Submit workout log offline** — written to local queue; synced on reconnect in submission order
- **Check-in offline** — stored locally; workout generation deferred until reconnected (requires Claude API call)

### Sync on reconnect

The Supabase JS client detects reconnection. On reconnect:
1. Pending workout logs flushed from local queue in order
2. `evolve-plan` triggered after each log syncs
3. Local cache refreshed with any server-side plan changes

---

## Security

### Row-Level Security

All user tables enforce `user_id = auth.uid()` at the PostgreSQL level. A misconfigured query cannot return another user's data — isolation is enforced by the database, not application code.

```
profiles             → user_id = auth.uid()
injury_intake        → user_id = auth.uid()
injury_status        → user_id = auth.uid()
recovery_plans       → user_id = auth.uid()
plan_phases          → via recovery_plans
sessions             → user_id = auth.uid()
check_ins            → user_id = auth.uid()
generated_workouts   → via sessions
workout_logs         → user_id = auth.uid()
exercise_logs        → via workout_logs
safety_events        → user_id = auth.uid()
exercises            → public read, no write from client
```

### Auth Tokens

- Issued by Supabase Auth as JWTs
- Stored in `expo-secure-store` (device keychain) — never in AsyncStorage or local storage
- All Supabase API calls attach the user JWT; RLS evaluates `auth.uid()` from it

### API Keys

- Claude API key: stored as a Supabase Edge Function secret; never in client code or API responses
- Cloudflare R2 credentials: stored as edge function secrets; client receives only pre-signed URLs with expiry

### Data in Transit

- All Supabase traffic over TLS
- R2 uploads and downloads via HTTPS pre-signed URLs
- Claude API calls from edge functions over TLS
