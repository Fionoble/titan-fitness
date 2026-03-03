import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import * as db from './db';
import type { Equipment, WorkoutPlan, WorkoutSession, ChatMessage, UserProfile, WorkoutCriteria, MealLog, FoodEntry, NutritionGoals } from './types';
import { generateWorkout, getTodayStyle } from './workout-engine';
import { generateWorkoutViaAI } from './ai-workout';
import { isAIConfigured } from './ai';
import { normalizeExerciseName } from './utils';

/** Apply previous weights to a plan's exercises (for AI-generated plans that may lack them) */
function applyPrevWeights(plan: WorkoutPlan, prevWeights: Record<string, number>): WorkoutPlan {
  return {
    ...plan,
    exercises: plan.exercises.map((ex) => {
      if (ex.weight) return ex; // already has a weight
      const prev = prevWeights[normalizeExerciseName(ex.name)];
      return prev ? { ...ex, weight: prev } : ex;
    }),
  };
}

export function useEquipment() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.initDefaultEquipment().then(() => db.getAllEquipment()).then((items) => {
      setEquipment(items);
      setLoading(false);
    });
  }, []);

  const toggle = useCallback(async (id: string) => {
    setEquipment((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e));
      db.saveAllEquipment(updated);
      return updated;
    });
  }, []);

  return { equipment, loading, toggle };
}

export function useTodayWorkout(equipment: Equipment[]) {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const buildPrevWeights = useCallback((sessions: WorkoutSession[]) => {
    const prevWeights: Record<string, number> = {};
    for (const s of sessions) {
      for (const ex of s.exercises) {
        const key = normalizeExerciseName(ex.exerciseName);
        for (const set of ex.sets) {
          if (set.weight && (!prevWeights[key] || set.weight > prevWeights[key])) {
            prevWeights[key] = set.weight;
          }
        }
      }
    }
    return prevWeights;
  }, []);

  const generateLocal = useCallback((sessions: WorkoutSession[], style?: string, prevWeights?: Record<string, number>) => {
    const enabled = equipment.filter((e) => e.enabled);
    const weights = prevWeights || buildPrevWeights(sessions);
    const workoutStyle = (style || getTodayStyle(sessions)) as any;
    return generateWorkout(enabled, workoutStyle, sessions, weights);
  }, [equipment, buildPrevWeights]);

  const generate = useCallback(async (style?: string, criteria?: WorkoutCriteria) => {
    setLoading(true);
    const sessions = await db.getRecentSessions(5);
    const prevWeights = buildPrevWeights(sessions);

    // Try AI generation first if configured
    if (isAIConfigured()) {
      try {
        const chatHistory = await db.getChatMessages();
        const effectiveCriteria = criteria || (style ? { style: style as any } : undefined);
        const result = await generateWorkoutViaAI(equipment, sessions, chatHistory, effectiveCriteria);
        if (result) {
          const planWithWeights = applyPrevWeights(result.plan, prevWeights);
          await db.savePlan(planWithWeights);
          setPlan(planWithWeights);
          setLoading(false);
          return planWithWeights;
        }
      } catch {
        // Fall through to local generation
      }
    }

    // Local fallback
    const newPlan = generateLocal(sessions, style, prevWeights);
    await db.savePlan(newPlan);
    setPlan(newPlan);
    setLoading(false);
    return newPlan;
  }, [equipment, generateLocal]);

  const applyPlan = useCallback(async (newPlan: WorkoutPlan) => {
    await db.savePlan(newPlan);
    setPlan(newPlan);
  }, []);

  useEffect(() => {
    if (equipment.length > 0) {
      db.getLatestPlan().then((existing) => {
        if (existing) {
          const planDate = new Date(existing.generatedAt).toDateString();
          const today = new Date().toDateString();
          if (planDate === today) {
            setPlan(existing);
            setLoading(false);
            return;
          }
        }
        generate();
      });
    }
  }, [equipment, generate]);

  return { plan, loading, regenerate: generate, applyPlan };
}

export function useSessions() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getAllSessions().then((s) => {
      setSessions(s);
      setLoading(false);
    });
  }, []);

  const saveSession = useCallback(async (session: WorkoutSession) => {
    await db.saveSession(session);
    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
  }, []);

  return { sessions, loading, saveSession };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.getChatMessages().then(setMessages);
  }, []);

  const addMessage = useCallback(async (msg: ChatMessage) => {
    await db.saveChatMessage(msg);
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clear = useCallback(async () => {
    await db.clearChat();
    setMessages([]);
  }, []);

  return { messages, loading, setLoading, addMessage, clear };
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    db.getProfile().then((p) => {
      if (p) setProfile(p);
      else {
        const defaultProfile: UserProfile = { name: 'User', createdAt: new Date().toISOString() };
        db.saveProfile(defaultProfile);
        setProfile(defaultProfile);
      }
    });
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...updates };
    await db.saveProfile(updated);
    setProfile(updated);
  }, [profile]);

  return { profile, updateProfile };
}

const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fats: 65,
  source: 'manual',
};

export function useNutrition(date: string) {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      db.getMealLogsForDate(date),
      db.getNutritionGoals(date),
    ]).then(([mealLogs, savedGoals]) => {
      setMeals(mealLogs);
      if (savedGoals) setGoals(savedGoals);
      setLoading(false);
    });
  }, [date]);

  const totals = useMemo(() => {
    let calories = 0, protein = 0, carbs = 0, fats = 0;
    for (const meal of meals) {
      for (const entry of meal.entries) {
        calories += entry.calories;
        protein += entry.protein;
        carbs += entry.carbs;
        fats += entry.fats;
      }
    }
    return { calories, protein, carbs, fats };
  }, [meals]);

  const addFoodToMeal = useCallback(async (mealType: MealLog['meal'], food: FoodEntry) => {
    let mealToSave: MealLog | null = null;
    setMeals((prev) => {
      const existing = prev.find((m) => m.meal === mealType);
      if (existing) {
        const updated: MealLog = { ...existing, entries: [...existing.entries, food] };
        mealToSave = updated;
        return prev.map((m) => m.id === updated.id ? updated : m);
      } else {
        const newMeal: MealLog = {
          id: `${date}-${mealType}`,
          date,
          meal: mealType,
          entries: [food],
          timestamp: Date.now(),
        };
        mealToSave = newMeal;
        return [...prev, newMeal];
      }
    });
    if (mealToSave) await db.saveMealLog(mealToSave);
  }, [date]);

  const removeFoodFromMeal = useCallback(async (mealType: MealLog['meal'], foodId: string) => {
    let mealToSave: MealLog | null = null;
    let mealToDelete: string | null = null;
    setMeals((prev) => {
      const existing = prev.find((m) => m.meal === mealType);
      if (!existing) return prev;
      const updatedEntries = existing.entries.filter((e) => e.id !== foodId);
      if (updatedEntries.length === 0) {
        mealToDelete = existing.id;
        return prev.filter((m) => m.id !== existing.id);
      } else {
        const updated: MealLog = { ...existing, entries: updatedEntries };
        mealToSave = updated;
        return prev.map((m) => m.id === updated.id ? updated : m);
      }
    });
    if (mealToDelete) await db.deleteMealLog(mealToDelete);
    if (mealToSave) await db.saveMealLog(mealToSave);
  }, []);

  const updateGoals = useCallback(async (newGoals: NutritionGoals) => {
    await db.saveNutritionGoals(date, newGoals);
    setGoals(newGoals);
  }, [date]);

  return { meals, goals, totals, loading, addFoodToMeal, removeFoodFromMeal, updateGoals };
}
