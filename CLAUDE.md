# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**One Day Stronger** is a mobile rehab companion app for people rehabbing injuries without consistent access to physical therapy. The MVP supports Proximal Hamstring Tendinopathy (PHT) users. The core loop is: daily check-in → LLM-generated workout → workout logging → adaptive plan evolution.

**Stack:** React Native (Expo) · Supabase (PostgreSQL + Auth + Edge Functions) · Cloudflare R2 · Groq (`llama-3.3-70b-versatile`, primary) + Gemini 2.0 Flash (LLM fallback)

## AI Docs

Project documentation for AI-assisted development lives in [ai_docs/](ai_docs/):

- [architecture.md](ai_docs/architecture.md) — system architecture, data model, key flows, LLM integration
- [design_system.md](ai_docs/design_system.md) — color tokens, typography, component specs, screen patterns
- [prd.md](ai_docs/prd.md) — product requirements, user journeys, functional requirements, scope
- [common_dev_guide.md](ai_docs/common_dev_guide.md) — development conventions and workflows

Update the relevant ai_docs files after major milestones and major additions to the project.

## Getting Started

```bash
# Install dependencies
npm install

# Start the Expo dev server
npm start          # or: npx expo start

# Run on iOS simulator
npm run ios        # or: npx expo run:ios

# Run on Android emulator
npm run android

# Run all tests
npm run test:ci    # CI mode (no watch, exits with code)
npx jest --ci --no-coverage

# Run a single test file
npx jest __tests__/hooks/useWorkoutLogging.test.ts

# Run tests matching a name pattern
npx jest --testNamePattern="submit.*high pain"
```

---

## Development Rules

These rules are non-negotiable. Follow them on every feature, every session.

### Feature Development Process

Every feature must follow this sequence. No step may be skipped, including on simple changes.

1. **Plan** — Write the full plan: what changes, what files, what tests. For UI screens, re-share design files and plan one screen at a time.
2. **Confirm** — Wait for explicit user approval before writing any code. "Looks good" or equivalent is required.
3. **Implement** — Build the feature with complete tests following all rules below.
4. **Pause for manual testing** — Stop and ask the user to test on device before continuing.
5. **Fix issues** — Trace the execution path and identify root cause before proposing any fix. Never guess.
6. **Commit/push** — Once both parties are satisfied, commit. Push and merge to `main` when the feature is complete.
7. **Retrospective** — Document what went wrong (if anything), any new pitfalls, process improvements. Present draft to user for approval before updating memory. **Mandatory — never skip, even on a clean run.**

### Error Troubleshooting Process

When any error is found during development (test failure, device bug, visual regression), follow this sequence. Never skip steps or jump straight to a fix.

1. **Trace** — Read the full execution path: the component, its parents, its hooks, and any shared utilities it touches. Do not diagnose from memory or assumptions.
2. **Identify all sources** — Determine every place that could contribute to the failure. Do not stop at the first plausible cause.
3. **Log in pitfalls** — Before fixing, decide whether this class of error is worth a pitfall entry. If the root cause was non-obvious or the diagnostic path was roundabout, it belongs in `ai_docs/pitfalls.md`.
4. **Fix** — Implement the fix informed by the trace. If the fix requires a product-level decision (what state to preserve, what to delete), state the assumption and get confirmation.
5. **Learn** — After the fix, update memory and/or CLAUDE.md if the error reveals a gap in the current rules or process.

### Branching

Always create a new branch for each feature. Never develop directly on `main`. Merge to `main` only when the feature is complete and all tests pass.

```
git checkout -b feature/<feature-name>
```

### LLM Response Contracts

Every LLM call that drives app behavior — workout generation, plan generation, plan evolution, plan revision — must return structured JSON validated against a defined schema before any database write or UI render. Free-text LLM responses are never used directly in app logic.

- Schema definitions live in `ai_docs/llm_contracts.md` (create when first LLM feature is built)
- Each schema entry maps to: the edge function that calls it, the prompt version it targets, and the eval cases that cover it
- On schema validation failure: one automatic retry with the error appended to the prompt; if retry fails, return a user-facing error with a retry option

### Environments

Maintain separate local/dev and production environments.

- **Dev:** Set `MOCK_LLM=true` in Supabase edge function secrets to bypass all LLM calls and return hardcoded responses. Never make real LLM calls in dev unless specifically testing model behavior.
- **Production:** Groq (`llama-3.3-70b-versatile`) primary, Gemini 2.0 Flash automatic fallback on any Groq error.
- Environment is controlled by an env var (`APP_ENV=dev|prod`). `MOCK_LLM=true` bypasses the LLM entirely in `generate-plan`, `generate-workout`, and `revise-plan`.

### Graceful Fallbacks

Every LLM-dependent feature must have a defined fallback. There is no acceptable state where a failed API call leaves the user with a blank screen or broken flow.

| Feature | Fallback |
|---|---|
| Workout generation fails | Show yesterday's workout with a banner: "Using your last workout — we'll try again tomorrow" |
| Plan generation fails | Retain onboarding state; show retry button; do not advance `onboarding_step` |
| Plan evolution fails | Skip the evolution event silently; retry on next workout log |
| General API error | User-facing message with a retry button; never expose raw error details |

### LLM Call Logging

Log every LLM call to a `llm_call_logs` Supabase table. Minimum fields:

```
id               uuid  PK
user_id          uuid  FK → profiles  (nullable for anonymous/dev calls)
edge_function    text  (generate-plan | generate-workout | evolve-plan | revise-plan)
model            text
prompt_version   text
input_tokens     integer
output_tokens    integer
latency_ms       integer
success          boolean
error_message    text  nullable
called_at        timestamptz
```

Do not log raw prompt content or LLM output to this table — that data lives in the existing plan and workout tables. This table is for operational monitoring only.

### Spend Cap

LLM infrastructure uses free tiers only:

- **Groq** (`llama-3.3-70b-versatile`): free tier, 30 RPM / 14,400 RPD
- **Gemini 2.0 Flash** (fallback): free tier, 15 RPM / 1M tokens/day

If Groq rate limits are hit, the system automatically falls back to Gemini — no user action needed. Use `MOCK_LLM=true` in dev to avoid consuming free-tier quota. Do not add features that require high-frequency LLM calls (e.g., streaming per keystroke) without evaluating rate limit impact first.

### Testing

Every new feature requires a test plan created before implementation begins and executed before merge.

- Test plan format: a checklist of cases covering the golden path, edge cases, and error states
- Test cases are added to the test suite alongside the feature code — no feature ships without tests
- All existing tests must pass before merging a feature branch to `main`
- When the test framework is established, update this file with the command to run all tests and a single test

### LLM Feature Documentation

For every feature that uses an LLM call, maintain a corresponding entry in `ai_docs/llm_contracts.md` covering:

- The edge function that owns the call
- The prompt it uses (or references the prompt version)
- The JSON schema it expects back
- The eval cases that validate the output
- Known edge cases and how they're handled

This document is the source of truth for all LLM behavior in the app. Keep it current.
