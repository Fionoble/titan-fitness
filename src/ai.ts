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

function buildSystemPrompt(equipment: Equipment[], recentSessions: WorkoutSession[], injuries?: string, additionalEquipment?: string): string {
  const enabledEquip = equipment.filter((e) => e.enabled).map((e) => e.name);
  const recentWorkouts = recentSessions.slice(0, 5).map((s) => {
    const exercises = s.exercises.map((e) => `${e.exerciseName} (${e.sets.length} sets)`).join(', ');
    return `- ${s.name} on ${new Date(s.startedAt).toLocaleDateString()}: ${exercises}, Volume: ${s.totalVolume}lbs`;
  });

  return `You are Titan, an expert AI fitness coach built into a home gym app. You're knowledgeable, encouraging, and adaptive.

USER'S HOME GYM EQUIPMENT:
${enabledEquip.length > 0 ? enabledEquip.map((e) => `- ${e}`).join('\n') : '- No equipment configured yet (bodyweight only)'}
${additionalEquipment ? `\nADDITIONAL EQUIPMENT/NOTES:\n${additionalEquipment}` : ''}
${injuries ? `\nCURRENT INJURIES/LIMITATIONS:\n${injuries}\nIMPORTANT: Always account for these injuries. Avoid exercises that aggravate them and suggest alternatives.` : ''}

RECENT WORKOUT HISTORY:
${recentWorkouts.length > 0 ? recentWorkouts.join('\n') : '- No recent workouts yet'}

GUIDELINES:
- Only suggest exercises the user can do with their available equipment
- Reference their workout history to suggest progressive overload
- If they mention an injury or limitation, immediately adapt recommendations
- Keep responses concise and actionable
- You can suggest workout modifications, recovery advice, form tips, and motivation
- Be conversational and supportive, like a personal trainer

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
}

export async function sendMessage(
  userMessage: string,
  chatHistory: ChatMessage[],
  equipment: Equipment[],
  recentSessions: WorkoutSession[],
  profileContext?: { injuries?: string; additionalEquipment?: string }
): Promise<string> {
  const config = getConfig();
  if (!config) {
    return "I'd love to help! Please set up your AI API key in the Profile settings to enable the chat. You can use either an Anthropic or OpenAI key.";
  }

  const systemPrompt = buildSystemPrompt(equipment, recentSessions, profileContext?.injuries, profileContext?.additionalEquipment);

  try {
    if (config.provider === 'anthropic') {
      return await callAnthropic(config.apiKey, systemPrompt, chatHistory, userMessage);
    } else {
      return await callOpenAI(config.apiKey, systemPrompt, chatHistory, userMessage);
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

async function callAnthropic(apiKey: string, system: string, history: ChatMessage[], userMsg: string): Promise<string> {
  const messages = history.slice(-20).map((m) => ({
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
      max_tokens: 1024,
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

async function callOpenAI(apiKey: string, system: string, history: ChatMessage[], userMsg: string): Promise<string> {
  const messages: { role: string; content: string }[] = [{ role: 'system', content: system }];
  for (const m of history.slice(-20)) {
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
      max_completion_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
