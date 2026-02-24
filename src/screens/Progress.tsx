import { useState, useMemo } from 'preact/hooks';
import { Icon } from '../components/Icon';
import type { WorkoutSession } from '../types';

interface ProgressProps {
  sessions: WorkoutSession[];
}

type TimeFrame = 'week' | 'month' | 'year';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return `${seconds}s`;
  return `${m} min`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getStyleIcon(style: string): string {
  const map: Record<string, string> = {
    strength: 'fitness_center', hypertrophy: 'fitness_center', functional: 'accessibility_new',
    hiit: 'timer', cardio: 'directions_run', recovery: 'self_improvement',
    mobility: 'self_improvement', power: 'bolt', endurance: 'monitor_heart',
  };
  return map[style] || 'fitness_center';
}

function getStyleColor(style: string): string {
  const map: Record<string, string> = {
    strength: 'bg-primary/10 text-primary', hypertrophy: 'bg-primary/10 text-primary',
    functional: 'bg-blue-500/10 text-blue-400', hiit: 'bg-orange-500/10 text-orange-400',
    cardio: 'bg-red-500/10 text-red-400', recovery: 'bg-purple-500/10 text-purple-400',
    mobility: 'bg-teal-500/10 text-teal-400', power: 'bg-yellow-500/10 text-yellow-400',
    endurance: 'bg-pink-500/10 text-pink-400',
  };
  return map[style] || 'bg-primary/10 text-primary';
}

export function Progress({ sessions }: ProgressProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');

  const filteredSessions = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    if (timeFrame === 'week') cutoff.setDate(now.getDate() - 7);
    else if (timeFrame === 'month') cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    return sessions.filter((s) => new Date(s.startedAt) >= cutoff);
  }, [sessions, timeFrame]);

  const totalVolume = filteredSessions.reduce((sum, s) => sum + s.totalVolume, 0);
  const totalSets = filteredSessions.reduce((sum, s) => sum + s.totalSets, 0);
  const totalPRs = filteredSessions.reduce((sum, s) => sum + s.personalRecords, 0);
  const workoutCount = filteredSessions.length;

  // Generate chart data points
  const chartPoints = useMemo(() => {
    if (filteredSessions.length === 0) return [];
    const dailyVolume: Record<string, number> = {};
    for (const s of filteredSessions) {
      const day = new Date(s.startedAt).toLocaleDateString();
      dailyVolume[day] = (dailyVolume[day] || 0) + s.totalVolume;
    }
    return Object.entries(dailyVolume).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredSessions]);

  // Build SVG path
  const svgPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    const maxVol = Math.max(...chartPoints.map(([, v]) => v), 1);
    const w = 350;
    const h = 120;
    const step = w / (chartPoints.length - 1);

    const points = chartPoints.map(([, v], i) => ({
      x: i * step,
      y: h - (v / maxVol) * h + 10,
    }));

    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cp1x = points[i - 1].x + step * 0.4;
      const cp1y = points[i - 1].y;
      const cp2x = points[i].x - step * 0.4;
      const cp2y = points[i].y;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i].x},${points[i].y}`;
    }
    return d;
  }, [chartPoints]);

  const svgFillPath = svgPath ? `${svgPath} V150 H0 Z` : '';

  // Calendar strip - last 7 days
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const hasWorkout = sessions.some((s) => new Date(s.startedAt).toDateString() === dateStr);
      days.push({
        date: d,
        label: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        day: d.getDate(),
        hasWorkout,
        isToday: i === 0,
      });
    }
    return days;
  }, [sessions]);

  // Group sessions by date label
  const groupedSessions = useMemo(() => {
    const groups: { label: string; sessions: WorkoutSession[] }[] = [];
    let currentLabel = '';
    for (const s of sessions.slice(0, 20)) {
      const label = formatTimeAgo(s.startedAt);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, sessions: [] });
      }
      groups[groups.length - 1].sessions.push(s);
    }
    return groups;
  }, [sessions]);

  const consistency = workoutCount > 0
    ? Math.min(Math.round((workoutCount / (timeFrame === 'week' ? 5 : timeFrame === 'month' ? 20 : 250)) * 100), 100)
    : 0;
  const circumference = 2 * Math.PI * 20;
  const strokeDashoffset = circumference - (consistency / 100) * circumference;

  return (
    <div class="flex-1 overflow-y-auto no-scrollbar min-h-0 pb-4">
      {/* Header */}
      <header class="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 pt-safe">
        <div class="px-4 py-3 flex items-center justify-center">
          <h1 class="text-lg font-bold tracking-tight">Your Progress</h1>
        </div>
        {/* Time frame selector */}
        <div class="px-4 pb-4">
          <div class="flex p-1 bg-surface-dark rounded-lg">
            {(['week', 'month', 'year'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                class={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all capitalize ${
                  timeFrame === tf
                    ? 'bg-bg-dark text-primary shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div class="space-y-6 pb-6">
        {/* Volume chart */}
        <section class="px-4 pt-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-slate-400 text-sm font-medium uppercase tracking-wider">Strength Volume</h2>
              <div class="flex items-baseline gap-2 mt-1">
                <span class="text-3xl font-bold text-white">{totalVolume.toLocaleString()}</span>
                <span class="text-sm font-medium text-slate-400">lbs</span>
              </div>
            </div>
            {workoutCount > 0 && (
              <div class="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md">
                <Icon name="trending_up" class="text-primary text-sm" />
                <span class="text-primary text-xs font-bold">{workoutCount} sessions</span>
              </div>
            )}
          </div>

          <div class="bg-surface-dark rounded-xl p-4 border border-white/5">
            {chartPoints.length >= 2 ? (
              <>
                <div class="h-36 w-full relative">
                  <svg class="w-full h-full overflow-visible" viewBox="0 0 350 150" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2bee79" stop-opacity="0.2" />
                        <stop offset="100%" stop-color="#2bee79" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    {svgFillPath && <path d={svgFillPath} fill="url(#chartGrad)" />}
                    {svgPath && <path d={svgPath} fill="none" stroke="#2bee79" stroke-width="3" stroke-linecap="round" />}
                  </svg>
                </div>
                <div class="flex justify-between mt-3 text-xs font-medium text-slate-500">
                  {chartPoints.slice(0, 7).map(([date], i) => (
                    <span key={i}>{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  ))}
                </div>
              </>
            ) : (
              <div class="h-36 flex items-center justify-center text-slate-500 text-sm">
                Complete workouts to see your progress chart
              </div>
            )}
          </div>
        </section>

        {/* Consistency */}
        <section class="px-4">
          <div class="bg-surface-dark rounded-xl p-4 flex items-center justify-between border border-white/5">
            <div class="flex items-center gap-3">
              <div class="relative w-12 h-12 flex items-center justify-center">
                <svg class="w-full h-full transform -rotate-90">
                  <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" stroke-width="4" class="text-slate-800" />
                  <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" stroke-width="4" class="text-primary"
                    stroke-dasharray={circumference} stroke-dashoffset={strokeDashoffset} />
                </svg>
                <span class="absolute text-[10px] font-bold text-slate-200">{consistency}%</span>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-white">Consistency</h3>
                <p class="text-xs text-slate-400">{workoutCount} Workouts this {timeFrame}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Calendar strip */}
        <section class="pl-4">
          <h3 class="text-lg font-bold mb-3 text-white">History</h3>
          <div class="flex gap-3 overflow-x-auto no-scrollbar pr-4 pb-2">
            {calendarDays.map((d) => (
              <div
                key={d.day}
                class={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-20 rounded-xl cursor-pointer transition-all ${
                  d.isToday
                    ? 'bg-primary shadow-lg shadow-primary/20'
                    : 'bg-surface-dark border border-white/5'
                }`}
              >
                <span class={`text-xs font-semibold ${d.isToday ? 'text-bg-dark' : 'text-slate-400'} mb-1`}>{d.label}</span>
                <span class={`text-xl font-bold ${d.isToday ? 'text-bg-dark' : 'text-slate-300'}`}>{d.day}</span>
                <div class={`w-1.5 h-1.5 rounded-full mt-1 ${
                  d.hasWorkout ? (d.isToday ? 'bg-bg-dark' : 'bg-primary') : 'bg-slate-700'
                }`}></div>
              </div>
            ))}
          </div>
        </section>

        {/* Workout history list */}
        <section class="px-4 space-y-2">
          {groupedSessions.length === 0 ? (
            <div class="text-center py-12 text-slate-500">
              <Icon name="fitness_center" class="text-4xl mb-2 block mx-auto opacity-30" />
              <p class="text-sm">No workouts yet. Start your first one!</p>
            </div>
          ) : (
            groupedSessions.map((group) => (
              <div key={group.label}>
                <div class="py-2 flex items-center gap-2">
                  <div class={`h-2 w-2 rounded-full ${group.label === 'Today' ? 'bg-primary' : 'bg-slate-700'}`}></div>
                  <span class="text-sm font-bold text-slate-400 uppercase tracking-wide">{group.label}</span>
                </div>
                {group.sessions.map((s) => (
                  <div key={s.id} class="bg-surface-dark rounded-xl p-4 border border-white/5 mb-2 space-y-3">
                    <div class="flex justify-between items-start">
                      <div class="flex gap-3">
                        <div class={`h-10 w-10 rounded-lg flex items-center justify-center ${getStyleColor(s.style)}`}>
                          <Icon name={getStyleIcon(s.style)} />
                        </div>
                        <div>
                          <h4 class="font-bold text-white text-base">{s.name}</h4>
                          <p class="text-xs text-slate-400 mt-0.5">
                            {new Date(s.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} &bull; {formatDuration(s.durationSeconds)}
                          </p>
                        </div>
                      </div>
                      {s.completedAt && (
                        <div class="bg-primary text-bg-dark text-[10px] font-bold px-2 py-1 rounded">COMPLETED</div>
                      )}
                    </div>
                    <div class="h-px bg-white/5 w-full"></div>
                    <div class="flex justify-between items-center text-sm">
                      <div class="flex flex-col">
                        <span class="text-slate-500 text-xs">Volume</span>
                        <span class="font-semibold text-slate-200">{s.totalVolume.toLocaleString()} lbs</span>
                      </div>
                      <div class="flex flex-col border-l border-white/5 pl-4">
                        <span class="text-slate-500 text-xs">Sets</span>
                        <span class="font-semibold text-slate-200">{s.totalSets}</span>
                      </div>
                      {s.personalRecords > 0 && (
                        <div class="flex flex-col border-l border-white/5 pl-4">
                          <span class="text-slate-500 text-xs">Records</span>
                          <span class="font-semibold text-primary">{s.personalRecords} PRs</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
