import { useState, useRef } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { UserProfile, WeightEntry } from '../types';
import { isAIConfigured, setAIConfig } from '../ai';
import { exportAllData, importAllData } from '../db';

interface SettingsProps {
  profile: UserProfile | null;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onNavigateEquipment: () => void;
  onAddWeight: (weight: number) => void;
  onBack: () => void;
}

export function Settings({ profile, onUpdateProfile, onNavigateEquipment, onAddWeight, onBack }: SettingsProps) {
  const [showAPISetup, setShowAPISetup] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [injuries, setInjuries] = useState(profile?.injuries || '');
  const [additionalEquipment, setAdditionalEquipment] = useState(profile?.additionalEquipment || '');
  const [showFitnessContext, setShowFitnessContext] = useState(false);
  const [showBodyMetrics, setShowBodyMetrics] = useState(false);
  const [weightInput, setWeightInput] = useState(profile?.weight?.toString() || '');
  const [heightFeet, setHeightFeet] = useState(profile?.height ? Math.floor(profile.height / 12).toString() : '');
  const [heightInches, setHeightInches] = useState(profile?.height ? (profile.height % 12).toString() : '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | undefined>(profile?.gender);
  const [restTimerSound, setRestTimerSound] = useState(() => {
    const stored = localStorage.getItem('titan_rest_sound');
    return stored !== 'false';
  });
  const [workoutMode, setWorkoutMode] = useState<'daily' | 'program'>(profile?.workoutMode || 'daily');
  const [avgWorkoutMinutes, setAvgWorkoutMinutes] = useState<string>(profile?.avgWorkoutMinutes?.toString() || '');
  const [programActiveDays, setProgramActiveDays] = useState(profile?.programActiveDays ?? 6);
  const [countIn, setCountIn] = useState(profile?.countIn ?? false);
  const [countInSeconds, setCountInSeconds] = useState<3 | 5 | 7>(profile?.countInSeconds ?? 3);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiConfigured = isAIConfigured();

  const saveAPIKey = () => {
    if (apiKey.trim()) {
      setAIConfig(apiKey.trim(), provider);
      setShowAPISetup(false);
      setApiKey('');
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `titan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    }
  };

  const handleImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importAllData(text);
      setImportStatus('success');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setImportStatus('error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div class="flex-1 overflow-y-auto no-scrollbar pb-24">
      <header class="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 pt-safe">
        <div class="px-4 py-4 flex items-center justify-between">
          <button onClick={onBack} class="flex items-center gap-0.5 text-primary text-sm font-medium -ml-1">
            <Icon name="chevron_left" class="text-[20px]" />
            Profile
          </button>
          <h1 class="text-lg font-bold tracking-tight">Settings</h1>
          <div class="w-16"></div>
        </div>
      </header>

      <div class="px-4 pt-4 space-y-6">
        {/* Equipment */}
        <div class="space-y-2">
          <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">Equipment</h3>
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
        </div>

        {/* Workout Preferences */}
        <div class="space-y-2">
          <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">Workout Preferences</h3>
          <div class="bg-surface-dark rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
            {/* Workout Mode */}
            <div class="p-4">
              <p class="text-sm font-medium text-white mb-2">Workout Mode</p>
              <div class="space-y-2">
                <button
                  onClick={() => { setWorkoutMode('daily'); onUpdateProfile({ workoutMode: 'daily' }); }}
                  class={`w-full text-left p-3 rounded-lg border transition-colors ${
                    workoutMode === 'daily' ? 'border-primary/40 bg-primary/10' : 'border-white/5 bg-bg-dark hover:border-white/10'
                  }`}
                >
                  <div class="flex items-center gap-2 mb-1">
                    {workoutMode === 'daily' && <Icon name="check_circle" class="text-primary text-sm" />}
                    <span class={`text-sm font-semibold ${workoutMode === 'daily' ? 'text-primary' : 'text-white'}`}>Daily</span>
                  </div>
                  <p class="text-xs text-slate-400">Fresh AI-generated workout each day based on your history and equipment.</p>
                </button>
                <button
                  onClick={() => { setWorkoutMode('program'); onUpdateProfile({ workoutMode: 'program' }); }}
                  class={`w-full text-left p-3 rounded-lg border transition-colors ${
                    workoutMode === 'program' ? 'border-primary/40 bg-primary/10' : 'border-white/5 bg-bg-dark hover:border-white/10'
                  }`}
                >
                  <div class="flex items-center gap-2 mb-1">
                    {workoutMode === 'program' && <Icon name="check_circle" class="text-primary text-sm" />}
                    <span class={`text-sm font-semibold ${workoutMode === 'program' ? 'text-primary' : 'text-white'}`}>Program</span>
                  </div>
                  <p class="text-xs text-slate-400">Follow a structured 7-day program with a planned split and rest days.</p>
                </button>
                {workoutMode === 'program' && (
                  <div class="p-3 rounded-lg border border-white/5 bg-bg-dark">
                    <p class="text-xs font-medium text-slate-400 mb-2">Active days per week</p>
                    <div class="flex gap-1.5">
                      {[3, 4, 5, 6].map((d) => (
                        <button
                          key={d}
                          onClick={() => { setProgramActiveDays(d); onUpdateProfile({ programActiveDays: d }); }}
                          class={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            programActiveDays === d ? 'bg-primary text-bg-dark' : 'bg-surface-dark text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1.5">{7 - programActiveDays} rest day{7 - programActiveDays !== 1 ? 's' : ''} per week</p>
                  </div>
                )}
              </div>
            </div>

            {/* Average Workout Time */}
            <div class="p-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-white">Workout Duration</p>
                <p class="text-xs text-slate-400">Target length for generated workouts</p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  value={avgWorkoutMinutes}
                  placeholder="—"
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    setAvgWorkoutMinutes(val);
                    const num = parseInt(val, 10);
                    onUpdateProfile({ avgWorkoutMinutes: num > 0 ? num : undefined });
                  }}
                  class="w-16 bg-bg-dark border border-white/10 rounded-lg text-center text-white text-sm p-2 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                />
                <span class="text-xs text-slate-400">min</span>
              </div>
            </div>

            {/* Rest Timer Sound */}
            <div class="p-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-white">Rest Timer Sound</p>
                <p class="text-xs text-slate-400">Beep when rest period ends</p>
              </div>
              <button
                onClick={() => {
                  const next = !restTimerSound;
                  setRestTimerSound(next);
                  localStorage.setItem('titan_rest_sound', String(next));
                  onUpdateProfile({ restTimerSound: next });
                }}
                class={`relative w-12 h-7 rounded-full transition-colors ${restTimerSound ? 'bg-primary' : 'bg-white/10'}`}
              >
                <div class={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${restTimerSound ? 'translate-x-[22px]' : 'translate-x-0.5'}`}></div>
              </button>
            </div>

            {/* Count-in Timer */}
            <div class="p-4">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <p class="text-sm font-medium text-white">Count-in Timer</p>
                  <p class="text-xs text-slate-400">Countdown before timed exercises</p>
                </div>
                <button
                  onClick={() => {
                    const next = !countIn;
                    setCountIn(next);
                    localStorage.setItem('titan_count_in', String(next));
                    onUpdateProfile({ countIn: next });
                  }}
                  class={`relative w-12 h-7 rounded-full transition-colors ${countIn ? 'bg-primary' : 'bg-white/10'}`}
                >
                  <div class={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${countIn ? 'translate-x-[22px]' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
              {countIn && (
                <div class="flex gap-2 mt-3">
                  {([3, 5, 7] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setCountInSeconds(s);
                        localStorage.setItem('titan_count_in_seconds', String(s));
                        onUpdateProfile({ countInSeconds: s });
                      }}
                      class={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        countInSeconds === s ? 'bg-primary text-bg-dark' : 'bg-bg-dark text-slate-300 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body & Health */}
        <div class="space-y-2">
          <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">Body & Health</h3>

          <button
            onClick={() => setShowBodyMetrics(!showBodyMetrics)}
            class="w-full flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5 hover:border-primary/30 transition-colors"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Icon name="monitor_weight" />
              </div>
              <div class="text-left">
                <p class="font-semibold text-white">Body Metrics</p>
                <p class="text-xs text-slate-400">Weight, height, gender</p>
              </div>
            </div>
            <Icon name={showBodyMetrics ? 'expand_less' : 'chevron_right'} class="text-slate-500" />
          </button>

          {showBodyMetrics && (
            <div class="bg-surface-dark rounded-xl p-4 border border-white/5 space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Weight (lbs)</label>
                <input
                  type="number"
                  value={weightInput}
                  onInput={(e) => setWeightInput((e.target as HTMLInputElement).value)}
                  placeholder="e.g. 175"
                  class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Height</label>
                <div class="flex gap-2">
                  <div class="flex-1 relative">
                    <input type="number" value={heightFeet} onInput={(e) => setHeightFeet((e.target as HTMLInputElement).value)} placeholder="5"
                      class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm pr-8" />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ft</span>
                  </div>
                  <div class="flex-1 relative">
                    <input type="number" value={heightInches} onInput={(e) => setHeightInches((e.target as HTMLInputElement).value)} placeholder="10"
                      class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm pr-8" />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">in</span>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Gender</label>
                <div class="flex gap-2">
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <button key={g} onClick={() => setGender(g)}
                      class={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${gender === g ? 'bg-primary text-bg-dark' : 'bg-white/5 text-slate-300'}`}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  const w = weightInput ? parseFloat(weightInput) : undefined;
                  const ft = parseInt(heightFeet) || 0;
                  const inc = parseInt(heightInches) || 0;
                  const totalInches = ft * 12 + inc || undefined;
                  onUpdateProfile({ weight: w, height: totalInches, gender });
                  if (w && w > 0) onAddWeight(w);
                  setShowBodyMetrics(false);
                }}
                class="w-full py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm"
              >
                Save
              </button>
            </div>
          )}

          <button
            onClick={() => setShowFitnessContext(!showFitnessContext)}
            class="w-full flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5 hover:border-primary/30 transition-colors"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                <Icon name="health_and_safety" />
              </div>
              <div class="text-left">
                <p class="font-semibold text-white">Injuries & Context</p>
                <p class="text-xs text-slate-400">Limitations, extra equipment info</p>
              </div>
            </div>
            <Icon name={showFitnessContext ? 'expand_less' : 'chevron_right'} class="text-slate-500" />
          </button>

          {showFitnessContext && (
            <div class="bg-surface-dark rounded-xl p-4 border border-white/5 space-y-4">
              <p class="text-sm text-slate-300">
                This info is shared with the AI Coach to personalize your workouts and avoid aggravating injuries.
              </p>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Current Injuries / Limitations</label>
                <textarea value={injuries} onInput={(e) => setInjuries((e.target as HTMLTextAreaElement).value)}
                  placeholder="e.g. torn rotator cuff (left), lower back pain, bad right knee..." rows={3}
                  class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm resize-none" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Additional Equipment Notes</label>
                <textarea value={additionalEquipment} onInput={(e) => setAdditionalEquipment((e.target as HTMLTextAreaElement).value)}
                  placeholder="e.g. adjustable dumbbells up to 50lbs, doorway pull-up bar with limited head clearance..." rows={3}
                  class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm resize-none" />
              </div>
              <button
                onClick={() => { onUpdateProfile({ injuries: injuries.trim() || undefined, additionalEquipment: additionalEquipment.trim() || undefined }); setShowFitnessContext(false); }}
                class="w-full py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm"
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* AI */}
        <div class="space-y-2">
          <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">AI Coach</h3>
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

          {showAPISetup && (
            <div class="bg-surface-dark rounded-xl p-4 border border-white/5 space-y-4">
              <p class="text-sm text-slate-300">
                Connect your AI provider to enable the Titan AI Coach. Your key is stored locally on your device only.
              </p>
              <div class="flex gap-2">
                <button onClick={() => setProvider('anthropic')}
                  class={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${provider === 'anthropic' ? 'bg-primary text-bg-dark' : 'bg-white/5 text-slate-300'}`}>
                  Anthropic
                </button>
                <button onClick={() => setProvider('openai')}
                  class={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${provider === 'openai' ? 'bg-primary text-bg-dark' : 'bg-white/5 text-slate-300'}`}>
                  OpenAI
                </button>
              </div>
              <input type="password" value={apiKey} onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm" />
              <button onClick={saveAPIKey} disabled={!apiKey.trim()}
                class="w-full py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity">
                Save API Key
              </button>
              {aiConfigured && (
                <button onClick={() => { localStorage.removeItem('titan_ai_key'); localStorage.removeItem('titan_ai_provider'); setShowAPISetup(false); }}
                  class="w-full py-2 text-red-400 text-sm hover:text-red-300 transition-colors">
                  Remove API Key
                </button>
              )}
            </div>
          )}
        </div>

        {/* Privacy & Data */}
        <div class="space-y-2">
          <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">Privacy & Data</h3>
          <div class="bg-surface-dark rounded-xl p-4 border border-white/5">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Icon name="lock" />
              </div>
              <div class="text-sm text-slate-400 space-y-1.5">
                <p>All workout data and profile info are stored locally on your device using IndexedDB. Nothing is sent to any server.</p>
                <p>When using the AI Coach, your equipment list and recent workout history are sent to the selected AI provider (Anthropic or OpenAI) to generate responses. API keys are stored in your browser's localStorage.</p>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button onClick={handleExport}
              class="flex-1 flex items-center justify-center gap-2 p-4 bg-surface-dark rounded-xl border border-white/5 hover:border-primary/30 transition-colors">
              <Icon name="download" class="text-primary" />
              <span class="font-semibold text-white text-sm">Export Data</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              class="flex-1 flex items-center justify-center gap-2 p-4 bg-surface-dark rounded-xl border border-white/5 hover:border-primary/30 transition-colors">
              <Icon name="upload" class="text-blue-400" />
              <span class="font-semibold text-white text-sm">Import Data</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} class="hidden" />
          </div>

          {importStatus === 'success' && (
            <div class="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary font-medium">
              <Icon name="check_circle" /> Data imported! Reloading...
            </div>
          )}
          {importStatus === 'error' && (
            <div class="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-medium">
              <Icon name="error" /> Import failed. Check the file and try again.
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
