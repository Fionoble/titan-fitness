export interface Equipment {
  id: string;
  name: string;
  category: 'weights' | 'cardio' | 'recovery' | 'other';
  description: string;
  icon: string;
  enabled: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string[];
  sets: number;
  reps: string; // "10-12" or "Failure" or "30s"
  weight?: number;
  restSeconds?: number;
  group?: string; // e.g. "A", "B" — exercises with same group are done together
}

export interface WorkoutPlan {
  id: string;
  name: string;
  style: WorkoutStyle;
  exercises: Exercise[];
  durationMin: number;
  estimatedCalories: number;
  focus: string;
  equipmentUsed: string[];
  generatedAt: string;
  intensity: 1 | 2 | 3; // bolt icons from design
}

export type WorkoutStyle =
  | 'strength'
  | 'hypertrophy'
  | 'functional'
  | 'hiit'
  | 'cardio'
  | 'recovery'
  | 'mobility'
  | 'power'
  | 'endurance';

export interface SetLog {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  isPersonalRecord?: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  planId?: string;
  name: string;
  style: WorkoutStyle;
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  exercises: ExerciseLog[];
  totalVolume: number; // total lbs lifted
  totalSets: number;
  personalRecords: number;
  notes?: string;
}

export interface ActiveWorkoutState {
  id: string;              // always 'current'
  planId: string;
  plan: WorkoutPlan;
  exerciseLogs: ExerciseLog[];
  startedAt: string;       // ISO timestamp
  currentGroupIdx: number;
  activeExInGroup: number;
}

export interface PersonalRecord {
  id: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
}

export interface UserProfile {
  name: string;
  aiApiKey?: string;
  aiProvider?: 'anthropic' | 'openai';
  injuries?: string;
  additionalEquipment?: string;
  weight?: number; // lbs
  height?: number; // total inches
  gender?: 'male' | 'female' | 'other';
  restTimerSound?: boolean;
  workoutMode?: 'daily' | 'program'; // defaults to 'daily'
  avgWorkoutMinutes?: number; // preferred workout duration in minutes
  programActiveDays?: number; // number of active (non-rest) days in a 7-day program (default 6)
  countIn?: boolean; // count-in timer before timed exercises
  countInSeconds?: 3 | 5 | 7; // count-in duration
  createdAt: string;
}

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number; // lbs
  timestamp: string; // ISO string
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  richContent?: {
    type: 'exercise';
    name: string;
    sets: number;
    reps: string;
    weight?: string;
  } | {
    type: 'workoutPlan';
    plan: WorkoutPlan;
  };
}

export interface WorkoutCriteria {
  mood?: string;
  limitations?: string;
  style?: WorkoutStyle;
  customPrompt?: string;
}

// Program generation types

export interface WorkoutProgram {
  id: string;
  name: string;
  days: ProgramDay[];
  createdAt: string;
  expiresAt: string; // when to regenerate (e.g., 7 days from creation)
  equipment: string[]; // equipment snapshot at creation time
}

export interface ProgramDay {
  dayNumber: number; // 1-7
  label: string; // e.g., "Day 1 — Push", "Rest Day"
  isRest: boolean;
  plan?: WorkoutPlan; // undefined if rest day
}

// Nutrition types

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: number;
  servingUnit: string;
  barcode?: string;
  source: 'scan' | 'ai' | 'manual';
}

export interface MealLog {
  id: string;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  entries: FoodEntry[];
  timestamp: number;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  source: 'ai' | 'manual';
}

export interface StarredFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: number;
  servingUnit: string;
  barcode?: string;
  source: 'scan' | 'ai' | 'manual';
  starredAt: number;
}

