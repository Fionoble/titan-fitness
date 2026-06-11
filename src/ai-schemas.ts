import type { Equipment, WorkoutPlan, WorkoutProgram, ProgramDay, WorkoutStyle } from './types';
import { uuid } from './utils';

// Tool schemas + client-side validators for AI workout/program generation.
// The model emits structured tool calls against these schemas; the validators
// below still coerce and bound every field because JSON-schema constraints
// (numeric ranges in particular) aren't enforced server-side.

export const WORKOUT_STYLES: WorkoutStyle[] = [
  'strength', 'hypertrophy', 'functional', 'hiit', 'cardio', 'recovery', 'mobility', 'power', 'endurance',
];

const EXERCISE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Exercise name' },
    muscleGroup: { type: 'string', description: 'Target muscle group' },
    equipment: {
      type: 'array',
      items: { type: 'string' },
      description: "Equipment ids used, e.g. ['dumbbells']. Empty array for bodyweight. Valid ids: dumbbells, barbell, kettlebells, bench, pull-up-bar, resistance-bands, rings, trx, yoga-mat, foam-roller, jump-rope, medicine-ball, ab-wheel, stationary-bike, rowing-machine, treadmill",
    },
    sets: { type: 'integer', description: 'Number of sets, typically 2-5' },
    reps: {
      type: 'string',
      description: "e.g. '10-12', '15', 'Failure'. IMPORTANT: for time-based exercises (planks, holds, stretches) always use a time suffix: '30s', '45s each', '60s'. Never a plain number for timed exercises.",
    },
    weight: { type: ['number', 'null'], description: 'Suggested weight in lbs, or null' },
    restSeconds: { type: 'integer', description: 'Rest after each set in seconds' },
    group: {
      type: ['string', 'null'],
      description: "Superset/circuit group letter (e.g. 'A') or null. Exercises sharing a letter must be adjacent. Don't superset everything.",
    },
  },
  required: ['name', 'muscleGroup', 'equipment', 'sets', 'reps'],
} as const;

export const WORKOUT_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Workout name' },
    style: { type: 'string', enum: WORKOUT_STYLES },
    exercises: { type: 'array', items: EXERCISE_SCHEMA, description: 'The complete exercise list' },
    durationMin: { type: 'integer', description: 'Estimated duration in minutes' },
    estimatedCalories: { type: 'integer' },
    focus: { type: 'string', description: "e.g. 'Chest & Triceps'" },
    intensity: { type: 'integer', enum: [1, 2, 3] },
  },
  required: ['name', 'style', 'exercises', 'durationMin', 'focus'],
} as const;

export const PROGRAM_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: "Program name, e.g. 'Push-Pull-Legs Split'" },
    days: {
      type: 'array',
      description: 'Exactly 7 days, dayNumber 1-7',
      items: {
        type: 'object',
        properties: {
          dayNumber: { type: 'integer', description: '1-7' },
          label: { type: 'string', description: "e.g. 'Day 1 — Push' or 'Day 3 — Rest'" },
          isRest: { type: 'boolean' },
          plan: { ...WORKOUT_PLAN_SCHEMA, description: 'Required when isRest is false; omit for rest days' },
        },
        required: ['dayNumber', 'label', 'isRest'],
      },
    },
  },
  required: ['name', 'days'],
} as const;

export const CREATE_WORKOUT_TOOL = {
  name: 'create_workout',
  description:
    'Create or update a single workout plan for the user. Call this whenever the user asks to generate, create, build, adjust, modify, or swap exercises in a workout. Always include the COMPLETE plan (every exercise), even when only changing one exercise. Also write a brief conversational message alongside the tool call.',
  input_schema: WORKOUT_PLAN_SCHEMA,
};

export const CREATE_PROGRAM_TOOL = {
  name: 'create_program',
  description:
    'Create a complete 7-day workout program (weekly training split). Call this when the user asks for a weekly program, training plan, weekly split, 7-day routine, or any multi-day schedule. Also write a brief conversational message alongside the tool call.',
  input_schema: PROGRAM_SCHEMA,
};

/** Exercises whose reps are always time-based (fixes the model omitting the 's' suffix) */
const ALWAYS_TIMED = /\bplank\b|dead hang|\bwall sit\b|foam roll/i;

function normalizeReps(reps: unknown, name: string): string {
  const r = String(reps || '10');
  if (/^\d+$/.test(r) && ALWAYS_TIMED.test(name)) {
    return r + 's';
  }
  return r;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function buildPlanFromParsed(parsed: any): WorkoutPlan | null {
  if (!parsed || !parsed.name || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
    return null;
  }
  const style: WorkoutStyle = WORKOUT_STYLES.includes(parsed.style) ? parsed.style : 'functional';

  return {
    id: uuid(),
    name: String(parsed.name),
    style,
    exercises: parsed.exercises.map((ex: any) => ({
      id: uuid(),
      name: String(ex.name || 'Unknown Exercise'),
      muscleGroup: String(ex.muscleGroup || 'Full Body'),
      equipment: Array.isArray(ex.equipment) ? ex.equipment.map(String) : [],
      sets: clampInt(ex.sets, 1, 12, 3),
      reps: normalizeReps(ex.reps, ex.name || ''),
      weight: Number.isFinite(Number(ex.weight)) && Number(ex.weight) > 0 ? Number(ex.weight) : undefined,
      restSeconds: clampInt(ex.restSeconds, 0, 600, 60),
      group: ex.group ? String(ex.group) : undefined,
    })),
    durationMin: clampInt(parsed.durationMin, 5, 240, 45),
    estimatedCalories: clampInt(parsed.estimatedCalories, 0, 3000, 300),
    focus: String(parsed.focus || 'Full Body'),
    equipmentUsed: [...new Set(parsed.exercises.flatMap((e: any) => (Array.isArray(e.equipment) ? e.equipment.map(String) : [])))] as string[],
    generatedAt: new Date().toISOString(),
    intensity: ([1, 2, 3].includes(parsed.intensity) ? parsed.intensity : 2) as 1 | 2 | 3,
  };
}

export interface ParsedProgram {
  program: WorkoutProgram;
  /** Days that had an invalid plan and were demoted to rest days */
  demotedDays: number;
}

export function buildProgramFromParsed(parsed: any, equipment: Equipment[]): ParsedProgram | null {
  if (!parsed || !parsed.name || !Array.isArray(parsed.days) || parsed.days.length === 0) {
    return null;
  }

  let demotedDays = 0;
  const days: ProgramDay[] = parsed.days.slice(0, 7).map((day: any, idx: number) => {
    const programDay: ProgramDay = {
      dayNumber: clampInt(day.dayNumber, 1, 7, idx + 1),
      label: String(day.label || `Day ${idx + 1}`),
      isRest: !!day.isRest,
    };
    if (!programDay.isRest) {
      const plan = day.plan ? buildPlanFromParsed(day.plan) : null;
      if (plan) {
        programDay.plan = plan;
      } else {
        programDay.isRest = true;
        demotedDays++;
      }
    }
    return programDay;
  });

  // A program where every active day failed validation is not usable
  if (days.every((d) => d.isRest)) return null;

  while (days.length < 7) {
    days.push({ dayNumber: days.length + 1, label: `Day ${days.length + 1} — Rest`, isRest: true });
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    program: {
      id: uuid(),
      name: String(parsed.name),
      days,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      equipment: equipment.filter((e) => e.enabled).map((e) => e.id),
    },
    demotedDays,
  };
}
