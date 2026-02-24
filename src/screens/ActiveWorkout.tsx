import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { WorkoutPlan, WorkoutSession, ExerciseLog, Exercise } from '../types';
import { uuid } from '../utils';
import { groupExercises, groupLabel } from '../group-utils';
import type { ExerciseGroup } from '../group-utils';

interface ActiveWorkoutProps {
  plan: WorkoutPlan;
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
}

function isTimeBased(reps: string): boolean {
  return /\d+\s*s($|\s|\/)/i.test(reps) || /\d+\s*min/i.test(reps) || /\d+\s*sec/i.test(reps);
}

function parseTimeSeconds(reps: string): number {
  const minMatch = reps.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1]) * 60;
  const secMatch = reps.match(/(\d+)\s*s/i);
  if (secMatch) return parseInt(secMatch[1]);
  return 60;
}

interface ExerciseTimerState {
  logIdx: number;
  setIdx: number;
  seconds: number;
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

export function ActiveWorkout({ plan, onComplete, onCancel }: ActiveWorkoutProps) {
  const groups = useMemo(() => groupExercises(plan.exercises), [plan.exercises]);

  // Map each exercise ID to its flat index in exerciseLogs
  const exIdToLogIdx = useMemo(() => {
    const map = new Map<string, number>();
    plan.exercises.forEach((ex, i) => map.set(ex.id, i));
    return map;
  }, [plan.exercises]);

  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);
  const [activeExInGroup, setActiveExInGroup] = useState(0);
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
  const [exTimer, setExTimer] = useState<ExerciseTimerState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const restRef = useRef<ReturnType<typeof setInterval>>();
  const exTimerRef = useRef<ReturnType<typeof setInterval>>();
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

  // Exercise timer (for time-based exercises)
  useEffect(() => {
    if (exTimer?.running) {
      exTimerRef.current = setInterval(() => {
        setExTimer((prev) => {
          if (!prev || !prev.running) return prev;
          if (prev.mode === 'countdown') {
            if (prev.seconds <= 1) {
              clearInterval(exTimerRef.current);
              // Auto-complete the set
              completeTimedSet(prev.logIdx, prev.setIdx, parseTimeSeconds(plan.exercises[prev.logIdx].reps));
              return null;
            }
            return { ...prev, seconds: prev.seconds - 1 };
          } else {
            return { ...prev, seconds: prev.seconds + 1 };
          }
        });
      }, 1000);
      return () => clearInterval(exTimerRef.current);
    }
  }, [exTimer?.running, exTimer?.logIdx, exTimer?.setIdx]);

  const completeTimedSet = useCallback((logIdx: number, setIdx: number, timeSeconds: number) => {
    const exercise = plan.exercises[logIdx];
    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[logIdx] };
      const sets = [...log.sets];
      sets[setIdx] = { ...sets[setIdx], completed: true, reps: timeSeconds, weight: null };
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
      } else {
        setActiveExInGroup((i) => i + 1);
      }
    } else {
      setRestTimer(exercise.restSeconds || 60);
    }
  }, [plan.exercises]);

  const startExTimer = useCallback((logIdx: number, setIdx: number, mode: 'countdown' | 'countup') => {
    const exercise = plan.exercises[logIdx];
    const targetSec = parseTimeSeconds(exercise.reps);
    setExTimer({
      logIdx,
      setIdx,
      seconds: mode === 'countdown' ? targetSec : 0,
      running: true,
      mode,
    });
  }, [plan.exercises]);

  const stopExTimer = useCallback(() => {
    if (!exTimer) return;
    const elapsed = exTimer.mode === 'countup' ? exTimer.seconds : parseTimeSeconds(plan.exercises[exTimer.logIdx].reps) - exTimer.seconds;
    completeTimedSet(exTimer.logIdx, exTimer.setIdx, elapsed);
  }, [exTimer, plan.exercises, completeTimedSet]);

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

  const toggleSetComplete = useCallback((logIdx: number, setIdx: number) => {
    const exercise = plan.exercises[logIdx];

    setExerciseLogs((prev) => {
      const updated = [...prev];
      const log = { ...updated[logIdx] };
      const sets = [...log.sets];
      const set = { ...sets[setIdx] };
      set.completed = !set.completed;
      // Auto-fill from placeholder/previous values when completing
      if (set.completed) {
        if (set.weight === null && exercise.weight) {
          set.weight = exercise.weight;
        }
        if (set.reps === null) {
          const numericReps = parseInt(exercise.reps.replace(/[^0-9]/g, ''));
          if (!isNaN(numericReps)) set.reps = numericReps;
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
        setActiveExInGroup(0); // wrap back to first exercise for next round
      } else {
        // Advance to next exercise in group (no rest)
        setActiveExInGroup((i) => i + 1);
      }
    } else {
      const restSec = exercise.restSeconds || 60;
      setRestTimer(restSec);
    }
  }, [isMultiExGroup, activeExInGroup, currentGroup, plan.exercises]);

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

  const nextGroup = () => {
    if (currentGroupIdx < groups.length - 1) {
      setCurrentGroupIdx((i) => i + 1);
      setActiveExInGroup(0);
      setRestTimer(null);
    }
  };

  const prevGroup = () => {
    if (currentGroupIdx > 0) {
      setCurrentGroupIdx((i) => i - 1);
      setActiveExInGroup(0);
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
      id: uuid(),
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

  const isLastGroup = currentGroupIdx === groups.length - 1;

  // Render set grid for a single exercise
  const renderSetGrid = (exercise: typeof plan.exercises[0], logIdx: number, isHighlighted: boolean) => {
    const log = exerciseLogs[logIdx];
    const timed = isTimeBased(exercise.reps);
    const targetSeconds = timed ? parseTimeSeconds(exercise.reps) : 0;

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
              <div class="col-span-2 text-left">Set</div>
              <div class="col-span-3">Target</div>
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
                    <div class="col-span-2 text-left font-bold text-lg pl-2">{set.setNumber}</div>
                    <div class="col-span-3 text-center text-xs text-slate-500 font-medium">
                      {exercise.reps}
                    </div>
                    <div class="col-span-5 flex items-center justify-center gap-2">
                      {set.completed ? (
                        <span class="text-sm font-bold text-primary">{formatTime(set.reps || targetSeconds)}</span>
                      ) : isTimerForThis ? (
                        <div class="flex items-center gap-2">
                          <span class={`text-lg font-bold tabular-nums ${isTimerActive ? 'text-primary' : 'text-white'}`}>
                            {formatTime(exTimer!.seconds)}
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
                            // Manual complete for timed exercises
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
              <div class="col-span-3">lbs</div>
              <div class="col-span-2">Reps</div>
              <div class="col-span-2 text-right">Done</div>
            </div>

            {log.sets.map((set, idx) => {
              const isActive = !set.completed && (idx === 0 || log.sets[idx - 1]?.completed);
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
                      <input
                        type="number"
                        value={set.weight ?? ''}
                        placeholder={exercise.weight?.toString() || '-'}
                        onInput={(e) => updateSet(logIdx, idx, 'weight', (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : null)}
                        class="w-full bg-bg-dark border-none rounded text-center font-bold text-white focus:ring-1 focus:ring-primary p-2 text-sm"
                      />
                    </div>
                    <div class="col-span-2">
                      <input
                        type="number"
                        value={set.reps ?? ''}
                        placeholder={exercise.reps.replace(/[^0-9]/g, '') || '-'}
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

        {/* Add Set */}
        <button
          onClick={() => addSet(logIdx)}
          class="mt-2 py-3 w-full rounded-lg border border-dashed border-slate-600 text-sm font-medium text-slate-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
        >
          <Icon name="add" class="text-lg" />
          Add Set
        </button>
      </div>
    );
  };

  // Get primary tip from the first exercise in the group
  const primaryExercise = currentGroup.exercises[isMultiExGroup ? activeExInGroup : 0];
  const tip = AI_TIPS[primaryExercise.muscleGroup] || AI_TIPS['Full Body'];

  return (
    <div class="flex flex-col h-full bg-bg-dark">
      {/* Header */}
      <header class="sticky top-0 z-50 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 pt-safe">
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
          <span>{completedGroups}/{groups.length} {isMultiExGroup ? 'Groups' : 'Exercises'}</span>
        </div>
      </header>

      {/* Main scrollable */}
      <main class="flex-1 overflow-y-auto min-h-0 p-4 pb-4 space-y-4">
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
                <div key={ex.id}>
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
      <div class="shrink-0 bg-bg-dark border-t border-white/5 p-4 pb-safe z-40">
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
            class="flex flex-col items-center justify-center h-14 w-20 rounded-xl bg-surface-dark text-slate-200 font-bold hover:bg-slate-800 transition-colors"
          >
            <Icon name="timer" class="text-xl" />
            <span class="text-[10px] uppercase font-bold tracking-wide mt-0.5">Rest</span>
          </button>
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
