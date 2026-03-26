import type { Equipment, WorkoutSession, ChatMessage } from './types';

interface AIConfig {
  apiKey: string;
  provider: 'anthropic' | 'openai';
}

function getConfig(): AIConfig | null {
  const key = localStorage.getItem('titan_ai_key');
  const provider = (localStorage.getItem('titan_ai_provider') || 'anthropic') as AIConfig['provider'];
  if (!key) return null;
  return { apiKey: key, provider };
}

export function isAIConfigured(): boolean {
  return !!localStorage.getItem('titan_ai_key');
}

export function setAIConfig(apiKey: string, provider: 'anthropic' | 'openai') {
  localStorage.setItem('titan_ai_key', apiKey);
  localStorage.setItem('titan_ai_provider', provider);
}

function daysAgo(dateStr: string): number {
  const now = new Date();
  const then = new Date(dateStr);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysAgo(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return '1 day ago';
  return `${n} days ago`;
}

function recoveryLabel(daysAgo: number): string {
  if (daysAgo <= 1) return 'NEEDS RECOVERY';
  if (daysAgo === 2) return 'RECOVERING';
  return 'RECOVERED';
}

function buildMuscleRecoveryStatus(recentSessions: WorkoutSession[]): string {
  const muscleLastTrained = new Map<string, number>();

  for (const session of recentSessions.slice(0, 5)) {
    const days = daysAgo(session.startedAt);
    for (const ex of session.exercises) {
      const mg = ex.muscleGroup;
      if (!muscleLastTrained.has(mg) || days < muscleLastTrained.get(mg)!) {
        muscleLastTrained.set(mg, days);
      }
    }
  }

  if (muscleLastTrained.size === 0) return '';

  const lines = Array.from(muscleLastTrained.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([muscle, days]) => `- ${muscle}: trained ${formatDaysAgo(days)} — ${recoveryLabel(days)}`);

  return `\nMUSCLE RECOVERY STATUS:\n${lines.join('\n')}`;
}

const WORKOUT_SCHEMA = `
WORKOUT GENERATION:
When asked to generate, create, adjust, or modify a workout, you MUST ALWAYS include the COMPLETE workout plan as a JSON block in a \`\`\`json code fence. This is CRITICAL — never describe changes without including the full updated JSON. Even if you're only adding or removing one exercise, output the entire plan. The JSON must match this exact schema:
{
  "name": "string - workout name",
  "style": "strength|hypertrophy|functional|hiit|cardio|recovery|mobility|power|endurance",
  "exercises": [
    {
      "name": "string - exercise name",
      "muscleGroup": "string - target muscle",
      "equipment": ["string - equipment id, e.g. 'dumbbells', 'barbell', or empty array for bodyweight"],
      "sets": 3,
      "reps": "string - e.g. '10-12', '15', 'Failure'. IMPORTANT: for time-based exercises (planks, holds, stretches, etc.) always include the time suffix: '30s', '45s each', '60s', '2 min'. Never use a plain number for timed exercises.",
      "weight": null,
      "restSeconds": 60,
      "group": "string or null - optional, e.g. 'A'. Exercises with same group form a superset/circuit and must be adjacent"
    }
  ],
  "durationMin": 45,
  "estimatedCalories": 350,
  "focus": "string - e.g. 'Chest & Triceps'",
  "intensity": 2
}
Always include a brief conversational message before or after the JSON block. Equipment IDs are: dumbbells, barbell, kettlebells, bench, pull-up-bar, resistance-bands, yoga-mat, foam-roller, jump-rope, medicine-ball, ab-wheel.
You may group 2-3 complementary exercises as supersets by giving them the same group letter (e.g. "A"). Don't superset every exercise — keep some standalone.`;

const WORKOUT_KEYWORDS = /\b(generate|create|make|build|give me|adjust|modify|change|update|swap|replace|new workout|workout plan)\b/i;

function buildSystemPrompt(equipment: Equipment[], recentSessions: WorkoutSession[], injuries?: string, additionalEquipment?: string, includeWorkoutSchema?: boolean, avgWorkoutMinutes?: number): string {
  const enabledEquip = equipment.filter((e) => e.enabled).map((e) => e.name);
  const recentWorkouts = recentSessions.slice(0, 5).map((s) => {
    const days = daysAgo(s.startedAt);
    const exercises = s.exercises.map((e) => `${e.exerciseName} [${e.muscleGroup}] (${e.sets.length} sets)`).join(', ');
    return `- "${s.name}" (${formatDaysAgo(days)}): ${exercises} — Volume: ${s.totalVolume}lbs`;
  });

  const muscleRecovery = buildMuscleRecoveryStatus(recentSessions);

  let prompt = `You are Titan, an expert AI fitness coach built into a home gym app. You're knowledgeable, encouraging, and adaptive.

USER'S HOME GYM EQUIPMENT:
${enabledEquip.length > 0 ? enabledEquip.map((e) => `- ${e}`).join('\n') : '- No equipment configured yet (bodyweight only)'}
${additionalEquipment ? `\nADDITIONAL EQUIPMENT/NOTES:\n${additionalEquipment}` : ''}
${injuries ? `\nCURRENT INJURIES/LIMITATIONS:\n${injuries}\nIMPORTANT: Always account for these injuries. Avoid exercises that aggravate them and suggest alternatives.` : ''}
${avgWorkoutMinutes ? `\nPREFERRED WORKOUT DURATION: ${avgWorkoutMinutes} minutes\nIMPORTANT: Design workouts to fit within this time frame. Adjust the number of exercises and sets accordingly.` : ''}

RECENT WORKOUT HISTORY:
${recentWorkouts.length > 0 ? recentWorkouts.join('\n') : '- No recent workouts yet'}
${muscleRecovery}

GUIDELINES:
- Only suggest exercises the user can do with their available equipment
- Reference their workout history to suggest progressive overload
- If they mention an injury or limitation, immediately adapt recommendations
- Keep responses concise and actionable
- You can suggest workout modifications, recovery advice, form tips, and motivation
- Be conversational and supportive, like a personal trainer
- CRITICAL: Check the MUSCLE RECOVERY STATUS section. Never program muscles marked as "NEEDS RECOVERY" as primary movers. Muscles marked "RECOVERING" can be used lightly (assistance work only). Prioritize "FRESH" and "RECOVERED" muscle groups.`;

  if (includeWorkoutSchema) {
    prompt += WORKOUT_SCHEMA;
  }

  return prompt;
}

export async function sendMessage(
  userMessage: string,
  chatHistory: ChatMessage[],
  equipment: Equipment[],
  recentSessions: WorkoutSession[],
  profileContext?: { injuries?: string; additionalEquipment?: string; avgWorkoutMinutes?: number }
): Promise<string> {
  const config = getConfig();
  if (!config) {
    return "I'd love to help! Please set up your AI API key in the Profile settings to enable the chat. You can use either an Anthropic or OpenAI key.";
  }

  const systemPrompt = buildSystemPrompt(
    equipment,
    recentSessions.slice(0, 5),
    profileContext?.injuries,
    profileContext?.additionalEquipment,
    true,
    profileContext?.avgWorkoutMinutes,
  );

  // Truncate history early to avoid passing large arrays through the stack
  const trimmedHistory = chatHistory.slice(-20);

  try {
    if (config.provider === 'anthropic') {
      return await callAnthropic(config.apiKey, systemPrompt, trimmedHistory, userMessage);
    } else {
      return await callOpenAI(config.apiKey, systemPrompt, trimmedHistory, userMessage);
    }
  } catch (err: any) {
    if (err.message?.includes('401')) {
      return "There's an issue with your API key. Please check it in Profile settings.";
    }
    if (err.message?.includes('404') || err.message?.includes('model_not_found') || err.message?.includes('invalid_model')) {
      return `The AI model isn't available on your account. Error: ${err.message}`;
    }
    return `Sorry, I had trouble connecting. Error: ${err.message}`;
  }
}

async function callAnthropic(apiKey: string, system: string, history: ChatMessage[], userMsg: string, maxTokens = 8192): Promise<string> {
  const messages = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  messages.push({ role: 'user', content: userMsg });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

export async function sendWorkoutChat(
  userMessage: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  currentExercise: { name: string; muscleGroup: string; reps: string; sets: number },
  planSummary: string
): Promise<string> {
  const config = getConfig();
  if (!config) {
    return "Set up your AI API key in Profile settings to use in-workout chat.";
  }

  const systemPrompt = `You are Titan, a concise in-workout AI coach. The user is mid-workout and needs quick, actionable advice.

CURRENT EXERCISE: ${currentExercise.name} (${currentExercise.muscleGroup}) — ${currentExercise.sets} sets × ${currentExercise.reps}

WORKOUT CONTEXT:
${planSummary}

GUIDELINES:
- Keep responses SHORT (2-4 sentences max) — the user is actively working out
- Focus on: form cues, exercise alternatives, weight/rep advice, breathing, common mistakes
- If suggesting an alternative, name 1-2 options with the same muscle group
- Be encouraging but concise — no lengthy explanations`;

  const messages = chatHistory.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  messages.push({ role: 'user', content: userMessage });

  try {
    if (config.provider === 'anthropic') {
      return await callAnthropic(config.apiKey, systemPrompt, messages as ChatMessage[], userMessage);
    } else {
      return await callOpenAI(config.apiKey, systemPrompt, messages as ChatMessage[], userMessage);
    }
  } catch (err: any) {
    return `Sorry, couldn't connect. ${err.message}`;
  }
}

async function callOpenAI(apiKey: string, system: string, history: ChatMessage[], userMsg: string, maxTokens = 8192): Promise<string> {
  const messages: { role: string; content: string }[] = [{ role: 'system', content: system }];
  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: 'user', content: userMsg });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages,
      max_completion_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export function buildProgramSystemPrompt(equipment: Equipment[], recentSessions: WorkoutSession[], injuries?: string, additionalEquipment?: string, avgWorkoutMinutes?: number, programActiveDays?: number): string {
  const enabledEquip = equipment.filter((e) => e.enabled).map((e) => e.name);
  const recentWorkouts = recentSessions.slice(0, 5).map((s) => {
    const exercises = s.exercises.map((e) => `${e.exerciseName} (${e.sets.length} sets)`).join(', ');
    return `- ${s.name} on ${new Date(s.startedAt).toLocaleDateString()}: ${exercises}, Volume: ${s.totalVolume}lbs`;
  });

  return `You are Titan, an expert AI fitness coach. Generate a complete 7-day workout program as a structured weekly training split.

USER'S HOME GYM EQUIPMENT:
${enabledEquip.length > 0 ? enabledEquip.map((e) => `- ${e}`).join('\n') : '- No equipment configured yet (bodyweight only)'}
${additionalEquipment ? `\nADDITIONAL EQUIPMENT/NOTES:\n${additionalEquipment}` : ''}
${injuries ? `\nCURRENT INJURIES/LIMITATIONS:\n${injuries}\nIMPORTANT: Always account for these injuries. Avoid exercises that aggravate them and suggest alternatives.` : ''}
${avgWorkoutMinutes ? `\nPREFERRED WORKOUT DURATION: ${avgWorkoutMinutes} minutes\nIMPORTANT: Design each workout day to fit within this time frame.` : ''}

RECENT WORKOUT HISTORY:
${recentWorkouts.length > 0 ? recentWorkouts.join('\n') : '- No recent workouts yet'}

PROGRAM DESIGN GUIDELINES:
- Design a balanced weekly split with proper muscle group recovery (e.g., Push/Pull/Legs, Upper/Lower, Full Body rotations)
- The program must have exactly ${programActiveDays || 6} active workout days and ${7 - (programActiveDays || 6)} rest/recovery day${7 - (programActiveDays || 6) !== 1 ? 's' : ''}. Spread rest days evenly through the week for optimal recovery.
- Progress difficulty through the week (harder sessions early, lighter towards the end)
- Only use exercises the user can do with their available equipment
- Reference their workout history for progressive overload
- Each workout day should have 5-8 exercises
- Vary workout styles across the week (strength, hypertrophy, functional, etc.)

You MUST respond with a JSON block in a \`\`\`json code fence matching this exact schema:
{
  "name": "string - program name (e.g., 'Week of Gains', 'Push-Pull-Legs Split')",
  "days": [
    {
      "dayNumber": 1,
      "label": "Day 1 — Push",
      "isRest": false,
      "plan": {
        "name": "string - workout name",
        "style": "strength|hypertrophy|functional|hiit|cardio|recovery|mobility|power|endurance",
        "exercises": [
          {
            "name": "string - exercise name",
            "muscleGroup": "string - target muscle",
            "equipment": ["string - equipment id, e.g. 'dumbbells', 'barbell', or empty array for bodyweight"],
            "sets": 3,
            "reps": "string - e.g. '10-12', '15', 'Failure'. For time-based exercises use '30s', '45s each', '60s'",
            "weight": null,
            "restSeconds": 60,
            "group": "string or null - optional superset group letter"
          }
        ],
        "durationMin": 45,
        "estimatedCalories": 350,
        "focus": "string - e.g. 'Chest & Triceps'",
        "intensity": 2
      }
    },
    {
      "dayNumber": 2,
      "label": "Day 2 — Rest",
      "isRest": true
    }
  ]
}

Equipment IDs are: dumbbells, barbell, kettlebells, bench, pull-up-bar, resistance-bands, rings, trx, yoga-mat, foam-roller, jump-rope, medicine-ball, ab-wheel, stationary-bike, rowing-machine, treadmill.
Include a brief conversational message before or after the JSON block.`;
}

export async function sendProgramMessage(
  userMessage: string,
  equipment: Equipment[],
  recentSessions: WorkoutSession[],
  profileContext?: { injuries?: string; additionalEquipment?: string; avgWorkoutMinutes?: number; programActiveDays?: number }
): Promise<string> {
  const config = getConfig();
  if (!config) {
    return "I'd love to help! Please set up your AI API key in the Profile settings to enable program generation.";
  }

  const systemPrompt = buildProgramSystemPrompt(equipment, recentSessions, profileContext?.injuries, profileContext?.additionalEquipment, profileContext?.avgWorkoutMinutes, profileContext?.programActiveDays);

  try {
    if (config.provider === 'anthropic') {
      return await callAnthropic(config.apiKey, systemPrompt, [], userMessage, 4096);
    } else {
      return await callOpenAI(config.apiKey, systemPrompt, [], userMessage, 8192);
    }
  } catch (err: any) {
    if (err.message?.includes('401')) {
      return "There's an issue with your API key. Please check it in Profile settings.";
    }
    return `Sorry, I had trouble connecting. Error: ${err.message}`;
  }
}
