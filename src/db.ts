import { openDB, type IDBPDatabase } from 'idb';
import type { Equipment, WorkoutPlan, WorkoutSession, PersonalRecord, UserProfile, ChatMessage, MealLog, FoodEntry, NutritionGoals, StarredFood, WeightEntry, WorkoutProgram, ActiveWorkoutState } from './types';

const DB_NAME = 'titan-fitness';
const DB_VERSION = 7;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('equipment')) {
          db.createObjectStore('equipment', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workoutPlans')) {
          db.createObjectStore('workoutPlans', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('by-date', 'startedAt');
        }
        if (!db.objectStoreNames.contains('personalRecords')) {
          const store = db.createObjectStore('personalRecords', { keyPath: 'id' });
          store.createIndex('by-exercise', 'exerciseName');
        }
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('chatMessages')) {
          const store = db.createObjectStore('chatMessages', { keyPath: 'id' });
          store.createIndex('by-time', 'timestamp');
        }
        // Nutrition stores (added in v2)
        if (!db.objectStoreNames.contains('nutritionLogs')) {
          const store = db.createObjectStore('nutritionLogs', { keyPath: 'id' });
          store.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains('foods')) {
          const store = db.createObjectStore('foods', { keyPath: 'id' });
          store.createIndex('by-barcode', 'barcode');
        }
        if (!db.objectStoreNames.contains('nutritionGoals')) {
          db.createObjectStore('nutritionGoals', { keyPath: 'date' });
        }
        // Starred foods (added in v3)
        if (!db.objectStoreNames.contains('starredFoods')) {
          const store = db.createObjectStore('starredFoods', { keyPath: 'id' });
          store.createIndex('by-name', 'name');
        }
        // Weight history (added in v4)
        if (!db.objectStoreNames.contains('weightHistory')) {
          const store = db.createObjectStore('weightHistory', { keyPath: 'id' });
          store.createIndex('by-date', 'date');
        }
        // Workout programs (added in v6)
        if (!db.objectStoreNames.contains('programs')) {
          db.createObjectStore('programs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('activeWorkout')) {
          db.createObjectStore('activeWorkout', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Equipment
export async function getAllEquipment(): Promise<Equipment[]> {
  const db = await getDB();
  return db.getAll('equipment');
}

export async function saveAllEquipment(items: Equipment[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('equipment', 'readwrite');
  for (const item of items) {
    tx.store.put(item);
  }
  await tx.done;
}

async function migrateEquipment(): Promise<void> {
  const db = await getDB();
  const existing = await db.getAll('equipment');
  const hasOldRings = existing.some((e: Equipment) => e.id === 'rings');
  const hasOldTrx = existing.some((e: Equipment) => e.id === 'trx');
  const hasNew = existing.some((e: Equipment) => e.id === 'trx-rings');

  // Update barbell icon
  const barbell = existing.find((e: Equipment) => e.id === 'barbell' && e.icon === 'horizontal_rule');
  if (barbell) {
    const txBb = db.transaction('equipment', 'readwrite');
    await txBb.store.put({ ...barbell, icon: 'horizontal_distribute' });
    await txBb.done;
  }

  // Update pull-up bar icon
  const pullUpBar = existing.find((e: Equipment) => e.id === 'pull-up-bar' && (e.icon === 'expand' || e.icon === 'power_input'));
  if (pullUpBar) {
    const txPb = db.transaction('equipment', 'readwrite');
    await txPb.store.put({ ...pullUpBar, icon: 'drag_handle' });
    await txPb.done;
  }

  // Update kettlebells icon
  const kettlebells = existing.find((e: Equipment) => e.id === 'kettlebells' && e.icon === 'circle');
  if (kettlebells) {
    const txKb = db.transaction('equipment', 'readwrite');
    await txKb.store.put({ ...kettlebells, icon: 'water_drop' });
    await txKb.done;
  }

  // Update resistance bands icon
  const bands = existing.find((e: Equipment) => e.id === 'resistance-bands' && e.icon === 'lasso');
  if (bands) {
    const tx2 = db.transaction('equipment', 'readwrite');
    await tx2.store.put({ ...bands, icon: 'all_inclusive' });
    await tx2.done;
  }

  if (!hasNew) {
    const wasEnabled = existing.some((e: Equipment) => (e.id === 'rings' || e.id === 'trx') && e.enabled);
    const tx = db.transaction('equipment', 'readwrite');
    if (hasOldRings) await tx.store.delete('rings');
    if (hasOldTrx) await tx.store.delete('trx');
    await tx.store.put({ id: 'trx-rings', name: 'TRX / Rings', category: 'weights', description: 'Suspension trainer or gymnastic rings', icon: 'sports_gymnastics', enabled: wasEnabled });
    await tx.done;
  }
}

export async function initDefaultEquipment(): Promise<void> {
  const existing = await getAllEquipment();
  if (existing.length > 0) {
    await migrateEquipment();
    return;
  }

  const defaults: Equipment[] = [
    { id: 'dumbbells', name: 'Dumbbells', category: 'weights', description: 'Adjustable or fixed', icon: 'fitness_center', enabled: false },
    { id: 'kettlebells', name: 'Kettlebells', category: 'weights', description: 'Various weights', icon: 'water_drop', enabled: false },
    { id: 'barbell', name: 'Barbell', category: 'weights', description: 'Standard or Olympic', icon: 'horizontal_distribute', enabled: false },
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

// Workout Plans
export async function savePlan(plan: WorkoutPlan): Promise<void> {
  const db = await getDB();
  await db.put('workoutPlans', plan);
}

export async function getLatestPlan(): Promise<WorkoutPlan | undefined> {
  const db = await getDB();
  const all = await db.getAll('workoutPlans');
  return all.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
}

/** Delete workout plans older than `days` days (keeps the most recent one regardless) */
export async function pruneOldPlans(days = 7): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('workoutPlans');
  if (all.length <= 1) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();
  // Always keep the newest plan
  const sorted = all.sort((a: WorkoutPlan, b: WorkoutPlan) => b.generatedAt.localeCompare(a.generatedAt));
  const toDelete = sorted.slice(1).filter((p: WorkoutPlan) => p.generatedAt < cutoffStr);
  if (toDelete.length === 0) return;
  const tx = db.transaction('workoutPlans', 'readwrite');
  for (const p of toDelete) {
    tx.store.delete(p.id);
  }
  await tx.done;
}

// Workout Sessions
export async function saveSession(session: WorkoutSession): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getAllSessions(): Promise<WorkoutSession[]> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getRecentSessions(limit: number): Promise<WorkoutSession[]> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
}

export async function getSessionsByDateRange(start: string, end: string): Promise<WorkoutSession[]> {
  const all = await getAllSessions();
  return all.filter((s) => s.startedAt >= start && s.startedAt <= end);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', id);
}

export async function updateSession(session: WorkoutSession): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

// Active Workout State
export async function saveActiveWorkout(state: ActiveWorkoutState): Promise<void> {
  const db = await getDB();
  await db.put('activeWorkout', state);
}

export async function getActiveWorkout(): Promise<ActiveWorkoutState | null> {
  const db = await getDB();
  const result = await db.get('activeWorkout', 'current');
  return result || null;
}

export async function clearActiveWorkout(): Promise<void> {
  const db = await getDB();
  await db.clear('activeWorkout');
}

// Personal Records
export async function savePersonalRecord(pr: PersonalRecord): Promise<void> {
  const db = await getDB();
  await db.put('personalRecords', pr);
}

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  const db = await getDB();
  return db.getAll('personalRecords');
}

export async function getRecordForExercise(exerciseName: string): Promise<PersonalRecord | undefined> {
  const db = await getDB();
  const all = await db.getAllFromIndex('personalRecords', 'by-exercise', exerciseName);
  return all.sort((a, b) => b.weight - a.weight)[0];
}

// Profile
export async function getProfile(): Promise<UserProfile | undefined> {
  const db = await getDB();
  const all = await db.getAll('profile');
  return all[0];
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const db = await getDB();
  await db.put('profile', profile);
}

// Chat
export async function getChatMessages(): Promise<ChatMessage[]> {
  const db = await getDB();
  const all = await db.getAll('chatMessages');
  return all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  const db = await getDB();
  await db.put('chatMessages', msg);
}

export async function clearChat(): Promise<void> {
  const db = await getDB();
  await db.clear('chatMessages');
}

// Nutrition Logs
export async function saveMealLog(meal: MealLog): Promise<void> {
  const db = await getDB();
  await db.put('nutritionLogs', meal);
}

export async function getMealLogsForDate(date: string): Promise<MealLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('nutritionLogs', 'by-date', date);
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function deleteMealLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('nutritionLogs', id);
}

// Nutrition Goals
export async function saveNutritionGoals(date: string, goals: NutritionGoals): Promise<void> {
  const db = await getDB();
  await db.put('nutritionGoals', { date, ...goals });
}

export async function getNutritionGoals(date: string): Promise<NutritionGoals | undefined> {
  const db = await getDB();
  const result = await db.get('nutritionGoals', date);
  if (result) {
    const { date: _, ...goals } = result;
    return goals as NutritionGoals;
  }
  // Fall back to the most recently saved goals (carry forward)
  const all = await db.getAll('nutritionGoals');
  if (all.length === 0) return undefined;
  const sorted = all.sort((a, b) => b.date.localeCompare(a.date));
  const { date: _, ...goals } = sorted[0];
  return goals as NutritionGoals;
}

// Food Cache
export async function saveFoodCache(food: FoodEntry): Promise<void> {
  const db = await getDB();
  await db.put('foods', food);
}

export async function getFoodByBarcode(barcode: string): Promise<FoodEntry | undefined> {
  const db = await getDB();
  const results = await db.getAllFromIndex('foods', 'by-barcode', barcode);
  return results[0];
}

// Starred Foods
export async function getStarredFoods(): Promise<StarredFood[]> {
  const db = await getDB();
  return db.getAll('starredFoods');
}

export async function starFood(food: FoodEntry): Promise<StarredFood> {
  const db = await getDB();
  const starred: StarredFood = { ...food, starredAt: Date.now() };
  await db.put('starredFoods', starred);
  return starred;
}

export async function unstarFood(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('starredFoods', id);
}

// Recent meal logs (for recent foods, capped to limit data loaded)
export async function getRecentMealLogs(days = 90): Promise<MealLog[]> {
  const db = await getDB();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD
  const all = await db.getAll('nutritionLogs');
  return all.filter((m: MealLog) => m.date >= cutoffDate);
}

// Weight History
export async function saveWeightEntry(entry: WeightEntry): Promise<void> {
  const db = await getDB();
  await db.put('weightHistory', entry);
}

export async function getWeightHistory(): Promise<WeightEntry[]> {
  const db = await getDB();
  const all = await db.getAll('weightHistory');
  return all.sort((a: WeightEntry, b: WeightEntry) => b.date.localeCompare(a.date));
}

export async function deleteWeightEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('weightHistory', id);
}

// Workout Programs
export async function saveProgram(program: WorkoutProgram): Promise<void> {
  const db = await getDB();
  await db.put('programs', program);
}

export async function getActiveProgram(): Promise<WorkoutProgram | undefined> {
  const db = await getDB();
  const all: WorkoutProgram[] = await db.getAll('programs');
  const now = new Date().toISOString();
  // Return the most recent non-expired program
  const active = all
    .filter((p) => p.expiresAt > now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return active[0];
}

export async function deleteProgram(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('programs', id);
}

// Export / Import
const STORE_NAMES = ['equipment', 'workoutPlans', 'sessions', 'personalRecords', 'profile', 'chatMessages', 'nutritionLogs', 'foods', 'nutritionGoals', 'starredFoods', 'weightHistory', 'programs', 'activeWorkout'] as const;

export async function exportAllData(): Promise<string> {
  const db = await getDB();
  const data: Record<string, any> = {};
  for (const store of STORE_NAMES) {
    data[store] = await db.getAll(store);
  }
  // Include localStorage AI config
  data._localStorage = {
    titan_ai_key: localStorage.getItem('titan_ai_key'),
    titan_ai_provider: localStorage.getItem('titan_ai_provider'),
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json);
  const db = await getDB();

  for (const store of STORE_NAMES) {
    if (!Array.isArray(data[store])) continue;
    const tx = db.transaction(store, 'readwrite');
    await tx.store.clear();
    for (const item of data[store]) {
      await tx.store.put(item);
    }
    await tx.done;
  }

  // Restore localStorage AI config
  if (data._localStorage) {
    if (data._localStorage.titan_ai_key) {
      localStorage.setItem('titan_ai_key', data._localStorage.titan_ai_key);
    }
    if (data._localStorage.titan_ai_provider) {
      localStorage.setItem('titan_ai_provider', data._localStorage.titan_ai_provider);
    }
  }
}
