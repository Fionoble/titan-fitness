import type { Equipment, WorkoutPlan, WorkoutSession, WorkoutProgram, ProgramDay } from './types';
import { uuid } from './utils';
import { sendProgramMessage, isAIConfigured } from './ai';
import { getProfile } from './db';

function extractJson(text: string): string | null {
  // Try ```json code fence first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Fallback: find a raw JSON object with "days" array
  const braceMatch = text.match(/\{[\s\S]*?"days"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
  if (braceMatch) return braceMatch[0];

  return null;
}

/** Exercises whose reps are always time-based (used to fix AI omitting 's' suffix) */
const ALWAYS_TIMED = /\bplank\b|dead hang|\bwall sit\b|foam roll/i;

function normalizeReps(reps: any, name: string): string {
  const r = String(reps || '10');
  if (/^\d+$/.test(r) && ALWAYS_TIMED.test(name)) {
    return r + 's';
  }
  return r;
}

function buildPlanFromJson(parsed: any): WorkoutPlan | null {
  if (!parsed.name || !parsed.style || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
    return null;
  }

  return {
    id: uuid(),
    name: parsed.name,
    style: parsed.style,
    exercises: parsed.exercises.map((ex: any) => ({
      id: uuid(),
      name: ex.name || 'Unknown Exercise',
      muscleGroup: ex.muscleGroup || 'Full Body',
      equipment: ex.equipment || [],
      sets: ex.sets || 3,
      reps: normalizeReps(ex.reps, ex.name || ''),
      weight: ex.weight || undefined,
      restSeconds: ex.restSeconds || 60,
      group: ex.group || undefined,
    })),
    durationMin: parsed.durationMin || 45,
    estimatedCalories: parsed.estimatedCalories || 300,
    focus: parsed.focus || 'Full Body',
    equipmentUsed: [...new Set((parsed.exercises || []).flatMap((e: any) => e.equipment || []))] as string[],
    generatedAt: new Date().toISOString(),
    intensity: parsed.intensity || 2,
  };
}

function parseProgramFromResponse(text: string, equipment: Equipment[]): WorkoutProgram | null {
  const jsonStr = extractJson(text);
  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.name || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      return null;
    }

    const days: ProgramDay[] = parsed.days.map((day: any) => {
      const programDay: ProgramDay = {
        dayNumber: day.dayNumber || 1,
        label: day.label || `Day ${day.dayNumber}`,
        isRest: !!day.isRest,
      };

      if (!day.isRest && day.plan) {
        const plan = buildPlanFromJson(day.plan);
        if (plan) {
          programDay.plan = plan;
        } else {
          // If plan parsing failed, mark as rest day
          programDay.isRest = true;
        }
      }

      return programDay;
    });

    // Ensure we have exactly 7 days, padding with rest days if needed
    while (days.length < 7) {
      days.push({
        dayNumber: days.length + 1,
        label: `Day ${days.length + 1} — Rest`,
        isRest: true,
      });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const enabledEquipNames = equipment.filter((e) => e.enabled).map((e) => e.id);

    return {
      id: uuid(),
      name: parsed.name,
      days: days.slice(0, 7), // Cap at 7 days
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      equipment: enabledEquipNames,
    };
  } catch {
    return null;
  }
}

export async function generateProgramViaAI(
  equipment: Equipment[],
  sessions: WorkoutSession[]
): Promise<WorkoutProgram | null> {
  if (!isAIConfigured()) return null;

  const profile = await getProfile();
  const profileContext = profile
    ? { injuries: profile.injuries, additionalEquipment: profile.additionalEquipment, avgWorkoutMinutes: profile.avgWorkoutMinutes, programActiveDays: profile.programActiveDays }
    : undefined;

  const activeDays = profile?.programActiveDays ?? 6;
  const restDays = 7 - activeDays;
  const enabledEquip = equipment.filter((e) => e.enabled).map((e) => e.name);
  const prompt = `Generate a complete 7-day workout program for me with ${activeDays} active workout days and ${restDays} rest day${restDays !== 1 ? 's' : ''}.${
    enabledEquip.length > 0 ? ` My available equipment: ${enabledEquip.join(', ')}.` : ' I have no equipment (bodyweight only).'
  } Design a balanced weekly split with proper muscle group recovery.`;

  const response = await sendProgramMessage(prompt, equipment, sessions, profileContext);
  return parseProgramFromResponse(response, equipment);
}
