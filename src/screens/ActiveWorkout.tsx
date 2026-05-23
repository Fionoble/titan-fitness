import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { WorkoutPlan, WorkoutSession, ExerciseLog, Exercise, ActiveWorkoutState } from '../types';
import { uuid } from '../utils';
import { groupExercises, groupLabel } from '../group-utils';
import type { ExerciseGroup } from '../group-utils';
import { sendWorkoutChat, isAIConfigured } from '../ai';
import { useStore, runTask, useAITaskByType, clearStore } from '../ai-tasks';

// Shared AudioContext — must be unlocked from a user gesture before it can play
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    return _audioCtx;
  } catch { return null; }
}

/** Call once from any touchstart/click handler to unlock audio on iOS.
 *  Also plays a silent buffer to fully prime the audio pipeline. */
function unlockAudio() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  // Play a silent buffer to fully unlock on iOS
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

/** Ensure AudioContext is active before playing. Returns true if ready. */
async function ensureAudioReady(): Promise<boolean> {
  const ctx = getAudioCtx();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { return false; }
  }
  return ctx.state === 'running';
}

async function playRestBeep() {
  if (!await ensureAudioReady()) return;
  const ctx = _audioCtx!;
  // Double beep: two short tones
  for (const offset of [0, 0.18]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.4;
    gain.gain.setTargetAtTime(0, ctx.currentTime + offset + 0.12, 0.02);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.18);
  }
}

async function playExerciseBeep() {
  if (!await ensureAudioReady()) return;
  const ctx = _audioCtx!;
  // Triple ascending beep — distinct from rest timer's double beep
  const notes = [660, 880, 1046.5]; // E5, A5, C6
  for (let i = 0; i < notes.length; i++) {
    const offset = i * 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = notes[i];
    osc.type = 'sine';
    gain.gain.value = 0.45;
    gain.gain.setTargetAtTime(0, ctx.currentTime + offset + 0.1, 0.02);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.15);
  }
}

function playCountInBeep(final = false) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = final ? 1046.5 : 660; // C6 on final, E5 on count
  osc.type = 'sine';
  gain.gain.value = 0.35;
  gain.gain.setTargetAtTime(0, ctx.currentTime + 0.1, 0.02);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

interface ActiveWorkoutProps {
  activeWorkout: ActiveWorkoutState | null;
  bandColors: string[];
  onComplete: (session: WorkoutSession) => void;
  onNavigateBack: () => void;
  onUpdateState: (updates: Partial<ActiveWorkoutState>) => void;
  onSaveNow: (state: ActiveWorkoutState) => void;
  onEndWorkout: () => void;
}

function isTimeBased(reps: string): boolean {
  return /\d+\s*s($|\s|\/)/i.test(reps) || /\d+\s*min/i.test(reps) || /\d+\s*sec/i.test(reps) || /\d+:\d{2}/.test(reps);
}

function parseTimeSeconds(reps: string): number {
  // MM:SS format
  const colonMatch = reps.match(/(\d+):(\d{2})/);
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
  const minMatch = reps.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1]) * 60;
  const secMatch = reps.match(/(\d+)\s*s/i);
  if (secMatch) return parseInt(secMatch[1]);
  // Plain number — treat as seconds (normalized AI output)
  const numMatch = reps.match(/^(\d+)$/);
  if (numMatch) return parseInt(numMatch[1]);
  return 60;
}

interface ExerciseTimerState {
  logIdx: number;
  setIdx: number;
  startedAt: number; // Date.now() when timer started
  duration: number;  // target seconds (countdown) or 0 (countup)
  running: boolean;
  mode: 'countdown' | 'countup';
}

const AI_TIPS: Record<string, string> = {
  'Chest': 'Keep your shoulder blades retracted and maintain a slight arch in your back.',
  'Back': 'Squeeze your shoulder blades together at the top of the movement.',
  'Shoulders': 'Keep a slight bend in your elbows and control the weight on the way down.',
  'Biceps': 'Avoid swinging—keep your elbows pinned to your sides.',
  'Triceps': 'Keep your elbows close to your body and fully extend at the top.',
  'Quads': 'Push through your heels and keep your knees tracking over your toes.',
  'Hamstrings': 'Maintain a flat back and feel the stretch in the back of your legs.',
  'Glutes': 'Squeeze at the top of the movement and control the descent.',
  'Core': 'Engage your core by pulling your belly button toward your spine.',
  'Full Body': 'Focus on controlled movements and proper breathing throughout.',
  'Legs': 'Keep your weight balanced and maintain good posture throughout.',
  'Cardio': 'Maintain a steady pace and focus on your breathing rhythm.',
  'Hips': 'Move slowly into the stretch and breathe deeply through it.',
};

interface WorkoutChatProps {
  open: boolean;
  onClose: () => void;
  currentExercise: { name: string; muscleGroup: string; reps: string; sets: number };
  planSummary: string;
}

function WorkoutChat({ open, onClose, currentExercise, planSummary }: WorkoutChatProps) {
  const [messages, setMessages] = useStore<{ role: 'user' | 'assistant'; content: string }[]>('workout-chat', []);
  const [input, setInput] = useState('');
  const task = useAITaskByType('workout-chat');
  const isLoading = task?.status === 'running';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages]);

  const send = useCallback((text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg = text.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    const taskId = `workout-chat-${Date.now()}`;
    runTask(taskId, 'workout-chat', async () => {
      const currentMessages = [...(messages || []), { role: 'user' as const, content: userMsg }];
      const reply = await sendWorkoutChat(userMsg, currentMessages, currentExercise, planSummary);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      return reply;
    });
  }, [isLoading, messages, currentExercise, planSummary, setMessages]);

  const chips = [
    `Form tips for ${currentExercise.name}`,
    'Suggest an alternative',
    'How much weight?',
  ];

  if (!open) return null;

  return (
    <div class="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      {/* Sheet */}
      <div class="relative bg-bg-dark rounded-t-2xl border-t border-primary/20 flex flex-col shadow-2xl shadow-black/50" style="height: 65vh">
        {/* Drag handle */}
        <div class="flex justify-center pt-2 pb-1 shrink-0">
          <div class="w-10 h-1 rounded-full bg-white/20"></div>
        </div>

        {/* Header */}
        <div class="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Icon name="auto_awesome" class="text-primary text-lg" />
            </div>
            <div>
              <p class="text-sm font-bold text-white leading-tight">Ask Titan</p>
              <p class="text-[11px] text-slate-400 truncate max-w-[220px]">{currentExercise.name}</p>
            </div>
          </div>
          <button onClick={onClose} class="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
            <Icon name="close" class="text-slate-400 text-lg" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div class="flex flex-col items-center justify-center py-8 text-center">
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Icon name="chat" class="text-primary text-2xl" />
              </div>
              <p class="text-sm text-slate-400 font-medium">Need help with this exercise?</p>
              <p class="text-xs text-slate-500 mt-1">Tap a suggestion below or type your question.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} class={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div class={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-bg-dark font-medium'
                  : 'bg-surface-dark text-slate-200 border border-white/5'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div class="flex justify-start">
              <div class="bg-surface-dark rounded-2xl px-4 py-3 text-sm text-slate-400 border border-white/5">
                <span class="inline-flex gap-0.5 text-lg leading-none">
                  <span class="animate-bounce" style="animation-delay: 0ms">.</span>
                  <span class="animate-bounce" style="animation-delay: 150ms">.</span>
                  <span class="animate-bounce" style="animation-delay: 300ms">.</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick action chips */}
        {messages.length === 0 && (
          <div class="px-4 pb-3 flex flex-wrap gap-2 shrink-0">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => send(chip)}
                class="text-xs px-3 py-2 rounded-full bg-surface-dark text-slate-200 border border-white/10 hover:border-primary/30 hover:text-primary transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div class="px-4 pt-3 pb-4 border-t border-white/5 shrink-0 pb-safe">
          <div class="flex gap-2">
            <input
              type="text"
              value={input}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder="Ask about this exercise..."
              class="flex-1 bg-surface-dark rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-500 border border-white/10 focus:border-primary/40 focus:outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || isLoading}
              class="w-10 h-10 rounded-full bg-primary text-bg-dark flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0"
            >
              <Icon name="send" class="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProgressModalProps {
  open: boolean;
  onClose: () => void;
  groups: ExerciseGroup[];
  exerciseLogs: ExerciseLog[];
  exIdToLogIdx: Map<string, number>;
  currentGroupIdx: number;
  onJumpToGroup: (idx: number) => void;
  elapsedSeconds: number;
  formatTime: (sec: number) => string;
}

function ProgressModal({ open, onClose, groups, exerciseLogs, exIdToLogIdx, currentGroupIdx, onJumpToGroup, elapsedSeconds, formatTime }: ProgressModalProps) {
  if (!open) return null;

  const totalSets = exerciseLogs.reduce((sum, log) => sum + log.sets.length, 0);
  const completedSets = exerciseLogs.reduce((sum, log) => sum + log.sets.filter(s => s.completed).length, 0);
  const totalVolume = exerciseLogs.reduce((sum, log) => {
    return sum + log.sets.filter(s => s.completed).reduce((v, s) => v + (s.weight && s.reps ? s.weight * s.reps : 0), 0);
  }, 0);

  return (
    <div class="fixed inset-0 z-[60] flex flex-col justify-end">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div class="relative bg-bg-dark rounded-t-2xl border-t border-primary/20 flex flex-col shadow-2xl shadow-black/50" style="max-height: 80vh">
        {/* Drag handle */}
        <div class="flex justify-center pt-2 pb-1 shrink-0">
          <div class="w-10 h-1 rounded-full bg-white/20"></div>
        </div>

        {/* Header */}
        <div class="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Icon name="format_list_bulleted" class="text-primary text-lg" />
            </div>
            <div>
              <p class="text-sm font-bold text-white leading-tight">Workout Overview</p>
              <p class="text-[11px] text-slate-400">{completedSets}/{totalSets} sets &middot; {formatTime(elapsedSeconds)}</p>
            </div>
          </div>
          <button onClick={onClose} class="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
            <Icon name="close" class="text-slate-400 text-lg" />
          </button>
        </div>

        {/* Stats row */}
        <div class="grid grid-cols-3 gap-3 px-4 py-3 border-b border-white/5 shrink-0">
          <div class="text-center">
            <p class="text-lg font-bold text-white">{completedSets}<span class="text-slate-500 text-sm">/{totalSets}</span></p>
            <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Sets</p>
          </div>
          <div class="text-center">
            <p class="text-lg font-bold text-white">{totalVolume > 0 ? totalVolume.toLocaleString() : '—'}</p>
            <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Volume (lbs)</p>
          </div>
          <div class="text-center">
            <p class="text-lg font-bold text-white">{formatTime(elapsedSeconds)}</p>
            <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Time</p>
          </div>
        </div>

        {/* Exercise list */}
        <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2 pb-safe">
          {groups.map((group, gIdx) => {
            const isCurrentGroup = gIdx === currentGroupIdx;
            const groupDone = group.exercises.every(ex => {
              const logIdx = exIdToLogIdx.get(ex.id)!;
              return exerciseLogs[logIdx].sets.every(s => s.completed);
            });
            const isUpcoming = gIdx > currentGroupIdx && !groupDone;

            return (
              <button
                key={group.groupId}
                onClick={() => { onJumpToGroup(gIdx); onClose(); }}
                class={`w-full text-left rounded-xl p-3 transition-all ${
                  isCurrentGroup
                    ? 'bg-primary/15 border border-primary/30'
                    : groupDone
                    ? 'bg-surface-dark border border-white/5 opacity-70'
                    : 'bg-surface-dark border border-white/5 hover:border-white/15'
                }`}
              >
                {group.exercises.map((ex, eIdx) => {
                  const logIdx = exIdToLogIdx.get(ex.id)!;
                  const log = exerciseLogs[logIdx];
                  const done = log.sets.filter(s => s.completed).length;
                  const total = log.sets.length;
                  const exDone = done === total;
                  const bestSet = log.sets
                    .filter(s => s.completed && s.weight && s.reps)
                    .sort((a, b) => (b.weight! * b.reps!) - (a.weight! * a.reps!))[0];

                  return (
                    <div key={ex.id}>
                      {eIdx > 0 && <div class="border-t border-white/5 my-2"></div>}
                      <div class="flex items-center gap-3">
                        <div class={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          exDone ? 'bg-primary/20' : isCurrentGroup ? 'bg-primary/10' : 'bg-surface-darker'
                        }`}>
                          {exDone ? (
                            <Icon name="check" class="text-primary text-lg" />
                          ) : (
                            <span class="text-xs font-bold text-slate-400">{gIdx + 1}{group.exercises.length > 1 ? String.fromCharCode(65 + eIdx) : ''}</span>
                          )}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <h4 class={`text-sm font-semibold truncate ${exDone ? 'text-slate-400 line-through' : isUpcoming ? 'text-slate-300' : 'text-white'}`}>
                              {ex.name}
                            </h4>
                            {isCurrentGroup && !exDone && (
                              <span class="text-[9px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">Now</span>
                            )}
                          </div>
                          <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[11px] text-slate-500">{ex.muscleGroup}</span>
                            <span class="text-[11px] text-slate-600">&middot;</span>
                            <span class={`text-[11px] font-medium ${exDone ? 'text-primary' : 'text-slate-400'}`}>
                              {done}/{total} sets
                            </span>
                            {bestSet && (
                              <>
                                <span class="text-[11px] text-slate-600">&middot;</span>
                                <span class="text-[11px] text-slate-400">{bestSet.weight} × {bestSet.reps}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const BAND_COLOR_MAP: Record<string, string> = {
  Yellow: '#EAB308',
  Red: '#EF4444',
  Green: '#22C55E',
  Blue: '#3B82F6',
  Black: '#374151',
  Purple: '#A855F7',
  Orange: '#F97316',
};

export function ActiveWorkout({ activeWorkout, bandColors, onComplete, onNavigateBack, onUpdateState, onSaveNow, onEndWorkout }: ActiveWorkoutProps) {
  // If no active workout, show empty state
  if (!activeWorkout) {
    return (
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <Icon name="fitness_center" class="text-4xl text-primary/30 mb-3" />
          <p class="text-slate-400 text-sm">No active workout</p>
        </div>
      </div>
    );
  }

  const plan = activeWorkout.plan;
  const groups = useMemo(() => groupExercises(plan.exercises), [plan.exercises]);

  // Map each exercise ID to its flat index in exerciseLogs
  const exIdToLogIdx = useMemo(() => {
    const map = new Map<string, number>();
    plan.exercises.forEach((ex, i) => map.set(ex.id, i));
    return map;
  }, [plan.exercises]);

  const [currentGroupIdx, setCurrentGroupIdx] = useState(activeWorkout.currentGroupIdx);
  const [activeExInGroup, setActiveExInGroup] = useState(activeWorkout.activeExInGroup);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>(activeWorkout.exerciseLogs);
  const [weightDraftKey, setWeightDraftKey] = useState<string | null>(null);
  const [weightDraftValue, setWeightDraftValue] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restEndTime, setRestEndTime] = useState<number | null>(null); // timestamp when rest ends
  const [exTimer, setExTimer] = useState<ExerciseTimerState | null>(null);
  const [, setTick] = useState(0); // force re-render for timer display
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const [chatOpen, setChatOpen] = useState(false);
  // Per-exercise weight mode: 'numeric' (lbs) or 'band' (color)
  const [weightModes, setWeightModes] = useState<Record<number, 'numeric' | 'band'>>(() => {
    const modes: Record<number, 'numeric' | 'band'> = {};
    plan.exercises.forEach((ex, i) => {
      const log = activeWorkout.exerciseLogs[i];
      const hasBandSet = log?.sets.some(s => s.weightType === 'band' || s.bandColor);
      const hasBands = ex.equipment.includes('resistance-bands') && bandColors.length > 0;
      modes[i] = hasBandSet || hasBands ? 'band' : 'numeric';
    });
    return modes;
  });
  const [progressOpen, setProgressOpen] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Compute elapsed time from startedAt
  useEffect(() => {
    const startTime = new Date(activeWorkout.startedAt).getTime();
    const update = () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [activeWorkout.startedAt]);

  // Keep AudioContext alive during the workout — iOS suspends it after inactivity
  useEffect(() => {
    const keepAlive = setInterval(() => {
      const ctx = getAudioCtx();
      if (ctx?.state === 'suspended') ctx.resume();
    }, 5000);
    return () => clearInterval(keepAlive);
  }, []);

  // Persist state changes to parent (debounced via hook)
  const persistRef = useRef(false);
  useEffect(() => {
    if (!persistRef.current) {
      persistRef.current = true;
      return;
    }
    onUpdateState({
      exerciseLogs,
      currentGroupIdx,
      activeExInGroup,
    });
  }, [exerciseLogs, currentGroupIdx, activeExInGroup]);

  // Flag to distinguish manual dismissal from natural timer expiry
  const restSkippedRef = useRef(false);

  const skipRest = useCallback(() => {
    restSkippedRef.current = true;
    setRestEndTime(null);
  }, []);

  const setRestTimer = useCallback((seconds: number) => {
    setRestEndTime(Date.now() + seconds * 1000);
  }, []);

  // Rest timer
  const restTimerDoneRef = useRef(false);

  // Unified tick interval for rest + exercise timers
  useEffect(() => {
    if (restEndTime !== null || exTimer?.running) {
      tickRef.current = setInterval(() => setTick((t) => t + 1), 200);
      return () => clearInterval(tickRef.current);
    }
  }, [restEndTime !== null, exTimer?.running]);

  // Check rest timer completion each render
  const restRemaining = restEndTime !== null ? Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000)) : null;

  useEffect(() => {
    if (restEndTime !== null && Date.now() >= restEndTime) {
      setRestEndTime(null);
      restTimerDoneRef.current = true;
    }
  });

  // Handle rest timer completion
  useEffect(() => {
    if (restEndTime === null && restTimerDoneRef.current) {
      restTimerDoneRef.current = false;
      if (!restSkippedRef.current) {
        const soundOff = localStorage.getItem('titan_rest_sound') === 'false';
        if (!soundOff) playRestBeep();
      }
      restSkippedRef.current = false;
    }
  }, [restEndTime]);

  // Exercise timer (for time-based exercises)
  // Track completion outside the state updater so beep + side effects run cleanly
  const exTimerDoneRef = useRef<{ logIdx: number; setIdx: number } | null>(null);

  // Compute exercise timer display value from timestamps
  const exTimerSeconds = exTimer?.running
    ? exTimer.mode === 'countdown'
      ? Math.max(0, exTimer.duration - Math.floor((Date.now() - exTimer.startedAt) / 1000))
      : Math.floor((Date.now() - exTimer.startedAt) / 1000)
    : null;

  // Check exercise timer completion each render
  useEffect(() => {
    if (exTimer?.running && exTimer.mode === 'countdown') {
      const elapsed = (Date.now() - exTimer.startedAt) / 1000;
      if (elapsed >= exTimer.duration) {
        exTimerDoneRef.current = { logIdx: exTimer.logIdx, setIdx: exTimer.setIdx };
        setExTimer(null);
      }
    }
  });

  // Scroll to active exercise in superset/circuit
  const scrollToGroupExercise = useCallback((index: number) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(`group-ex-${index}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }, []);

  const completeTimedSet = useCallback((logIdx: number, setIdx: number, timeSeconds: number) => {
    const exercise = plan.exercises[logIdx];
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[logIdx] };
      const sets = [...log.sets];
      const existing = sets[setIdx];
      // Auto-fill weight/band from previous completed set if not already set
      const lastCompleted = sets.slice(0, setIdx).reverse().find(s => s.completed);
      const weight = existing.weight ?? lastCompleted?.weight ?? exercise.weight ?? null;
      const bandColor = existing.bandColor || lastCompleted?.bandColor;
      const weightType = existing.weightType || lastCompleted?.weightType;
      sets[setIdx] = { ...existing, completed: true, reps: timeSeconds, weight, bandColor, weightType };
      log.sets = sets;
      updated[logIdx] = log;
      return updated;
    });
    setExTimer(null);

    // Group-aware rest logic
    if (isMultiExGroupRef.current) {
      const group = groupsRef.current;
      const isLastEx = activeExInGroupRef.current >= group.exercises.length - 1;
      if (isLastEx) {
        setRestTimer(90);
        setActiveExInGroup(0);
        scrollToGroupExercise(0);
      } else {
        const next = activeExInGroupRef.current + 1;
        setActiveExInGroup(next);
        scrollToGroupExercise(next);
      }
    } else {
      setRestTimer(exercise.restSeconds || 60);
    }
  }, [plan.exercises, scrollToGroupExercise]);

  // Handle exercise timer completion — runs after state update, outside the updater
  useEffect(() => {
    if (exTimer === null && exTimerDoneRef.current) {
      const { logIdx, setIdx } = exTimerDoneRef.current;
      exTimerDoneRef.current = null;
      const soundOff = localStorage.getItem('titan_rest_sound') === 'false';
      if (!soundOff) playExerciseBeep();
      completeTimedSet(logIdx, setIdx, parseTimeSeconds(plan.exercises[logIdx].reps));
    }
  }, [exTimer, plan.exercises, completeTimedSet]);

  // Count-in timer state
  const [countInTimer, setCountInTimer] = useState<number | null>(null);
  const countInRef = useRef<ReturnType<typeof setInterval>>();
  const countInPendingRef = useRef<{ logIdx: number; setIdx: number; mode: 'countdown' | 'countup' } | null>(null);

  const skipCountIn = useCallback(() => {
    setCountInTimer(null);
    clearInterval(countInRef.current);
    const pending = countInPendingRef.current;
    if (pending) {
      countInPendingRef.current = null;
      const exercise = plan.exercises[pending.logIdx];
      const targetSec = parseTimeSeconds(exercise.reps);
      setExTimer({
        logIdx: pending.logIdx,
        setIdx: pending.setIdx,
        startedAt: Date.now(),
        duration: targetSec,
        running: true,
        mode: pending.mode,
      });
    }
  }, [plan.exercises]);

  // Count-in countdown effect
  useEffect(() => {
    if (countInTimer !== null && countInTimer > 0) {
      playCountInBeep(false);
      countInRef.current = setInterval(() => {
        setCountInTimer((c) => {
          if (c !== null && c <= 1) {
            clearInterval(countInRef.current);
            playCountInBeep(true);
            // Start the actual exercise timer
            const pending = countInPendingRef.current;
            if (pending) {
              countInPendingRef.current = null;
              const exercise = plan.exercises[pending.logIdx];
              const targetSec = parseTimeSeconds(exercise.reps);
              setExTimer({
                logIdx: pending.logIdx,
                setIdx: pending.setIdx,
                startedAt: Date.now(),
                duration: targetSec,
                running: true,
                mode: pending.mode,
              });
            }
            return null;
          }
          if (c !== null && c > 1) playCountInBeep(false);
          return c !== null ? c - 1 : null;
        });
      }, 1000);
      return () => clearInterval(countInRef.current);
    }
  }, [countInTimer !== null && countInTimer > 0]); // only re-run when count-in starts

  const startExTimer = useCallback((logIdx: number, setIdx: number, mode: 'countdown' | 'countup') => {
    // Check if count-in is enabled
    const countInEnabled = localStorage.getItem('titan_count_in') === 'true';
    if (countInEnabled) {
      const seconds = parseInt(localStorage.getItem('titan_count_in_seconds') || '3', 10) as 3 | 5 | 7;
      countInPendingRef.current = { logIdx, setIdx, mode };
      setCountInTimer(seconds);
      return;
    }

    const exercise = plan.exercises[logIdx];
    const targetSec = parseTimeSeconds(exercise.reps);
    setExTimer({
      logIdx,
      setIdx,
      startedAt: Date.now(),
      duration: targetSec,
      running: true,
      mode,
    });
  }, [plan.exercises]);

  const stopExTimer = useCallback(() => {
    if (!exTimer) return;
    const elapsed = Math.floor((Date.now() - exTimer.startedAt) / 1000);
    completeTimedSet(exTimer.logIdx, exTimer.setIdx, elapsed);
  }, [exTimer, completeTimedSet]);

  const currentGroup = groups[currentGroupIdx];
  const isMultiExGroup = currentGroup.exercises.length > 1;

  // Refs for use in timer callbacks
  const isMultiExGroupRef = useRef(isMultiExGroup);
  isMultiExGroupRef.current = isMultiExGroup;
  const groupsRef = useRef(currentGroup);
  groupsRef.current = currentGroup;
  const activeExInGroupRef = useRef(activeExInGroup);
  activeExInGroupRef.current = activeExInGroup;

  const completedGroups = groups.filter((g) =>
    g.exercises.every((ex) => {
      const logIdx = exIdToLogIdx.get(ex.id)!;
      return exerciseLogs[logIdx].sets.every((s) => s.completed);
    })
  ).length;

  // Progress across all groups
  const totalGroupProgress = groups.reduce((acc, g) => {
    const groupTotal = g.exercises.reduce((sum, ex) => {
      const logIdx = exIdToLogIdx.get(ex.id)!;
      const log = exerciseLogs[logIdx];
      return sum + log.sets.filter((s) => s.completed).length / log.sets.length;
    }, 0);
    return acc + groupTotal / g.exercises.length;
  }, 0);
  const progress = (totalGroupProgress / groups.length) * 100;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const updateSet = useCallback((logIdx: number, setIdx: number, field: 'weight' | 'reps', value: number | null) => {
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[logIdx] };
      const sets = [...log.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      log.sets = sets;
      updated[logIdx] = log;
      return updated;
    });
  }, []);

  const toggleWeightMode = useCallback((logIdx: number) => {
    setWeightModes(prev => ({
      ...prev,
      [logIdx]: prev[logIdx] === 'band' ? 'numeric' : 'band',
    }));
  }, []);

  const updateBandColor = useCallback((logIdx: number, setIdx: number, color: string | undefined) => {
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[logIdx] };
      const sets = [...log.sets];
      sets[setIdx] = { ...sets[setIdx], bandColor: color };
      log.sets = sets;
      updated[logIdx] = log;
      return updated;
    });
  }, []);

  const toggleSetComplete = useCallback((logIdx: number, setIdx: number) => {
    const exercise = plan.exercises[logIdx];

    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[logIdx] };
      const sets = [...log.sets];
      const set = { ...sets[setIdx] };
      set.completed = !set.completed;
      // Auto-fill from most recent completed set, then fall back to plan defaults
      if (set.completed) {
        const lastCompleted = sets.slice(0, setIdx).reverse().find((s) => s.completed);
        if (set.weight === null) {
          set.weight = lastCompleted?.weight ?? exercise.weight ?? null;
        }
        if (set.reps === null) {
          const fallbackReps = parseInt(exercise.reps.replace(/[^0-9]/g, ''));
          set.reps = lastCompleted?.reps ?? (isNaN(fallbackReps) ? null : fallbackReps);
        }
        if (!set.bandColor && lastCompleted?.bandColor) {
          set.bandColor = lastCompleted.bandColor;
        }
        if (!set.weightType && lastCompleted?.weightType) {
          set.weightType = lastCompleted.weightType;
        }
      }
      sets[setIdx] = set;
      log.sets = sets;
      updated[logIdx] = log;
      return updated;
    });

    // Group-aware rest logic
    if (isMultiExGroup) {
      const isLastExInGroup = activeExInGroup >= currentGroup.exercises.length - 1;
      if (isLastExInGroup) {
        // Completed a round — start rest timer (90s for groups)
        setRestTimer(90);
        setActiveExInGroup(0);
        scrollToGroupExercise(0);
      } else {
        // Advance to next exercise in group (no rest)
        const next = activeExInGroup + 1;
        setActiveExInGroup(next);
        scrollToGroupExercise(next);
      }
    } else {
      const restSec = exercise.restSeconds || 60;
      setRestTimer(restSec);
    }
  }, [isMultiExGroup, activeExInGroup, currentGroup, plan.exercises, scrollToGroupExercise]);

  const addSet = useCallback((logIdx: number) => {
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[logIdx] };
      log.sets = [
        ...log.sets,
        { setNumber: log.sets.length + 1, weight: null, reps: null, completed: false },
      ];
      updated[logIdx] = log;
      return updated;
    });
  }, []);

  const jumpToGroup = (idx: number) => {
    if (idx >= 0 && idx < groups.length) {
      setCurrentGroupIdx(idx);
      setActiveExInGroup(0);
      skipRest();
    }
  };

  const nextGroup = () => {
    if (currentGroupIdx < groups.length - 1) {
      setCurrentGroupIdx((i) => i + 1);
      setActiveExInGroup(0);
      skipRest();
    }
  };

  const prevGroup = () => {
    if (currentGroupIdx > 0) {
      setCurrentGroupIdx((i) => i - 1);
      setActiveExInGroup(0);
      skipRest();
    }
  };

  const finishWorkout = () => {
    let totalVolume = 0;
    let totalSets = 0;

    for (const log of exerciseLogs) {
      for (const set of log.sets) {
        if (set.completed) {
          totalSets++;
          if (set.weight && set.reps) {
            totalVolume += set.weight * set.reps;
          }
        }
      }
    }

    const session: WorkoutSession = {
      id: uuid(),
      planId: plan.id,
      name: plan.name,
      style: plan.style,
      startedAt: activeWorkout.startedAt,
      completedAt: new Date().toISOString(),
      durationSeconds: elapsedSeconds,
      exercises: exerciseLogs,
      totalVolume,
      totalSets,
      personalRecords: 0,
    };

    clearStore('workout-chat');
    onComplete(session);
  };

  const isLastGroup = currentGroupIdx === groups.length - 1;

  // Render set grid for a single exercise
  const renderWeightInput = (logIdx: number, idx: number, set: typeof exerciseLogs[0]['sets'][0], exercise: typeof plan.exercises[0], mode: 'numeric' | 'band') => {
    const lastCompleted = exerciseLogs[logIdx].sets.slice(0, idx).reverse().find((s) => s.completed);
    const effectiveBandColor = set.bandColor || lastCompleted?.bandColor;

    if (mode === 'band' && bandColors.length > 0) {
      return (
        <select
          value={effectiveBandColor || ''}
          onChange={(e) => {
            const val = (e.target as HTMLSelectElement).value;
            setExerciseLogs((prev) => {
              const updated = [...prev];
              const log = { ...updated[logIdx] };
              const sets = [...log.sets];
              sets[idx] = { ...sets[idx], bandColor: val || undefined, weightType: 'band' };
              log.sets = sets;
              updated[logIdx] = log;
              return updated;
            });
          }}
          class="w-full bg-bg-dark border-none rounded text-center font-bold text-white focus:ring-1 focus:ring-primary p-2 text-xs appearance-none"
          style={effectiveBandColor ? { color: BAND_COLOR_MAP[effectiveBandColor] || '#94a3b8' } : undefined}
        >
          <option value="">—</option>
          {bandColors.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      );
    }

    const weightPlaceholder = lastCompleted?.weight?.toString() ?? exercise.weight?.toString() ?? '-';
    const weightKey = `${logIdx}-${idx}`;
    return (
      <input
        type="text"
        inputMode="decimal"
        value={weightDraftKey === weightKey ? weightDraftValue : set.weight ?? ''}
        placeholder={weightPlaceholder}
        onFocus={() => {
          setWeightDraftKey(weightKey);
          setWeightDraftValue(set.weight?.toString() ?? '');
        }}
        onBlur={() => {
          if (weightDraftKey !== weightKey) return;
          const raw = weightDraftValue.trim();
          if (!raw || raw === '.') {
            updateSet(logIdx, idx, 'weight', null);
          } else {
            const num = parseFloat(raw);
            if (!isNaN(num)) updateSet(logIdx, idx, 'weight', num);
          }
          setWeightDraftKey(null);
          setWeightDraftValue('');
        }}
        onInput={(e) => {
          const next = (e.target as HTMLInputElement).value;
          setWeightDraftKey(weightKey);
          setWeightDraftValue(next);
          if (!next) { updateSet(logIdx, idx, 'weight', null); return; }
          if (next === '.' || next.endsWith('.')) return;
          const num = Number(next);
          updateSet(logIdx, idx, 'weight', Number.isFinite(num) ? num : null);
        }}
        class="w-full bg-bg-dark border-none rounded text-center font-bold text-white focus:ring-1 focus:ring-primary p-2 text-sm"
      />
    );
  };

  const renderWeightColumnHeader = (logIdx: number) => {
    const mode = weightModes[logIdx] || 'numeric';
    const canToggle = bandColors.length > 0;
    return (
      <span
        role={canToggle ? 'button' : undefined}
        onClick={canToggle ? () => toggleWeightMode(logIdx) : undefined}
        class={canToggle ? 'cursor-pointer hover:text-primary transition-colors' : ''}
      >
        {mode === 'band' ? 'Band' : 'lbs'}{canToggle && ' ⇄'}
      </span>
    );
  };

  const renderSetGrid = (exercise: typeof plan.exercises[0], logIdx: number, isHighlighted: boolean) => {
    const log = exerciseLogs[logIdx];
    const timed = isTimeBased(exercise.reps);
    const targetSeconds = timed ? parseTimeSeconds(exercise.reps) : 0;
    const mode = weightModes[logIdx] || 'numeric';

    return (
      <div class={`space-y-2 ${isMultiExGroup && !isHighlighted ? 'opacity-60' : ''}`}>
        {/* Exercise header for multi-exercise groups */}
        {isMultiExGroup && (
          <div class="flex items-center justify-between pt-2 pb-1">
            <h4 class="text-sm font-bold text-white">{exercise.name}</h4>
            <span class="text-[10px] text-slate-400 bg-surface-darker px-1.5 py-0.5 rounded">
              {exercise.muscleGroup}
            </span>
          </div>
        )}

        {timed ? (
          /* Time-based exercise UI */
          <>
            <div class="grid grid-cols-12 gap-2 px-2 pb-1 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center">
              <div class="col-span-1 text-left">Set</div>
              <div class="col-span-2">{renderWeightColumnHeader(logIdx)}</div>
              <div class="col-span-2">Target</div>
              <div class="col-span-5">Time</div>
              <div class="col-span-2 text-right">Done</div>
            </div>

            {log.sets.map((set, idx) => {
              const isActive = !set.completed && (idx === 0 || log.sets[idx - 1]?.completed);
              const isTimerActive = exTimer?.logIdx === logIdx && exTimer?.setIdx === idx && exTimer?.running;
              const isTimerForThis = exTimer?.logIdx === logIdx && exTimer?.setIdx === idx;

              return (
                <div
                  key={idx}
                  class={`relative rounded-lg overflow-hidden transition-all ${
                    set.completed
                      ? 'bg-surface-dark border border-white/5'
                      : isActive && isHighlighted
                      ? 'bg-surface-dark border-2 border-primary/50 shadow-md'
                      : 'bg-surface-dark border border-white/5 opacity-60'
                  }`}
                >
                  {set.completed && <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                  <div class="grid grid-cols-12 gap-2 p-3 items-center">
                    <div class="col-span-1 text-left font-bold text-lg pl-1">{set.setNumber}</div>
                    <div class="col-span-2">
                      {renderWeightInput(logIdx, idx, set, exercise, mode)}
                    </div>
                    <div class="col-span-2 text-center text-xs text-slate-500 font-medium">
                      {exercise.reps}
                    </div>
                    <div class="col-span-5 flex items-center justify-center gap-2">
                      {set.completed ? (
                        <span class="text-sm font-bold text-primary">{formatTime(set.reps || targetSeconds)}</span>
                      ) : isTimerForThis ? (
                        <div class="flex items-center gap-2">
                          <span class={`text-lg font-bold tabular-nums ${isTimerActive ? 'text-primary' : 'text-white'}`}>
                            {formatTime(exTimerSeconds ?? 0)}
                          </span>
                          <button
                            onClick={stopExTimer}
                            class="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
                          >
                            Stop
                          </button>
                        </div>
                      ) : isActive && isHighlighted ? (
                        <div class="flex gap-1">
                          <button
                            onClick={() => startExTimer(logIdx, idx, 'countdown')}
                            class="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30 transition-colors flex items-center gap-1"
                            title="Countdown from target"
                          >
                            <Icon name="timer" class="text-sm" />
                            {formatTime(targetSeconds)}
                          </button>
                          <button
                            onClick={() => startExTimer(logIdx, idx, 'countup')}
                            class="px-2 py-1 rounded bg-white/10 text-slate-300 text-xs font-bold hover:bg-white/15 transition-colors flex items-center gap-1"
                            title="Count up"
                          >
                            <Icon name="arrow_upward" class="text-sm" />
                            0:00
                          </button>
                        </div>
                      ) : (
                        <span class="text-xs text-slate-500">—</span>
                      )}
                    </div>
                    <div class="col-span-2 flex justify-end">
                      {set.completed ? (
                        <div class="w-8 h-8 rounded flex items-center justify-center bg-primary text-bg-dark shadow-sm">
                          <Icon name="check" class="text-xl font-bold" />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            completeTimedSet(logIdx, idx, targetSeconds);
                          }}
                          class="w-8 h-8 rounded flex items-center justify-center bg-slate-700 text-slate-400 hover:bg-primary/20 hover:text-primary transition-all"
                        >
                          <Icon name="check" class="text-xl font-bold" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          /* Standard weight/reps UI */
          <>
            <div class="grid grid-cols-12 gap-2 px-2 pb-1 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center">
              <div class="col-span-2 text-left">Set</div>
              <div class="col-span-3">Prev</div>
              <div class="col-span-3">{renderWeightColumnHeader(logIdx)}</div>
              <div class="col-span-2">Reps</div>
              <div class="col-span-2 text-right">Done</div>
            </div>

            {log.sets.map((set, idx) => {
              const isActive = !set.completed && (idx === 0 || log.sets[idx - 1]?.completed);
              const lastCompleted = log.sets.slice(0, idx).reverse().find((s) => s.completed);
              const repsPlaceholder = lastCompleted?.reps?.toString() ?? (exercise.reps.replace(/[^0-9]/g, '') || '-');
              return (
                <div
                  key={idx}
                  class={`relative rounded-lg overflow-hidden transition-all ${
                    set.completed
                      ? 'bg-surface-dark border border-white/5'
                      : isActive && isHighlighted
                      ? 'bg-surface-dark border-2 border-primary/50 shadow-md'
                      : 'bg-surface-dark border border-white/5 opacity-60'
                  }`}
                >
                  {set.completed && <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                  <div class="grid grid-cols-12 gap-2 p-3 items-center">
                    <div class="col-span-2 text-left font-bold text-lg pl-2">{set.setNumber}</div>
                    <div class="col-span-3 text-center text-xs text-slate-500 font-medium">
                      {exercise.weight ? `${exercise.weight} × ${exercise.reps}` : '—'}
                    </div>
                    <div class="col-span-3">
                      {renderWeightInput(logIdx, idx, set, exercise, mode)}
                    </div>
                    <div class="col-span-2">
                      <input
                        type="number"
                        value={set.reps ?? ''}
                        placeholder={repsPlaceholder}
                        onInput={(e) => updateSet(logIdx, idx, 'reps', (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : null)}
                        class="w-full bg-bg-dark border-none rounded text-center font-bold text-white focus:ring-1 focus:ring-primary p-2 text-sm"
                      />
                    </div>
                    <div class="col-span-2 flex justify-end">
                      <button
                        onClick={() => toggleSetComplete(logIdx, idx)}
                        class={`w-8 h-8 rounded flex items-center justify-center transition-all ${
                          set.completed
                            ? 'bg-primary text-bg-dark shadow-sm'
                            : 'bg-slate-700 text-slate-400 hover:bg-primary/20 hover:text-primary'
                        }`}
                      >
                        <Icon name="check" class="text-xl font-bold" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Notes + Add Set */}
        <div class="flex gap-2 mt-2">
          <button
            onClick={() => {
              setExerciseLogs((prev) => {
                const updated = [...prev];
                const log = { ...updated[logIdx] };
                log.notes = log.notes === undefined ? '' : undefined;
                updated[logIdx] = log;
                return updated;
              });
            }}
            class={`py-3 px-4 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
              log.notes !== undefined
                ? 'border-amber-500/30 text-amber-400 bg-amber-500/5'
                : 'border-dashed border-slate-600 text-slate-400 hover:border-amber-500/30 hover:text-amber-400'
            }`}
          >
            <Icon name={log.notes !== undefined ? 'sticky_note_2' : 'note_add'} class="text-base" />
          </button>
          <button
            onClick={() => addSet(logIdx)}
            class="py-3 flex-1 rounded-lg border border-dashed border-slate-600 text-sm font-medium text-slate-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="add" class="text-lg" />
            Add Set
          </button>
        </div>

        {log.notes !== undefined && (
          <textarea
            value={log.notes}
            onInput={(e) => {
              const value = (e.target as HTMLTextAreaElement).value;
              setExerciseLogs((prev) => {
                const updated = [...prev];
                const l = { ...updated[logIdx] };
                l.notes = value;
                updated[logIdx] = l;
                return updated;
              });
            }}
            placeholder="e.g. Go heavier next time, felt easy..."
            rows={2}
            class="w-full bg-bg-dark border border-amber-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 resize-none mt-1"
          />
        )}
      </div>
    );
  };

  // Get primary tip from the first exercise in the group
  const primaryExercise = currentGroup.exercises[isMultiExGroup ? activeExInGroup : 0];
  const tip = AI_TIPS[primaryExercise.muscleGroup] || AI_TIPS['Full Body'];

  const planSummary = useMemo(() =>
    `${plan.name} (${plan.style}) — ${plan.exercises.map((e) => e.name).join(', ')}`,
    [plan]
  );

  return (
    <div class="flex flex-col h-full bg-bg-dark" onTouchStart={unlockAudio} onClick={unlockAudio}>
      {/* Header */}
      <header class="sticky top-0 z-50 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 pt-safe">
        <div class="flex items-center justify-between px-4 py-3">
          <button onClick={onNavigateBack} class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-dark transition-colors">
            <Icon name="arrow_back" />
          </button>
          <div class="text-center">
            <h2 class="text-base font-bold tracking-tight">{plan.name}</h2>
            <div class="flex items-center justify-center gap-1 text-xs text-slate-400 font-medium">
              <Icon name="timer" class="text-[14px]" />
              <span>{formatTime(elapsedSeconds)}</span>
            </div>
          </div>
          <button
            onClick={finishWorkout}
            class="text-primary text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            Finish
          </button>
        </div>
        {/* Progress bar — tap to open overview */}
        <button onClick={() => setProgressOpen(true)} class="w-full text-left">
          <div class="w-full h-1 bg-surface-dark">
            <div class="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }}></div>
          </div>
          <div class="px-4 py-1 flex justify-between text-[10px] uppercase font-bold tracking-wider text-slate-500">
            <span class="flex items-center gap-1">Progress <Icon name="expand_more" class="text-[12px]" /></span>
            <span>{completedGroups}/{groups.length} {isMultiExGroup ? 'Groups' : 'Exercises'}</span>
          </div>
        </button>
      </header>

      {/* Main scrollable */}
      <main class="flex-1 overflow-y-auto p-4 pb-32 space-y-4">
        {/* Exercise hero card */}
        <div class="relative w-full rounded-xl overflow-hidden bg-surface-dark">
          <div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
          {isMultiExGroup ? (
            /* Multi-exercise group header */
            <div class="relative z-10 p-4">
              <div class="flex items-center gap-2 mb-3">
                <Icon name="link" class="text-primary text-lg" />
                <span class="text-xs font-bold text-primary uppercase tracking-wider">{groupLabel(currentGroup.type)}</span>
                <span class="text-xs text-slate-400 ml-auto">{currentGroupIdx + 1} / {groups.length}</span>
              </div>
              <div class="space-y-2">
                {currentGroup.exercises.map((ex, i) => (
                  <div
                    key={ex.id}
                    class={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                      i === activeExInGroup ? 'bg-primary/15 border border-primary/30' : 'opacity-60'
                    }`}
                  >
                    <div class="w-8 h-8 rounded-md bg-surface-darker flex items-center justify-center shrink-0">
                      <span class="text-sm font-bold text-primary/80">{currentGroup.groupId}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h3 class={`font-bold leading-tight truncate ${i === activeExInGroup ? 'text-white text-base' : 'text-slate-300 text-sm'}`}>{ex.name}</h3>
                      <p class="text-slate-400 text-xs">{ex.muscleGroup}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Single exercise hero (same as before) */
            <>
              <div class="absolute inset-0 flex items-center justify-center">
                <Icon name="fitness_center" class="text-5xl text-primary/40" />
              </div>
              <div class="relative z-10 pt-16 pb-4 px-4 bg-gradient-to-t from-black/90 to-transparent">
                <h1 class="text-2xl font-bold text-white leading-tight">{currentGroup.exercises[0].name}</h1>
                <p class="text-slate-300 text-sm font-medium">{currentGroup.exercises[0].muscleGroup} Focus</p>
              </div>
              <div class="absolute top-3 right-3 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white font-medium">
                {currentGroupIdx + 1} / {groups.length}
              </div>
            </>
          )}
        </div>

        {/* AI Tip */}
        <div class="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Icon name="auto_awesome" class="text-primary mt-0.5 text-lg" />
          <div>
            <p class="text-sm font-semibold text-primary mb-0.5">AI Tip</p>
            <p class="text-xs text-slate-300 leading-relaxed">{tip}</p>
          </div>
        </div>

        {/* Set logging — render all exercises in the group */}
        {isMultiExGroup ? (
          <div class="space-y-4">
            {currentGroup.exercises.map((ex, i) => {
              const logIdx = exIdToLogIdx.get(ex.id)!;
              return (
                <div key={ex.id} id={`group-ex-${i}`}>
                  {i > 0 && <div class="border-t border-white/10 my-2"></div>}
                  {renderSetGrid(ex, logIdx, i === activeExInGroup)}
                </div>
              );
            })}
          </div>
        ) : (
          renderSetGrid(currentGroup.exercises[0], exIdToLogIdx.get(currentGroup.exercises[0].id)!, true)
        )}
      </main>

      {/* Count-in overlay */}
      {countInTimer !== null && (
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-bg-dark/90 backdrop-blur-lg rounded-2xl p-8 text-center border border-amber-500/20 shadow-2xl">
          <p class="text-slate-400 text-sm uppercase tracking-wider mb-2">Get Ready</p>
          <p class="text-7xl font-bold text-amber-400 mb-4">{countInTimer}</p>
          <button
            onClick={skipCountIn}
            class="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Skip
          </button>
        </div>
      )}

      {/* Exercise timer overlay */}
      {exTimer?.running && (
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-bg-dark/90 backdrop-blur-lg rounded-2xl p-8 text-center border border-amber-500/20 shadow-2xl min-w-[260px]">
          <p class="text-amber-400 text-sm uppercase tracking-wider mb-1">
            {exTimer.mode === 'countdown' ? 'Exercise Timer' : 'Stopwatch'}
          </p>
          <p class="text-xs text-slate-500 mb-3">{plan.exercises[exTimer.logIdx]?.name}</p>
          <p class="text-6xl font-bold text-amber-400 mb-5 tabular-nums">{formatTime(exTimerSeconds ?? 0)}</p>
          <button
            onClick={stopExTimer}
            class="px-6 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {/* Rest timer overlay */}
      {restRemaining !== null && restRemaining > 0 && (
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-bg-dark/90 backdrop-blur-lg rounded-2xl p-8 text-center border border-primary/20 shadow-2xl min-w-[260px]">
          <p class="text-slate-400 text-sm uppercase tracking-wider mb-2">Rest Timer</p>
          <p class="text-6xl font-bold text-primary mb-5 tabular-nums">{formatTime(restRemaining)}</p>
          <button
            onClick={skipRest}
            class="px-6 py-2.5 rounded-xl bg-white/10 text-slate-400 text-sm font-medium hover:text-white transition-colors"
          >
            Skip Rest
          </button>
        </div>
      )}

      {/* Progress overview modal */}
      <ProgressModal
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        groups={groups}
        exerciseLogs={exerciseLogs}
        exIdToLogIdx={exIdToLogIdx}
        currentGroupIdx={currentGroupIdx}
        onJumpToGroup={jumpToGroup}
        elapsedSeconds={elapsedSeconds}
        formatTime={formatTime}
      />

      {/* Workout AI Chat */}
      <WorkoutChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        currentExercise={primaryExercise}
        planSummary={planSummary}
      />

      {/* End Workout Confirmation */}
      {showEndConfirm && (
        <div class="fixed inset-0 z-[200] flex items-center justify-center">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEndConfirm(false)}></div>
          <div class="relative bg-surface-dark rounded-2xl p-6 max-w-[320px] w-full mx-4 border border-white/10 shadow-2xl">
            <div class="text-center mb-5">
              <div class="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
                <Icon name="warning" class="text-red-400 text-3xl" />
              </div>
              <h3 class="text-lg font-bold text-white mb-1">End Workout?</h3>
              <p class="text-sm text-slate-400">
                Your progress will not be saved. Use "Finish" to save.
              </p>
            </div>
            <div class="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                class="flex-1 py-3 rounded-xl bg-surface-darker text-slate-300 font-semibold text-sm"
              >
                Keep Going
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); onEndWorkout(); }}
                class="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm"
              >
                End
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div class="fixed bottom-0 left-0 w-full bg-bg-dark border-t border-white/5 p-4 pb-safe z-40 max-w-[430px] mx-auto" style="left: 50%; transform: translateX(-50%)">
        <div class="flex gap-3">
          {currentGroupIdx > 0 && (
            <button
              onClick={prevGroup}
              class="flex items-center justify-center h-14 w-14 rounded-xl bg-surface-dark text-slate-200 font-bold hover:bg-slate-800 transition-colors"
            >
              <Icon name="arrow_back" class="text-xl" />
            </button>
          )}
          <button
            onClick={() => setRestTimer(isMultiExGroup ? 90 : (currentGroup.exercises[0].restSeconds || 60))}
            class="flex flex-col items-center justify-center h-14 w-14 rounded-xl bg-surface-dark text-slate-200 font-bold hover:bg-slate-800 transition-colors"
          >
            <Icon name="timer" class="text-xl" />
            <span class="text-[10px] uppercase font-bold tracking-wide mt-0.5">Rest</span>
          </button>
          {isAIConfigured() && (
            <button
              onClick={() => setChatOpen(true)}
              class="flex flex-col items-center justify-center h-14 w-14 rounded-xl bg-primary/15 text-primary font-bold hover:bg-primary/25 transition-colors border border-primary/20"
            >
              <Icon name="auto_awesome" class="text-xl" />
              <span class="text-[10px] uppercase font-bold tracking-wide mt-0.5">AI</span>
            </button>
          )}
          <button
            onClick={isLastGroup ? finishWorkout : nextGroup}
            class="flex-1 h-14 rounded-xl bg-primary text-bg-dark text-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <span>{isLastGroup ? 'Finish Workout' : 'Next'}</span>
            <Icon name={isLastGroup ? 'check' : 'arrow_forward'} class="font-bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
