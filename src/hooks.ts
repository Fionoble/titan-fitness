import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import * as db from './db';
import type { Equipment, WorkoutPlan, WorkoutSession, ChatMessage, UserProfile, WorkoutCriteria, MealLog, FoodEntry, NutritionGoals, StarredFood, WeightEntry, WorkoutProgram, ProgramDay, ActiveWorkoutState, ExerciseLog, Exercise } from './types';
import { generateWorkout, getTodayStyle } from './workout-engine';
import { generateWorkoutViaAI } from './ai-workout';
import { generateProgramViaAI } from './ai-program';
import { isAIConfigured } from './ai';
import { normalizeExerciseName } from './utils';
import { runTask } from './ai-tasks';

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
    const taskId = `workout-gen-${Date.now()}`;
    const result = await runTask(taskId, 'workout-gen', async () => {
      setLoading(true);
      const sessions = await db.getRecentSessions(5);
      const prevWeights = buildPrevWeights(sessions);

      // Prune old plans in the background
      db.pruneOldPlans(7).catch(() => {});

      // Try AI generation first if configured
      if (isAIConfigured()) {
        try {
          // Only include chat history when user explicitly requested generation (has style/criteria)
          // Auto-generation on load doesn't need prior conversation context
          const chatHistory = (style || criteria) ? await db.getChatMessages() : [];
          const effectiveCriteria = criteria || (style ? { style: style as any } : undefined);
          const profile = await db.getProfile();
          const profileCtx = profile ? { injuries: profile.injuries, additionalEquipment: profile.additionalEquipment, avgWorkoutMinutes: profile.avgWorkoutMinutes } : undefined;
          const aiResult = await generateWorkoutViaAI(equipment, sessions, chatHistory, effectiveCriteria, profileCtx);
          if (aiResult) {
            const planWithWeights = applyPrevWeights(aiResult.plan, prevWeights);
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
    }, 'workout-gen');

    // If blocked by lock, result is null
    if (!result) return null;
    return result;
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

export function useWorkoutProgram(equipment: Equipment[]) {
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayPlan, setTodayPlan] = useState<ProgramDay | null>(null);

  // Compute which day of the program we're on (1-7) based on createdAt vs today
  const computeTodayDay = useCallback((prog: WorkoutProgram): ProgramDay | null => {
    const created = new Date(prog.createdAt);
    const now = new Date();
    // Zero out times for clean day diff
    const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = today.getTime() - createdDay.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const dayNumber = (diffDays % 7) + 1; // 1-indexed, wraps around
    return prog.days.find((d) => d.dayNumber === dayNumber) || null;
  }, []);

  // Check for active program on mount
  useEffect(() => {
    db.getActiveProgram().then((existing) => {
      if (existing) {
        setProgram(existing);
        setTodayPlan(computeTodayDay(existing));
      }
      setLoading(false);
    });
  }, [computeTodayDay]);

  const generateProgram = useCallback(async () => {
    if (!isAIConfigured()) return null;
    setLoading(true);
    try {
      const sessions = await db.getRecentSessions(5);
      const result = await generateProgramViaAI(equipment, sessions);
      if (result) {
        await db.saveProgram(result);
        setProgram(result);
        setTodayPlan(computeTodayDay(result));
        setLoading(false);
        return result;
      }
    } catch {
      // Generation failed
    }
    setLoading(false);
    return null;
  }, [equipment, computeTodayDay]);

  const getDayPlan = useCallback((dayNumber: number): ProgramDay | null => {
    if (!program) return null;
    return program.days.find((d) => d.dayNumber === dayNumber) || null;
  }, [program]);

  const updateProgram = useCallback(async (updated: WorkoutProgram) => {
    await db.saveProgram(updated);
    setProgram(updated);
    setTodayPlan(computeTodayDay(updated));
  }, [computeTodayDay]);

  const clearProgram = useCallback(async () => {
    if (program) {
      await db.deleteProgram(program.id);
      setProgram(null);
      setTodayPlan(null);
    }
  }, [program]);

  return { program, loading, todayPlan, generateProgram, getDayPlan, clearProgram, updateProgram };
}

export function useSessions() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [allLoaded, setAllLoaded] = useState(false);

  useEffect(() => {
    db.getRecentSessions(50).then((s) => {
      setSessions(s);
      setLoading(false);
    });
  }, []);

  const loadAll = useCallback(async () => {
    if (allLoaded) return;
    const all = await db.getAllSessions();
    setSessions(all);
    setAllLoaded(true);
  }, [allLoaded]);

  const saveSession = useCallback(async (session: WorkoutSession) => {
    await db.saveSession(session);
    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
  }, []);

  const updateSession = useCallback(async (session: WorkoutSession) => {
    await db.updateSession(session);
    setSessions((prev) => prev.map((s) => s.id === session.id ? session : s));
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await db.deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const startWorkoutFromSession = useCallback((session: WorkoutSession): WorkoutPlan => {
    const exercises: Exercise[] = session.exercises.map((ex) => {
      const bestSet = ex.sets
        .filter((s) => s.completed && s.weight)
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
      return {
        id: `${ex.exerciseId}-${Date.now()}`,
        name: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        equipment: [],
        sets: ex.sets.length,
        reps: bestSet?.reps?.toString() || '10',
        weight: bestSet?.weight || undefined,
        restSeconds: 60,
      };
    });
    return {
      id: `repeat-${Date.now()}`,
      name: session.name,
      style: session.style,
      exercises,
      durationMin: Math.round(session.durationSeconds / 60),
      estimatedCalories: 300,
      focus: [...new Set(session.exercises.map((e) => e.muscleGroup))].slice(0, 2).join(' & ') || 'Full Body',
      equipmentUsed: [],
      generatedAt: new Date().toISOString(),
      intensity: 2,
    };
  }, []);

  return { sessions, loading, saveSession, updateSession, deleteSession, startWorkoutFromSession, loadAll, allLoaded };
}

export function useActiveWorkout() {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResume, setShowResume] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingStateRef = useRef<ActiveWorkoutState | null>(null);

  // Load persisted active workout on mount
  useEffect(() => {
    db.getActiveWorkout().then((state) => {
      if (state) {
        setShowResume(true);
        setActiveWorkout(state);
      }
      setLoading(false);
    });
  }, []);

  const resumeWorkout = useCallback(() => {
    setShowResume(false);
  }, []);

  const dismissResume = useCallback(async () => {
    setShowResume(false);
    await db.clearActiveWorkout();
    setActiveWorkout(null);
  }, []);

  // Debounced save to IndexedDB
  const persistState = useCallback((state: ActiveWorkoutState) => {
    pendingStateRef.current = state;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (pendingStateRef.current) {
        db.saveActiveWorkout(pendingStateRef.current);
      }
    }, 2000);
  }, []);

  const startWorkout = useCallback(async (plan: WorkoutPlan) => {
    const initialLogs: ExerciseLog[] = plan.exercises.map((ex) => ({
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        weight: ex.weight || null,
        reps: null,
        completed: false,
      })),
    }));

    const state: ActiveWorkoutState = {
      id: 'current',
      planId: plan.id,
      plan,
      exerciseLogs: initialLogs,
      startedAt: new Date().toISOString(),
      currentGroupIdx: 0,
      activeExInGroup: 0,
    };

    await db.saveActiveWorkout(state);
    setActiveWorkout(state);
    setShowResume(false);
  }, []);

  const updateWorkoutState = useCallback((updates: Partial<ActiveWorkoutState>) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      persistState(updated);
      return updated;
    });
  }, [persistState]);

  // Immediate save (for critical moments like set completion)
  const saveNow = useCallback(async (state: ActiveWorkoutState) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingStateRef.current = null;
    await db.saveActiveWorkout(state);
  }, []);

  const completeWorkout = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await db.clearActiveWorkout();
    setActiveWorkout(null);
  }, []);

  const cancelWorkout = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await db.clearActiveWorkout();
    setActiveWorkout(null);
  }, []);

  return {
    activeWorkout,
    isActive: activeWorkout !== null && !showResume,
    loading,
    showResume,
    resumeWorkout,
    dismissResume,
    startWorkout,
    updateWorkoutState,
    saveNow,
    completeWorkout,
    cancelWorkout,
  };
}

function isFromToday(timestamp: string): boolean {
  const msgDate = new Date(timestamp);
  const now = new Date();
  return msgDate.getFullYear() === now.getFullYear()
    && msgDate.getMonth() === now.getMonth()
    && msgDate.getDate() === now.getDate();
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.getChatMessages().then((msgs) => {
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && !isFromToday(lastMsg.timestamp)) {
        db.clearChat();
        setMessages([]);
      } else {
        setMessages(msgs);
      }
    });
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

export function useWeightHistory() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getWeightHistory().then((e) => {
      setEntries(e);
      setLoading(false);
    });
  }, []);

  const addEntry = useCallback(async (weight: number) => {
    const today = new Date().toISOString().slice(0, 10);
    // Replace existing entry for today if one exists
    const existingToday = entries.find((e) => e.date === today);
    const entry: WeightEntry = {
      id: existingToday?.id || `weight-${Date.now()}`,
      date: today,
      weight,
      timestamp: new Date().toISOString(),
    };
    await db.saveWeightEntry(entry);
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.date !== today);
      return [entry, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
    });
  }, [entries]);

  const removeEntry = useCallback(async (id: string) => {
    await db.deleteWeightEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, loading, addEntry, removeEntry };
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    db.getProfile().then((p) => {
      if (p) {
        setProfile(p);
        // Sync timer settings to localStorage for fast access in timer callbacks
        if (p.restTimerSound !== undefined) {
          localStorage.setItem('titan_rest_sound', String(p.restTimerSound));
        }
        if (p.countIn !== undefined) {
          localStorage.setItem('titan_count_in', String(p.countIn));
        }
        if (p.countInSeconds !== undefined) {
          localStorage.setItem('titan_count_in_seconds', String(p.countInSeconds));
        }
      } else {
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

export interface RecentFoodItem {
  food: FoodEntry;
  frequency: number;
  lastUsed: number;
  score: number;
}

export function useRecentFoods() {
  const [recentFoods, setRecentFoods] = useState<RecentFoodItem[]>([]);
  const [starredFoods, setStarredFoods] = useState<StarredFood[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [allMeals, starred] = await Promise.all([
      db.getRecentMealLogs(90),
      db.getStarredFoods(),
    ]);

    // Deduplicate foods by normalized name
    const foodMap = new Map<string, { food: FoodEntry; frequency: number; lastUsed: number }>();
    for (const meal of allMeals) {
      for (const entry of meal.entries) {
        const key = entry.name.toLowerCase().trim();
        const existing = foodMap.get(key);
        if (existing) {
          existing.frequency++;
          existing.lastUsed = Math.max(existing.lastUsed, meal.timestamp);
          // Keep the most recent entry's data
          if (meal.timestamp > existing.lastUsed) {
            existing.food = entry;
          }
        } else {
          foodMap.set(key, { food: entry, frequency: 1, lastUsed: meal.timestamp });
        }
      }
    }

    // Score by combined frequency and recency
    const now = Date.now();
    const items: RecentFoodItem[] = [];
    for (const { food, frequency, lastUsed } of foodMap.values()) {
      const daysSince = (now - lastUsed) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - daysSince / 30); // decays over 30 days
      const score = frequency * 0.6 + recencyScore * 10 * 0.4;
      items.push({ food, frequency, lastUsed, score });
    }
    items.sort((a, b) => b.score - a.score);

    setRecentFoods(items);
    setStarredFoods(starred);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStar = useCallback(async (food: FoodEntry) => {
    // Check if already starred by normalized name
    const key = food.name.toLowerCase().trim();
    const existing = starredFoods.find((s) => s.name.toLowerCase().trim() === key);
    if (existing) {
      await db.unstarFood(existing.id);
      setStarredFoods((prev) => prev.filter((s) => s.id !== existing.id));
    } else {
      const starred = await db.starFood(food);
      setStarredFoods((prev) => [...prev, starred]);
    }
  }, [starredFoods]);

  const isStarred = useCallback((foodName: string) => {
    const key = foodName.toLowerCase().trim();
    return starredFoods.some((s) => s.name.toLowerCase().trim() === key);
  }, [starredFoods]);

  return { recentFoods, starredFoods, loading, toggleStar, isStarred, reload: load };
}
