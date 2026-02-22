import type { Equipment, WorkoutPlan, Exercise, WorkoutStyle, WorkoutSession } from './types';
import { uuid } from './utils';

// Exercise database organized by muscle group and equipment
const EXERCISE_DB: Record<string, { name: string; muscleGroup: string; equipment: string[]; defaultSets: number; defaultReps: string }[]> = {
  dumbbells: [
    { name: 'Dumbbell Bench Press', muscleGroup: 'Chest', equipment: ['dumbbells', 'bench'], defaultSets: 3, defaultReps: '10-12' },
    { name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '10' },
    { name: 'Dumbbell Row', muscleGroup: 'Back', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '12' },
    { name: 'Dumbbell Curl', muscleGroup: 'Biceps', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '12' },
    { name: 'Dumbbell Lateral Raise', muscleGroup: 'Shoulders', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '15' },
    { name: 'Dumbbell Tricep Extension', muscleGroup: 'Triceps', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '12' },
    { name: 'Dumbbell Goblet Squat', muscleGroup: 'Quads', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '12' },
    { name: 'Dumbbell Lunges', muscleGroup: 'Legs', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '10 each' },
    { name: 'Dumbbell Romanian Deadlift', muscleGroup: 'Hamstrings', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '10' },
    { name: 'Dumbbell Fly', muscleGroup: 'Chest', equipment: ['dumbbells', 'bench'], defaultSets: 3, defaultReps: '12' },
    { name: 'Dumbbell Pullover', muscleGroup: 'Chest', equipment: ['dumbbells', 'bench'], defaultSets: 3, defaultReps: '12' },
    { name: 'Dumbbell Shrug', muscleGroup: 'Traps', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '15' },
    { name: 'Dumbbell Front Raise', muscleGroup: 'Shoulders', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '12' },
    { name: 'Dumbbell Hammer Curl', muscleGroup: 'Biceps', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '12' },
  ],
  barbell: [
    { name: 'Barbell Squat', muscleGroup: 'Quads', equipment: ['barbell'], defaultSets: 4, defaultReps: '8' },
    { name: 'Barbell Deadlift', muscleGroup: 'Back', equipment: ['barbell'], defaultSets: 4, defaultReps: '6' },
    { name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: ['barbell', 'bench'], defaultSets: 4, defaultReps: '8' },
    { name: 'Barbell Overhead Press', muscleGroup: 'Shoulders', equipment: ['barbell'], defaultSets: 3, defaultReps: '8' },
    { name: 'Barbell Row', muscleGroup: 'Back', equipment: ['barbell'], defaultSets: 4, defaultReps: '8' },
    { name: 'Barbell Curl', muscleGroup: 'Biceps', equipment: ['barbell'], defaultSets: 3, defaultReps: '10' },
    { name: 'Barbell Hip Thrust', muscleGroup: 'Glutes', equipment: ['barbell', 'bench'], defaultSets: 3, defaultReps: '12' },
    { name: 'Barbell Romanian Deadlift', muscleGroup: 'Hamstrings', equipment: ['barbell'], defaultSets: 3, defaultReps: '10' },
  ],
  kettlebells: [
    { name: 'Kettlebell Swing', muscleGroup: 'Full Body', equipment: ['kettlebells'], defaultSets: 4, defaultReps: '15' },
    { name: 'Kettlebell Goblet Squat', muscleGroup: 'Quads', equipment: ['kettlebells'], defaultSets: 3, defaultReps: '12' },
    { name: 'Kettlebell Turkish Get-Up', muscleGroup: 'Full Body', equipment: ['kettlebells'], defaultSets: 3, defaultReps: '5 each' },
    { name: 'Kettlebell Clean & Press', muscleGroup: 'Shoulders', equipment: ['kettlebells'], defaultSets: 3, defaultReps: '8 each' },
    { name: 'Kettlebell Snatch', muscleGroup: 'Full Body', equipment: ['kettlebells'], defaultSets: 3, defaultReps: '10 each' },
    { name: 'Kettlebell Row', muscleGroup: 'Back', equipment: ['kettlebells'], defaultSets: 3, defaultReps: '10 each' },
  ],
  bodyweight: [
    { name: 'Push-Ups', muscleGroup: 'Chest', equipment: [], defaultSets: 3, defaultReps: 'Failure' },
    { name: 'Diamond Push-Ups', muscleGroup: 'Triceps', equipment: [], defaultSets: 3, defaultReps: 'Failure' },
    { name: 'Decline Push-Ups', muscleGroup: 'Upper Chest', equipment: [], defaultSets: 3, defaultReps: 'Failure' },
    { name: 'Bodyweight Squat', muscleGroup: 'Quads', equipment: [], defaultSets: 3, defaultReps: '20' },
    { name: 'Lunges', muscleGroup: 'Legs', equipment: [], defaultSets: 3, defaultReps: '12 each' },
    { name: 'Plank', muscleGroup: 'Core', equipment: [], defaultSets: 3, defaultReps: '45s' },
    { name: 'Mountain Climbers', muscleGroup: 'Core', equipment: [], defaultSets: 3, defaultReps: '30s' },
    { name: 'Burpees', muscleGroup: 'Full Body', equipment: [], defaultSets: 3, defaultReps: '10' },
    { name: 'Jump Squats', muscleGroup: 'Legs', equipment: [], defaultSets: 3, defaultReps: '15' },
    { name: 'Glute Bridge', muscleGroup: 'Glutes', equipment: [], defaultSets: 3, defaultReps: '15' },
    { name: 'Crunches', muscleGroup: 'Core', equipment: [], defaultSets: 3, defaultReps: '20' },
    { name: 'Bicycle Crunches', muscleGroup: 'Core', equipment: [], defaultSets: 3, defaultReps: '20' },
    { name: 'Leg Raises', muscleGroup: 'Core', equipment: [], defaultSets: 3, defaultReps: '15' },
    { name: 'Superman Hold', muscleGroup: 'Back', equipment: [], defaultSets: 3, defaultReps: '30s' },
    { name: 'Tricep Dips', muscleGroup: 'Triceps', equipment: [], defaultSets: 3, defaultReps: 'Failure' },
  ],
  'pull-up-bar': [
    { name: 'Pull-Ups', muscleGroup: 'Back', equipment: ['pull-up-bar'], defaultSets: 4, defaultReps: 'Failure' },
    { name: 'Chin-Ups', muscleGroup: 'Biceps', equipment: ['pull-up-bar'], defaultSets: 3, defaultReps: 'Failure' },
    { name: 'Hanging Leg Raise', muscleGroup: 'Core', equipment: ['pull-up-bar'], defaultSets: 3, defaultReps: '12' },
    { name: 'Wide-Grip Pull-Ups', muscleGroup: 'Back', equipment: ['pull-up-bar'], defaultSets: 3, defaultReps: 'Failure' },
  ],
  'resistance-bands': [
    { name: 'Band Pull-Apart', muscleGroup: 'Shoulders', equipment: ['resistance-bands'], defaultSets: 3, defaultReps: '15' },
    { name: 'Banded Squat', muscleGroup: 'Quads', equipment: ['resistance-bands'], defaultSets: 3, defaultReps: '15' },
    { name: 'Banded Row', muscleGroup: 'Back', equipment: ['resistance-bands'], defaultSets: 3, defaultReps: '15' },
    { name: 'Banded Lateral Walk', muscleGroup: 'Glutes', equipment: ['resistance-bands'], defaultSets: 3, defaultReps: '12 each' },
    { name: 'Banded Chest Press', muscleGroup: 'Chest', equipment: ['resistance-bands'], defaultSets: 3, defaultReps: '15' },
  ],
  'yoga-mat': [
    { name: 'Yoga Flow', muscleGroup: 'Full Body', equipment: ['yoga-mat'], defaultSets: 1, defaultReps: '10 min' },
    { name: 'Child\'s Pose', muscleGroup: 'Back', equipment: ['yoga-mat'], defaultSets: 1, defaultReps: '60s' },
    { name: 'Downward Dog', muscleGroup: 'Full Body', equipment: ['yoga-mat'], defaultSets: 1, defaultReps: '60s' },
    { name: 'Cat-Cow Stretch', muscleGroup: 'Back', equipment: ['yoga-mat'], defaultSets: 1, defaultReps: '10' },
    { name: 'Pigeon Pose', muscleGroup: 'Hips', equipment: ['yoga-mat'], defaultSets: 1, defaultReps: '60s each' },
    { name: 'Hip Flexor Stretch', muscleGroup: 'Hips', equipment: ['yoga-mat'], defaultSets: 1, defaultReps: '45s each' },
  ],
  'foam-roller': [
    { name: 'Foam Roll Quads', muscleGroup: 'Quads', equipment: ['foam-roller'], defaultSets: 1, defaultReps: '60s' },
    { name: 'Foam Roll IT Band', muscleGroup: 'Legs', equipment: ['foam-roller'], defaultSets: 1, defaultReps: '60s each' },
    { name: 'Foam Roll Back', muscleGroup: 'Back', equipment: ['foam-roller'], defaultSets: 1, defaultReps: '60s' },
    { name: 'Foam Roll Calves', muscleGroup: 'Calves', equipment: ['foam-roller'], defaultSets: 1, defaultReps: '60s' },
  ],
  'jump-rope': [
    { name: 'Jump Rope Intervals', muscleGroup: 'Cardio', equipment: ['jump-rope'], defaultSets: 5, defaultReps: '60s on / 30s off' },
    { name: 'Double Unders', muscleGroup: 'Cardio', equipment: ['jump-rope'], defaultSets: 4, defaultReps: '30s' },
  ],
  'medicine-ball': [
    { name: 'Medicine Ball Slam', muscleGroup: 'Full Body', equipment: ['medicine-ball'], defaultSets: 3, defaultReps: '12' },
    { name: 'Medicine Ball Russian Twist', muscleGroup: 'Core', equipment: ['medicine-ball'], defaultSets: 3, defaultReps: '20' },
    { name: 'Medicine Ball Woodchop', muscleGroup: 'Core', equipment: ['medicine-ball'], defaultSets: 3, defaultReps: '10 each' },
  ],
  'ab-wheel': [
    { name: 'Ab Wheel Rollout', muscleGroup: 'Core', equipment: ['ab-wheel'], defaultSets: 3, defaultReps: '10' },
    { name: 'Kneeling Ab Rollout', muscleGroup: 'Core', equipment: ['ab-wheel'], defaultSets: 3, defaultReps: '12' },
  ],
};

// Muscle group splits for different styles
const STYLE_CONFIG: Record<WorkoutStyle, { muscleGroups: string[][]; exerciseCount: number; durationMin: number; calories: number }> = {
  strength: { muscleGroups: [['Chest', 'Triceps'], ['Back', 'Biceps'], ['Quads', 'Hamstrings', 'Glutes'], ['Shoulders', 'Traps']], exerciseCount: 5, durationMin: 50, calories: 350 },
  hypertrophy: { muscleGroups: [['Chest', 'Shoulders'], ['Back', 'Biceps'], ['Legs', 'Quads', 'Hamstrings'], ['Shoulders', 'Triceps']], exerciseCount: 6, durationMin: 55, calories: 380 },
  functional: { muscleGroups: [['Full Body']], exerciseCount: 6, durationMin: 40, calories: 300 },
  hiit: { muscleGroups: [['Full Body', 'Cardio']], exerciseCount: 8, durationMin: 30, calories: 400 },
  cardio: { muscleGroups: [['Cardio', 'Full Body']], exerciseCount: 5, durationMin: 35, calories: 350 },
  recovery: { muscleGroups: [['Full Body', 'Back', 'Hips']], exerciseCount: 8, durationMin: 30, calories: 100 },
  mobility: { muscleGroups: [['Full Body', 'Hips', 'Back']], exerciseCount: 8, durationMin: 25, calories: 80 },
  power: { muscleGroups: [['Chest', 'Shoulders'], ['Back', 'Full Body'], ['Quads', 'Glutes']], exerciseCount: 5, durationMin: 45, calories: 400 },
  endurance: { muscleGroups: [['Full Body', 'Cardio']], exerciseCount: 6, durationMin: 45, calories: 320 },
};

const STYLE_NAMES: Record<WorkoutStyle, string[]> = {
  strength: ['Strength Builder', 'Power Session', 'Heavy Lifts'],
  hypertrophy: ['Muscle Builder', 'Hypertrophy Focus', 'Growth Session'],
  functional: ['Functional Fitness', 'Movement Mastery', 'Functional Flow'],
  hiit: ['HIIT Blitz', 'Cardio Crusher', 'Interval Burn'],
  cardio: ['Cardio Session', 'Heart Racer', 'Endurance Burn'],
  recovery: ['Active Recovery', 'Restore & Recover', 'Easy Recovery'],
  mobility: ['Mobility Flow', 'Stretch & Restore', 'Flexibility Focus'],
  power: ['Power & Explosiveness', 'Power Surge', 'Explosive Power'],
  endurance: ['Endurance Builder', 'Stamina Session', 'Long Burn'],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getAvailableExercises(enabledEquipment: Equipment[], targetMuscles: string[]): typeof EXERCISE_DB[string] {
  const enabledIds = new Set(enabledEquipment.map((e) => e.id));
  const pool: typeof EXERCISE_DB[string] = [];

  // Always include bodyweight
  for (const ex of EXERCISE_DB.bodyweight) {
    if (targetMuscles.some((m) => ex.muscleGroup.includes(m) || m === 'Full Body')) {
      pool.push(ex);
    }
  }

  for (const eqId of enabledIds) {
    const exercises = EXERCISE_DB[eqId];
    if (!exercises) continue;
    for (const ex of exercises) {
      const allEquipAvailable = ex.equipment.every((e) => enabledIds.has(e) || e === '');
      if (allEquipAvailable && targetMuscles.some((m) => ex.muscleGroup.includes(m) || m === 'Full Body' || ex.muscleGroup === 'Full Body')) {
        pool.push(ex);
      }
    }
  }

  return pool;
}

function getMuscleGroupsForToday(style: WorkoutStyle, recentSessions: WorkoutSession[]): string[] {
  const config = STYLE_CONFIG[style];
  if (config.muscleGroups.length === 1) return config.muscleGroups[0];

  // Rotate based on recent sessions
  const recentMuscles = new Set<string>();
  for (const s of recentSessions.slice(0, 2)) {
    for (const e of s.exercises) {
      recentMuscles.add(e.muscleGroup);
    }
  }

  // Pick the muscle group split least recently trained
  let bestSplit = config.muscleGroups[0];
  let bestScore = -1;
  for (const split of config.muscleGroups) {
    const overlap = split.filter((m) => recentMuscles.has(m)).length;
    const score = split.length - overlap;
    if (score > bestScore) {
      bestScore = score;
      bestSplit = split;
    }
  }
  return bestSplit;
}

export function generateWorkout(
  enabledEquipment: Equipment[],
  style: WorkoutStyle,
  recentSessions: WorkoutSession[] = [],
  previousWeights: Record<string, number> = {}
): WorkoutPlan {
  const config = STYLE_CONFIG[style];
  const targetMuscles = getMuscleGroupsForToday(style, recentSessions);
  const pool = getAvailableExercises(enabledEquipment, targetMuscles);

  const selectedExercises: Exercise[] = [];
  const usedNames = new Set<string>();
  const shuffled = shuffle(pool);

  for (const ex of shuffled) {
    if (selectedExercises.length >= config.exerciseCount) break;
    if (usedNames.has(ex.name)) continue;

    const prevWeight = previousWeights[ex.name];
    selectedExercises.push({
      id: uuid(),
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
      sets: ex.defaultSets,
      reps: ex.defaultReps,
      weight: prevWeight,
      restSeconds: style === 'hiit' ? 30 : style === 'recovery' ? 15 : 60,
    });
    usedNames.add(ex.name);
  }

  // If we don't have enough, fill with bodyweight
  if (selectedExercises.length < config.exerciseCount) {
    for (const ex of shuffle(EXERCISE_DB.bodyweight)) {
      if (selectedExercises.length >= config.exerciseCount) break;
      if (usedNames.has(ex.name)) continue;
      selectedExercises.push({
        id: uuid(),
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        equipment: [],
        sets: ex.defaultSets,
        reps: ex.defaultReps,
        restSeconds: 60,
      });
      usedNames.add(ex.name);
    }
  }

  const equipUsed = [...new Set(selectedExercises.flatMap((e) => e.equipment))];
  const names = STYLE_NAMES[style];
  const focusLabel = targetMuscles.length > 2 ? 'Full Body' : targetMuscles.join(' & ');

  return {
    id: uuid(),
    name: `${focusLabel} ${pick(names)}`,
    style,
    exercises: selectedExercises,
    durationMin: config.durationMin,
    estimatedCalories: config.calories,
    focus: focusLabel,
    equipmentUsed: equipUsed,
    generatedAt: new Date().toISOString(),
    intensity: style === 'recovery' || style === 'mobility' ? 1 : style === 'hiit' || style === 'power' ? 3 : 2,
  };
}

export function getStyleInfo(style: WorkoutStyle): { label: string; icon: string; color: string; description: string } {
  const map: Record<WorkoutStyle, { label: string; icon: string; color: string; description: string }> = {
    strength: { label: 'Strength', icon: 'fitness_center', color: '#2bee79', description: 'Build raw strength with heavy compound lifts' },
    hypertrophy: { label: 'Hypertrophy', icon: 'fitness_center', color: '#2bee79', description: 'Maximize muscle growth with volume training' },
    functional: { label: 'Functional', icon: 'accessibility_new', color: '#60a5fa', description: 'Move better in daily life with practical movements' },
    hiit: { label: 'HIIT', icon: 'timer', color: '#f97316', description: 'Burn calories fast with high-intensity intervals' },
    cardio: { label: 'Cardio', icon: 'directions_run', color: '#ef4444', description: 'Boost heart health and endurance' },
    recovery: { label: 'Recovery', icon: 'self_improvement', color: '#a78bfa', description: 'Heal, lengthen, and restore your body' },
    mobility: { label: 'Mobility', icon: 'self_improvement', color: '#2dd4bf', description: 'Improve flexibility and joint health' },
    power: { label: 'Power', icon: 'bolt', color: '#eab308', description: 'Develop explosive strength and speed' },
    endurance: { label: 'Endurance', icon: 'monitor_heart', color: '#ec4899', description: 'Build stamina and staying power' },
  };
  return map[style];
}

export function getTodayStyle(recentSessions: WorkoutSession[]): WorkoutStyle {
  const day = new Date().getDay();
  // Simple rotation with recovery days
  const schedule: WorkoutStyle[] = ['strength', 'hypertrophy', 'functional', 'strength', 'hiit', 'recovery', 'mobility'];
  return schedule[day];
}
