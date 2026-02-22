import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { WorkoutPlan, WorkoutCriteria, WorkoutStyle } from '../types';

interface HomeProps {
  plan: WorkoutPlan | null;
  loading: boolean;
  userName: string;
  onStartWorkout: () => void;
  onRegenerate: (style?: string, criteria?: WorkoutCriteria) => void;
  onAdjustWithAI?: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getMotivation(): string {
  const phrases = ['Ready to crush it?', 'Let\'s get after it!', 'Time to level up!', 'Ready to sweat?', 'Let\'s build something!'];
  return phrases[new Date().getDate() % phrases.length];
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const STYLE_OPTIONS: { value: WorkoutStyle; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Hypertrophy' },
  { value: 'functional', label: 'Functional' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'power', label: 'Power' },
  { value: 'endurance', label: 'Endurance' },
];

export function Home({ plan, loading, userName, onStartWorkout, onRegenerate, onAdjustWithAI }: HomeProps) {
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenStyle, setRegenStyle] = useState<WorkoutStyle | ''>('');
  const [regenMood, setRegenMood] = useState('');
  const [regenLimitations, setRegenLimitations] = useState('');

  const handleRegenerate = () => {
    const criteria: WorkoutCriteria = {};
    if (regenMood) criteria.mood = regenMood;
    if (regenLimitations) criteria.limitations = regenLimitations;
    if (regenStyle) criteria.style = regenStyle as WorkoutStyle;

    const hasCriteria = Object.keys(criteria).length > 0;
    onRegenerate(regenStyle || undefined, hasCriteria ? criteria : undefined);
    setShowRegenModal(false);
    setRegenStyle('');
    setRegenMood('');
    setRegenLimitations('');
  };

  return (
    <main class="flex-1 overflow-y-auto no-scrollbar pb-40">
      {/* Header */}
      <div class="px-5 pt-6 pb-2">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            <div class="relative">
              <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div class="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-bg-dark"></div>
            </div>
            <div>
              <p class="text-xs text-primary font-medium tracking-wide uppercase">AI Plan Ready</p>
              <h1 class="text-lg font-bold leading-tight">{getGreeting()}, {userName}</h1>
            </div>
          </div>
          <div class="flex gap-2">
            {onAdjustWithAI && plan && (
              <button
                onClick={onAdjustWithAI}
                class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-dark text-slate-300 hover:text-primary transition-colors"
                title="Adjust with AI"
              >
                <Icon name="auto_awesome" />
              </button>
            )}
            <button
              onClick={() => setShowRegenModal(true)}
              class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-dark text-slate-300 hover:text-primary transition-colors"
              title="Regenerate workout"
            >
              <Icon name="refresh" />
            </button>
          </div>
        </div>
        <div class="mb-2">
          <h2 class="text-3xl font-bold tracking-tight text-white mb-1">{getMotivation()}</h2>
          <p class="text-slate-400 text-sm">{formatDate()}</p>
        </div>
      </div>

      {/* Hero Card: AI Daily Mix */}
      {loading ? (
        <div class="px-4 mb-8">
          <div class="rounded-2xl bg-surface-dark h-[320px] animate-pulse flex items-center justify-center">
            <Icon name="fitness_center" class="text-4xl text-primary/30" />
          </div>
        </div>
      ) : plan ? (
        <div class="px-4 mb-8">
          <div class="relative overflow-hidden rounded-2xl bg-surface-dark shadow-lg shadow-primary/5">
            {/* Gradient background */}
            <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/80 to-transparent"></div>

            <div class="relative z-10 p-6 flex flex-col h-[320px] justify-between">
              <div class="flex justify-between items-start">
                <span class="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider border border-primary/20 backdrop-blur-sm">
                  AI Daily Mix
                </span>
                <div class="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <Icon
                      key={i}
                      name="bolt"
                      class={`text-sm ${i <= plan.intensity ? 'text-primary' : 'text-slate-600'}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 class="text-3xl font-bold text-white mb-2 leading-tight">
                  {plan.focus}<br />
                  <span class="text-primary">{plan.style.charAt(0).toUpperCase() + plan.style.slice(1)}</span>
                </h3>

                {/* Equipment tags */}
                <div class="flex flex-wrap gap-2 mb-6">
                  {plan.equipmentUsed.length > 0 ? (
                    plan.equipmentUsed.map((e) => (
                      <span key={e} class="text-[10px] text-slate-300 bg-white/10 px-2 py-1 rounded border border-white/5 capitalize">
                        {e.replace(/-/g, ' ')}
                      </span>
                    ))
                  ) : (
                    <span class="text-[10px] text-slate-300 bg-white/10 px-2 py-1 rounded border border-white/5">Bodyweight</span>
                  )}
                </div>

                {/* Stats */}
                <div class="grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
                  <div>
                    <p class="text-slate-400 text-xs mb-1">Duration</p>
                    <p class="text-white font-semibold flex items-center gap-1">
                      <Icon name="schedule" class="text-primary text-base" /> {plan.durationMin}m
                    </p>
                  </div>
                  <div>
                    <p class="text-slate-400 text-xs mb-1">Burn</p>
                    <p class="text-white font-semibold flex items-center gap-1">
                      <Icon name="local_fire_department" class="text-primary text-base" /> {plan.estimatedCalories}
                    </p>
                  </div>
                  <div>
                    <p class="text-slate-400 text-xs mb-1">Focus</p>
                    <p class="text-white font-semibold flex items-center gap-1">
                      <Icon name="fitness_center" class="text-primary text-base" /> {plan.focus.split(' ')[0].slice(0, 4)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Exercise List */}
      {plan && (
        <div class="px-5 pb-20">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-white">Exercises</h3>
            <span class="text-xs text-primary font-medium">{plan.exercises.length} Moves</span>
          </div>
          <div class="space-y-3">
            {plan.exercises.map((ex, i) => (
              <div
                key={ex.id}
                class="bg-surface-dark rounded-xl p-3 flex items-center gap-4 border border-white/5 hover:border-primary/30 transition-colors"
              >
                <div class="w-14 h-14 rounded-lg bg-surface-darker flex items-center justify-center shrink-0">
                  <span class="text-2xl font-bold text-primary/60">{i + 1}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex justify-between items-start mb-1">
                    <h4 class="text-white font-medium truncate pr-2">{ex.name}</h4>
                    <span class="text-xs text-slate-400 bg-surface-darker px-1.5 py-0.5 rounded shrink-0">
                      {ex.muscleGroup}
                    </span>
                  </div>
                  <div class="flex items-center gap-3 text-sm text-slate-400">
                    <span>{ex.sets} Sets</span>
                    <span class="w-1 h-1 rounded-full bg-slate-600"></span>
                    <span>{ex.reps}</span>
                    {ex.weight && (
                      <>
                        <span class="w-1 h-1 rounded-full bg-slate-600"></span>
                        <span>{ex.weight} lbs</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Workout FAB */}
      {plan && (
        <div class="fixed bottom-20 pb-safe left-0 w-full px-6 z-20 pointer-events-none max-w-[430px] mx-auto" style="left: 50%; transform: translateX(-50%);">
          <button
            onClick={onStartWorkout}
            class="w-full bg-primary text-bg-dark h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 pointer-events-auto active:scale-[0.98] transition-all font-bold text-lg tracking-wide"
          >
            <Icon name="play_arrow" class="text-2xl" />
            START WORKOUT
          </button>
        </div>
      )}

      {/* Regeneration Modal */}
      {showRegenModal && (
        <div class="fixed inset-0 z-[100] flex items-end justify-center">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegenModal(false)}></div>
          <div class="relative w-full max-w-[430px] bg-bg-dark border-t border-white/10 rounded-t-2xl p-5 pb-8 animate-slide-up">
            <div class="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4"></div>
            <h3 class="text-lg font-bold text-white mb-4">Regenerate Workout</h3>

            {/* Style picker */}
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Style</label>
            <div class="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setRegenStyle('')}
                class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !regenStyle ? 'bg-primary text-bg-dark' : 'bg-surface-dark text-slate-300 hover:bg-white/10'
                }`}
              >
                Auto
              </button>
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setRegenStyle(s.value)}
                  class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    regenStyle === s.value ? 'bg-primary text-bg-dark' : 'bg-surface-dark text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Mood */}
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Mood / Energy</label>
            <input
              type="text"
              value={regenMood}
              onInput={(e) => setRegenMood((e.target as HTMLInputElement).value)}
              placeholder="e.g. feeling energetic, tired, stressed..."
              class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 mb-4"
            />

            {/* Limitations */}
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Limitations / Injuries</label>
            <input
              type="text"
              value={regenLimitations}
              onInput={(e) => setRegenLimitations((e.target as HTMLInputElement).value)}
              placeholder="e.g. sore shoulder, bad knee..."
              class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 mb-6"
            />

            {/* Actions */}
            <div class="flex gap-3">
              <button
                onClick={() => setShowRegenModal(false)}
                class="flex-1 py-3 rounded-xl bg-surface-dark text-slate-300 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                class="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm flex items-center justify-center gap-2"
              >
                <Icon name="auto_awesome" class="text-lg" />
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
