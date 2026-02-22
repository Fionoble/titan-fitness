import type { Equipment, WorkoutPlan, WorkoutSession, WorkoutCriteria, ChatMessage } from './types';
import { uuid } from './utils';
import { sendMessage, isAIConfigured } from './ai';

export function parseWorkoutFromResponse(text: string): WorkoutPlan | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1].trim());

    // Validate required fields
    if (!parsed.name || !parsed.style || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      return null;
    }

    // Build a full WorkoutPlan with defaults for missing fields
    const plan: WorkoutPlan = {
      id: uuid(),
      name: parsed.name,
      style: parsed.style,
      exercises: parsed.exercises.map((ex: any) => ({
        id: uuid(),
        name: ex.name || 'Unknown Exercise',
        muscleGroup: ex.muscleGroup || 'Full Body',
        equipment: ex.equipment || [],
        sets: ex.sets || 3,
        reps: String(ex.reps || '10'),
        weight: ex.weight || undefined,
        restSeconds: ex.restSeconds || 60,
      })),
      durationMin: parsed.durationMin || 45,
      estimatedCalories: parsed.estimatedCalories || 300,
      focus: parsed.focus || 'Full Body',
      equipmentUsed: [...new Set((parsed.exercises || []).flatMap((e: any) => e.equipment || []))] as string[],
      generatedAt: new Date().toISOString(),
      intensity: parsed.intensity || 2,
    };

    return plan;
  } catch {
    return null;
  }
}

export function stripJsonBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```/g, '').trim();
}

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

  return prompt;
}

export async function generateWorkoutViaAI(
  equipment: Equipment[],
  sessions: WorkoutSession[],
  chatHistory: ChatMessage[],
  criteria?: WorkoutCriteria
): Promise<{ plan: WorkoutPlan; message: string } | null> {
  if (!isAIConfigured()) return null;

  const prompt = buildWorkoutPrompt(equipment, criteria);
  const response = await sendMessage(prompt, chatHistory, equipment, sessions);
  const plan = parseWorkoutFromResponse(response);

  if (!plan) return null;

  const message = stripJsonBlock(response);
  return { plan, message: message || "Here's your workout plan!" };
}

export function buildAdjustPrompt(plan: WorkoutPlan, adjustmentRequest: string): string {
  const exerciseList = plan.exercises
    .map((ex) => `- ${ex.name} (${ex.muscleGroup}): ${ex.sets}x${ex.reps}${ex.weight ? ` @ ${ex.weight}lbs` : ''}`)
    .join('\n');

  return `I'm currently reviewing this workout plan:

**${plan.name}** (${plan.style})
${exerciseList}

${adjustmentRequest}

Please generate an adjusted version as a complete workout plan.`;
}
