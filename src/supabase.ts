import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let _cachedUserId: string | null = null;

export function getUserId(): string {
  if (!_cachedUserId) throw new Error('Not authenticated');
  return _cachedUserId;
}

export async function initAuth(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    _cachedUserId = session.user.id;
    return session.user;
  }
  return null;
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    _cachedUserId = user?.id ?? null;
    callback(user);
  });
}

export async function signInWithEmail(email: string) {
  return supabase.auth.signInWithOtp({ email });
}

export async function signOut() {
  _cachedUserId = null;
  return supabase.auth.signOut();
}
