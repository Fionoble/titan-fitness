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

const VISION_NUTRITION_PROMPT = `You are a nutrition analysis AI that can analyze food from images and descriptions.

When given a food image (and optional text description), do one of these:

1. If you need clarification about portion size, preparation method, or ingredients, ask 1-2 SHORT questions in plain text. Be conversational and specific (e.g. "That looks like about 2 cups of rice — does that seem right?" rather than "How much rice is there?").

2. If you have enough information, respond with ONLY a JSON array: [{"name": "...", "calories": ..., "protein": ..., "carbs": ..., "fats": ..., "servingSize": ..., "servingUnit": "..."}]

Rules:
- Ask at MOST 2 rounds of questions before giving your estimate
- If the user answers your questions, respond with the JSON estimate
- All numbers should be reasonable estimates
- Calories in kcal, protein/carbs/fats in grams
- If multiple foods visible, return multiple items in the array`;

const LABEL_SCAN_PROMPT = `You are a nutrition label reader. Given a photo of a nutrition facts label, extract the nutritional data.

You MUST respond with ONLY a valid JSON array, no other text:
[{"name": "Product name (read from label or packaging, or 'Unknown Product')", "calories": 200, "protein": 10, "carbs": 25, "fats": 8, "servingSize": 1, "servingUnit": "serving"}]

Rules:
- Read the values directly from the label — do not estimate
- Use the "per serving" values, not "per 100g" (unless serving size IS 100g)
- Calories in kcal, protein/carbs/fats in grams
- Include the serving size and unit from the label
- If the label is unclear or partially visible, do your best with what's readable
- Always return valid JSON array, nothing else`;

export function isJSONResponse(text: string): boolean {
  const trimmed = text.trim();
  // Check for raw JSON array
  if (trimmed.startsWith('[')) {
    try { JSON.parse(trimmed); return true; } catch { return false; }
  }
  // Check for JSON in code fences
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { JSON.parse(match[1].trim()); return true; } catch { return false; }
  }
  return false;
}

interface VisionMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  mediaType?: string;
}

export async function estimateNutritionWithImage(
  imageBase64: string,
  mediaType: string,
  description?: string,
  conversationHistory?: VisionMessage[],
  forceEstimate?: boolean,
): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error('AI not configured');

  const systemPrompt = forceEstimate
    ? VISION_NUTRITION_PROMPT + '\n\nIMPORTANT: The user has already answered your questions. You MUST now respond with ONLY the JSON array estimate. Do not ask any more questions.'
    : VISION_NUTRITION_PROMPT;

  if (config.provider === 'anthropic') {
    const messages: any[] = [];

    // Build first user message with image
    const firstUserContent: any[] = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: imageBase64 },
      },
    ];
    if (description) {
      firstUserContent.push({ type: 'text', text: description });
    } else {
      firstUserContent.push({ type: 'text', text: 'What food is this? Estimate the nutrition.' });
    }
    messages.push({ role: 'user', content: firstUserContent });

    // Add conversation history (follow-up messages)
    if (conversationHistory) {
      for (const msg of conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

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
    // OpenAI
    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    const firstUserContent: any[] = [
      {
        type: 'image_url',
        image_url: { url: `data:${mediaType};base64,${imageBase64}` },
      },
    ];
    if (description) {
      firstUserContent.push({ type: 'text', text: description });
    } else {
      firstUserContent.push({ type: 'text', text: 'What food is this? Estimate the nutrition.' });
    }
    messages.push({ role: 'user', content: firstUserContent });

    if (conversationHistory) {
      for (const msg of conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages,
        max_completion_tokens: 4096,
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }
}

export async function scanNutritionLabel(imageBase64: string, mediaType: string): Promise<FoodEntry[]> {
  const config = getConfig();
  if (!config) throw new Error('AI not configured');

  let responseText: string;

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
        system: LABEL_SCAN_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Read the nutrition facts from this label.' },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    responseText = data?.content?.[0]?.text;
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
          { role: 'system', content: LABEL_SCAN_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
              { type: 'text', text: 'Read the nutrition facts from this label.' },
            ],
          },
        ],
        max_completion_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    responseText = data?.choices?.[0]?.message?.content;
  }

  if (!responseText) throw new Error('Empty response from API');

  let jsonStr = responseText.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  const parsed = JSON.parse(jsonStr);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item: any) => ({
    id: `label-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: item.name || 'Unknown Product',
    calories: Math.round(item.calories || 0),
    protein: Math.round(item.protein || 0),
    carbs: Math.round(item.carbs || 0),
    fats: Math.round(item.fats || 0),
    servingSize: item.servingSize || 1,
    servingUnit: item.servingUnit || 'serving',
    source: 'scan' as const,
  }));
}

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
        max_completion_tokens: 4096,
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

  const parts = [`User profile: Name: ${profile.name}`];
  if (profile.weight) parts.push(`Weight: ${profile.weight} lbs`);
  if (profile.height) parts.push(`Height: ${Math.floor(profile.height / 12)}'${profile.height % 12}"`);
  if (profile.gender) parts.push(`Gender: ${profile.gender}`);
  if (profile.injuries) parts.push(`Injuries/limitations: ${profile.injuries}`);
  const profileDesc = `${parts.join(', ')}. Please suggest daily nutrition goals.`;
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
  if (!config) {
    return "I'd love to help! Please set up your AI API key in the Profile settings to enable the nutrition coach.";
  }

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

  try {
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
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anthropic API error ${res.status}: ${text}`);
      }
      const data = await res.json();
      const reply = data?.content?.[0]?.text;
      if (!reply) throw new Error('Empty response from API');
      return reply;
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
          max_completion_tokens: 4096,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${text}`);
      }
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) throw new Error('Empty response from API');
      return reply;
    }
  } catch (err: any) {
    if (err.message?.includes('401')) {
      return "There's an issue with your API key. Please check it in Profile settings.";
    }
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('Load failed')) {
      return "Couldn't reach the AI service. Please check your internet connection and try again.";
    }
    return `Sorry, I had trouble connecting. Error: ${err.message}`;
  }
}
