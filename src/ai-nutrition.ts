import { isAIConfigured } from './ai';
import type { ChatMessage, FoodEntry, NutritionGoals, UserProfile } from './types';

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

const NUTRITION_SYSTEM_PROMPT = `You are a nutrition analysis AI. When given a food description, estimate the nutritional content.

IMPORTANT: You MUST respond with ONLY valid JSON, no other text. Return an array of food items with this exact structure:
[
  {
    "name": "Food name",
    "calories": 200,
    "protein": 10,
    "carbs": 25,
    "fats": 8,
    "servingSize": 1,
    "servingUnit": "serving"
  }
]

Rules:
- All numbers should be reasonable estimates based on standard serving sizes
- Calories in kcal, protein/carbs/fats in grams
- If multiple foods are described, return multiple items in the array
- Be as accurate as possible with your estimates
- Always return valid JSON array, nothing else`;

const GOALS_SYSTEM_PROMPT = `You are a nutrition planning AI. Based on the user profile provided, suggest daily calorie and macro goals.

IMPORTANT: You MUST respond with ONLY valid JSON, no other text. Return an object with this exact structure:
{
  "calories": 2000,
  "protein": 150,
  "carbs": 200,
  "fats": 65
}

Rules:
- Base recommendations on the user's goals, activity level, and any other profile info
- Use standard nutritional science guidelines
- Protein in grams, carbs in grams, fats in grams
- Always return valid JSON object, nothing else`;

const CHAT_SYSTEM_PROMPT = `You are Titan's nutrition coach AI. You help users with nutrition questions, meal planning, dietary patterns, food suggestions, calorie strategies, and general health-related food topics.

You have access to the user's daily nutrition tracking data when provided. Use it to give personalized, context-aware advice.

Guidelines:
- Be encouraging and supportive
- Give specific, actionable advice
- Reference the user's actual data when available
- Keep responses concise but informative (2-4 paragraphs max)
- If asked about medical conditions or allergies, recommend consulting a healthcare provider
- You can suggest meals, snacks, recipes, and dietary adjustments
- Discuss macro ratios, meal timing, hydration, and nutrition science`;

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error('AI not configured');

  if (config.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.content[0].text;
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_completion_tokens: 8192,
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }
}

export async function estimateNutrition(description: string): Promise<FoodEntry[]> {
  if (!isAIConfigured()) {
    throw new Error('AI not configured. Please set up your API key in Profile settings.');
  }

  const response = await callAI(NUTRITION_SYSTEM_PROMPT, description);

  // Extract JSON from response (handle potential markdown code fences)
  let jsonStr = response.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);
  const items: FoodEntry[] = (Array.isArray(parsed) ? parsed : [parsed]).map((item: any) => ({
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: item.name || 'Unknown Food',
    calories: Math.round(item.calories || 0),
    protein: Math.round(item.protein || 0),
    carbs: Math.round(item.carbs || 0),
    fats: Math.round(item.fats || 0),
    servingSize: item.servingSize || 1,
    servingUnit: item.servingUnit || 'serving',
    source: 'ai' as const,
  }));

  return items;
}

export async function suggestGoals(profile: UserProfile): Promise<NutritionGoals> {
  if (!isAIConfigured()) {
    throw new Error('AI not configured');
  }

  const profileDesc = `User profile: Name: ${profile.name}${profile.injuries ? `, Injuries/limitations: ${profile.injuries}` : ''}. Please suggest daily nutrition goals.`;
  const response = await callAI(GOALS_SYSTEM_PROMPT, profileDesc);

  let jsonStr = response.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);
  return {
    calories: Math.round(parsed.calories || 2000),
    protein: Math.round(parsed.protein || 150),
    carbs: Math.round(parsed.carbs || 200),
    fats: Math.round(parsed.fats || 65),
    source: 'ai',
  };
}

export async function chatWithNutritionAI(
  userMessage: string,
  chatHistory: ChatMessage[],
  context?: { totals?: { calories: number; protein: number; carbs: number; fats: number }; goals?: NutritionGoals }
): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error('AI not configured');

  let systemPrompt = CHAT_SYSTEM_PROMPT;
  if (context?.totals && context?.goals) {
    systemPrompt += `\n\nUser's nutrition data today:
- Consumed: ${context.totals.calories} cal, ${context.totals.protein}g protein, ${context.totals.carbs}g carbs, ${context.totals.fats}g fats
- Goals: ${context.goals.calories} cal, ${context.goals.protein}g protein, ${context.goals.carbs}g carbs, ${context.goals.fats}g fats
- Remaining: ${context.goals.calories - context.totals.calories} cal`;
  }

  const historyMessages = chatHistory.slice(-20).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  if (config.provider === 'anthropic') {
    const messages = [...historyMessages, { role: 'user' as const, content: userMessage }];
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.content[0].text;
  } else {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMessages,
      { role: 'user' as const, content: userMessage },
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages,
        max_completion_tokens: 8192,
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }
}
