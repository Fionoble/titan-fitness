import { useState, useEffect } from 'preact/hooks';
import { Icon } from './Icon';
import type { ActiveWorkoutState } from '../types';

interface WorkoutBannerProps {
  activeWorkout: ActiveWorkoutState;
  onResume: () => void;
  onEnd: () => void;
}

export function WorkoutBanner({ activeWorkout, onResume, onEnd }: WorkoutBannerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const startTime = new Date(activeWorkout.startedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout.startedAt]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const completedSets = activeWorkout.exerciseLogs.reduce(
    (sum, log) => sum + log.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = activeWorkout.exerciseLogs.reduce(
    (sum, log) => sum + log.sets.length,
    0
  );

  return (
    <>
      <button
        onClick={onResume}
        class="fixed bottom-[calc(70px+var(--pwa-bottom-nudge,0px))] left-0 right-0 z-40 flex justify-center"
      >
        <div class="max-w-[430px] w-full px-4">
          <div class="bg-primary/95 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform">
            {/* Pulsing dot */}
            <div class="relative w-3 h-3 shrink-0">
              <div class="absolute inset-0 bg-bg-dark rounded-full animate-ping opacity-40"></div>
              <div class="absolute inset-0 bg-bg-dark rounded-full"></div>
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-bg-dark truncate">{activeWorkout.plan.name}</p>
              <p class="text-xs text-bg-dark/70 font-medium">
                {completedSets}/{totalSets} sets · {formatTime(elapsed)}
              </p>
            </div>

            <span class="text-xs font-bold text-bg-dark uppercase tracking-wider bg-bg-dark/15 px-2 py-1 rounded-lg">
              Resume
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirm(true);
              }}
              class="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-dark/15 hover:bg-bg-dark/25 transition-colors shrink-0"
            >
              <Icon name="close" class="text-bg-dark text-lg" />
            </button>
          </div>
        </div>
      </button>

      {/* End Workout Confirmation */}
      {showConfirm && (
        <div class="fixed inset-0 z-[200] flex items-center justify-center">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)}></div>
          <div class="relative bg-surface-dark rounded-2xl p-6 max-w-[320px] w-full mx-4 border border-white/10 shadow-2xl">
            <div class="text-center mb-5">
              <div class="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
                <Icon name="warning" class="text-red-400 text-3xl" />
              </div>
              <h3 class="text-lg font-bold text-white mb-1">End Workout?</h3>
              <p class="text-sm text-slate-400">
                Your progress for this session will not be saved.
              </p>
            </div>
            <div class="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                class="flex-1 py-3 rounded-xl bg-surface-darker text-slate-300 font-semibold text-sm"
              >
                Keep Going
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  onEnd();
                }}
                class="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm"
              >
                End
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
