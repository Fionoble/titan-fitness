import type { Equipment, WorkoutSession, ChatMessage, WorkoutPlan, WorkoutProgram } from './types';
import {
  CREATE_WORKOUT_TOOL,
  CREATE_PROGRAM_TOOL,
  buildPlanFromParsed,
  buildProgramFromParsed,
} from './ai-schemas';
import type { ParsedProgram } from './ai-schemas';

// BYOK browser client — raw fetch by design (no server, dual-provider, CSP-pinned hosts).
const ANTHROPIC_MODEL = 'claude-haiku-4-5';
const OPENAI_MODEL = 'gpt-5-mini';
const TIMEOUT_MS = 90_000;

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

// --- Typed errors -----------------------------------------------------------

export type AIErrorKind =
  | 'unconfigured'
  | 'auth'
  | 'rate_limit'
  | 'overloaded'
  | 'network'
  | 'timeout'
  | 'bad_request'
  | 'truncated'
  | 'invalid_output'
  | 'unknown';

export class AIError extends Error {
  constructor(public kind: AIErrorKind, message: string, public status?: number) {
    super(message);
    this.name = 'AIError';
  }
}

/** User-facing message for any AI failure. Never echoes raw API bodies. */
export function aiErrorMessage(err: unknown): string {
  if (err instanceof AIError) {
    switch (err.kind) {
      case 'unconfigured': return 'Set up your AI API key in Settings to use the AI coach.';
      case 'auth': return "There's an issue with your API key — check it in Settings.";
      case 'rate_limit': return 'The AI provider is rate-limiting requests right now. Give it a moment and try again.';
      case 'overloaded': return 'The AI service is temporarily overloaded. Try again in a minute.';
      case 'timeout': return 'The request timed out. Check your connection and try again.';
      // Some providers (OpenAI) omit CORS headers on auth-rejected responses,
      // so a bad key is indistinguishable from a network failure in a browser
      case 'network': return typeof navigator !== 'undefined' && navigator.onLine === false
        ? "You're offline — reconnect to use the AI coach."
        : "Couldn't reach the AI service. Check your connection — and if you're online, double-check your API key in Settings.";
      case 'truncated': return 'The response got cut off before it finished. Try again — a simpler request can help.';
      case 'invalid_output': return "I couldn't produce a valid result this time. Try rephrasing or just try again.";
      case 'bad_request': return `The AI request was rejected: ${err.message}`;
    }
  }
  return 'Something went wrong talking to the AI. Please try again.';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return 1500 * Math.pow(2, attempt) + Math.random() * 500;
}

/** Extract a short, safe error description from a provider error body */
function summarizeErrorBody(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body);
    const msg = parsed?.error?.message || parsed?.message;
    if (typeof msg === 'string') return msg.slice(0, 200);
  } catch { /* not JSON */ }
  return `HTTP ${status}`;
}

/**
 * fetch with timeout + retry. 429/500/529 are retried with backoff
 * (honoring retry-after); auth and validation errors throw immediately.
 */
async function apiFetch(url: string, init: RequestInit): Promise<Response> {
  const maxAttempts = 3;
  let lastErr: AIError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === 'AbortError') throw new AIError('timeout', 'Request timed out');
      lastErr = new AIError('network', 'Network request failed');
      if (attempt < maxAttempts - 1) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw lastErr;
    }
    clearTimeout(timer);

    if (res.ok) return res;

    const status = res.status;
    const body = await res.text().catch(() => '');

    if (status === 401 || status === 403) {
      throw new AIError('auth', `Authentication failed (${status})`, status);
    }
    if (status === 429 || status === 529 || status >= 500) {
      const kind: AIErrorKind = status === 429 ? 'rate_limit' : 'overloaded';
      lastErr = new AIError(kind, summarizeErrorBody(body, status), status);
      if (attempt < maxAttempts - 1) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15_000)
          : backoffMs(attempt);
        await sleep(delay);
        continue;
      }
      throw lastErr;
    }
    throw new AIError('bad_request', summarizeErrorBody(body, status), status);
  }
  throw lastErr ?? new AIError('unknown', 'Request failed');
}

// --- Provider calls ---------------------------------------------------------

interface ToolSpec {
  name: string;
  description: string;
  input_schema: any;
}

interface AICallOpts {
  maxTokens?: number;
  tools?: ToolSpec[];
  /** Force the model to call this tool (must be in `tools`) */
  forceTool?: string;
}

interface AIResult {
  text: string;
  toolName?: string;
  toolInput?: any;
}

type WireMessage = { role: 'user' | 'assistant'; content: string };

async function callAnthropic(apiKey: string, system: string, messages: WireMessage[], opts: AICallOpts = {}): Promise<AIResult> {
  const body: any = {
    model: ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 8192,
    system,
    messages,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    if (opts.forceTool) body.tool_choice = { type: 'tool', name: opts.forceTool };
  }

  const res = await apiFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const blocks: any[] = Array.isArray(data.content) ? data.content : [];
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const toolUse = blocks.find((b) => b.type === 'tool_use');

  // A tool call truncated mid-JSON is unusable; plain text cut short is still
  // worth showing, so only treat truncation as fatal on tool paths
  if (data.stop_reason === 'max_tokens' && (opts.forceTool || toolUse)) {
    throw new AIError('truncated', 'Response hit the token limit mid-generation');
  }
  if (!text && !toolUse) {
    throw new AIError('invalid_output', `Empty response (stop_reason: ${data.stop_reason ?? 'unknown'})`);
  }
  return { text, toolName: toolUse?.name, toolInput: toolUse?.input };
}

async function callOpenAI(apiKey: string, system: string, messages: WireMessage[], opts: AICallOpts = {}): Promise<AIResult> {
  const body: any = {
    model: OPENAI_MODEL,
    messages: [{ role: 'system', content: system }, ...messages],
    max_completion_tokens: opts.maxTokens ?? 8192,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
    if (opts.forceTool) body.tool_choice = { type: 'function', function: { name: opts.forceTool } };
  }

  const res = await apiFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const choice = data.choices?.[0];
  const text = (choice?.message?.content || '').trim();

  let toolName: string | undefined;
  let toolInput: any;
  const call = choice?.message?.tool_calls?.[0];
  if (call?.function) {
    toolName = call.function.name;
    try {
      toolInput = JSON.parse(call.function.arguments);
    } catch {
      throw new AIError('invalid_output', 'Tool arguments were not valid JSON');
    }
  }

  if (choice?.finish_reason === 'length' && (opts.forceTool || toolName)) {
    throw new AIError('truncated', 'Response hit the token limit mid-generation');
  }
  if (!text && !toolInput) {
    throw new AIError('invalid_output', `Empty response (finish_reason: ${choice?.finish_reason ?? 'unknown'})`);
  }
  return { text, toolName, toolInput };
}

async function callAI(system: string, messages: WireMessage[], opts: AICallOpts = {}): Promise<AIResult> {
  const config = getConfig();
  if (!config) throw new AIError('unconfigured', 'No AI API key configured');
  return config.provider === 'anthropic'
    ? callAnthropic(config.apiKey, system, messages, opts)
    : callOpenAI(config.apiKey, system, messages, opts);
}

/** Build wire messages from chat history: drop error bubbles, trim, ensure user-first */
function toWire(history: ChatMessage[], userMessage: string): WireMessage[] {
  const trimmed = history.filter((m) => !m.isError).slice(-20);
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift();
  const msgs: WireMessage[] = trimmed.map((m) => ({ role: m.role, content: m.content }));
  msgs.push({ role: 'user', content: userMessage });
  return msgs;
}

// --- Prompt building --------------------------------------------------------

function daysAgo(dateStr: string): number {
  const now = new Date();
  const then = new Date(dateStr);
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  return Math.round((startOfNow - startOfThen) / (1000 * 60 * 60 * 24));
}

function formatDaysAgo(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return '1 day ago';
  return `${n} days ago`;
}

function recoveryLabel(daysAgo: number): string {
  if (daysAgo === 0) return 'TRAINED TODAY — do not retrain';
  if (daysAgo === 1) return 'NEEDS RECOVERY (24h)';
  if (daysAgo === 2) return 'RECOVERING (48h)';
  if (daysAgo === 3) return 'MOSTLY RECOVERED (72h) — light work OK';
  return 'FULLY RECOVERED';
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

  const workoutDays = recentSessions.slice(0, 5).map((s) => daysAgo(s.startedAt));
  const lastWorkoutDays = workoutDays.length > 0 ? workoutDays[0] : null;
  const restDayNote = lastWorkoutDays !== null && lastWorkoutDays >= 2
    ? `\nNote: User has had ${lastWorkoutDays} rest day${lastWorkoutDays > 1 ? 's' : ''} since their last workout — most muscle groups should be recovered.`
    : '';

  const lines = Array.from(muscleLastTrained.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([muscle, days]) => `- ${muscle}: trained ${formatDaysAgo(days)} — ${recoveryLabel(days)}`);

  return `\nMUSCLE RECOVERY STATUS:${restDayNote}\n${lines.join('\n')}`;
}

export interface ProfileContext {
  injuries?: string;
  additionalEquipment?: string;
  avgWorkoutMinutes?: number;
  programActiveDays?: number;
}

function buildSystemPrompt(equipment: Equipment[], recentSessions: WorkoutSession[], profileContext?: ProfileContext, withTools = true): string {
  const enabledEquip = equipment.filter((e) => e.enabled).map((e) => e.name);
  const recentWorkouts = recentSessions.slice(0, 5).map((s) => {
    const days = daysAgo(s.startedAt);
    const exercises = s.exercises.map((e) => `${e.exerciseName} [${e.muscleGroup}] (${e.sets.length} sets)`).join(', ');
    return `- "${s.name}" (${formatDaysAgo(days)}): ${exercises} — Volume: ${s.totalVolume}lbs`;
  });

  const muscleRecovery = buildMuscleRecoveryStatus(recentSessions);
  const { injuries, additionalEquipment, avgWorkoutMinutes } = profileContext || {};

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
- CRITICAL: Check the MUSCLE RECOVERY STATUS section. Never program muscles marked "NEEDS RECOVERY" as primary movers. Muscles marked "RECOVERING" can be used lightly (assistance work only). Prioritize "FULLY RECOVERED" and "MOSTLY RECOVERED" muscle groups.`;

  if (withTools) {
    prompt += `

TOOLS:
- Use the create_workout tool whenever the user asks you to generate, create, adjust, modify, or swap exercises in a workout. Always include the COMPLETE plan in the tool call, even when only one exercise changes.
- Use the create_program tool when the user asks for a weekly program, training plan, weekly split, or multi-day routine.
- Always write a brief conversational message alongside any tool call.`;
  }

  return prompt;
}

function buildProgramSystemPrompt(equipment: Equipment[], recentSessions: WorkoutSession[], profileContext?: ProfileContext): string {
  const enabledEquip = equipment.filter((e) => e.enabled).map((e) => e.name);
  const recentWorkouts = recentSessions.slice(0, 5).map((s) => {
    const exercises = s.exercises.map((e) => `${e.exerciseName} (${e.sets.length} sets)`).join(', ');
    return `- ${s.name} on ${new Date(s.startedAt).toLocaleDateString()}: ${exercises}, Volume: ${s.totalVolume}lbs`;
  });
  const { injuries, additionalEquipment, avgWorkoutMinutes, programActiveDays } = profileContext || {};
  const activeDays = programActiveDays || 6;

  return `You are Titan, an expert AI fitness coach. Generate a complete 7-day workout program as a structured weekly training split using the create_program tool.

USER'S HOME GYM EQUIPMENT:
${enabledEquip.length > 0 ? enabledEquip.map((e) => `- ${e}`).join('\n') : '- No equipment configured yet (bodyweight only)'}
${additionalEquipment ? `\nADDITIONAL EQUIPMENT/NOTES:\n${additionalEquipment}` : ''}
${injuries ? `\nCURRENT INJURIES/LIMITATIONS:\n${injuries}\nIMPORTANT: Always account for these injuries. Avoid exercises that aggravate them and suggest alternatives.` : ''}
${avgWorkoutMinutes ? `\nPREFERRED WORKOUT DURATION: ${avgWorkoutMinutes} minutes\nIMPORTANT: Design each workout day to fit within this time frame.` : ''}

RECENT WORKOUT HISTORY:
${recentWorkouts.length > 0 ? recentWorkouts.join('\n') : '- No recent workouts yet'}

PROGRAM DESIGN GUIDELINES:
- Design a balanced weekly split with proper muscle group recovery (e.g., Push/Pull/Legs, Upper/Lower, Full Body rotations)
- The program must have exactly ${activeDays} active workout days and ${7 - activeDays} rest/recovery day${7 - activeDays !== 1 ? 's' : ''}. Spread rest days evenly through the week for optimal recovery.
- Progress difficulty through the week (harder sessions early, lighter towards the end)
- Only use exercises the user can do with their available equipment
- Reference their workout history for progressive overload
- Each workout day should have 5-8 exercises
- Vary workout styles across the week (strength, hypertrophy, functional, etc.)

Respond by calling the create_program tool with all 7 days, plus a brief conversational message.`;
}

// --- Public API -------------------------------------------------------------

export interface CoachReply {
  text: string;
  plan?: WorkoutPlan;
  program?: WorkoutProgram;
  /** Program days that failed validation and became rest days */
  programDemotedDays?: number;
}

/**
 * Coach chat: the model decides whether to answer in text, create a workout,
 * or create a 7-day program (tools replace the old JSON-in-prose parsing and
 * the keyword-based program router). Throws AIError on failure.
 */
export async function sendCoachMessage(
  userMessage: string,
  chatHistory: ChatMessage[],
  equipment: Equipment[],
  recentSessions: WorkoutSession[],
  profileContext?: ProfileContext,
): Promise<CoachReply> {
  const system = buildSystemPrompt(equipment, recentSessions.slice(0, 5), profileContext);
  const result = await callAI(system, toWire(chatHistory, userMessage), {
    tools: [CREATE_WORKOUT_TOOL, CREATE_PROGRAM_TOOL],
  });

  if (result.toolName === 'create_workout') {
    const plan = buildPlanFromParsed(result.toolInput);
    if (!plan) throw new AIError('invalid_output', 'Generated workout failed validation');
    return { text: result.text || "Here's your workout plan!", plan };
  }
  if (result.toolName === 'create_program') {
    const parsed = buildProgramFromParsed(result.toolInput, equipment);
    if (!parsed) throw new AIError('invalid_output', 'Generated program failed validation');
    return {
      text: result.text || "Here's your weekly program!",
      program: parsed.program,
      programDemotedDays: parsed.demotedDays,
    };
  }
  return { text: result.text };
}

/** Dedicated workout generation — forces the create_workout tool. Throws AIError. */
export async function requestWorkout(
  prompt: string,
  chatHistory: ChatMessage[],
  equipment: Equipment[],
  recentSessions: WorkoutSession[],
  profileContext?: ProfileContext,
): Promise<{ plan: WorkoutPlan; message: string }> {
  const system = buildSystemPrompt(equipment, recentSessions.slice(0, 5), profileContext);
  const result = await callAI(system, toWire(chatHistory, prompt), {
    tools: [CREATE_WORKOUT_TOOL],
    forceTool: 'create_workout',
  });
  const plan = buildPlanFromParsed(result.toolInput);
  if (!plan) throw new AIError('invalid_output', 'Generated workout failed validation');
  return { plan, message: result.text || "Here's your workout plan!" };
}

/** Dedicated 7-day program generation — forces the create_program tool. Throws AIError. */
export async function requestProgram(
  prompt: string,
  equipment: Equipment[],
  recentSessions: WorkoutSession[],
  profileContext?: ProfileContext,
): Promise<ParsedProgram> {
  const system = buildProgramSystemPrompt(equipment, recentSessions, profileContext);
  const result = await callAI(system, [{ role: 'user', content: prompt }], {
    tools: [CREATE_PROGRAM_TOOL],
    forceTool: 'create_program',
    maxTokens: 8192,
  });
  const parsed = buildProgramFromParsed(result.toolInput, equipment);
  if (!parsed) throw new AIError('invalid_output', 'Generated program failed validation');
  return parsed;
}

/** Plain-text Q&A with the coach persona (no tools). Throws AIError. */
export async function sendTextMessage(
  userMessage: string,
  equipment: Equipment[],
  recentSessions: WorkoutSession[],
): Promise<string> {
  const system = buildSystemPrompt(equipment, recentSessions.slice(0, 5), undefined, false);
  const result = await callAI(system, [{ role: 'user', content: userMessage }], { maxTokens: 2048 });
  return result.text;
}

/**
 * In-workout quick chat. Returns a string (errors come back as friendly text —
 * this chat is ephemeral and never re-sent as model context).
 */
export async function sendWorkoutChat(
  userMessage: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  currentExercise: { name: string; muscleGroup: string; reps: string; sets: number },
  planSummary: string,
): Promise<string> {
  const system = `You are Titan, a concise in-workout AI coach. The user is mid-workout and needs quick, actionable advice.

CURRENT EXERCISE: ${currentExercise.name} (${currentExercise.muscleGroup}) — ${currentExercise.sets} sets × ${currentExercise.reps}

WORKOUT CONTEXT:
${planSummary}

GUIDELINES:
- Keep responses SHORT (2-4 sentences max) — the user is actively working out
- Focus on: form cues, exercise alternatives, weight/rep advice, breathing, common mistakes
- If suggesting an alternative, name 1-2 options with the same muscle group
- Be encouraging but concise — no lengthy explanations`;

  const messages: WireMessage[] = chatHistory.slice(-10).map((m) => ({ role: m.role, content: m.content }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  messages.push({ role: 'user', content: userMessage });

  try {
    const result = await callAI(system, messages, { maxTokens: 1024 });
    return result.text;
  } catch (err) {
    return aiErrorMessage(err);
  }
}
