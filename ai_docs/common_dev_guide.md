# Common Dev Guide

Development conventions, patterns, and workflows for One Day Stronger.

---

## Project structure

```
app/
  _layout.tsx              — root layout, auth gate, font loading
  (auth)/                  — login.tsx, signup.tsx
  (onboarding)/            — welcome, intake, goal-selection, plan-generation, plan-summary
  (app)/                   — today, plan, history, profile, log-workout (hidden from tab bar)

src/
  components/ui/           — design system components (Button, Card, PainScale, …)
  hooks/                   — useAuth, useOnboardingGuard, useIntakeForm,
                             useTodayWorkout, useWorkoutLogging
  services/                — typed Supabase wrappers: profiles, intake, plans,
                             sessions, checkins, workouts, evolution, safetyEvents
  lib/
    supabase.ts            — Supabase client (expo-secure-store adapter)
    auth.ts                — signUp, signIn, signOut, getSession
    database.types.ts      — fully typed Database interface (all 16 tables)
  theme/                   — colors, typography, spacing, radius, shadows

supabase/
  migrations/              — 0001_initial_schema.sql, 0002_rls_policies.sql
  seed.sql                 — 18 PHT exercises
  functions/
    _shared/               — claude.ts, llm_logger.ts, cors.ts, validation.ts
    generate-plan/         — index.ts
    generate-workout/      — index.ts, fallback.ts
    evolve-plan/           — (Phase 4)
    revise-plan/           — (Phase 4)

__tests__/
  helpers/supabaseMock.ts  — createChain() Proxy-based Supabase fluent chain mock
  hooks/                   — useIntakeForm, useWorkoutLogging
  schemas/                 — llmContracts (Zod, mirrors ai_docs/llm_contracts.md)
  screens/                 — welcome, goalSelection, today, plan, history, profile
  services/                — profiles, checkins, sessions, workouts, evolution, safetyEvents
```

---

## Path aliases

`@/` maps to `src/` via `babel-plugin-module-resolver`. Use `@/` for all internal imports.

```ts
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
```

Screen files under `app/` use relative imports when referencing test files.

---

## Supabase service pattern

All database access goes through typed service functions in `src/services/`. Services follow this pattern:

```ts
// Returns data + error, never throws
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

// Mutations return { error: string | null }
export async function updateProfile(
  userId: string,
  data: ProfileUpdate,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update(data).eq('user_id', userId);
  return { error: error ? error.message : null };
}
```

Rules:
- Never expose raw Supabase errors to the UI — translate to `string | null`
- Never call `supabase` directly from screen components — always go through a service
- Return `null` on read errors rather than throwing

---

## Hook pattern

Hooks own async state and expose clean typed interfaces to screens. Screens are pure render functions over hook state.

```ts
// Hook exports typed state + action callbacks
export interface TodayState {
  phase: TodayPhase;
  workout: TodayWorkout | null;
  error: string | null;
  submitCheckIn: (pain: number, soreness: number) => Promise<void>;
}

export function useTodayWorkout(): TodayState { … }
```

Rules:
- Hooks call services, not `supabase` directly
- Never put business logic (validation, safety checks) in screen components
- Hooks that invoke edge functions use `supabase.functions.invoke()`

---

## Edge function pattern

Edge functions are Deno TypeScript in `supabase/functions/`. Each function follows this structure:

1. Parse and validate auth header → get `user`
2. Parse request body
3. Fetch any DB state needed for the prompt
4. Perform safety checks (before calling Claude)
5. Call `callClaude()` from `_shared/claude.ts`
6. Validate response with `_shared/validation.ts` (one retry on failure)
7. Log call with `logLlmCall()` from `_shared/llm_logger.ts`
8. Write validated data to DB
9. Return JSON response

All imports use `https://esm.sh/...` for npm packages. No `npm:` imports.

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

---

## Testing conventions

### Test file locations

| What's being tested | Location |
|---|---|
| Hook logic | `__tests__/hooks/` |
| Service functions | `__tests__/services/` |
| Schema validation | `__tests__/schemas/` |
| Screen render | `__tests__/screens/` |
| Edge function pure logic | `__tests__/functions/` |
| Test helpers | `__tests__/helpers/` (ignored by Jest runner) |

### Supabase mock

Use `createChain()` from `__tests__/helpers/supabaseMock.ts`. It creates a Proxy-based fluent chain where any method returns the chain, and `.single()` / `.maybeSingle()` resolve to the provided value.

```ts
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

it('returns data on success', async () => {
  mockedFrom.mockReturnValue(createChain({ data: { id: '1' }, error: null }));
  const result = await getProfile('user-1');
  expect(result).toEqual({ id: '1' });
});
```

### Screen tests

Screen tests are smoke tests only (render + content assertions). `fireEvent.press` is avoided on `TouchableOpacity` components due to a React 19.2.5 / react-native-renderer 19.2.3 version mismatch that triggers animation checks in test mode. Interaction logic is covered by hook tests instead.

### Known constraint: react-native-renderer version

`react@19.2.5` bundles `react-native-renderer@19.2.3`. RNTL v13 checks the exact version — they match, but the renderer's dev-mode animation guard in `TouchableOpacity.componentDidUpdate` throws when `fireEvent.press` is used in tests. Setting `__DEV__: false` doesn't help because jest-expo overrides it. Workaround: test button accessibility state with `.toHaveProp('disabled', true)` and test press handlers via hook tests.

### Edge function unit tests

Pure TypeScript modules in edge functions (no Deno-specific imports) can be tested directly in Jest by importing via relative path:

```ts
import { evaluatePlanProgress } from '../../supabase/functions/evolve-plan/evaluator';
```

This works because Jest's TypeScript transformer handles files outside `src/` as long as they have no `Deno.*` or `https://esm.sh/` imports. Keep evaluators and other pure-logic modules free of Deno dependencies.

---

## Edge function invocation from client services

Calls to `supabase.functions.invoke()` live in `src/services/`, not in screen components or hooks that call supabase directly. This keeps the same service boundary rule consistent for both DB queries and edge function calls.

```ts
// src/services/revision.ts
export async function invokeRevisePlan(
  injuryStatus: InjuryStatusUpdate,
): Promise<{ planId: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('revise-plan', {
    body: { injuryStatus },
  });
  if (error) return { planId: null, error: error.message };
  if (data?.error) return { planId: null, error: data.error };
  return { planId: data?.planId ?? null, error: null };
}
```

Exception: hooks that call fire-and-forget edge functions (e.g., `useWorkoutLogging` invoking `evolve-plan`) may call `supabase.functions.invoke` directly since there is no meaningful return value to wrap.

---

## Environment variables

| Variable | Where set | Values |
|---|---|---|
| `APP_ENV` | Edge function env | `dev` \| `prod` |
| `ANTHROPIC_API_KEY` | Supabase edge function secret | — |
| `SUPABASE_URL` | Supabase edge function env (auto) | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase edge function env (auto) | — |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` | — |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` | — |

The mobile client uses `EXPO_PUBLIC_*` vars (via `expo-constants`). Edge functions use the automatically injected `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` plus secrets set via `supabase secrets set`.

---

## LLM model gate

Enforced in `supabase/functions/_shared/claude.ts`:

```ts
export function getModel(): string {
  return Deno.env.get('APP_ENV') === 'prod'
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001';
}
```

Never call `claude-sonnet-4-6` in dev. Set `APP_ENV=prod` only when testing prod model behavior explicitly.

---

## Safety event flow

Safety events block workout generation and must be acknowledged before the user can proceed.

Three insertion points:
1. **Intake** (`generate-plan`): keyword detection in `prior_treatment`, `current_symptoms`, `mechanism`
2. **Check-in** (`generate-workout`): `pain_level ≥ 8` — no Claude call; rest recommendation returned directly
3. **Workout log** (`useWorkoutLogging`): `pain_during_session > 5` — blocks submit until user acknowledges

Acknowledgment sets `professional_care_acknowledged = true` on the `safety_events` row. `getPendingSafetyEvent()` returns any unacknowledged event; `useTodayWorkout` checks this on mount and surfaces `SafetyAdvisoryModal` if found.

---

## Phase completion checklist

Before merging a phase branch to `main`:

- [ ] All new files have corresponding tests
- [ ] `npx jest --ci --no-coverage` passes with 0 failures
- [ ] New LLM calls have an entry in `ai_docs/llm_contracts.md`
- [ ] `ai_docs/common_dev_guide.md` updated if new patterns introduced
- [ ] Memory file `project_build_state.md` updated
- [ ] CLAUDE.md updated if build commands or rules changed
