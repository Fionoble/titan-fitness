import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { UserProfile, WorkoutSession, WeightEntry } from '../types';

interface ProfileProps {
  profile: UserProfile | null;
  sessions: WorkoutSession[];
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onNavigateSettings: () => void;
  weightHistory: WeightEntry[];
  onAddWeight: (weight: number) => void;
  onRemoveWeight: (id: string) => void;
}

export function ProfileNative({ profile, sessions, onUpdateProfile, onNavigateSettings, weightHistory, onAddWeight, onRemoveWeight }: ProfileProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.name || '');
  const [showLogWeight, setShowLogWeight] = useState(false);
  const [logWeightInput, setLogWeightInput] = useState(profile?.weight?.toString() || '');

  const totalWorkouts = sessions.length;
  const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);

  const saveName = () => {
    if (nameInput.trim()) {
      onUpdateProfile({ name: nameInput.trim() });
      setEditingName(false);
    }
  };

  return (
    <div class="flex-1 overflow-y-auto no-scrollbar pb-24">
      <header class="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 pt-safe">
        <div class="px-4 py-4 flex items-center justify-between">
          <div class="w-10"></div>
          <h1 class="text-lg font-bold tracking-tight">Profile</h1>
          <button
            onClick={onNavigateSettings}
            class="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-primary transition-colors"
          >
            <Icon name="settings" class="text-[22px]" />
          </button>
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
              const px = 8;
              const py = 8;
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
                        setShowLogWeight(false);
                      }
                    }}
                    disabled={!logWeightInput || parseFloat(logWeightInput) <= 0}
                    class="flex-1 py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setShowLogWeight(false)} class="px-4 py-2.5 bg-white/5 text-slate-300 rounded-lg text-sm">
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
                  <button onClick={() => onRemoveWeight(entry.id)} class="text-slate-600 hover:text-red-400 transition-colors p-1">
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
                    setShowLogWeight(false);
                  }
                }}
                disabled={!logWeightInput || parseFloat(logWeightInput) <= 0}
                class="flex-1 py-2.5 bg-primary text-bg-dark rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setShowLogWeight(false)} class="px-4 py-2.5 bg-white/5 text-slate-300 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* App info */}
        <div class="text-center pt-4 pb-8">
          <p class="text-slate-600 text-xs">Titan Fitness v1.0.0</p>
          <p class="text-slate-700 text-xs mt-1">Data synced securely via Supabase</p>
        </div>
      </div>
    </div>
  );
}
