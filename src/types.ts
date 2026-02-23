export interface Equipment {
  id: string;
  name: string;
  category: 'weights' | 'cardio' | 'recovery' | 'other';
  description: string;
  icon: string;
  enabled: boolean;
  details?: Record<string, string>; // e.g. { maxWeight: "50lbs", type: "adjustable" }
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string[];
  sets: number;
  reps: string; // "10-12" or "Failure" or "30s"
  weight?: number;
  notes?: string;
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
  createdAt: string;
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
