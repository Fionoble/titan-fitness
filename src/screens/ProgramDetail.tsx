import { useState, useMemo } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Icon } from '../components/Icon';
import type { WorkoutProgram, ProgramDay, Exercise, WorkoutPlan } from '../types';
import { groupExercises, groupLabel } from '../group-utils';
import { withBase } from '../base';

interface ProgramDetailProps {
  program: WorkoutProgram | null;
  currentDay: number;
  onStartWorkout?: (plan: WorkoutPlan) => void;
  onClearProgram?: () => void;
}

const STYLE_COLORS: Record<string, string> = {
  strength: '#2bee79',
  hypertrophy: '#2bee79',
  functional: '#60a5fa',
  hiit: '#f97316',
  cardio: '#ef4444',
  recovery: '#a78bfa',
  mobility: '#2dd4bf',
  power: '#eab308',
  endurance: '#ec4899',
};

function DayCard({ day, isCurrent, isExpanded, onToggle, onStart }: {
  day: ProgramDay;
  isCurrent: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onStart?: () => void;
}) {
  const plan = day.plan;
  const styleColor = plan ? STYLE_COLORS[plan.style] || '#2bee79' : '#a78bfa';

  return (
    <div class={`rounded-2xl border transition-all ${
      isCurrent
        ? 'border-primary/40 bg-primary/5'
        : 'border-white/5 bg-surface-dark'
    }`}>
      {/* Day header — always visible */}
      <button
        onClick={onToggle}
        class="w-full p-4 flex items-center gap-3 text-left"
      >
        {/* Day number badge */}
        <div
          class={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
            isCurrent
              ? 'bg-primary text-bg-dark'
              : day.isRest
              ? 'bg-white/5 text-slate-500'
              : 'bg-surface-darker text-slate-300'
          }`}
        >
          {day.dayNumber}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class={`font-semibold truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>
              {day.label}
            </h3>
            {isCurrent && (
              <span class="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded shrink-0">
                Today
              </span>
            )}
          </div>
          {plan && (
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs" style={{ color: styleColor }}>
                {plan.style.charAt(0).toUpperCase() + plan.style.slice(1)}
              </span>
              <span class="text-slate-600 text-xs">·</span>
              <span class="text-xs text-slate-400">{plan.focus}</span>
              <span class="text-slate-600 text-xs">·</span>
              <span class="text-xs text-slate-400">{plan.exercises.length} exercises</span>
            </div>
          )}
          {day.isRest && (
            <span class="text-xs text-slate-500">Rest & Recovery</span>
          )}
        </div>

        <Icon
          name={isExpanded ? 'expand_less' : 'expand_more'}
          class="text-slate-500 text-xl shrink-0"
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div class="px-4 pb-4">
          {day.isRest ? (
            <RestDayContent />
          ) : plan ? (
            <DayWorkoutContent plan={plan} isCurrent={isCurrent} onStart={onStart} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function RestDayContent() {
  const tips = [
    { icon: 'self_improvement', text: 'Light stretching or yoga' },
    { icon: 'water_drop', text: 'Stay hydrated' },
    { icon: 'bedtime', text: 'Prioritize sleep' },
    { icon: 'directions_walk', text: 'Go for a light walk' },
  ];

  return (
    <div class="border-t border-white/5 pt-3">
      <p class="text-sm text-slate-400 mb-3">Recovery suggestions:</p>
      <div class="grid grid-cols-2 gap-2">
        {tips.map((tip) => (
          <div key={tip.text} class="flex items-center gap-2 bg-surface-darker rounded-lg p-2.5">
            <Icon name={tip.icon} class="text-purple-400 text-base shrink-0" />
            <span class="text-xs text-slate-300">{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayWorkoutContent({ plan, isCurrent, onStart }: {
  plan: WorkoutPlan;
  isCurrent: boolean;
  onStart?: () => void;
}) {
  const groups = useMemo(() => groupExercises(plan.exercises), [plan.exercises]);
  let counter = 0;

  return (
    <div class="border-t border-white/5 pt-3 space-y-3">
      {/* Stats row */}
      <div class="flex items-center gap-4 text-xs text-slate-400">
        <span class="flex items-center gap-1">
          <Icon name="schedule" class="text-primary text-sm" />
          {plan.durationMin} min
        </span>
        <span class="flex items-center gap-1">
          <Icon name="local_fire_department" class="text-primary text-sm" />
          {plan.estimatedCalories} cal
        </span>
        {plan.equipmentUsed.length > 0 && (
          <span class="flex items-center gap-1">
            <Icon name="fitness_center" class="text-primary text-sm" />
            {plan.equipmentUsed.length} gear
          </span>
        )}
        <span class="flex items-center gap-1">
          {Array.from({ length: 3 }, (_, i) => (
            <Icon
              key={i}
              name="bolt"
              class={`text-sm ${i < plan.intensity ? 'text-primary' : 'text-slate-700'}`}
            />
          ))}
        </span>
      </div>

      {/* Equipment pills */}
      {plan.equipmentUsed.length > 0 && (
        <div class="flex flex-wrap gap-1.5">
          {plan.equipmentUsed.map((eq) => (
            <span key={eq} class="text-[10px] bg-surface-darker text-slate-400 px-2 py-1 rounded-full border border-white/5">
              {eq}
            </span>
          ))}
        </div>
      )}

      {/* Exercise list */}
      <div class="space-y-2">
        {groups.map((group) => {
          if (group.type === 'standalone') {
            counter++;
            const ex = group.exercises[0];
            return <CompactExerciseRow key={group.groupId} ex={ex} num={counter} />;
          }

          const badge = group.groupId;
          return (
            <div key={group.groupId}>
              <div class="flex items-center gap-1.5 mb-1">
                <Icon name="link" class="text-primary text-xs" />
                <span class="text-[10px] font-bold text-primary uppercase tracking-wider">{groupLabel(group.type)}</span>
              </div>
              <div class="border-l-2 border-primary/30 pl-2.5 space-y-1.5">
                {group.exercises.map((ex) => {
                  counter++;
                  return <CompactExerciseRow key={ex.id} ex={ex} num={counter} badge={badge} />;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Start button for current day */}
      {isCurrent && onStart && (
        <button
          onClick={onStart}
          class="w-full py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all mt-2"
        >
          <Icon name="play_arrow" class="text-lg" />
          Start This Workout
        </button>
      )}
    </div>
  );
}

function CompactExerciseRow({ ex, num, badge }: { ex: Exercise; num: number; badge?: string }) {
  return (
    <div class="flex items-center gap-3 bg-surface-darker/60 rounded-lg p-2.5">
      <span class="w-6 h-6 rounded-md bg-surface-dark flex items-center justify-center text-xs font-bold text-primary/50 shrink-0">
        {badge || num}
      </span>
      <div class="flex-1 min-w-0">
        <span class="text-sm text-white truncate block">{ex.name}</span>
        <span class="text-xs text-slate-500">{ex.muscleGroup}</span>
      </div>
      <div class="text-right shrink-0">
        <span class="text-xs text-slate-300">{ex.sets}×{ex.reps}</span>
        {ex.weight && (
          <span class="text-[10px] text-slate-500 block">{ex.weight} lbs</span>
        )}
      </div>
    </div>
  );
}

export function ProgramDetail({ program, currentDay, onStartWorkout, onClearProgram }: ProgramDetailProps) {
  const { route } = useLocation();
  const [expandedDay, setExpandedDay] = useState<number>(currentDay);

  if (!program) {
    return (
      <div class="h-full flex items-center justify-center p-5">
        <div class="text-center">
          <Icon name="event_note" class="text-4xl text-slate-600 mb-3" />
          <p class="text-slate-400">No active program</p>
          <button
            onClick={() => route(withBase('/'))}
            class="mt-4 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Compute summary stats
  const workoutDays = program.days.filter((d) => !d.isRest);
  const restDays = program.days.filter((d) => d.isRest);
  const totalExercises = workoutDays.reduce((sum, d) => sum + (d.plan?.exercises.length || 0), 0);
  const avgDuration = workoutDays.length > 0
    ? Math.round(workoutDays.reduce((sum, d) => sum + (d.plan?.durationMin || 0), 0) / workoutDays.length)
    : 0;

  // Days remaining
  const expiresAt = new Date(program.expiresAt);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div class="pb-24 overflow-y-auto">
      {/* Header */}
      <div class="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-md border-b border-white/5">
        <div class="max-w-[430px] mx-auto flex items-center gap-3 px-5 py-3">
          <button
            onClick={() => route(withBase('/'))}
            class="w-9 h-9 rounded-xl bg-surface-dark flex items-center justify-center hover:bg-surface-darker transition-colors"
          >
            <Icon name="arrow_back" class="text-white text-lg" />
          </button>
          <div class="flex-1 min-w-0">
            <h1 class="text-lg font-bold text-white truncate">{program.name}</h1>
            <p class="text-xs text-slate-400">{daysRemaining} days remaining</p>
          </div>
          {onClearProgram && (
            <button
              onClick={() => {
                onClearProgram();
                route(withBase('/'));
              }}
              class="text-xs text-red-400/70 hover:text-red-400 transition-colors px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div class="max-w-[430px] mx-auto">
        {/* Program overview card */}
        <div class="px-5 pt-5 pb-3">
          <div class="bg-surface-dark rounded-2xl p-4 border border-white/5">
            {/* Week progress dots */}
            <div class="flex items-center justify-between mb-4">
              {program.days.map((day) => {
                const isCurrent = day.dayNumber === currentDay;
                const isPast = day.dayNumber < currentDay;
                return (
                  <button
                    key={day.dayNumber}
                    onClick={() => setExpandedDay(day.dayNumber === expandedDay ? -1 : day.dayNumber)}
                    class={`flex flex-col items-center gap-1 transition-all ${isCurrent ? 'scale-110' : ''}`}
                  >
                    <div class={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-primary text-bg-dark ring-2 ring-primary/30'
                        : isPast
                        ? 'bg-primary/20 text-primary'
                        : day.isRest
                        ? 'bg-white/5 text-slate-600'
                        : 'bg-surface-darker text-slate-400'
                    }`}>
                      {day.isRest ? 'R' : day.dayNumber}
                    </div>
                    <span class={`text-[9px] leading-tight ${
                      isCurrent ? 'text-primary font-bold' : 'text-slate-600'
                    }`}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day.dayNumber - 1] || `D${day.dayNumber}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Stats */}
            <div class="grid grid-cols-4 gap-2">
              <div class="text-center">
                <p class="text-lg font-bold text-white">{workoutDays.length}</p>
                <p class="text-[10px] text-slate-500 uppercase tracking-wider">Workouts</p>
              </div>
              <div class="text-center">
                <p class="text-lg font-bold text-white">{restDays.length}</p>
                <p class="text-[10px] text-slate-500 uppercase tracking-wider">Rest</p>
              </div>
              <div class="text-center">
                <p class="text-lg font-bold text-white">{totalExercises}</p>
                <p class="text-[10px] text-slate-500 uppercase tracking-wider">Exercises</p>
              </div>
              <div class="text-center">
                <p class="text-lg font-bold text-white">{avgDuration}m</p>
                <p class="text-[10px] text-slate-500 uppercase tracking-wider">Avg Time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Day list */}
        <div class="px-5 space-y-3 pb-5">
          {program.days.map((day) => (
            <DayCard
              key={day.dayNumber}
              day={day}
              isCurrent={day.dayNumber === currentDay}
              isExpanded={day.dayNumber === expandedDay}
              onToggle={() => setExpandedDay(day.dayNumber === expandedDay ? -1 : day.dayNumber)}
              onStart={
                day.dayNumber === currentDay && !day.isRest && day.plan && onStartWorkout
                  ? () => onStartWorkout(day.plan!)
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
