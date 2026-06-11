import { Icon } from './Icon';
import type { ExerciseLog } from '../types';
import { BAND_COLOR_MAP } from '../bands';

export function ExerciseBreakdown({ exercises }: { exercises: ExerciseLog[] }) {
  const items: { exercises: ExerciseLog[]; groupId: string | null }[] = [];
  let i = 0;
  while (i < exercises.length) {
    const ex = exercises[i];
    if (ex.group) {
      const grouped = [ex];
      let j = i + 1;
      while (j < exercises.length && exercises[j].group === ex.group) {
        grouped.push(exercises[j]);
        j++;
      }
      items.push({ exercises: grouped, groupId: ex.group });
      i = j;
    } else {
      items.push({ exercises: [ex], groupId: null });
      i++;
    }
  }

  return (
    <div class="divide-y divide-white/5">
      {items.map((item) => {
        if (item.groupId && item.exercises.length > 1) {
          return (
            <div key={item.exercises[0].exerciseId}>
              <div class="flex items-center gap-2 px-4 pt-3 pb-1">
                <Icon name="link" class="text-primary text-sm" />
                <span class="text-[11px] font-bold text-primary uppercase tracking-wider">Superset</span>
              </div>
              <div class="border-l-2 border-primary/30 ml-4">
                {item.exercises.map((ex) => <ExerciseRow key={ex.exerciseId} ex={ex} />)}
              </div>
            </div>
          );
        }
        return <ExerciseRow key={item.exercises[0].exerciseId} ex={item.exercises[0]} />;
      })}
    </div>
  );
}

function ExerciseRow({ ex }: { ex: ExerciseLog }) {
  const completed = ex.sets.filter(s => s.completed);
  const bestSet = completed.length > 0
    ? completed.reduce((best, s) => (s.weight || 0) > (best.weight || 0) ? s : best, completed[0])
    : null;
  // Band exercises have no weight — surface the last band used instead
  const bestBand = !bestSet?.weight
    ? [...completed].reverse().find(s => s.bandColor)
    : null;

  return (
    <div class="flex items-center justify-between px-4 py-3">
      <div class="flex-1 min-w-0">
        <p class="text-sm text-white truncate">{ex.exerciseName}</p>
        <p class="text-xs text-slate-500">{ex.muscleGroup}</p>
      </div>
      <div class="text-right shrink-0 ml-3">
        <p class="text-sm text-slate-300">{completed.length}/{ex.sets.length} sets</p>
        {bestSet?.weight ? (
          <p class="text-xs text-primary">{bestSet.weight} lbs x {bestSet.reps}</p>
        ) : bestBand?.bandColor ? (
          <p class="text-xs text-primary flex items-center justify-end gap-1">
            <span
              class="w-2 h-2 rounded-full inline-block border border-white/20"
              style={{ backgroundColor: BAND_COLOR_MAP[bestBand.bandColor] || '#64748b' }}
            ></span>
            {bestBand.bandColor} band x {bestBand.reps}
          </p>
        ) : null}
      </div>
    </div>
  );
}
