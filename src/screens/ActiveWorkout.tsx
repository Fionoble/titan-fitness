import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { WorkoutPlan, WorkoutSession, ExerciseLog, SetLog } from '../types';

interface ActiveWorkoutProps {
  plan: WorkoutPlan;
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
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

export function ActiveWorkout({ plan, onComplete, onCancel }: ActiveWorkoutProps) {
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>(() =>
    plan.exercises.map((ex) => ({
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        weight: ex.weight || null,
        reps: null,
        completed: false,
      })),
    }))
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const restRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef(new Date().toISOString());

  // Main timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Rest timer
  useEffect(() => {
    if (restTimer !== null && restTimer > 0) {
      restRef.current = setInterval(() => {
        setRestTimer((r) => {
          if (r !== null && r <= 1) {
            clearInterval(restRef.current);
            return null;
          }
          return r !== null ? r - 1 : null;
        });
      }, 1000);
      return () => clearInterval(restRef.current);
    }
  }, [restTimer]);

  const currentExercise = plan.exercises[currentExIdx];
  const currentLog = exerciseLogs[currentExIdx];
  const completedExercises = exerciseLogs.filter((log) => log.sets.every((s) => s.completed)).length;
  const progress = ((completedExercises + (currentLog.sets.filter((s) => s.completed).length / currentLog.sets.length)) / plan.exercises.length) * 100;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const updateSet = useCallback((setIdx: number, field: 'weight' | 'reps', value: number | null) => {
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[currentExIdx] };
      const sets = [...log.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      log.sets = sets;
      updated[currentExIdx] = log;
      return updated;
    });
  }, [currentExIdx]);

  const toggleSetComplete = useCallback((setIdx: number) => {
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[currentExIdx] };
      const sets = [...log.sets];
      const set = { ...sets[setIdx] };
      set.completed = !set.completed;
      // Auto-fill from placeholder/previous values when completing
      if (set.completed) {
        if (set.weight === null && currentExercise.weight) {
          set.weight = currentExercise.weight;
        }
        if (set.reps === null) {
          const numericReps = parseInt(currentExercise.reps.replace(/[^0-9]/g, ''));
          if (!isNaN(numericReps)) set.reps = numericReps;
        }
      }
      sets[setIdx] = set;
      log.sets = sets;
      updated[currentExIdx] = log;
      return updated;
    });
    // Start rest timer on completing a set
    const restSec = currentExercise.restSeconds || 60;
    setRestTimer(restSec);
  }, [currentExIdx, currentExercise]);

  const addSet = useCallback(() => {
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[currentExIdx] };
      log.sets = [
        ...log.sets,
        { setNumber: log.sets.length + 1, weight: null, reps: null, completed: false },
      ];
      updated[currentExIdx] = log;
      return updated;
    });
  }, [currentExIdx]);

  const nextExercise = () => {
    if (currentExIdx < plan.exercises.length - 1) {
      setCurrentExIdx((i) => i + 1);
      setRestTimer(null);
    }
  };

  const prevExercise = () => {
    if (currentExIdx > 0) {
      setCurrentExIdx((i) => i - 1);
      setRestTimer(null);
    }
  };

  const finishWorkout = () => {
    let totalVolume = 0;
    let totalSets = 0;
    let prs = 0;

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
      id: crypto.randomUUID(),
      planId: plan.id,
      name: plan.name,
      style: plan.style,
      startedAt: startTimeRef.current,
      completedAt: new Date().toISOString(),
      durationSeconds: elapsedSeconds,
      exercises: exerciseLogs,
      totalVolume,
      totalSets,
      personalRecords: prs,
    };

    onComplete(session);
  };

  const tip = AI_TIPS[currentExercise.muscleGroup] || AI_TIPS['Full Body'];
  const isLastExercise = currentExIdx === plan.exercises.length - 1;

  return (
    <div class="flex flex-col h-full bg-bg-dark">
      {/* Header */}
      <header class="sticky top-0 z-50 bg-bg-dark/95 backdrop-blur-md border-b border-white/5">
        <div class="flex items-center justify-between px-4 py-3">
          <button onClick={onCancel} class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-dark transition-colors">
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
        {/* Progress bar */}
        <div class="w-full h-1 bg-surface-dark">
          <div class="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
        <div class="px-4 py-1 flex justify-between text-[10px] uppercase font-bold tracking-wider text-slate-500">
          <span>Progress</span>
          <span>{completedExercises}/{plan.exercises.length} Exercises</span>
        </div>
      </header>

      {/* Main scrollable */}
      <main class="flex-1 overflow-y-auto p-4 pb-32 space-y-4">
        {/* Exercise display */}
        <div class="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-surface-dark">
          <div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center">
            <div class="text-center">
              <Icon name="fitness_center" class="text-5xl text-primary/40 mb-2" />
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-12 pb-4 px-4">
            <h1 class="text-2xl font-bold text-white leading-tight">{currentExercise.name}</h1>
            <p class="text-slate-300 text-sm font-medium">{currentExercise.muscleGroup} Focus</p>
          </div>
          {/* Exercise navigation dots */}
          <div class="absolute top-3 right-3 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white font-medium">
            {currentExIdx + 1} / {plan.exercises.length}
          </div>
        </div>

        {/* AI Tip */}
        <div class="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Icon name="auto_awesome" class="text-primary mt-0.5 text-lg" />
          <div>
            <p class="text-sm font-semibold text-primary mb-0.5">AI Tip</p>
            <p class="text-xs text-slate-300 leading-relaxed">{tip}</p>
          </div>
        </div>

        {/* Set logging */}
        <div class="space-y-2">
          <div class="grid grid-cols-12 gap-2 px-2 pb-1 text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center">
            <div class="col-span-2 text-left">Set</div>
            <div class="col-span-3">Prev</div>
            <div class="col-span-3">lbs</div>
            <div class="col-span-2">Reps</div>
            <div class="col-span-2 text-right">Done</div>
          </div>

          {currentLog.sets.map((set, idx) => {
            const isActive = !set.completed && (idx === 0 || currentLog.sets[idx - 1]?.completed);
            return (
              <div
                key={idx}
                class={`relative rounded-lg overflow-hidden transition-all ${
                  set.completed
                    ? 'bg-surface-dark border border-white/5'
                    : isActive
                    ? 'bg-surface-dark border-2 border-primary/50 shadow-md'
                    : 'bg-surface-dark border border-white/5 opacity-60'
                }`}
              >
                {set.completed && <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                <div class="grid grid-cols-12 gap-2 p-3 items-center">
                  <div class="col-span-2 text-left font-bold text-lg pl-2">{set.setNumber}</div>
                  <div class="col-span-3 text-center text-xs text-slate-500 font-medium">
                    {currentExercise.weight ? `${currentExercise.weight} × ${currentExercise.reps}` : '—'}
                  </div>
                  <div class="col-span-3">
                    <input
                      type="number"
                      value={set.weight ?? ''}
                      placeholder={currentExercise.weight?.toString() || '-'}
                      onInput={(e) => updateSet(idx, 'weight', (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : null)}
                      class="w-full bg-bg-dark border-none rounded text-center font-bold text-white focus:ring-1 focus:ring-primary p-2 text-sm"
                    />
                  </div>
                  <div class="col-span-2">
                    <input
                      type="number"
                      value={set.reps ?? ''}
                      placeholder={currentExercise.reps.replace(/[^0-9]/g, '') || '-'}
                      onInput={(e) => updateSet(idx, 'reps', (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : null)}
                      class="w-full bg-bg-dark border-none rounded text-center font-bold text-white focus:ring-1 focus:ring-primary p-2 text-sm"
                    />
                  </div>
                  <div class="col-span-2 flex justify-end">
                    <button
                      onClick={() => toggleSetComplete(idx)}
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

          {/* Add Set */}
          <button
            onClick={addSet}
            class="mt-2 py-3 w-full rounded-lg border border-dashed border-slate-600 text-sm font-medium text-slate-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="add" class="text-lg" />
            Add Set
          </button>
        </div>
      </main>

      {/* Rest timer overlay */}
      {restTimer !== null && (
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-bg-dark/90 backdrop-blur-lg rounded-2xl p-8 text-center border border-primary/20 shadow-2xl">
          <p class="text-slate-400 text-sm uppercase tracking-wider mb-2">Rest Timer</p>
          <p class="text-5xl font-bold text-primary mb-4">{formatTime(restTimer)}</p>
          <button
            onClick={() => setRestTimer(null)}
            class="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Skip Rest
          </button>
        </div>
      )}

      {/* Bottom actions */}
      <div class="fixed bottom-0 left-0 w-full bg-bg-dark border-t border-white/5 p-4 pb-safe z-40 max-w-[430px] mx-auto" style="left: 50%; transform: translateX(-50%);">
        <div class="flex gap-3">
          {currentExIdx > 0 && (
            <button
              onClick={prevExercise}
              class="flex items-center justify-center h-14 w-14 rounded-xl bg-surface-dark text-slate-200 font-bold hover:bg-slate-800 transition-colors"
            >
              <Icon name="arrow_back" class="text-xl" />
            </button>
          )}
          <button
            onClick={() => setRestTimer(currentExercise.restSeconds || 60)}
            class="flex flex-col items-center justify-center h-14 w-20 rounded-xl bg-surface-dark text-slate-200 font-bold hover:bg-slate-800 transition-colors"
          >
            <Icon name="timer" class="text-xl" />
            <span class="text-[10px] uppercase font-bold tracking-wide mt-0.5">Rest</span>
          </button>
          <button
            onClick={isLastExercise ? finishWorkout : nextExercise}
            class="flex-1 h-14 rounded-xl bg-primary text-bg-dark text-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <span>{isLastExercise ? 'Finish Workout' : 'Next Exercise'}</span>
            <Icon name={isLastExercise ? 'check' : 'arrow_forward'} class="font-bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
