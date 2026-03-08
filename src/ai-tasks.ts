import { useState, useEffect, useRef } from 'preact/hooks';

// --- Task Manager ---

export type TaskStatus = 'running' | 'done' | 'error';

export interface AITask<T = any> {
  id: string;
  type: string;
  status: TaskStatus;
  result?: T;
  error?: string;
  startedAt: number;
}

type Listener = () => void;

const tasks = new Map<string, AITask>();
const taskListeners = new Set<Listener>();
const locks = new Map<string, string>(); // lockKey → taskId

function notifyTaskListeners() {
  for (const fn of taskListeners) fn();
}

// Prune completed tasks older than 5 minutes
function pruneOldTasks() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, task] of tasks) {
    if (task.status !== 'running' && task.startedAt < cutoff) {
      tasks.delete(id);
    }
  }
}

export function runTask<T>(
  id: string,
  type: string,
  fn: () => Promise<T>,
  lockKey?: string,
): Promise<T | null> {
  // If lockKey is set and another task with that lock is running, block
  if (lockKey) {
    const existingId = locks.get(lockKey);
    if (existingId && existingId !== id) {
      const existing = tasks.get(existingId);
      if (existing?.status === 'running') return Promise.resolve(null);
    }
    locks.set(lockKey, id);
  }

  pruneOldTasks();

  const task: AITask<T> = { id, type, status: 'running', startedAt: Date.now() };
  tasks.set(id, task);
  notifyTaskListeners();

  return fn().then(
    (result) => {
      const t = tasks.get(id);
      if (t) { t.status = 'done'; t.result = result; }
      if (lockKey && locks.get(lockKey) === id) locks.delete(lockKey);
      notifyTaskListeners();
      return result;
    },
    (err) => {
      const t = tasks.get(id);
      if (t) { t.status = 'error'; t.error = err?.message || 'Unknown error'; }
      if (lockKey && locks.get(lockKey) === id) locks.delete(lockKey);
      notifyTaskListeners();
      throw err;
    },
  );
}

export function getTask(id: string): AITask | undefined {
  return tasks.get(id);
}

export function useAITask(id: string): AITask | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    taskListeners.add(listener);
    return () => { taskListeners.delete(listener); };
  }, []);
  return tasks.get(id);
}

export function useAITaskByType(type: string): AITask | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    taskListeners.add(listener);
    return () => { taskListeners.delete(listener); };
  }, []);
  // Find the most recent task of this type
  let latest: AITask | undefined;
  for (const task of tasks.values()) {
    if (task.type === type && (!latest || task.startedAt > latest.startedAt)) {
      latest = task;
    }
  }
  return latest;
}

// --- Persistent Store ---

const stores = new Map<string, any>();
const storeListeners = new Map<string, Set<Listener>>();

function notifyStoreListeners(key: string) {
  const listeners = storeListeners.get(key);
  if (listeners) for (const fn of listeners) fn();
}

export function useStore<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [, setTick] = useState(0);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    let set = storeListeners.get(key);
    if (!set) { set = new Set(); storeListeners.set(key, set); }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) storeListeners.delete(key);
    };
  }, [key]);

  const value: T = stores.has(key) ? stores.get(key) : defaultValue;

  const setValue = (next: T | ((prev: T) => T)) => {
    const k = keyRef.current;
    const current: T = stores.has(k) ? stores.get(k) : defaultValue;
    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(current) : next;
    stores.set(k, resolved);
    notifyStoreListeners(k);
  };

  return [value, setValue];
}

export function clearStore(key: string) {
  stores.delete(key);
  notifyStoreListeners(key);
}
