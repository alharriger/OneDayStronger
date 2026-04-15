# One Day Stronger

A mobile rehabilitation companion for people recovering from Proximal Hamstring Tendinopathy (PHT) without consistent access to physical therapy.

The app guides users through a clinically-grounded, AI-generated rehab plan that adapts over time based on daily check-ins and workout logs. The core loop is: **daily check-in → AI-generated workout → workout logging → adaptive plan evolution**.

---

## Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo SDK 55) |
| Language | TypeScript |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| Backend | Supabase Edge Functions (Deno) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Local cache | expo-sqlite |
| Auth storage | expo-secure-store (device keychain) |

---

## Features (MVP)

- **Onboarding** — multi-step intake form capturing injury history, irritability level, training background, and rehab goal
- **AI plan generation** — Claude generates a personalised 3–5 phase PHT rehab plan from intake data, with progression and regression criteria per phase
- **Daily check-in** — pain level, energy, and sleep logged before each session
- **AI workout generation** — each session's exercises are adapted to the day's check-in; a fallback workout is shown if the API is unavailable
- **Workout logging** — sets, reps, load, and per-exercise pain ratings logged per session; works offline and syncs on reconnect
- **Plan evolution** — Claude evaluates recent session data and adjusts phase progression automatically
- **Plan revision** — users can trigger a manual plan revision from the Profile screen when their baseline changes significantly
- **Safety screening** — red-flag keywords in intake trigger a safety advisory before plan generation
- **Account management** — sign up (email confirmation), sign in, sign out, delete account

---

## Project Structure

```
app/
  _layout.tsx                — root layout: font loading, auth gate, splash screen
  index.tsx                  — root route redirect (required by expo-router)
  (auth)/                    — login.tsx, signup.tsx
  (onboarding)/              — welcome, intake (4-step), goal-selection,
                               plan-generation, plan-summary
  (app)/                     — today, plan, history, profile, log-workout

src/
  components/ui/             — Button, Card, FormField, PainScale, SegmentedSelector, …
  hooks/                     — useAuth, useOnboardingGuard, useIntakeForm,
                               useTodayWorkout, useWorkoutLogging,
                               useOfflineSync, useNetworkStatus
  services/                  — typed Supabase wrappers for every table
  lib/
    supabase.ts              — Supabase client (expo-secure-store adapter)
    auth.ts                  — signUp, signIn, signOut, deleteAccount
    localDb.ts               — SQLite schema + CRUD helpers (offline cache)
    database.types.ts        — auto-generated Database interface (all tables)
  theme/                     — Colors, Typography, Spacing, Radius, Shadows

supabase/
  migrations/                — 0001_initial_schema.sql, 0002_rls_policies.sql
  seed.sql                   — 18 PHT exercises
  functions/
    _shared/                 — claude.ts, cors.ts, llm_logger.ts, validation.ts
    generate-plan/           — onboarding plan generation
    generate-workout/        — daily workout generation + fallback
    evolve-plan/             — automatic phase progression/regression
    revise-plan/             — manual plan revision from profile

__tests__/
  helpers/supabaseMock.ts    — Proxy-based Supabase fluent chain mock
  hooks/                     — useIntakeForm, useWorkoutLogging, useNetworkStatus,
                               useOfflineSync, useOnboardingGuard
  lib/                       — auth, localDb
  schemas/                   — llmContracts (mirrors ai_docs/llm_contracts.md)
  screens/                   — welcome, signup, intake, goalSelection,
                               planGeneration, today, plan, history, profile
  services/                  — profiles, checkins, sessions, workouts,
                               evolution, safetyEvents, revision
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 20 (via nvm recommended)
- Xcode (for iOS simulator) or Android Studio (for Android emulator)
- Supabase CLI: `brew install supabase/tap/supabase`
- An Anthropic API key (for production LLM calls)

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd OneDayStronger
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your Supabase project credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
APP_ENV=dev
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

> The anon key is safe to include here — Supabase Row Level Security enforces data access. **Never commit `.env.local`.**

### 3. Apply database migrations

```bash
supabase db push --project-ref <your-project-ref>
```

Or apply each migration file manually via the Supabase SQL editor:
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_rls_policies.sql`

Optionally seed the exercise library:

```bash
supabase db push --db-url <connection-string> < supabase/seed.sql
```

### 4. Set Edge Function secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <your-project-ref>
# Optional: bypass Claude API during development
supabase secrets set MOCK_LLM=true --project-ref <your-project-ref>
```

When `MOCK_LLM=true`, the `generate-plan` function returns a hardcoded 3-phase PHT plan without calling the Claude API. Useful for testing the full onboarding flow without incurring API costs.

### 5. Deploy Edge Functions

```bash
supabase functions deploy generate-plan --project-ref <your-project-ref>
supabase functions deploy generate-workout --project-ref <your-project-ref>
supabase functions deploy evolve-plan --project-ref <your-project-ref>
supabase functions deploy revise-plan --project-ref <your-project-ref>
supabase functions deploy delete-account --project-ref <your-project-ref>
```

### 6. Start the development server

```bash
npm start          # Expo dev server (scan QR code with Expo Go)
npm run ios        # iOS simulator
npm run android    # Android emulator
```

---

## Running Tests

```bash
# Run all tests (CI mode — no watch, exits with status code)
npm run test:ci

# Or directly:
node node_modules/.bin/jest --ci --no-coverage

# Single test file
node node_modules/.bin/jest __tests__/hooks/useIntakeForm.test.ts

# Tests matching a pattern
node node_modules/.bin/jest --testNamePattern="submit.*error"
```

> **Note:** If `npx` is not on your PATH (common with nvm), call Jest via `node node_modules/.bin/jest` directly.

---

## Development Notes

### LLM cost control

- `APP_ENV=dev` (default) routes edge function calls to `claude-haiku-4-5-20251001`
- `APP_ENV=prod` routes to `claude-sonnet-4-6`
- `MOCK_LLM=true` skips Claude entirely and returns a hardcoded response

### Edge Function authentication

The `generate-plan` function uses `verify_jwt: false` (Supabase gateway level) and performs its own JWT verification using the service role key. This is intentional — it avoids double token overhead while keeping auth fully enforced inside the function.

### Offline support

The app caches today's workout and queues workout logs locally via expo-sqlite. The `useOfflineSync` hook replays the queue when the device comes back online.

---

## AI Documentation

Extended documentation for AI-assisted development lives in [`ai_docs/`](ai_docs/):

| File | Contents |
|---|---|
| [architecture.md](ai_docs/architecture.md) | System architecture, data model, key flows |
| [design_system.md](ai_docs/design_system.md) | Color tokens, typography, component specs |
| [prd.md](ai_docs/prd.md) | Product requirements, user journeys, functional scope |
| [llm_contracts.md](ai_docs/llm_contracts.md) | LLM prompt schemas, validation rules, eval cases |
| [common_dev_guide.md](ai_docs/common_dev_guide.md) | Development conventions and workflows |

---

## Disclaimer

One Day Stronger is an educational tool and is not a substitute for professional medical care. Always consult a qualified healthcare professional before starting or modifying a rehabilitation program.
