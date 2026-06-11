import type { Equipment, WorkoutSession, WorkoutProgram } from './types';
import { requestProgram, isAIConfigured } from './ai';
import { getProfile } from './db';

/** Generate a 7-day program via AI. Returns null when AI is unconfigured; throws AIError on failure. */
export async function generateProgramViaAI(
  equipment: Equipment[],
  sessions: WorkoutSession[],
): Promise<WorkoutProgram | null> {
  if (!isAIConfigured()) return null;

  const profile = await getProfile();
  const profileContext = profile
    ? {
        injuries: profile.injuries,
        additionalEquipment: profile.additionalEquipment,
        avgWorkoutMinutes: profile.avgWorkoutMinutes,
        programActiveDays: profile.programActiveDays,
      }
    : undefined;

  const activeDays = profile?.programActiveDays ?? 6;
  const restDays = 7 - activeDays;
  const enabledEquip = equipment.filter((e) => e.enabled).map((e) => e.name);
  const prompt = `Generate a complete 7-day workout program for me with ${activeDays} active workout days and ${restDays} rest day${restDays !== 1 ? 's' : ''}.${
    enabledEquip.length > 0 ? ` My available equipment: ${enabledEquip.join(', ')}.` : ' I have no equipment (bodyweight only).'
  } Design a balanced weekly split with proper muscle group recovery.`;

  const parsed = await requestProgram(prompt, equipment, sessions, profileContext);
  return parsed.program;
}
