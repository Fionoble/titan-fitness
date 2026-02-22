import { openDB, type IDBPDatabase } from 'idb';
import type { Equipment, WorkoutPlan, WorkoutSession, PersonalRecord, UserProfile, ChatMessage } from './types';

const DB_NAME = 'titan-fitness';
const DB_VERSION = 1;

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

export async function getEnabledEquipment(): Promise<Equipment[]> {
  const all = await getAllEquipment();
  return all.filter((e) => e.enabled);
}

export async function saveEquipment(item: Equipment): Promise<void> {
  const db = await getDB();
  await db.put('equipment', item);
}

export async function saveAllEquipment(items: Equipment[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('equipment', 'readwrite');
  for (const item of items) {
    tx.store.put(item);
  }
  await tx.done;
}

export async function initDefaultEquipment(): Promise<void> {
  const existing = await getAllEquipment();
  if (existing.length > 0) return;

  const defaults: Equipment[] = [
    { id: 'dumbbells', name: 'Dumbbells', category: 'weights', description: 'Adjustable or fixed', icon: 'fitness_center', enabled: false },
    { id: 'kettlebells', name: 'Kettlebells', category: 'weights', description: 'Various weights', icon: 'circle', enabled: false },
    { id: 'barbell', name: 'Barbell', category: 'weights', description: 'Standard or Olympic', icon: 'horizontal_rule', enabled: false },
    { id: 'bench', name: 'Bench', category: 'weights', description: 'Flat or adjustable', icon: 'chair_alt', enabled: false },
    { id: 'pull-up-bar', name: 'Pull-Up Bar', category: 'weights', description: 'Doorway or mounted', icon: 'expand', enabled: false },
    { id: 'resistance-bands', name: 'Resistance Bands', category: 'weights', description: 'Light to heavy', icon: 'lasso', enabled: false },
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

export async function getPlan(id: string): Promise<WorkoutPlan | undefined> {
  const db = await getDB();
  return db.get('workoutPlans', id);
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
  const all = await getAllSessions();
  return all.slice(0, limit);
}

export async function getSessionsByDateRange(start: string, end: string): Promise<WorkoutSession[]> {
  const all = await getAllSessions();
  return all.filter((s) => s.startedAt >= start && s.startedAt <= end);
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
