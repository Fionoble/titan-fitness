# Project Instructions

## Playwright Screenshots
When taking screenshots with the Playwright MCP tool, always save to the `snapshots/` directory using relative paths (e.g. `snapshots/my-screenshot.png`). Never save screenshots to the project root.

## Project Overview

**Titan Fitness** — AI-powered workout companion. PWA + Capacitor native apps (iOS/Android).

**Live PWA:** titan.fio.dev
**Repo:** github.com/Fionoble/titan-fitness

## Tech Stack

- **UI:** Preact + TypeScript
- **Styling:** Tailwind CSS v4
- **Build:** Vite
- **Package manager:** pnpm
- **Data (PWA):** IndexedDB via `idb`
- **Data (Native):** Supabase (PostgreSQL + auth)
- **PWA:** vite-plugin-pwa + Workbox
- **Native:** Capacitor (iOS/Android)
- **AI:** Anthropic Claude / OpenAI (BYOK — user provides their own API key)

## Architecture — Dual Build Pipeline

The app has two separate build pipelines. The PWA and native builds share most source code, but key modules are swapped at build time via Vite aliases.

### PWA Build (`pnpm build`)
- Entry: `index.html` → `src/main.tsx` → `src/app.tsx`
- Storage: `src/db.ts` (IndexedDB, no auth)
- Config: `vite.config.ts`
- No Supabase code bundled

### Native Build (`pnpm build:native`)
- Entry: `index-native.html` → `src/main-native.tsx` → `src/app-native.tsx`
- Storage: `src/db-supabase.ts` (Supabase, aliased from `db.ts` at build time)
- Auth: `src/components/AuthGate.tsx` (magic link email, SSO planned)
- Config: `vite.config.native.ts`
- `vite.config.native.ts` uses `resolve.alias` to swap `src/db.ts` → `src/db-supabase.ts` and `transformIndexHtml` to swap entry + CSP

### Native-Only Files
- `src/app-native.tsx` — app shell using native Settings/Profile variants
- `src/main-native.tsx` — entry with AuthGate wrapping
- `src/supabase.ts` — Supabase client + auth helpers
- `src/db-supabase.ts` — all db functions backed by Supabase (activeWorkout stays IDB)
- `src/components/AuthGate.tsx` — magic link email login
- `src/screens/SettingsNative.tsx` — Settings with sign-out + Supabase privacy copy
- `src/screens/ProfileNative.tsx` — Profile with Supabase footer copy
- `index-native.html` — CSP allows `*.supabase.co`
- `supabase-schema.sql` — SQL schema for Supabase (12 tables, RLS policies)

### Scripts
- `pnpm dev` — PWA dev server (port 1337)
- `pnpm build` — PWA production build
- `pnpm build:native` — Native build with Supabase
- `pnpm native:sync` — `build:native` + `cap sync`
- `pnpm vite --config vite.config.native.ts` — Dev server with native pipeline (for testing Supabase auth locally)

## Key Source Files

### Core
- `src/types.ts` — All TypeScript interfaces (Equipment, WorkoutPlan, Exercise, WorkoutSession, ExerciseLog, SetLog, UserProfile, SavedPlan, etc.)
- `src/db.ts` — IndexedDB data layer (IDB v8, 14 stores including savedPlans)
- `src/hooks.ts` — All Preact hooks (useEquipment, useTodayWorkout, useWorkoutProgram, useSessions, useSavedPlans, useActiveWorkout, useChat, useProfile, useNutrition, useRecentFoods, useWeightHistory)
- `src/utils.ts` — uuid(), normalizeExerciseName()
- `src/ai-tasks.ts` — Task manager + persistent store for async AI operations

### AI
- `src/ai.ts` — AI config (BYOK), sendMessage(), sendWorkoutChat(), sendProgramMessage(), system prompt builders with muscle recovery tracking
- `src/ai-workout.ts` — parseWorkoutFromResponse(), generateWorkoutViaAI()
- `src/ai-program.ts` — generateProgramViaAI() for 7-day programs
- `src/ai-nutrition.ts` — estimateNutrition(), estimateNutritionWithImage(), scanNutritionLabel(), suggestGoals(), chatWithNutritionAI()
- `src/workout-engine.ts` — Local (non-AI) workout generation fallback

### Screens
- `src/screens/Home.tsx` — Main screen. Daily mode (generate workout button + plan hero card + exercise list) or Program mode (7-day program with day dots). Shows saved workouts when no plan active. Shows inline completion view after finishing a workout.
- `src/screens/ActiveWorkout.tsx` — Active workout tracking. Set logging (weight/reps), rest timers, exercise timers (countdown/countup), superset/circuit support, resistance band color selector, per-exercise notes, in-workout AI chat. Timers are timestamp-based (background-resilient).
- `src/screens/WorkoutComplete.tsx` — Completion celebration with confetti, stats, exercise breakdown with superset indicators
- `src/screens/Coach.tsx` — AI chat. Generates workouts (parsed from JSON in responses), programs. WorkoutPlanCard with Apply + Save buttons.
- `src/screens/Progress.tsx` — Volume charts, consistency rings, calendar, workout history
- `src/screens/Discover.tsx` — Browse workout styles
- `src/screens/Equipment.tsx` — Toggle equipment. Resistance bands have expandable band color config (preset colors + custom).
- `src/screens/Nutrition.tsx` — Meal logging, calorie ring, macro tracking, AI food recognition, barcode scan (exists but removed from nav — extracted to separate app at ../nutrition-tracker/)
- `src/screens/Profile.tsx` — User profile, weight chart, stats
- `src/screens/Settings.tsx` — Equipment, workout preferences, body metrics, AI setup, privacy, export/import
- `src/screens/ProgramDetail.tsx` — Full 7-day program view

### Components
- `src/components/BottomNav.tsx` — Nav tabs: Home, Discover, Progress, AI Coach, Profile
- `src/components/Icon.tsx` — Material Symbols wrapper
- `src/components/NavSlot.tsx` — Portal system for floating content above nav island
- `src/components/WorkoutBanner.tsx` — Floating banner when workout is active on non-workout screens
- `src/components/ExerciseBreakdown.tsx` — Shared exercise list with superset grouping (used in WorkoutComplete + Home)
- `src/components/AuthGate.tsx` — Native-only auth gate

## Recent Changes (This Session)

1. **Supabase migration** — Separate native build pipeline with Supabase auth + storage. PWA completely unaffected.
2. **Resistance band colors** — Equipment screen lets users configure band colors (presets + custom). ActiveWorkout shows band color dropdown replacing lbs input for band exercises. Band color auto-fills from previous set.
3. **Exercise card layout** — Home screen exercise cards: removed truncation, moved muscle group inline with sets/reps, stats use shrink-0 to prevent wrapping.
4. **Superset indicators** — ExerciseBreakdown component shows superset grouping in completion screens. ExerciseLog now carries `group` field.
5. **Manual workout generation** — No more auto-generating on app load. Shows "Generate Workout" button + saved workouts when no plan exists.
6. **Save workouts from Coach** — WorkoutPlanCard has Save button. SavedPlan type + IDB store. Saved workouts shown on Home with Start/Delete.
7. **Timer fix** — Rest timer and exercise timer now timestamp-based (background-resilient). Uses `Date.now()` math instead of decrementing counters.
8. **PWA icon** — Updated to dumbbell design (green on dark green).
9. **Nav update** — Nutrition tab replaced with Discover in bottom nav.
10. **Nutrition tracker extracted** — Standalone PWA at `../nutrition-tracker/` with blue color scheme.

## Pending / Future Work

- **SSO auth** (Google/Apple sign-in) for native builds — `@capgo/capacitor-social-login` was evaluated (Cap 8 compatible), code was started but stripped out to get basics working first
- **Server-side LLM calls** — Supabase Edge Functions to proxy AI requests, keeping API keys server-side. Just needs `src/ai.ts` changes + deploying functions.
- **Saved plans in Supabase** — `savedPlans` currently only in local IDB. Needs `saved_plans` table in Supabase + `db-supabase.ts` functions (or keep local for both builds).
- **Supabase anon key** — User needs to update `.env` with the JWT-format anon key (starts with `eyJ`), not the `sb_publishable_` format key.

## Color Scheme
- Primary: `#2bee79` (green)
- Background: `#102217` (dark green)
- Surface: `#1a2e22`
