import type { Equipment, WorkoutPlan, WorkoutSession, WorkoutCriteria, ChatMessage } from './types';
import { requestWorkout, isAIConfigured } from './ai';
import type { ProfileContext } from './ai';

function buildWorkoutPrompt(equipment: Equipment[], criteria?: WorkoutCriteria): string {
  const enabled = equipment.filter((e) => e.enabled).map((e) => e.name);
  let prompt = 'Generate a workout for me';

  if (criteria?.style) {
    prompt += ` in ${criteria.style} style`;
  }

  if (criteria?.mood) {
    prompt += `. My mood/energy level: ${criteria.mood}`;
  }

  if (criteria?.limitations) {
    prompt += `. Limitations/injuries: ${criteria.limitations}`;
  }

  if (criteria?.customPrompt) {
    prompt = criteria.customPrompt;
  }

  if (enabled.length > 0) {
    prompt += `. My available equipment: ${enabled.join(', ')}`;
  }

  prompt += '. Prioritize muscle groups that haven\'t been trained recently and need the least recovery.';

  return prompt;
}

/** Generate a workout via AI. Returns null when AI is unconfigured; throws AIError on failure. */
export async function generateWorkoutViaAI(
  equipment: Equipment[],
  sessions: WorkoutSession[],
  chatHistory: ChatMessage[],
  criteria?: WorkoutCriteria,
  profileContext?: ProfileContext,
): Promise<{ plan: WorkoutPlan; message: string } | null> {
  if (!isAIConfigured()) return null;

  const prompt = buildWorkoutPrompt(equipment, criteria);
  return requestWorkout(prompt, chatHistory, equipment, sessions, profileContext);
}

export function buildAdjustPrompt(plan: WorkoutPlan, adjustmentRequest: string): string {
  const exerciseList = plan.exercises
    .map((ex) => `- ${ex.name} (${ex.muscleGroup}): ${ex.sets}x${ex.reps}${ex.weight ? ` @ ${ex.weight}lbs` : ''}${ex.group ? ` [Group ${ex.group}]` : ''}`)
    .join('\n');

  return `I'm currently reviewing this workout plan:

**${plan.name}** (${plan.style})
${exerciseList}

${adjustmentRequest}

Please generate an adjusted version as a complete workout plan.`;
}
