import { useState, useRef } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { UserProfile, WorkoutSession, WeightEntry } from '../types';
import { isAIConfigured, setAIConfig } from '../ai';
import { exportAllData, importAllData } from '../db';

interface ProfileProps {
  profile: UserProfile | null;
  sessions: WorkoutSession[];
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onNavigateEquipment: () => void;
  weightHistory: WeightEntry[];
  onAddWeight: (weight: number) => void;
  onRemoveWeight: (id: string) => void;
}

export function Profile({ profile, sessions, onUpdateProfile, onNavigateEquipment, weightHistory, onAddWeight, onRemoveWeight }: ProfileProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.name || '');
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
  const [showLogWeight, setShowLogWeight] = useState(false);
  const [logWeightInput, setLogWeightInput] = useState(profile?.weight?.toString() || '');
  const [restTimerSound, setRestTimerSound] = useState(() => {
    const stored = localStorage.getItem('titan_rest_sound');
    return stored !== 'false'; // default ON
  });
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
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

        {/* Weight History */}
        {weightHistory.length > 0 && (
          <div class="space-y-3">
            <div class="flex items-center justify-between px-1">
              <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Weight History</h3>
              <button
                onClick={() => { setShowLogWeight(true); setLogWeightInput(profile?.weight?.toString() || ''); }}
                class="text-xs font-semibold text-primary"
              >
                + Log Weight
              </button>
            </div>

            {/* Summary stats */}
            {(() => {
              const sorted = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
              const current = sorted[sorted.length - 1].weight;
              const starting = sorted[0].weight;
              const change = current - starting;
              return (
                <div class="grid grid-cols-3 gap-2">
                  <div class="bg-surface-dark rounded-lg p-3 text-center border border-white/5">
                    <p class="text-lg font-bold text-white">{current}</p>
                    <p class="text-[10px] text-slate-400">Current lbs</p>
                  </div>
                  <div class="bg-surface-dark rounded-lg p-3 text-center border border-white/5">
                    <p class="text-lg font-bold text-white">{starting}</p>
                    <p class="text-[10px] text-slate-400">Starting lbs</p>
                  </div>
                  <div class="bg-surface-dark rounded-lg p-3 text-center border border-white/5">
                    <p class={`text-lg font-bold ${change <= 0 ? 'text-primary' : 'text-orange-400'}`}>
                      {change > 0 ? '+' : ''}{change.toFixed(1)}
                    </p>
                    <p class="text-[10px] text-slate-400">Change lbs</p>
                  </div>
                </div>
              );
            })()}

            {/* SVG line chart */}
            {weightHistory.length >= 2 && (() => {
              const chartData = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
              const weights = chartData.map((e) => e.weight);
              const minW = Math.min(...weights);
              const maxW = Math.max(...weights);
              const range = maxW - minW || 1;
              const padding = range * 0.1;
              const yMin = minW - padding;
              const yMax = maxW + padding;
              const w = 320;
              const h = 120;
              const px = 8; // horizontal padding
              const py = 8; // vertical padding
              const points = chartData.map((e, i) => {
                const x = px + (i / (chartData.length - 1)) * (w - px * 2);
                const y = py + (1 - (e.weight - yMin) / (yMax - yMin)) * (h - py * 2);
                return { x, y, weight: e.weight, date: e.date };
              });
              const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
              const areaPath = `${linePath} L${points[points.length - 1].x},${h - py} L${points[0].x},${h - py} Z`;

              return (
                <div class="bg-surface-dark rounded-xl p-3 border border-white/5">
                  <svg viewBox={`0 0 ${w} ${h}`} class="w-full" style={{ height: '120px' }}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2bee79" stop-opacity="0.3" />
                        <stop offset="100%" stop-color="#2bee79" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#weightGrad)" />
                    <path d={linePath} fill="none" stroke="#2bee79" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    {points.map((p) => (
                      <circle cx={p.x} cy={p.y} r="3" fill="#2bee79" />
                    ))}
                  </svg>
                  <div class="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
                    <span>{chartData[0].date.slice(5)}</span>
                    <span>{chartData[chartData.length - 1].date.slice(5)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Log weight modal */}
            {showLogWeight && (
              <div class="bg-surface-dark rounded-xl p-4 border border-primary/20 space-y-3">
                <label class="block text-xs font-medium text-slate-400 uppercase tracking-wider">Log Today's Weight (lbs)</label>
                <input
                  type="number"
                  value={logWeightInput}
                  onInput={(e) => setLogWeightInput((e.target as HTMLInputElement).value)}
                  placeholder="e.g. 175"
                  class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm"
                  autoFocus
                />
                <div class="flex gap-2">
                  <button
                    onClick={() => {
                      const w = parseFloat(logWeightInput);
                      if (w > 0) {
                        onAddWeight(w);
                        onUpdateProfile({ weight: w });
                        setWeightInput(w.toString());
                        setShowLogWeight(false);
                      }
                    }}
                    disabled={!logWeightInput || parseFloat(logWeightInput) <= 0}
                    class="flex-1 py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowLogWeight(false)}
                    class="px-4 py-2.5 bg-white/5 text-slate-300 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Recent entries list */}
            <div class="space-y-1">
              {weightHistory.slice(0, 10).map((entry) => (
                <div key={entry.id} class="flex items-center justify-between px-3 py-2 bg-surface-dark rounded-lg border border-white/5">
                  <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold text-white">{entry.weight} lbs</span>
                    <span class="text-xs text-slate-500">{new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <button
                    onClick={() => onRemoveWeight(entry.id)}
                    class="text-slate-600 hover:text-red-400 transition-colors p-1"
                  >
                    <Icon name="close" class="text-sm" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log weight button when no history exists */}
        {weightHistory.length === 0 && !showLogWeight && (
          <button
            onClick={() => { setShowLogWeight(true); setLogWeightInput(profile?.weight?.toString() || ''); }}
            class="w-full flex items-center justify-center gap-2 p-4 bg-surface-dark rounded-xl border border-dashed border-white/10 hover:border-primary/30 transition-colors"
          >
            <Icon name="monitor_weight" class="text-primary" />
            <span class="text-sm font-semibold text-slate-300">Start Tracking Weight</span>
          </button>
        )}
        {weightHistory.length === 0 && showLogWeight && (
          <div class="bg-surface-dark rounded-xl p-4 border border-primary/20 space-y-3">
            <label class="block text-xs font-medium text-slate-400 uppercase tracking-wider">Log Today's Weight (lbs)</label>
            <input
              type="number"
              value={logWeightInput}
              onInput={(e) => setLogWeightInput((e.target as HTMLInputElement).value)}
              placeholder="e.g. 175"
              class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm"
              autoFocus
            />
            <div class="flex gap-2">
              <button
                onClick={() => {
                  const w = parseFloat(logWeightInput);
                  if (w > 0) {
                    onAddWeight(w);
                    onUpdateProfile({ weight: w });
                    setWeightInput(w.toString());
                    setShowLogWeight(false);
                  }
                }}
                disabled={!logWeightInput || parseFloat(logWeightInput) <= 0}
                class="flex-1 py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setShowLogWeight(false)}
                class="px-4 py-2.5 bg-white/5 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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

          <div
            class="w-full flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Icon name="volume_up" />
              </div>
              <div class="text-left">
                <p class="font-semibold text-white">Rest Timer Sound</p>
                <p class="text-xs text-slate-400">Beep when rest period ends</p>
              </div>
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
                    <input
                      type="number"
                      value={heightFeet}
                      onInput={(e) => setHeightFeet((e.target as HTMLInputElement).value)}
                      placeholder="5"
                      class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm pr-8"
                    />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ft</span>
                  </div>
                  <div class="flex-1 relative">
                    <input
                      type="number"
                      value={heightInches}
                      onInput={(e) => setHeightInches((e.target as HTMLInputElement).value)}
                      placeholder="10"
                      class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm pr-8"
                    />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">in</span>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Gender</label>
                <div class="flex gap-2">
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      class={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        gender === g ? 'bg-primary text-bg-dark' : 'bg-white/5 text-slate-300'
                      }`}
                    >
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
                  const updates: Partial<UserProfile> = { weight: w, height: totalInches, gender };
                  onUpdateProfile(updates);
                  // Auto-log weight entry if weight was set
                  if (w && w > 0) {
                    onAddWeight(w);
                    setLogWeightInput(w.toString());
                  }
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
                <textarea
                  value={injuries}
                  onInput={(e) => setInjuries((e.target as HTMLTextAreaElement).value)}
                  placeholder="e.g. torn rotator cuff (left), lower back pain, bad right knee..."
                  rows={3}
                  class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm resize-none"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Additional Equipment Notes</label>
                <textarea
                  value={additionalEquipment}
                  onInput={(e) => setAdditionalEquipment((e.target as HTMLTextAreaElement).value)}
                  placeholder="e.g. adjustable dumbbells up to 50lbs, doorway pull-up bar with limited head clearance..."
                  rows={3}
                  class="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:ring-primary focus:border-primary text-sm resize-none"
                />
              </div>

              <button
                onClick={() => {
                  onUpdateProfile({ injuries: injuries.trim() || undefined, additionalEquipment: additionalEquipment.trim() || undefined });
                  setShowFitnessContext(false);
                }}
                class="w-full py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm"
              >
                Save
              </button>
            </div>
          )}

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
            <button
              onClick={handleExport}
              class="flex-1 flex items-center justify-center gap-2 p-4 bg-surface-dark rounded-xl border border-white/5 hover:border-primary/30 transition-colors"
            >
              <Icon name="download" class="text-primary" />
              <span class="font-semibold text-white text-sm">Export Data</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              class="flex-1 flex items-center justify-center gap-2 p-4 bg-surface-dark rounded-xl border border-white/5 hover:border-primary/30 transition-colors"
            >
              <Icon name="upload" class="text-blue-400" />
              <span class="font-semibold text-white text-sm">Import Data</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              class="hidden"
            />
          </div>

          {importStatus === 'success' && (
            <div class="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary font-medium">
              <Icon name="check_circle" />
              Data imported! Reloading...
            </div>
          )}
          {importStatus === 'error' && (
            <div class="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-medium">
              <Icon name="error" />
              Import failed. Check the file and try again.
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
