import { useState, useEffect, useCallback } from 'preact/hooks';
import * as db from './db';
import type { Equipment, WorkoutPlan, WorkoutSession, ChatMessage, UserProfile, WorkoutCriteria } from './types';
import { generateWorkout, getTodayStyle } from './workout-engine';
import { generateWorkoutViaAI } from './ai-workout';
import { isAIConfigured } from './ai';

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

  const generateLocal = useCallback((sessions: WorkoutSession[], style?: string) => {
    const enabled = equipment.filter((e) => e.enabled);
    const prevWeights: Record<string, number> = {};
    for (const s of sessions) {
      for (const ex of s.exercises) {
        for (const set of ex.sets) {
          if (set.weight && (!prevWeights[ex.exerciseName] || set.weight > prevWeights[ex.exerciseName])) {
            prevWeights[ex.exerciseName] = set.weight;
          }
        }
      }
    }
    const workoutStyle = (style || getTodayStyle(sessions)) as any;
    return generateWorkout(enabled, workoutStyle, sessions, prevWeights);
  }, [equipment]);

  const generate = useCallback(async (style?: string, criteria?: WorkoutCriteria) => {
    setLoading(true);
    const sessions = await db.getRecentSessions(5);

    // Try AI generation first if configured
    if (isAIConfigured()) {
      try {
        const chatHistory = await db.getChatMessages();
        const effectiveCriteria = criteria || (style ? { style: style as any } : undefined);
        const result = await generateWorkoutViaAI(equipment, sessions, chatHistory, effectiveCriteria);
        if (result) {
          await db.savePlan(result.plan);
          setPlan(result.plan);
          setLoading(false);
          return result.plan;
        }
      } catch {
        // Fall through to local generation
      }
    }

    // Local fallback
    const newPlan = generateLocal(sessions, style);
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
