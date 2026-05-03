import { openDB, type IDBPDatabase } from 'idb';
import { supabase, getUserId } from './supabase';
import type { Equipment, WorkoutPlan, WorkoutSession, PersonalRecord, UserProfile, ChatMessage, MealLog, FoodEntry, NutritionGoals, StarredFood, WeightEntry, WorkoutProgram, ActiveWorkoutState } from './types';

// ============================================
// ActiveWorkout stays in IndexedDB (offline-first, ephemeral)
// ============================================

const IDB_NAME = 'titan-fitness';
const IDB_VERSION = 1;

let idbPromise: Promise<IDBPDatabase> | null = null;

function getIDB() {
  if (!idbPromise) {
    idbPromise = openDB(IDB_NAME, IDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('activeWorkout')) {
          db.createObjectStore('activeWorkout', { keyPath: 'id' });
        }
      },
    });
  }
  return idbPromise;
}

// Active Workout State (IDB only)
export async function saveActiveWorkout(state: ActiveWorkoutState): Promise<void> {
  const db = await getIDB();
  await db.put('activeWorkout', state);
}

export async function getActiveWorkout(): Promise<ActiveWorkoutState | null> {
  const db = await getIDB();
  const result = await db.get('activeWorkout', 'current');
  return result || null;
}

export async function clearActiveWorkout(): Promise<void> {
  const db = await getIDB();
  await db.clear('activeWorkout');
}

// ============================================
// Helper: snake_case -> camelCase mapping
// ============================================

function toWorkoutPlan(row: any): WorkoutPlan {
  return {
    id: row.id,
    name: row.name,
    style: row.style,
    exercises: row.exercises,
    durationMin: row.duration_min,
    estimatedCalories: row.estimated_calories,
    focus: row.focus,
    equipmentUsed: row.equipment_used,
    generatedAt: row.generated_at,
    intensity: row.intensity,
  };
}

function toSession(row: any): WorkoutSession {
  return {
    id: row.id,
    planId: row.plan_id,
    name: row.name,
    style: row.style,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    exercises: row.exercises,
    totalVolume: row.total_volume,
    totalSets: row.total_sets,
    personalRecords: row.personal_records,
    notes: row.notes,
  };
}

function toProfile(row: any): UserProfile {
  return {
    name: row.name,
    injuries: row.injuries,
    additionalEquipment: row.additional_equipment,
    weight: row.weight,
    height: row.height,
    gender: row.gender,
    restTimerSound: row.rest_timer_sound,
    workoutMode: row.workout_mode,
    avgWorkoutMinutes: row.avg_workout_minutes,
    programActiveDays: row.program_active_days,
    countIn: row.count_in,
    countInSeconds: row.count_in_seconds,
    createdAt: row.created_at,
  };
}

function toChatMessage(row: any): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    richContent: row.rich_content,
  };
}

function toWeightEntry(row: any): WeightEntry {
  return {
    id: row.id,
    date: row.date,
    weight: row.weight,
    timestamp: row.timestamp,
  };
}

function toProgram(row: any): WorkoutProgram {
  return {
    id: row.id,
    name: row.name,
    days: row.days,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    equipment: row.equipment,
  };
}

function toMealLog(row: any): MealLog {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    entries: row.entries,
    timestamp: row.timestamp,
  };
}

function toFoodEntry(row: any): FoodEntry {
  return {
    id: row.id,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fats: row.fats,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    barcode: row.barcode,
    source: row.source,
  };
}

function toStarredFood(row: any): StarredFood {
  return {
    id: row.id,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fats: row.fats,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    barcode: row.barcode,
    source: row.source,
    starredAt: row.starred_at,
  };
}

function toNutritionGoals(row: any): NutritionGoals {
  return {
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fats: row.fats,
    source: row.source,
  };
}

// ============================================
// Equipment
// ============================================

export async function getAllEquipment(): Promise<Equipment[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('user_id', uid);
  if (error) throw error;
  return data || [];
}

export async function saveAllEquipment(items: Equipment[]): Promise<void> {
  const uid = getUserId();
  const rows = items.map((e) => ({ ...e, user_id: uid }));
  const { error } = await supabase
    .from('equipment')
    .upsert(rows, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function initDefaultEquipment(): Promise<void> {
  const existing = await getAllEquipment();
  if (existing.length > 0) return;

  const defaults: Equipment[] = [
    { id: 'dumbbells', name: 'Dumbbells', category: 'weights', description: 'Adjustable or fixed', icon: 'exercise', enabled: false },
    { id: 'kettlebells', name: 'Kettlebells', category: 'weights', description: 'Various weights', icon: 'weight', enabled: false },
    { id: 'barbell', name: 'Barbell', category: 'weights', description: 'Standard or Olympic', icon: 'fitness_center', enabled: false },
    { id: 'bench', name: 'Bench', category: 'weights', description: 'Flat or adjustable', icon: 'chair_alt', enabled: false },
    { id: 'pull-up-bar', name: 'Pull-Up Bar', category: 'weights', description: 'Doorway or mounted', icon: 'drag_handle', enabled: false },
    { id: 'resistance-bands', name: 'Resistance Bands', category: 'weights', description: 'Light to heavy', icon: 'all_inclusive', enabled: false },
    { id: 'trx-rings', name: 'TRX / Rings', category: 'weights', description: 'Suspension trainer or gymnastic rings', icon: 'sports_gymnastics', enabled: false },
    { id: 'stationary-bike', name: 'Stationary Bike', category: 'cardio', description: 'Spin or upright', icon: 'directions_bike', enabled: false },
    { id: 'rowing-machine', name: 'Rowing Machine', category: 'cardio', description: 'Air or water', icon: 'rowing', enabled: false },
    { id: 'jump-rope', name: 'Jump Rope', category: 'cardio', description: 'Speed or weighted', icon: 'steps', enabled: false },
    { id: 'treadmill', name: 'Treadmill', category: 'cardio', description: 'Manual or motorized', icon: 'directions_run', enabled: false },
    { id: 'yoga-mat', name: 'Yoga Mat', category: 'recovery', description: 'Standard', icon: 'waves', enabled: false },
    { id: 'foam-roller', name: 'Foam Roller', category: 'recovery', description: 'Recovery tool', icon: 'radio_button_checked', enabled: false },
    { id: 'ab-wheel', name: 'Ab Wheel', category: 'other', description: 'Core strengthener', icon: 'trip_origin', enabled: false },
    { id: 'medicine-ball', name: 'Medicine Ball', category: 'other', description: 'Weighted ball', icon: 'sports_basketball', enabled: false },
  ];
  await saveAllEquipment(defaults);
}

// ============================================
// Workout Plans
// ============================================

export async function savePlan(plan: WorkoutPlan): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('workout_plans').upsert({
    id: plan.id,
    user_id: uid,
    name: plan.name,
    style: plan.style,
    exercises: plan.exercises,
    duration_min: plan.durationMin,
    estimated_calories: plan.estimatedCalories,
    focus: plan.focus,
    equipment_used: plan.equipmentUsed,
    generated_at: plan.generatedAt,
    intensity: plan.intensity,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function getLatestPlan(): Promise<WorkoutPlan | undefined> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('user_id', uid)
    .order('generated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ? toWorkoutPlan(data[0]) : undefined;
}

export async function pruneOldPlans(days = 7): Promise<void> {
  const uid = getUserId();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data: latest } = await supabase
    .from('workout_plans')
    .select('id')
    .eq('user_id', uid)
    .order('generated_at', { ascending: false })
    .limit(1);

  const keepId = latest?.[0]?.id;
  if (!keepId) return;

  const { error } = await supabase
    .from('workout_plans')
    .delete()
    .eq('user_id', uid)
    .lt('generated_at', cutoff.toISOString())
    .neq('id', keepId);
  if (error) throw error;
}

// ============================================
// Workout Sessions
// ============================================

export async function saveSession(session: WorkoutSession): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('sessions').upsert({
    id: session.id,
    user_id: uid,
    plan_id: session.planId,
    name: session.name,
    style: session.style,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    duration_seconds: session.durationSeconds,
    exercises: session.exercises,
    total_volume: session.totalVolume,
    total_sets: session.totalSets,
    personal_records: session.personalRecords,
    notes: session.notes,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function getAllSessions(): Promise<WorkoutSession[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', uid)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(toSession);
}

export async function getRecentSessions(limit: number): Promise<WorkoutSession[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', uid)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(toSession);
}

export async function getSessionsByDateRange(start: string, end: string): Promise<WorkoutSession[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', uid)
    .gte('started_at', start)
    .lte('started_at', end)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(toSession);
}

export async function deleteSession(id: string): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('user_id', uid)
    .eq('id', id);
  if (error) throw error;
}

export async function updateSession(session: WorkoutSession): Promise<void> {
  await saveSession(session);
}

// ============================================
// Personal Records
// ============================================

export async function savePersonalRecord(pr: PersonalRecord): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('personal_records').upsert({
    id: pr.id,
    user_id: uid,
    exercise_name: pr.exerciseName,
    weight: pr.weight,
    reps: pr.reps,
    date: pr.date,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', uid);
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    exerciseName: r.exercise_name,
    weight: r.weight,
    reps: r.reps,
    date: r.date,
  }));
}

export async function getRecordForExercise(exerciseName: string): Promise<PersonalRecord | undefined> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', uid)
    .eq('exercise_name', exerciseName)
    .order('weight', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data?.[0]) return undefined;
  const r = data[0];
  return { id: r.id, exerciseName: r.exercise_name, weight: r.weight, reps: r.reps, date: r.date };
}

// ============================================
// Profile
// ============================================

export async function getProfile(): Promise<UserProfile | undefined> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', uid)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? toProfile(data) : undefined;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('profiles').upsert({
    user_id: uid,
    name: profile.name,
    injuries: profile.injuries,
    additional_equipment: profile.additionalEquipment,
    weight: profile.weight,
    height: profile.height,
    gender: profile.gender,
    rest_timer_sound: profile.restTimerSound,
    workout_mode: profile.workoutMode,
    avg_workout_minutes: profile.avgWorkoutMinutes,
    program_active_days: profile.programActiveDays,
    count_in: profile.countIn,
    count_in_seconds: profile.countInSeconds,
    created_at: profile.createdAt,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ============================================
// Chat
// ============================================

export async function getChatMessages(): Promise<ChatMessage[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', uid)
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return (data || []).map(toChatMessage);
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('chat_messages').upsert({
    id: msg.id,
    user_id: uid,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    rich_content: msg.richContent || null,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function clearChat(): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', uid);
  if (error) throw error;
}

// ============================================
// Nutrition Logs
// ============================================

export async function saveMealLog(meal: MealLog): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('nutrition_logs').upsert({
    id: meal.id,
    user_id: uid,
    date: meal.date,
    meal: meal.meal,
    entries: meal.entries,
    timestamp: meal.timestamp,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function getMealLogsForDate(date: string): Promise<MealLog[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', uid)
    .eq('date', date)
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return (data || []).map(toMealLog);
}

export async function deleteMealLog(id: string): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase
    .from('nutrition_logs')
    .delete()
    .eq('user_id', uid)
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// Nutrition Goals
// ============================================

export async function saveNutritionGoals(date: string, goals: NutritionGoals): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('nutrition_goals').upsert({
    user_id: uid,
    date,
    calories: goals.calories,
    protein: goals.protein,
    carbs: goals.carbs,
    fats: goals.fats,
    source: goals.source,
  }, { onConflict: 'user_id,date' });
  if (error) throw error;
}

export async function getNutritionGoals(date: string): Promise<NutritionGoals | undefined> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('nutrition_goals')
    .select('*')
    .eq('user_id', uid)
    .eq('date', date)
    .single();
  if (!error && data) return toNutritionGoals(data);

  const { data: recent, error: err2 } = await supabase
    .from('nutrition_goals')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false })
    .limit(1);
  if (err2) throw err2;
  return recent?.[0] ? toNutritionGoals(recent[0]) : undefined;
}

// ============================================
// Food Cache
// ============================================

export async function saveFoodCache(food: FoodEntry): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('foods').upsert({
    id: food.id,
    user_id: uid,
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fats: food.fats,
    serving_size: food.servingSize,
    serving_unit: food.servingUnit,
    barcode: food.barcode,
    source: food.source,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function getFoodByBarcode(barcode: string): Promise<FoodEntry | undefined> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('user_id', uid)
    .eq('barcode', barcode)
    .limit(1);
  if (error) throw error;
  return data?.[0] ? toFoodEntry(data[0]) : undefined;
}

// ============================================
// Starred Foods
// ============================================

export async function getStarredFoods(): Promise<StarredFood[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('starred_foods')
    .select('*')
    .eq('user_id', uid);
  if (error) throw error;
  return (data || []).map(toStarredFood);
}

export async function starFood(food: FoodEntry): Promise<StarredFood> {
  const uid = getUserId();
  const starred: StarredFood = { ...food, starredAt: Date.now() };
  const { error } = await supabase.from('starred_foods').upsert({
    id: starred.id,
    user_id: uid,
    name: starred.name,
    calories: starred.calories,
    protein: starred.protein,
    carbs: starred.carbs,
    fats: starred.fats,
    serving_size: starred.servingSize,
    serving_unit: starred.servingUnit,
    barcode: starred.barcode,
    source: starred.source,
    starred_at: starred.starredAt,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
  return starred;
}

export async function unstarFood(id: string): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase
    .from('starred_foods')
    .delete()
    .eq('user_id', uid)
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// Recent Meal Logs
// ============================================

export async function getRecentMealLogs(days = 90): Promise<MealLog[]> {
  const uid = getUserId();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', uid)
    .gte('date', cutoffDate);
  if (error) throw error;
  return (data || []).map(toMealLog);
}

// ============================================
// Weight History
// ============================================

export async function saveWeightEntry(entry: WeightEntry): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('weight_history').upsert({
    id: entry.id,
    user_id: uid,
    date: entry.date,
    weight: entry.weight,
    timestamp: entry.timestamp,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function getWeightHistory(): Promise<WeightEntry[]> {
  const uid = getUserId();
  const { data, error } = await supabase
    .from('weight_history')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(toWeightEntry);
}

export async function deleteWeightEntry(id: string): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase
    .from('weight_history')
    .delete()
    .eq('user_id', uid)
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// Workout Programs
// ============================================

export async function saveProgram(program: WorkoutProgram): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase.from('programs').upsert({
    id: program.id,
    user_id: uid,
    name: program.name,
    days: program.days,
    created_at: program.createdAt,
    expires_at: program.expiresAt,
    equipment: program.equipment,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function getActiveProgram(): Promise<WorkoutProgram | undefined> {
  const uid = getUserId();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', uid)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ? toProgram(data[0]) : undefined;
}

export async function deleteProgram(id: string): Promise<void> {
  const uid = getUserId();
  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('user_id', uid)
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// Export / Import
// ============================================

export async function exportAllData(): Promise<string> {
  const uid = getUserId();
  const tables = ['equipment', 'workout_plans', 'sessions', 'personal_records', 'profiles', 'chat_messages', 'nutrition_logs', 'foods', 'nutrition_goals', 'starred_foods', 'weight_history', 'programs'] as const;

  const data: Record<string, any> = {};
  for (const table of tables) {
    const { data: rows } = await supabase.from(table).select('*').eq('user_id', uid);
    data[table] = rows || [];
  }

  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json);
  const uid = getUserId();

  const tables = ['equipment', 'workout_plans', 'sessions', 'personal_records', 'profiles', 'chat_messages', 'nutrition_logs', 'foods', 'nutrition_goals', 'starred_foods', 'weight_history', 'programs'] as const;

  for (const table of tables) {
    if (!Array.isArray(data[table]) && typeof data[table] !== 'object') continue;

    const rows = Array.isArray(data[table]) ? data[table] : [data[table]];
    if (rows.length === 0) continue;

    await supabase.from(table).delete().eq('user_id', uid);

    const withUser = rows.map((r: any) => ({ ...r, user_id: uid }));
    await supabase.from(table).upsert(withUser);
  }
}
