import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { UserProfile, WorkoutSession } from '../types';
import { isAIConfigured, setAIConfig } from '../ai';

interface ProfileProps {
  profile: UserProfile | null;
  sessions: WorkoutSession[];
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onNavigateEquipment: () => void;
}

export function Profile({ profile, sessions, onUpdateProfile, onNavigateEquipment }: ProfileProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.name || '');
  const [showAPISetup, setShowAPISetup] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');

  const totalWorkouts = sessions.length;
  const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);
  const aiConfigured = isAIConfigured();

  const saveName = () => {
    if (nameInput.trim()) {
      onUpdateProfile({ name: nameInput.trim() });
      setEditingName(false);
    }
  };

  const saveAPIKey = () => {
    if (apiKey.trim()) {
      setAIConfig(apiKey.trim(), provider);
      setShowAPISetup(false);
      setApiKey('');
    }
  };

  return (
    <div class="flex-1 overflow-y-auto no-scrollbar pb-24">
      <header class="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 pt-safe">
        <div class="px-4 py-4 flex items-center justify-center">
          <h1 class="text-lg font-bold tracking-tight">Profile</h1>
        </div>
      </header>

      <div class="px-4 pt-6 space-y-6">
        {/* Avatar & Name */}
        <div class="flex flex-col items-center text-center">
          <div class="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold mb-3">
            {(profile?.name || 'U').charAt(0).toUpperCase()}
          </div>
          {editingName ? (
            <div class="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onInput={(e) => setNameInput((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                class="bg-surface-dark border border-white/10 rounded-lg px-3 py-2 text-white text-center focus:ring-primary focus:border-primary"
                autoFocus
              />
              <button onClick={saveName} class="text-primary">
                <Icon name="check" />
              </button>
            </div>
          ) : (
            <button onClick={() => { setEditingName(true); setNameInput(profile?.name || ''); }} class="group">
              <h2 class="text-xl font-bold text-white group-hover:text-primary transition-colors flex items-center gap-1">
                {profile?.name || 'User'}
                <Icon name="edit" class="text-sm text-slate-500 group-hover:text-primary" />
              </h2>
            </button>
          )}
          <p class="text-sm text-slate-400 mt-1">
            Member since {profile ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>

        {/* Stats */}
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-surface-dark rounded-xl p-4 text-center border border-white/5">
            <p class="text-2xl font-bold text-white">{totalWorkouts}</p>
            <p class="text-xs text-slate-400 mt-1">Workouts</p>
          </div>
          <div class="bg-surface-dark rounded-xl p-4 text-center border border-white/5">
            <p class="text-2xl font-bold text-white">{(totalVolume / 1000).toFixed(0)}k</p>
            <p class="text-xs text-slate-400 mt-1">lbs Lifted</p>
          </div>
          <div class="bg-surface-dark rounded-xl p-4 text-center border border-white/5">
            <p class="text-2xl font-bold text-white">{totalMinutes}</p>
            <p class="text-xs text-slate-400 mt-1">Minutes</p>
          </div>
        </div>

        {/* Settings */}
        <div class="space-y-2">
          <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">Settings</h3>

          <button
            onClick={onNavigateEquipment}
            class="w-full flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5 hover:border-primary/30 transition-colors"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Icon name="fitness_center" />
              </div>
              <div class="text-left">
                <p class="font-semibold text-white">My Equipment</p>
                <p class="text-xs text-slate-400">Manage your home gym gear</p>
              </div>
            </div>
            <Icon name="chevron_right" class="text-slate-500" />
          </button>

          <button
            onClick={() => setShowAPISetup(!showAPISetup)}
            class="w-full flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5 hover:border-primary/30 transition-colors"
          >
            <div class="flex items-center gap-3">
              <div class={`w-10 h-10 rounded-lg flex items-center justify-center ${aiConfigured ? 'bg-primary/10 text-primary' : 'bg-yellow-500/10 text-yellow-500'}`}>
                <Icon name="smart_toy" />
              </div>
              <div class="text-left">
                <p class="font-semibold text-white">AI Coach Setup</p>
                <p class="text-xs text-slate-400">{aiConfigured ? 'API key configured' : 'Set up your API key'}</p>
              </div>
            </div>
            <Icon name={showAPISetup ? 'expand_less' : 'chevron_right'} class="text-slate-500" />
          </button>

          {/* AI Setup Panel */}
          {showAPISetup && (
            <div class="bg-surface-dark rounded-xl p-4 border border-white/5 space-y-4">
              <p class="text-sm text-slate-300">
                Connect your AI provider to enable the Titan AI Coach. Your key is stored locally on your device only.
              </p>

              {/* Provider toggle */}
              <div class="flex gap-2">
                <button
                  onClick={() => setProvider('anthropic')}
                  class={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    provider === 'anthropic' ? 'bg-primary text-bg-dark' : 'bg-white/5 text-slate-300'
                  }`}
                >
                  Anthropic
                </button>
                <button
                  onClick={() => setProvider('openai')}
                  class={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    provider === 'openai' ? 'bg-primary text-bg-dark' : 'bg-white/5 text-slate-300'
                  }`}
                >
                  OpenAI
                </button>
              </div>

              <input
                type="password"
                value={apiKey}
                onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm"
              />

              <button
                onClick={saveAPIKey}
                disabled={!apiKey.trim()}
                class="w-full py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity"
              >
                Save API Key
              </button>

              {aiConfigured && (
                <button
                  onClick={() => {
                    localStorage.removeItem('titan_ai_key');
                    localStorage.removeItem('titan_ai_provider');
                    setShowAPISetup(false);
                  }}
                  class="w-full py-2 text-red-400 text-sm hover:text-red-300 transition-colors"
                >
                  Remove API Key
                </button>
              )}
            </div>
          )}
        </div>

        {/* App info */}
        <div class="text-center pt-4 pb-8">
          <p class="text-slate-600 text-xs">Titan Fitness v1.0.0</p>
          <p class="text-slate-700 text-xs mt-1">Your data stays on your device</p>
        </div>
      </div>
    </div>
  );
}
