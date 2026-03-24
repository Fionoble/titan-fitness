import type { Equipment, WorkoutPlan, WorkoutSession, WorkoutCriteria, ChatMessage } from './types';
import { uuid } from './utils';
import { sendMessage, isAIConfigured } from './ai';

function extractJson(text: string): string | null {
  // Try ```json code fence first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Fallback: find a raw JSON object with "exercises" array
  const braceMatch = text.match(/\{[\s\S]*?"exercises"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
  if (braceMatch) return braceMatch[0];

  return null;
}

/** Exercises whose reps are always time-based (used to fix AI omitting 's' suffix) */
const ALWAYS_TIMED = /\bplank\b|dead hang|\bwall sit\b|foam roll/i;

function normalizeReps(reps: any, name: string): string {
  const r = String(reps || '10');
  // If reps is a plain number and exercise is always time-based, add 's' suffix
  if (/^\d+$/.test(r) && ALWAYS_TIMED.test(name)) {
    return r + 's';
  }
  return r;
}

function buildPlanFromJson(parsed: any): WorkoutPlan | null {
  // Validate required fields
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

export function parseWorkoutFromResponse(text: string): WorkoutPlan | null {
  const jsonStr = extractJson(text);
  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);
    return buildPlanFromJson(parsed);
  } catch {
    return null;
  }
}

export function stripJsonBlock(text: string): string {
  return text
    .replace(/```(?:json)?\s*[\s\S]*?```/g, '')
    .replace(/\{[\s\S]*?"exercises"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/g, '')
    .trim();
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

  prompt += '. Prioritize muscle groups that haven\'t been trained recently and need the least recovery.';

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
    .map((ex) => `- ${ex.name} (${ex.muscleGroup}): ${ex.sets}x${ex.reps}${ex.weight ? ` @ ${ex.weight}lbs` : ''}${ex.group ? ` [Group ${ex.group}]` : ''}`)
    .join('\n');

  return `I'm currently reviewing this workout plan:

**${plan.name}** (${plan.style})
${exerciseList}

${adjustmentRequest}

Please generate an adjusted version as a complete workout plan.`;
}
