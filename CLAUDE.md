# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**One Day Stronger** is a mobile rehab companion app for people rehabbing injuries without consistent access to physical therapy. The MVP supports Proximal Hamstring Tendinopathy (PHT) users. The core loop is: daily check-in → LLM-generated workout → workout logging → adaptive plan evolution.

**Stack:** React Native (Expo) · Supabase (PostgreSQL + Auth + Edge Functions) · Cloudflare R2 · Claude API (`claude-sonnet-4-6`)

## AI Docs

Project documentation for AI-assisted development lives in [ai_docs/](ai_docs/):

- [architecture.md](ai_docs/architecture.md) — system architecture, data model, key flows, LLM integration
- [design_system.md](ai_docs/design_system.md) — color tokens, typography, component specs, screen patterns
- [prd.md](ai_docs/prd.md) — product requirements, user journeys, functional requirements, scope
- [common_dev_guide.md](ai_docs/common_dev_guide.md) — development conventions and workflows

Update the relevant ai_docs files after major milestones and major additions to the project.

## Getting Started

When the build system is established, update this file with:

- How to install dependencies
- How to run the development server
- How to build for production
- How to run tests (all tests and a single test)
- How to lint

---

## Development Rules

These rules are non-negotiable. Follow them on every feature, every session.

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

- **Dev:** LLM API calls use `claude-haiku-4-5-20251001` or are mocked entirely. Never call `claude-sonnet-4-6` in dev unless specifically testing model behavior.
- **Production:** `claude-sonnet-4-6` only.
- Environment is controlled by an env var (`APP_ENV=dev|prod`). Prompt templates and model selection branch on this var inside edge functions.

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

Monthly Claude API spend cap: **$10 USD**.

- Track spend via the Anthropic usage dashboard or API
- If approaching the cap, switch dev calls to `claude-haiku-4-5-20251001` first, then mock if needed
- Do not add features that require high-frequency LLM calls (e.g., streaming responses per keystroke) without evaluating cost impact first

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
