import { useState, useMemo } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Icon } from '../components/Icon';
import { NavSlot } from '../components/NavSlot';
import type { WorkoutPlan, WorkoutCriteria, WorkoutStyle, Exercise, WorkoutSession, WorkoutProgram, ProgramDay, ActiveWorkoutState } from '../types';
import { groupExercises, groupLabel } from '../group-utils';
import { withBase } from '../base';

interface HomeProps {
  plan: WorkoutPlan | null;
  loading: boolean;
  userName: string;
  sessions: WorkoutSession[];
  onStartWorkout: () => void;
  onRegenerate: (style?: string, criteria?: WorkoutCriteria) => void;
  onAdjustWithAI?: () => void;
  onUpdatePlan?: (plan: WorkoutPlan) => void;
  // Program mode props
  workoutMode?: 'daily' | 'program';
  program?: WorkoutProgram | null;
  programLoading?: boolean;
  todayProgramDay?: ProgramDay | null;
  onGenerateProgram?: () => Promise<WorkoutProgram | null>;
  onClearProgram?: () => void;
  onStartProgramWorkout?: (plan: WorkoutPlan) => void;
  activeWorkout?: ActiveWorkoutState | null;
  workoutIsActive?: boolean;
  onResumeWorkout?: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const WORKOUT_IMAGES: Record<string, string> = {
  'Chest & Triceps': '/images/workouts/chest-triceps.jpg',
  'Back & Biceps': '/images/workouts/back-biceps.jpg',
  'Shoulders & Traps': '/images/workouts/shoulders-traps.jpg',
  'Chest & Shoulders': '/images/workouts/chest-shoulders.jpg',
  'Shoulders & Triceps': '/images/workouts/shoulders-triceps.jpg',
  'Quads & Glutes': '/images/workouts/quads-glutes.jpg',
  'Full Body': '/images/workouts/full-body.jpg',
  'Core': '/images/workouts/core.jpg',
  'Legs': '/images/workouts/legs.jpg',
  'Back': '/images/workouts/back.jpg',
  'Chest': '/images/workouts/chest.jpg',
  'Arms': '/images/workouts/arms.jpg',
  'Biceps & Triceps': '/images/workouts/arms.jpg',
  'Glutes': '/images/workouts/glutes.jpg',
  'Glutes & Hamstrings': '/images/workouts/glutes.jpg',
  'Upper Body': '/images/workouts/upper-body.jpg',
  'Lower Body': '/images/workouts/lower-body.jpg',
  'Shoulders': '/images/workouts/shoulders.jpg',
  'Conditioning': '/images/workouts/conditioning.jpg',
  'Cardio': '/images/workouts/conditioning.jpg',
};

const STYLE_FALLBACK_IMAGES: Record<string, string> = {
  strength: '/images/discover/strength.jpg',
  hypertrophy: '/images/discover/hypertrophy.jpg',
  functional: '/images/discover/functional.jpg',
  hiit: '/images/discover/hiit.jpg',
  cardio: '/images/discover/cardio.jpg',
  recovery: '/images/discover/recovery.jpg',
  mobility: '/images/discover/mobility.jpg',
  power: '/images/discover/power.jpg',
  endurance: '/images/discover/endurance.jpg',
};

function getWorkoutImage(focus: string, style: string): string | null {
  return WORKOUT_IMAGES[focus] || STYLE_FALLBACK_IMAGES[style] || WORKOUT_IMAGES['Full Body'] || null;
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

function ExerciseCard({ ex, label, onTap }: { ex: Exercise; label: string | number; onTap?: () => void }) {
  return (
    <div
      onClick={onTap}
      class={`bg-surface-dark rounded-xl p-3 flex items-start gap-4 border border-white/5 hover:border-primary/30 transition-colors ${onTap ? 'cursor-pointer active:scale-[0.98]' : ''}`}
    >
      <div class="w-10 h-10 rounded-lg bg-surface-darker flex items-center justify-center shrink-0 mt-0.5">
        <span class="text-lg font-bold text-primary/60">{label}</span>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-white font-medium leading-snug mb-1">{ex.name}</h4>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
          <span class="shrink-0">{ex.sets} Sets</span>
          <span class="w-1 h-1 rounded-full bg-slate-600 shrink-0"></span>
          <span class="shrink-0">{ex.reps}</span>
          {ex.weight && (
            <>
              <span class="w-1 h-1 rounded-full bg-slate-600 shrink-0"></span>
              <span class="shrink-0">{ex.weight} lbs</span>
            </>
          )}
          <span class="w-1 h-1 rounded-full bg-slate-600 shrink-0"></span>
          <span class="text-xs text-slate-500">{ex.muscleGroup}</span>
        </div>
      </div>
      {onTap && <Icon name="edit" class="text-slate-600 text-lg shrink-0 mt-0.5" />}
    </div>
  );
}

function ExerciseList({ exercises, onEditExercise }: { exercises: Exercise[]; onEditExercise?: (ex: Exercise) => void }) {
  const groups = useMemo(() => groupExercises(exercises), [exercises]);
  let counter = 0;

  return (
    <div class="space-y-3">
      {groups.map((group) => {
        if (group.type === 'standalone') {
          counter++;
          const ex = group.exercises[0];
          return <ExerciseCard key={group.groupId} ex={ex} label={counter} onTap={onEditExercise ? () => onEditExercise(ex) : undefined} />;
        }

        const badge = group.groupId;
        return (
          <div key={group.groupId} class="relative">
            {/* Group header */}
            <div class="flex items-center gap-2 mb-2">
              <Icon name="link" class="text-primary text-sm" />
              <span class="text-xs font-bold text-primary uppercase tracking-wider">{groupLabel(group.type)}</span>
            </div>
            {/* Grouped exercises with left accent */}
            <div class="border-l-2 border-primary/40 pl-3 space-y-2">
              {group.exercises.map((ex) => {
                counter++;
                return <ExerciseCard key={ex.id} ex={ex} label={badge} onTap={onEditExercise ? () => onEditExercise(ex) : undefined} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EditExerciseModal({ exercise, onSave, onRemove, onClose }: {
  exercise: Exercise;
  onSave: (updated: Exercise) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets.toString());
  const [reps, setReps] = useState(exercise.reps);
  const [weight, setWeight] = useState(exercise.weight?.toString() || '');
  const [muscleGroup, setMuscleGroup] = useState(exercise.muscleGroup);

  const handleSave = () => {
    onSave({
      ...exercise,
      name: name.trim() || exercise.name,
      sets: parseInt(sets) || exercise.sets,
      reps: reps.trim() || exercise.reps,
      weight: weight ? Number(weight) : undefined,
      muscleGroup: muscleGroup.trim() || exercise.muscleGroup,
    });
  };

  return (
    <div class="fixed inset-0 z-[100] flex items-end justify-center">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div class="relative w-full max-w-[430px] bg-bg-dark border-t border-white/10 rounded-t-2xl p-5 pb-8 animate-slide-up">
        <div class="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4"></div>
        <h3 class="text-lg font-bold text-white mb-4">Edit Exercise</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Muscle Group</label>
            <input
              type="text"
              value={muscleGroup}
              onInput={(e) => setMuscleGroup((e.target as HTMLInputElement).value)}
              class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Sets</label>
              <input
                type="number"
                value={sets}
                onInput={(e) => setSets((e.target as HTMLInputElement).value)}
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Reps</label>
              <input
                type="text"
                value={reps}
                onInput={(e) => setReps((e.target as HTMLInputElement).value)}
                placeholder="10-12"
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Weight</label>
              <input
                type="number"
                value={weight}
                onInput={(e) => setWeight((e.target as HTMLInputElement).value)}
                placeholder="lbs"
                class="w-full bg-surface-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            onClick={onRemove}
            class="h-12 w-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors shrink-0"
            title="Remove exercise"
          >
            <Icon name="delete" />
          </button>
          <button
            onClick={onClose}
            class="flex-1 py-3 rounded-xl bg-surface-dark text-slate-300 font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            class="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgramDayDots({ days, currentDay }: { days: ProgramDay[]; currentDay: number }) {
  return (
    <div class="flex items-center gap-1.5 justify-center">
      {days.map((day) => (
        <div
          key={day.dayNumber}
          class={`flex items-center justify-center rounded-full transition-all ${
            day.dayNumber === currentDay
              ? 'w-7 h-7 bg-primary text-bg-dark text-xs font-bold'
              : day.isRest
              ? 'w-5 h-5 bg-white/5 border border-white/10'
              : 'w-5 h-5 bg-surface-dark border border-white/10'
          }`}
          title={day.label}
        >
          {day.dayNumber === currentDay ? day.dayNumber : (
            day.isRest ? (
              <span class="text-[8px] text-slate-500">R</span>
            ) : (
              <span class="text-[8px] text-slate-400">{day.dayNumber}</span>
            )
          )}
        </div>
      ))}
    </div>
  );
}

function DiscoverCard() {
  const { route } = useLocation();
  return (
    <div class="px-5 mb-6">
      <button
        onClick={() => route(withBase('/discover'))}
        class="w-full bg-surface-dark rounded-xl p-4 border border-white/5 flex items-center gap-4 hover:border-primary/30 transition-colors text-left active:scale-[0.98]"
      >
        <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon name="explore" class="text-primary text-2xl" />
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-white font-semibold text-sm">Discover Workouts</h4>
          <p class="text-slate-400 text-xs">Browse styles, find new routines</p>
        </div>
        <Icon name="chevron_right" class="text-slate-500 text-xl shrink-0" />
      </button>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Collapsed card shown when a new plan was generated after today's completed session
function CompletedWorkoutCard({ session, onClick }: { session: WorkoutSession; onClick: () => void }) {
  const totalReps = session.exercises.reduce((sum, ex) =>
    sum + ex.sets.filter(s => s.completed).reduce((r, s) => r + (s.reps || 0), 0), 0);

  return (
    <div class="px-4 mb-4">
      <button
        onClick={onClick}
        class="w-full bg-surface-dark rounded-xl p-4 border border-primary/20 flex items-center gap-4 hover:border-primary/40 transition-colors text-left active:scale-[0.98]"
      >
        <div class="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Icon name="emoji_events" class="text-primary text-2xl" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-xs font-bold text-primary uppercase tracking-wider">Completed Today</span>
          </div>
          <h4 class="text-white font-semibold text-sm truncate">{session.name}</h4>
          <div class="flex gap-3 text-xs text-slate-400 mt-0.5">
            <span>{formatDuration(session.durationSeconds)}</span>
            <span>{session.totalSets} sets</span>
            <span>{totalReps} reps</span>
            {session.totalVolume > 0 && <span>{session.totalVolume.toLocaleString()} lbs</span>}
          </div>
        </div>
        <Icon name="chevron_right" class="text-slate-500 text-xl shrink-0" />
      </button>
    </div>
  );
}

// Inline completion view — shows workout summary on home screen
function CompletedWorkoutInline({ session, onRegenerate }: { session: WorkoutSession; onRegenerate: () => void }) {
  const duration = formatDuration(session.durationSeconds);
  const exerciseCount = session.exercises.length;
  const completedSets = session.totalSets;
  const totalReps = session.exercises.reduce((sum, ex) =>
    sum + ex.sets.filter(s => s.completed).reduce((r, s) => r + (s.reps || 0), 0), 0);
  const volume = session.totalVolume;
  const muscleGroups = [...new Set(session.exercises.map(e => e.muscleGroup))];

  return (
    <div class="px-5 pb-40">
      {/* Trophy header */}
      <div class="flex flex-col items-center py-6">
        <div class="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4 border-2 border-primary/40">
          <Icon name="emoji_events" class="text-primary text-4xl" />
        </div>
        <h2 class="text-2xl font-bold text-white mb-1">Workout Complete!</h2>
        <p class="text-slate-400 text-sm">{session.name}</p>
      </div>

      {/* Stats grid */}
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
          <Icon name="schedule" class="text-2xl mb-2 text-primary" />
          <p class="text-2xl font-bold text-white mb-1">{duration}</p>
          <p class="text-xs text-slate-400 uppercase tracking-wider">Duration</p>
        </div>
        <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
          <Icon name="fitness_center" class="text-2xl mb-2 text-blue-400" />
          <p class="text-2xl font-bold text-white mb-1">{exerciseCount}</p>
          <p class="text-xs text-slate-400 uppercase tracking-wider">Exercises</p>
        </div>
        <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
          <Icon name="repeat" class="text-2xl mb-2 text-amber-400" />
          <p class="text-2xl font-bold text-white mb-1">{completedSets}</p>
          <p class="text-xs text-slate-400 uppercase tracking-wider">Sets</p>
        </div>
        <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
          <Icon name="tag" class="text-2xl mb-2 text-rose-400" />
          <p class="text-2xl font-bold text-white mb-1">{totalReps}</p>
          <p class="text-xs text-slate-400 uppercase tracking-wider">Total Reps</p>
        </div>
      </div>

      {/* Volume */}
      {volume > 0 && (
        <div class="bg-surface-dark rounded-xl p-4 border border-primary/20 mb-4 text-center">
          <div class="flex items-center justify-center gap-2 mb-1">
            <Icon name="monitoring" class="text-primary text-xl" />
            <span class="text-xs text-slate-400 uppercase tracking-wider">Total Volume</span>
          </div>
          <p class="text-3xl font-bold text-primary">{volume.toLocaleString()}<span class="text-lg text-slate-400 ml-1">lbs</span></p>
        </div>
      )}

      {/* Muscles worked */}
      <div class="bg-surface-dark rounded-xl p-4 border border-white/5 mb-4">
        <p class="text-xs text-slate-400 uppercase tracking-wider mb-3 text-center">Muscles Worked</p>
        <div class="flex flex-wrap justify-center gap-2">
          {muscleGroups.map((mg) => (
            <span key={mg} class="text-xs text-slate-200 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
              {mg}
            </span>
          ))}
        </div>
      </div>

      {/* Exercise breakdown */}
      <div class="bg-surface-dark rounded-xl border border-white/5 overflow-hidden mb-6">
        <div class="p-3 border-b border-white/5">
          <p class="text-xs text-slate-400 uppercase tracking-wider font-medium">Exercise Breakdown</p>
        </div>
        <div class="divide-y divide-white/5">
          {session.exercises.map((ex) => {
            const completed = ex.sets.filter(s => s.completed);
            const bestSet = completed.reduce((best, s) =>
              (s.weight || 0) > (best.weight || 0) ? s : best, completed[0]);
            return (
              <div key={ex.exerciseId} class="flex items-center justify-between px-4 py-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-white truncate">{ex.exerciseName}</p>
                  <p class="text-xs text-slate-500">{ex.muscleGroup}</p>
                </div>
                <div class="text-right shrink-0 ml-3">
                  <p class="text-sm text-slate-300">{completed.length}/{ex.sets.length} sets</p>
                  {bestSet?.weight && (
                    <p class="text-xs text-primary">{bestSet.weight} lbs x {bestSet.reps}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generate new workout button */}
      <button
        onClick={onRegenerate}
        class="w-full py-3 rounded-xl bg-surface-dark border border-white/10 text-slate-300 font-semibold text-sm flex items-center justify-center gap-2 hover:border-primary/30 hover:text-primary transition-colors"
      >
        <Icon name="refresh" class="text-lg" />
        Generate Another Workout
      </button>
    </div>
  );
}

// Full-screen completion modal (reused from WorkoutComplete, without confetti)
function CompletedWorkoutModal({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const duration = formatDuration(session.durationSeconds);
  const exerciseCount = session.exercises.length;
  const completedSets = session.totalSets;
  const totalReps = session.exercises.reduce((sum, ex) =>
    sum + ex.sets.filter(s => s.completed).reduce((r, s) => r + (s.reps || 0), 0), 0);
  const volume = session.totalVolume;
  const muscleGroups = [...new Set(session.exercises.map(e => e.muscleGroup))];

  return (
    <div class="fixed inset-0 z-[150] bg-bg-dark/95 backdrop-blur-sm flex flex-col">
      <div class="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center px-6 py-10">
        {/* Close button */}
        <div class="w-full max-w-[430px] flex justify-end mb-4">
          <button
            onClick={onClose}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-dark text-slate-300 hover:text-white transition-colors"
          >
            <Icon name="close" class="text-xl" />
          </button>
        </div>

        {/* Trophy */}
        <div class="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-6 border-2 border-primary/40">
          <Icon name="emoji_events" class="text-primary text-5xl" />
        </div>

        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-white mb-2">Workout Complete!</h1>
          <p class="text-slate-400 text-sm mt-2">{session.name}</p>
        </div>

        {/* Stats grid */}
        <div class="w-full max-w-[400px]">
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
              <Icon name="schedule" class="text-2xl mb-2 text-primary" />
              <p class="text-2xl font-bold text-white mb-1">{duration}</p>
              <p class="text-xs text-slate-400 uppercase tracking-wider">Duration</p>
            </div>
            <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
              <Icon name="fitness_center" class="text-2xl mb-2 text-blue-400" />
              <p class="text-2xl font-bold text-white mb-1">{exerciseCount}</p>
              <p class="text-xs text-slate-400 uppercase tracking-wider">Exercises</p>
            </div>
            <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
              <Icon name="repeat" class="text-2xl mb-2 text-amber-400" />
              <p class="text-2xl font-bold text-white mb-1">{completedSets}</p>
              <p class="text-xs text-slate-400 uppercase tracking-wider">Sets</p>
            </div>
            <div class="bg-surface-dark rounded-xl p-4 border border-white/5 text-center">
              <Icon name="tag" class="text-2xl mb-2 text-rose-400" />
              <p class="text-2xl font-bold text-white mb-1">{totalReps}</p>
              <p class="text-xs text-slate-400 uppercase tracking-wider">Total Reps</p>
            </div>
          </div>

          {volume > 0 && (
            <div class="bg-surface-dark rounded-xl p-4 border border-primary/20 mb-4 text-center">
              <div class="flex items-center justify-center gap-2 mb-1">
                <Icon name="monitoring" class="text-primary text-xl" />
                <span class="text-xs text-slate-400 uppercase tracking-wider">Total Volume</span>
              </div>
              <p class="text-3xl font-bold text-primary">{volume.toLocaleString()}<span class="text-lg text-slate-400 ml-1">lbs</span></p>
            </div>
          )}

          {/* Muscles worked */}
          <div class="bg-surface-dark rounded-xl p-4 border border-white/5 mb-6">
            <p class="text-xs text-slate-400 uppercase tracking-wider mb-3 text-center">Muscles Worked</p>
            <div class="flex flex-wrap justify-center gap-2">
              {muscleGroups.map((mg) => (
                <span key={mg} class="text-xs text-slate-200 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
                  {mg}
                </span>
              ))}
            </div>
          </div>

          {/* Exercise breakdown */}
          <div class="bg-surface-dark rounded-xl border border-white/5 overflow-hidden mb-6">
            <div class="p-3 border-b border-white/5">
              <p class="text-xs text-slate-400 uppercase tracking-wider font-medium">Exercise Breakdown</p>
            </div>
            <div class="divide-y divide-white/5">
              {session.exercises.map((ex) => {
                const completed = ex.sets.filter(s => s.completed);
                const bestSet = completed.reduce((best, s) =>
                  (s.weight || 0) > (best.weight || 0) ? s : best, completed[0]);
                return (
                  <div key={ex.exerciseId} class="flex items-center justify-between px-4 py-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-white truncate">{ex.exerciseName}</p>
                      <p class="text-xs text-slate-500">{ex.muscleGroup}</p>
                    </div>
                    <div class="text-right shrink-0 ml-3">
                      <p class="text-sm text-slate-300">{completed.length}/{ex.sets.length} sets</p>
                      {bestSet?.weight && (
                        <p class="text-xs text-primary">{bestSet.weight} lbs x {bestSet.reps}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom close button */}
      <div class="px-6 pb-8 pt-2">
        <button
          onClick={onClose}
          class="w-full h-14 rounded-xl bg-primary text-bg-dark font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function Home({ plan, loading, userName, sessions, onStartWorkout, onRegenerate, onAdjustWithAI, onUpdatePlan, workoutMode, program, programLoading, todayProgramDay, onGenerateProgram, onClearProgram, onStartProgramWorkout }: HomeProps) {
  const { route } = useLocation();
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenStyle, setRegenStyle] = useState<WorkoutStyle | ''>('');
  const [regenMood, setRegenMood] = useState('');
  const [regenLimitations, setRegenLimitations] = useState('');
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [generatingProgram, setGeneratingProgram] = useState(false);

  const isProgramMode = workoutMode === 'program';

  // Find today's completed session
  const todaySession = useMemo(() => {
    const today = new Date().toDateString();
    return sessions.find((s) =>
      s.completedAt && new Date(s.startedAt).toDateString() === today
    ) || null;
  }, [sessions]);

  // Determine if the plan was generated AFTER the completed session
  const planIsNewer = useMemo(() => {
    if (!todaySession?.completedAt || !plan?.generatedAt) return false;
    return plan.generatedAt > todaySession.completedAt;
  }, [todaySession, plan]);

  // Show inline completion when there's a completed session and NO newer plan
  const showInlineCompletion = todaySession && !planIsNewer && !loading;
  // Show collapsed card when there IS a newer plan
  const showCompletedCard = todaySession && planIsNewer;

  const handleSaveExercise = (updated: Exercise) => {
    if (!plan || !onUpdatePlan) return;
    const newExercises = plan.exercises.map((ex) => ex.id === updated.id ? updated : ex);
    onUpdatePlan({ ...plan, exercises: newExercises });
    setEditingExercise(null);
  };

  const handleRemoveExercise = () => {
    if (!plan || !onUpdatePlan || !editingExercise) return;
    if (plan.exercises.length <= 1) return; // don't remove last exercise
    const newExercises = plan.exercises.filter((ex) => ex.id !== editingExercise.id);
    onUpdatePlan({ ...plan, exercises: newExercises });
    setEditingExercise(null);
  };

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
      <div class="px-5 pt-6 pt-safe pb-2">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            <div class="relative">
              <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div class="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-bg-dark"></div>
            </div>
            <div>
              <p class="text-xs text-primary font-medium tracking-wide uppercase">
                {isProgramMode && program ? 'Program Active' : showInlineCompletion ? 'Workout Done' : 'AI Plan Ready'}
              </p>
              <h1 class="text-lg font-bold leading-tight">{getGreeting()}, {userName}</h1>
            </div>
          </div>
          <div class="flex gap-2">
            {!isProgramMode && onAdjustWithAI && plan && (
              <button
                onClick={onAdjustWithAI}
                class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-dark text-slate-300 hover:text-primary transition-colors"
                title="Adjust with AI"
              >
                <Icon name="auto_awesome" />
              </button>
            )}
            {!isProgramMode && (
              <button
                onClick={() => setShowRegenModal(true)}
                class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-dark text-slate-300 hover:text-primary transition-colors"
                title="Regenerate workout"
              >
                <Icon name="refresh" />
              </button>
            )}
            {isProgramMode && program && onClearProgram && (
              <button
                onClick={() => {
                  if (confirm('Clear your current program? You can generate a new one afterward.')) {
                    onClearProgram();
                  }
                }}
                class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-dark text-slate-300 hover:text-primary transition-colors"
                title="Clear program"
              >
                <Icon name="restart_alt" />
              </button>
            )}
          </div>
        </div>
        <div class="mb-2">
          <h2 class="text-3xl font-bold tracking-tight text-white mb-1">
            {showInlineCompletion ? 'Crushed it today!' : isProgramMode && todayProgramDay?.isRest ? 'Rest & Recover' : getMotivation()}
          </h2>
          <p class="text-slate-400 text-sm">{formatDate()}</p>
        </div>
      </div>

      {/* ===== PROGRAM MODE ===== */}
      {isProgramMode && (
        <>
          {/* Loading state */}
          {(programLoading || generatingProgram) && (
            <div class="px-4 mb-8">
              <div class="rounded-2xl bg-surface-dark h-[280px] animate-pulse flex flex-col items-center justify-center gap-3">
                <div class="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p class="text-sm text-slate-400">{generatingProgram ? 'Generating your program...' : 'Loading program...'}</p>
              </div>
            </div>
          )}

          {/* No program yet — prompt to generate */}
          {!programLoading && !generatingProgram && !program && (
            <div class="px-4 mb-8">
              <div class="rounded-2xl bg-surface-dark border border-dashed border-white/10 p-6 text-center">
                <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon name="calendar_month" class="text-primary text-3xl" />
                </div>
                <h3 class="text-lg font-bold text-white mb-2">No Active Program</h3>
                <p class="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
                  Generate a structured 7-day program with a balanced split, rest days, and progressive overload.
                </p>
                <button
                  onClick={async () => {
                    if (!onGenerateProgram) return;
                    setGeneratingProgram(true);
                    await onGenerateProgram();
                    setGeneratingProgram(false);
                  }}
                  class="px-6 py-3 bg-primary text-bg-dark rounded-xl font-bold text-sm inline-flex items-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
                >
                  <Icon name="auto_awesome" class="text-lg" />
                  Generate Program
                </button>
              </div>
            </div>
          )}

          {/* Active program — show today's day */}
          {!programLoading && !generatingProgram && program && todayProgramDay && (
            <>
              {/* Week progress dots */}
              <div class="px-5 mb-4">
                <div class="bg-surface-dark rounded-xl p-3 border border-white/5">
                  <p class="text-xs text-slate-400 uppercase tracking-wider text-center mb-2 font-medium">{program.name}</p>
                  <ProgramDayDots days={program.days} currentDay={todayProgramDay.dayNumber} />
                  <button
                    onClick={() => route(withBase('/program'))}
                    class="mt-2.5 w-full flex items-center justify-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors py-1"
                  >
                    <Icon name="event_note" class="text-sm" />
                    View Full Program
                  </button>
                </div>
              </div>

              {/* Rest day card */}
              {todayProgramDay.isRest && (
                <div class="px-4 mb-8">
                  <div class="rounded-2xl bg-surface-dark border border-white/5 p-6 text-center">
                    <div class="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                      <Icon name="self_improvement" class="text-blue-400 text-3xl" />
                    </div>
                    <span class="text-xs text-blue-400 font-bold uppercase tracking-wider">{todayProgramDay.label}</span>
                    <h3 class="text-xl font-bold text-white mt-2 mb-3">Rest Day</h3>
                    <div class="text-sm text-slate-400 space-y-2 max-w-xs mx-auto text-left">
                      <p class="flex items-start gap-2">
                        <Icon name="check_circle" class="text-primary text-sm mt-0.5 shrink-0" />
                        Stay hydrated and aim for 7-9 hours of sleep
                      </p>
                      <p class="flex items-start gap-2">
                        <Icon name="check_circle" class="text-primary text-sm mt-0.5 shrink-0" />
                        Light stretching or a short walk to keep blood flowing
                      </p>
                      <p class="flex items-start gap-2">
                        <Icon name="check_circle" class="text-primary text-sm mt-0.5 shrink-0" />
                        Focus on protein intake to support muscle recovery
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Workout day — show the plan */}
              {!todayProgramDay.isRest && todayProgramDay.plan && (
                <>
                  {/* Hero card for today's program workout */}
                  <div class="px-4 mb-8">
                    <div class="relative overflow-hidden rounded-2xl bg-surface-dark shadow-lg shadow-primary/5">
                      {(() => {
                        const img = getWorkoutImage(todayProgramDay.plan!.focus, todayProgramDay.plan!.style);
                        return img ? (
                          <img src={img} alt="" class="absolute inset-0 w-full h-full object-cover opacity-40" />
                        ) : (
                          <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5"></div>
                        );
                      })()}
                      <div class="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/60 to-bg-dark/30"></div>

                      <div class="relative z-10 p-6 flex flex-col min-h-[320px] justify-between">
                        <div class="flex justify-between items-start">
                          <span class="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider border border-primary/20 backdrop-blur-sm">
                            {todayProgramDay.label}
                          </span>
                          <div class="flex gap-1">
                            {[1, 2, 3].map((i) => (
                              <Icon
                                key={i}
                                name="bolt"
                                class={`text-sm ${i <= todayProgramDay.plan!.intensity ? 'text-primary' : 'text-slate-600'}`}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 class="text-3xl font-bold text-white mb-2 leading-tight">
                            {todayProgramDay.plan!.focus}<br />
                            <span class="text-primary">{todayProgramDay.plan!.style.charAt(0).toUpperCase() + todayProgramDay.plan!.style.slice(1)}</span>
                          </h3>

                          {/* Equipment tags */}
                          <div class="flex flex-wrap gap-2 mb-6">
                            {todayProgramDay.plan!.equipmentUsed.length > 0 ? (
                              todayProgramDay.plan!.equipmentUsed.map((e) => (
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
                                <Icon name="schedule" class="text-primary text-base" /> {todayProgramDay.plan!.durationMin}m
                              </p>
                            </div>
                            <div>
                              <p class="text-slate-400 text-xs mb-1">Burn</p>
                              <p class="text-white font-semibold flex items-center gap-1">
                                <Icon name="local_fire_department" class="text-primary text-base" /> {todayProgramDay.plan!.estimatedCalories}
                              </p>
                            </div>
                            <div>
                              <p class="text-slate-400 text-xs mb-1">Focus</p>
                              <p class="text-white font-semibold flex items-center gap-1">
                                <Icon name="fitness_center" class="text-primary text-base" /> {todayProgramDay.plan!.focus.split(' ')[0].slice(0, 4)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Exercise list for today's program day */}
                  <div class="px-5 pb-40">
                    <div class="flex items-center justify-between mb-4">
                      <h3 class="text-lg font-bold text-white">Exercises</h3>
                      <span class="text-xs text-primary font-medium">{todayProgramDay.plan!.exercises.length} Moves</span>
                    </div>
                    <ExerciseList exercises={todayProgramDay.plan!.exercises} />
                  </div>
                </>
              )}
            </>
          )}

          <DiscoverCard />


        </>
      )}

      {/* ===== DAILY MODE (default) ===== */}
      {/* Inline completion view — replaces the plan when no newer plan exists */}
      {!isProgramMode && showInlineCompletion && todaySession && (
        <>
          <CompletedWorkoutInline
            session={todaySession}
            onRegenerate={() => setShowRegenModal(true)}
          />
          {/* Discover Card still visible */}
          <DiscoverCard />
        </>
      )}

      {/* Completed workout card — shown when a newer plan takes priority */}
      {!isProgramMode && showCompletedCard && todaySession && (
        <CompletedWorkoutCard
          session={todaySession}
          onClick={() => setShowCompletedModal(true)}
        />
      )}

      {/* Hero Card: AI Daily Mix — only shown if no inline completion */}
      {!isProgramMode && !showInlineCompletion && (loading ? (
        <div class="px-4 mb-8">
          <div class="rounded-2xl bg-surface-dark h-[320px] animate-pulse flex items-center justify-center">
            <Icon name="fitness_center" class="text-4xl text-primary/30" />
          </div>
        </div>
      ) : plan ? (
        <div class="px-4 mb-8">
          <div class="relative overflow-hidden rounded-2xl bg-surface-dark shadow-lg shadow-primary/5">
            {/* Background image */}
            {(() => {
              const img = getWorkoutImage(plan.focus, plan.style);
              return img ? (
                <img src={img} alt="" class="absolute inset-0 w-full h-full object-cover opacity-40" />
              ) : (
                <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5"></div>
              );
            })()}
            <div class="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/60 to-bg-dark/30"></div>

            <div class="relative z-10 p-6 flex flex-col min-h-[320px] justify-between">
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
      ) : null)}

      {/* Exercise List — only when not showing inline completion */}
      {!isProgramMode && !showInlineCompletion && plan && (
        <div class="px-5 pb-40">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-white">Exercises</h3>
            <span class="text-xs text-primary font-medium">{plan.exercises.length} Moves</span>
          </div>
          <ExerciseList exercises={plan.exercises} onEditExercise={onUpdatePlan ? setEditingExercise : undefined} />
        </div>
      )}

      {/* Discover Workouts Card — only when not showing inline completion (it's included in CompletedWorkoutInline) */}
      {!isProgramMode && !showInlineCompletion && <DiscoverCard />}

      {/* Exercise Edit Modal */}
      {editingExercise && (
        <EditExerciseModal
          exercise={editingExercise}
          onSave={handleSaveExercise}
          onRemove={handleRemoveExercise}
          onClose={() => setEditingExercise(null)}
        />
      )}



      {/* Completed workout detail modal — opens from collapsed card */}
      {showCompletedModal && todaySession && (
        <CompletedWorkoutModal
          session={todaySession}
          onClose={() => setShowCompletedModal(false)}
        />
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
      {/* Start Workout button portaled above the nav island */}
      {isProgramMode && !programLoading && !generatingProgram && program && todayProgramDay && !todayProgramDay.isRest && todayProgramDay.plan && (
        <NavSlot>
          <button
            onClick={() => onStartProgramWorkout?.(todayProgramDay.plan!)}
            class="w-full nav-island bg-primary/20 h-12 flex items-center justify-center gap-2 active:scale-[0.98] transition-all font-bold text-base tracking-wide text-primary"
          >
            <Icon name="play_arrow" class="text-xl" />
            START WORKOUT
          </button>
        </NavSlot>
      )}
      {!isProgramMode && !showInlineCompletion && plan && (
        <NavSlot>
          <button
            onClick={onStartWorkout}
            class="w-full nav-island bg-primary/20 h-12 flex items-center justify-center gap-2 active:scale-[0.98] transition-all font-bold text-base tracking-wide text-primary"
          >
            <Icon name="play_arrow" class="text-xl" />
            START WORKOUT
          </button>
        </NavSlot>
      )}
    </main>
  );
}
