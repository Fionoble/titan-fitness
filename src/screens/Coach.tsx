import { useState, useEffect, useRef } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { ChatMessage, Equipment, WorkoutSession, WorkoutPlan } from '../types';
import { sendMessage, isAIConfigured, setAIConfig } from '../ai';
import { parseWorkoutFromResponse, stripJsonBlock, buildAdjustPrompt } from '../ai-workout';
import { uuid } from '../utils';

interface CoachProps {
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => Promise<void>;
  onReceiveMessage: (msg: ChatMessage) => Promise<void>;
  equipment: Equipment[];
  sessions: WorkoutSession[];
  onApplyPlan?: (plan: WorkoutPlan) => void;
  onClearChat?: () => void;
  pendingAdjustPlan?: WorkoutPlan | null;
  onClearPendingAdjust?: () => void;
}

const QUICK_ACTIONS = [
  { label: 'Generate workout', icon: 'fitness_center', color: 'text-primary' },
  { label: 'Modify for injury', icon: 'healing', color: 'text-primary' },
  { label: 'Generate recovery', icon: 'spa', color: 'text-blue-400' },
  { label: 'Explain exercise', icon: 'help', color: 'text-amber-400' },
];

function WorkoutPlanCard({ plan, onApply }: { plan: WorkoutPlan; onApply?: (plan: WorkoutPlan) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div class="mt-2 rounded-xl bg-surface-dark border border-white/10 overflow-hidden">
      <div class="p-3">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Icon name="fitness_center" class="text-primary" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-white truncate">{plan.name}</p>
            <p class="text-xs text-slate-400">
              {plan.exercises.length} exercises • {plan.durationMin}min • ~{plan.estimatedCalories} cal
            </p>
          </div>
          <div class="flex gap-0.5">
            {[1, 2, 3].map((i) => (
              <Icon key={i} name="bolt" class={`text-xs ${i <= plan.intensity ? 'text-primary' : 'text-slate-600'}`} />
            ))}
          </div>
        </div>

        {/* Exercise preview */}
        <div class="space-y-1.5 mb-3">
          {(expanded ? plan.exercises : plan.exercises.slice(0, 3)).map((ex, i) => (
            <div key={ex.id || i} class="flex items-center gap-2 text-xs">
              <span class="text-primary/60 font-bold w-5 text-right">{i + 1}</span>
              <span class="text-slate-200 flex-1 truncate">{ex.name}</span>
              <span class="text-slate-500">{ex.sets}×{ex.reps}</span>
            </div>
          ))}
          {!expanded && plan.exercises.length > 3 && (
            <button
              onClick={() => setExpanded(true)}
              class="text-xs text-primary font-medium ml-7"
            >
              +{plan.exercises.length - 3} more exercises
            </button>
          )}
        </div>

        {/* Actions */}
        <div class="flex gap-2">
          {onApply && (
            <button
              onClick={() => onApply(plan)}
              class="flex-1 py-2 bg-primary text-bg-dark rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <Icon name="check_circle" class="text-sm" />
              Apply to Home
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            class="py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-slate-300 transition-colors"
          >
            {expanded ? 'Less' : 'Details'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Coach({ messages, onSendMessage, onReceiveMessage, equipment, sessions, onApplyPlan, onClearChat, pendingAdjustPlan, onClearPendingAdjust }: CoachProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [configured, setConfigured] = useState(isAIConfigured());
  const [setupKey, setSetupKey] = useState('');
  const [setupProvider, setSetupProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const hasSentAdjust = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-send adjustment request when coming from Home
  useEffect(() => {
    if (pendingAdjustPlan && !hasSentAdjust.current && configured) {
      hasSentAdjust.current = true;
      const prompt = buildAdjustPrompt(pendingAdjustPlan, 'I want to adjust this workout. What changes would you suggest? Please generate an updated version.');
      handleSend(prompt);
      onClearPendingAdjust?.();
    }
  }, [pendingAdjustPlan]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;

    const userMsg: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };

    await onSendMessage(userMsg);
    setInput('');
    setIsTyping(true);

    try {
      const response = await sendMessage(msg, [...messages, userMsg], equipment, sessions);

      // Check if the response contains a workout plan
      const parsedPlan = parseWorkoutFromResponse(response);
      const cleanContent = parsedPlan ? stripJsonBlock(response) : response;

      const aiMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: cleanContent || "Here's your workout plan!",
        timestamp: new Date().toISOString(),
        richContent: parsedPlan ? { type: 'workoutPlan', plan: parsedPlan } : undefined,
      };
      await onReceiveMessage(aiMsg);
    } catch {
      const errorMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: "Sorry, I couldn't process that. Please try again.",
        timestamp: new Date().toISOString(),
      };
      await onReceiveMessage(errorMsg);
    }
    setIsTyping(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyPlan = (plan: WorkoutPlan) => {
    onApplyPlan?.(plan);
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div class="flex flex-col h-full bg-bg-dark">
      {/* Header */}
      <header class="sticky top-0 z-50 bg-bg-dark/95 backdrop-blur-sm border-b border-white/5 px-4 pt-4 pt-safe pb-3 flex items-center justify-between">
        <div class="w-10">
          {messages.length > 0 && onClearChat && (
            <button
              onClick={() => { if (confirm('Start a new chat session?')) onClearChat(); }}
              class="flex items-center justify-center w-10 h-10 rounded-full text-slate-400 hover:text-primary hover:bg-white/5 transition-colors"
              title="New chat"
            >
              <Icon name="edit_square" class="text-[20px]" />
            </button>
          )}
        </div>
        <div class="flex flex-col items-center">
          <h1 class="text-lg font-bold tracking-tight text-white">Titan AI Coach</h1>
          <div class="flex items-center gap-1.5">
            <span class="relative flex h-2 w-2">
              <span class={`animate-ping absolute inline-flex h-full w-full rounded-full ${configured ? 'bg-primary' : 'bg-yellow-500'} opacity-75`}></span>
              <span class={`relative inline-flex rounded-full h-2 w-2 ${configured ? 'bg-primary' : 'bg-yellow-500'}`}></span>
            </span>
            <span class={`text-[10px] uppercase font-medium tracking-wider ${configured ? 'text-primary' : 'text-yellow-500'}`}>
              {configured ? 'Online' : 'Setup needed'}
            </span>
          </div>
        </div>
        <div class="w-10"></div>
      </header>

      {/* Chat area */}
      <main class="flex-1 overflow-y-auto p-4 space-y-4 pb-56">
        {!configured && messages.length === 0 && (
          <div class="text-center py-8">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-dark border border-white/10 flex items-center justify-center">
              <Icon name="smart_toy" class="text-primary text-3xl" />
            </div>
            <h3 class="text-white font-bold text-lg mb-2">Welcome to Titan AI Coach</h3>
            <p class="text-slate-400 text-sm mb-4 max-w-xs mx-auto">
              I can generate custom workouts, adapt to injuries, answer fitness questions, and guide your training.
            </p>

            {/* Inline API key setup */}
            <div class="max-w-xs mx-auto text-left space-y-3">
              <label class="block text-xs font-medium text-slate-400 uppercase tracking-wider">Provider</label>
              <div class="flex gap-2">
                <button
                  onClick={() => setSetupProvider('anthropic')}
                  class={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    setupProvider === 'anthropic' ? 'bg-primary text-bg-dark' : 'bg-surface-dark text-slate-300 hover:bg-white/10'
                  }`}
                >
                  Anthropic
                </button>
                <button
                  onClick={() => setSetupProvider('openai')}
                  class={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    setupProvider === 'openai' ? 'bg-primary text-bg-dark' : 'bg-surface-dark text-slate-300 hover:bg-white/10'
                  }`}
                >
                  OpenAI
                </button>
              </div>

              <label class="block text-xs font-medium text-slate-400 uppercase tracking-wider">API Key</label>
              <input
                type="password"
                value={setupKey}
                onInput={(e) => setSetupKey((e.target as HTMLInputElement).value)}
                placeholder={setupProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />

              <button
                onClick={() => {
                  if (setupKey.trim()) {
                    setAIConfig(setupKey.trim(), setupProvider);
                    setConfigured(true);
                  }
                }}
                disabled={!setupKey.trim()}
                class="w-full py-2.5 bg-primary text-bg-dark rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save & Start Chatting
              </button>
              <p class="text-xs text-slate-500 text-center mt-2">
                Your key is stored locally and sent only to the selected provider.
              </p>
            </div>
          </div>
        )}

        {messages.length === 0 && configured && (
          <div class="text-center py-8">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-dark border border-white/10 flex items-center justify-center">
              <Icon name="smart_toy" class="text-primary text-3xl" />
            </div>
            <h3 class="text-white font-bold text-lg mb-2">Hey there!</h3>
            <p class="text-slate-400 text-sm mb-4 max-w-xs mx-auto">
              Ask me anything about your workouts, or use the quick actions below to get started.
            </p>
          </div>
        )}

        {/* Date divider if messages exist */}
        {messages.length > 0 && (
          <div class="flex justify-center py-2">
            <span class="text-xs font-medium text-slate-500 bg-surface-dark px-3 py-1 rounded-full">
              {formatTime(messages[0].timestamp)}
            </span>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} class={`flex gap-3 items-end ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div class="w-8 h-8 rounded-full bg-surface-dark border border-white/10 shrink-0 flex items-center justify-center">
                <Icon name="smart_toy" class="text-primary text-sm" />
              </div>
            )}
            <div class={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : ''} max-w-[85%]`}>
              {msg.role === 'assistant' && (
                <span class="text-xs text-slate-500 ml-1">Titan AI</span>
              )}
              <div class={`p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-primary text-bg-dark rounded-br-none shadow-md shadow-primary/10'
                  : 'bg-bubble-ai rounded-bl-none border border-white/5'
              }`}>
                <p class={`text-[15px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'font-medium' : 'text-slate-200'
                }`}>
                  {msg.content}
                </p>
              </div>
              {/* Workout plan card */}
              {msg.richContent?.type === 'workoutPlan' && (
                <WorkoutPlanCard plan={msg.richContent.plan} onApply={handleApplyPlan} />
              )}
            </div>
            {msg.role === 'user' && (
              <div class="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center">
                <Icon name="person" class="text-primary text-sm" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div class="flex gap-3 items-end">
            <div class="w-8 h-8 rounded-full bg-surface-dark border border-white/10 shrink-0 flex items-center justify-center">
              <Icon name="smart_toy" class="text-primary text-sm" />
            </div>
            <div class="p-3 bg-bubble-ai rounded-2xl rounded-bl-none border border-white/5 flex gap-1.5 items-center h-10 w-16 justify-center">
              <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
              <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
              <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
            </div>
          </div>
        )}

        <div ref={chatEndRef}></div>
      </main>

      {/* Bottom input area - sits above BottomNav (~70px) */}
      <div class="fixed bottom-nav-offset left-0 w-full bg-bg-dark border-t border-white/5 z-40 pb-2 pt-2 max-w-[430px] mx-auto" style="left: 50%; transform: translateX(-50%);">
        <div class="absolute top-[-20px] left-0 w-full h-20 bg-gradient-to-t from-bg-dark to-transparent pointer-events-none -z-10"></div>

        {/* Quick action chips */}
        <div class="flex overflow-x-auto gap-2 px-4 pb-3 no-scrollbar">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onTouchEnd={(e) => { e.preventDefault(); handleSend(action.label); }}
              onClick={() => handleSend(action.label)}
              disabled={isTyping}
              class="shrink-0 h-9 px-4 rounded-lg bg-surface-dark border border-transparent hover:border-primary/50 text-slate-300 text-sm font-medium transition-all active:scale-95 whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
            >
              <Icon name={action.icon} class={`text-[18px] ${action.color}`} />
              {action.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div class="px-4 flex items-end gap-2">
          <div class="flex-1 bg-surface-dark rounded-xl border border-white/10 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all flex items-center px-3 py-2">
            <input
              type="text"
              value={input}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Titan..."
              enterkeyhint="send"
              class="flex-1 bg-transparent border-none text-white placeholder-slate-500 focus:ring-0 text-base py-2 px-2"
            />
          </div>
          <button
            onTouchEnd={(e) => { e.preventDefault(); handleSend(); }}
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            class="w-12 h-12 rounded-xl bg-primary hover:bg-green-400 text-bg-dark flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="arrow_upward" class="text-[24px] font-bold" filled />
          </button>
        </div>
      </div>
    </div>
  );
}
