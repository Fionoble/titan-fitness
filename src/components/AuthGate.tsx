import { useState, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { User } from '@supabase/supabase-js';
import { initAuth, onAuthStateChange, signInWithEmail } from '../supabase';
import { Icon } from './Icon';

interface AuthGateProps {
  children: ComponentChildren;
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initAuth().then((u) => {
      setUser(u);
      setLoading(false);
    });
    const { data: { subscription } } = onAuthStateChange((u) => setUser(u));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div class="h-full flex items-center justify-center bg-bg-dark">
        <div class="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (user) return <>{children}</>;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return;
    const { error: err } = await signInWithEmail(email.trim());
    if (err) {
      setError(err.message);
    } else {
      setSubmitted(true);
    }
  };

  return (
    <div class="h-full flex items-center justify-center bg-bg-dark px-6">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <div class="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <Icon name="fitness_center" class="text-primary text-4xl" />
          </div>
          <h1 class="text-2xl font-bold text-white mb-1">Titan Fitness</h1>
          <p class="text-slate-400 text-sm">Sign in to sync your workouts</p>
        </div>

        {submitted ? (
          <div class="bg-surface-dark rounded-xl p-6 border border-primary/20 text-center">
            <Icon name="mail" class="text-primary text-3xl mb-3" />
            <h2 class="text-lg font-semibold text-white mb-2">Check your email</h2>
            <p class="text-sm text-slate-400">
              We sent a magic link to <span class="text-white font-medium">{email}</span>. Click the link to sign in.
            </p>
            <button
              onClick={() => { setSubmitted(false); setEmail(''); }}
              class="mt-4 text-sm text-primary hover:text-primary/80"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="space-y-4">
            <input
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="your@email.com"
              required
              class="w-full bg-surface-dark border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm"
            />
            {error && (
              <p class="text-red-400 text-sm">{error}</p>
            )}
            <button
              type="submit"
              class="w-full py-3.5 bg-primary text-bg-dark rounded-xl font-bold text-sm"
            >
              Continue with Email
            </button>
          </form>
        )}

        <p class="text-center text-xs text-slate-600 mt-6">
          Your workout data is stored securely in the cloud and synced across devices.
        </p>
      </div>
    </div>
  );
}
