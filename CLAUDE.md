# Project Instructions

## Playwright Screenshots
When taking screenshots with the Playwright MCP tool, always save to the `snapshots/` directory using relative paths (e.g. `snapshots/my-screenshot.png`). Never save screenshots to the project root.

## Project Overview

**Titan Fitness** — AI-powered workout companion. PWA-only (installed to home screen on iOS/Android). A Capacitor native pipeline existed previously but was removed June 2026 — the app is personal-use (owner + family) and not worth Apple's distribution overhead.

**Live PWA:** titan.fio.dev (deployed via GitHub Actions on push to main)
**Repo:** github.com/Fionoble/titan-fitness

## Tech Stack

- **UI:** Preact + TypeScript
- **Styling:** Tailwind CSS v4
- **Build:** Vite
- **Package manager:** pnpm
- **Data:** IndexedDB via `idb` (local-first, no backend)
- **PWA:** vite-plugin-pwa + Workbox
- **AI:** Anthropic Claude / OpenAI (BYOK — user provides their own API key)

## Build

- Entry: `index.html` → `src/main.tsx` → `src/app.tsx`
- Storage: `src/db.ts` (IndexedDB, no auth)
- Config: `vite.config.ts`

### Scripts
- `pnpm dev` — dev server (port 1337)
- `pnpm build` — production build (tsc + vite)
- `pnpm preview` — preview the production build

## Key Source Files

### Core
- `src/types.ts` — All TypeScript interfaces (Equipment, WorkoutPlan, Exercise, WorkoutSession, ExerciseLog, SetLog, ActiveWorkoutState, ExerciseTimerState, UserProfile, SavedPlan, etc.)
- `src/db.ts` — IndexedDB data layer (IDB v8, 14 stores including savedPlans)
- `src/hooks.ts` — All Preact hooks (useEquipment, useTodayWorkout, useWorkoutProgram, useSessions, useSavedPlans, useActiveWorkout, useChat, useProfile, useNutrition, useRecentFoods, useWeightHistory)
- `src/utils.ts` — uuid(), normalizeExerciseName()
- `src/bands.ts` — Shared resistance-band color palette (presets + name→hex map)
- `src/ai-tasks.ts` — Task manager + persistent store for async AI operations

### AI
- `src/ai.ts` — AI config (BYOK), sendCoachMessage() (tools: create_workout/create_program, model decides), requestWorkout()/requestProgram() (forced tool_choice), sendWorkoutChat(), sendTextMessage(), typed AIError + aiErrorMessage(), retry/backoff for 429/500/529 honoring retry-after, 90s timeout, truncation detection via stop_reason/finish_reason. Models: claude-haiku-4-5 / gpt-5-mini. Raw fetch by design (BYOK browser app, no SDK).
- `src/ai-schemas.ts` — Tool JSON schemas + client-side validators (buildPlanFromParsed, buildProgramFromParsed — clamp/coerce all fields)
- `src/ai-workout.ts` — generateWorkoutViaAI() (thin wrapper over requestWorkout)
- `src/ai-program.ts` — generateProgramViaAI() (thin wrapper over requestProgram)
- `src/workout-engine.ts` — Local (non-AI) workout generation fallback
- Chat error bubbles carry `ChatMessage.isError` and are never re-sent as model context

### Screens
- `src/screens/Home.tsx` — Main screen. Daily mode (generate workout button + plan hero card + exercise list) or Program mode (7-day program with day dots). Shows saved workouts when no plan active. Shows inline completion view after finishing a workout.
- `src/screens/ActiveWorkout.tsx` — Active workout tracking. Set logging (weight/reps), rest timers, exercise timers (countdown/countup), superset/circuit support, weight/band tracking toggle per exercise, per-exercise notes, in-workout AI chat. Timers are timestamp-based, persisted in ActiveWorkoutState, and survive navigation/app restarts. Set completions save to IDB immediately (bypassing the 2s debounce).
- `src/screens/WorkoutComplete.tsx` — Completion celebration with confetti, stats, exercise breakdown with superset indicators
- `src/screens/Coach.tsx` — AI chat. Generates workouts (parsed from JSON in responses), programs. WorkoutPlanCard with Apply + Save buttons.
- `src/screens/Progress.tsx` — Volume charts, consistency rings, calendar, workout history
- `src/screens/Discover.tsx` — Browse workout styles
- `src/screens/Equipment.tsx` — Toggle equipment. Resistance bands have expandable band color config (preset colors + custom).
- `src/screens/Profile.tsx` — User profile, weight chart, stats
- `src/screens/Settings.tsx` — Equipment, workout preferences, body metrics, AI setup, privacy, export/import (exports deliberately exclude the AI API key)
- `src/screens/ProgramDetail.tsx` — Full 7-day program view

### Components
- `src/components/BottomNav.tsx` — Nav tabs: Home, Discover, Progress, AI Coach, Profile
- `src/components/Icon.tsx` — Material Symbols wrapper
- `src/components/NavSlot.tsx` — Portal system for floating content above nav island
- `src/components/WorkoutBanner.tsx` — Floating banner when workout is active on non-workout screens
- `src/components/ExerciseBreakdown.tsx` — Shared exercise list with superset grouping and band-aware best-set display (used in WorkoutComplete + Home)

## Nutrition

The nutrition feature was extracted to a standalone PWA at `../nutrition-tracker/` and fully removed from this app (June 2026). The IndexedDB nutrition stores (nutritionLogs, foods, nutritionGoals, starredFoods) and their types remain so existing data and backups stay importable — do not remove them without an IDB migration plan.

## Weight/Band Tracking (ActiveWorkout)

Each exercise has a tracking mode: `'numeric'` (lbs) or `'band'` (resistance band color). A TRACK lbs/band segmented control appears above each set grid when band colors are configured in Equipment. Explicit choices are stored in `ActiveWorkoutState.weightModes` (persisted); defaults derive at render time (band-equipped exercises default to band mode). Set completion stamps `SetLog.weightType` from the mode; band sets never auto-fill numeric weight. Completed sets display what was logged regardless of the current toggle.

## Pending / Future Work

- **PWA polish remaining**: Material Symbols icon-font subsetting (currently full variable font), self-hosted fonts (offline first load + drops Google from CSP), proper padded maskable icon. Route-level code splitting deliberately skipped (precached SW makes it moot at this size).
- **AI layer**: streaming responses in Coach (biggest perceived-latency win); injury-aware local fallback (workout-engine ignores limitations when AI fails)
- **Testing**: zero tests; start with vitest + ai-schemas validators, timer math, IDB migrations

## Color Scheme
- Primary: `#2bee79` (green)
- Background: `#102217` (dark green)
- Surface: `#1a2e22`
