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

function WorkoutDetail({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const date = new Date(session.startedAt);

  return (
    <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        class="w-full max-w-[430px] bg-surface-dark rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="px-5 pt-5 pb-3 flex items-start justify-between border-b border-white/5">
          <div class="flex gap-3">
            <div class={`h-11 w-11 rounded-lg flex items-center justify-center flex-shrink-0 ${getStyleColor(session.style)}`}>
              <Icon name={getStyleIcon(session.style)} />
            </div>
            <div>
              <h2 class="text-lg font-bold text-white">{session.name}</h2>
              <p class="text-xs text-slate-400 mt-0.5 capitalize">
                {session.style} &bull; {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={onClose} class="text-slate-400 p-1">
            <Icon name="close" />
          </button>
        </div>

        <div class="grid grid-cols-3 gap-3 px-5 py-4 border-b border-white/5">
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-500">Duration</span>
            <span class="text-sm font-bold text-white">{formatDuration(session.durationSeconds)}</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-500">Volume</span>
            <span class="text-sm font-bold text-white">{session.totalVolume.toLocaleString()} lbs</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-500">Sets</span>
            <span class="text-sm font-bold text-white">{session.totalSets}</span>
          </div>
        </div>

        <div class="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {session.exercises.map((ex) => (
            <div key={ex.exerciseId}>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-semibold text-white">{ex.exerciseName}</span>
                <span class="text-[10px] text-slate-500 uppercase">{ex.muscleGroup}</span>
              </div>
              <div class="space-y-1">
                {ex.sets.map((set) => (
                  <div
                    key={set.setNumber}
                    class={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm ${
                      set.completed ? 'bg-white/5' : 'bg-transparent opacity-40'
                    }`}
                  >
                    <span class="text-xs text-slate-500 w-5">S{set.setNumber}</span>
                    <span class="text-slate-200 font-medium flex-1">
                      {set.weight != null ? `${set.weight} lbs` : '\u2014'} {'\u00d7'} {set.reps ?? '\u2014'}
                    </span>
                    {set.completed && <Icon name="check_circle" class="text-primary text-base" />}
                    {set.isPersonalRecord && <span class="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">PR</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Progress({ sessions }: ProgressProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);

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

  // Generate chart bars based on time frame
  const chartBars = useMemo(() => {
    const now = new Date();

    if (timeFrame === 'year') {
      // 12 monthly bars
      const bars: { label: string; volume: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
        const label = d.toLocaleDateString('en-US', { month: 'short' });
        let volume = 0;
        for (const s of filteredSessions) {
          const sd = new Date(s.startedAt);
          if (`${sd.getFullYear()}-${sd.getMonth()}` === monthKey) {
            volume += s.totalVolume;
          }
        }
        bars.push({ label, volume });
      }
      return bars;
    }

    // Week (7 days) or month (30 days)
    const numDays = timeFrame === 'week' ? 7 : 30;
    const bars: { label: string; volume: number }[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toDateString();
      const label = timeFrame === 'week'
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : (i % 5 === 0 || i === 0) ? d.toLocaleDateString('en-US', { day: 'numeric' }) : '';
      let volume = 0;
      for (const s of filteredSessions) {
        if (new Date(s.startedAt).toDateString() === dateStr) {
          volume += s.totalVolume;
        }
      }
      bars.push({ label, volume });
    }
    return bars;
  }, [filteredSessions, timeFrame]);

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
    <div class="flex-1 overflow-y-auto no-scrollbar pb-24">
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
            {chartBars.some((b) => b.volume > 0) ? (() => {
              const maxVol = Math.max(...chartBars.map((b) => b.volume), 1);
              return (
                <>
                  <div class="h-36 w-full flex items-end gap-[2px]">
                    {chartBars.map((bar, i) => (
                      <div key={i} class="flex-1 flex flex-col items-center justify-end h-full">
                        <div
                          class="w-full rounded-t-sm bg-primary/80 min-w-[2px] transition-all"
                          style={{
                            height: bar.volume > 0 ? `${Math.max((bar.volume / maxVol) * 100, 4)}%` : '0%',
                            opacity: bar.volume > 0 ? 1 : 0,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div class="flex justify-between mt-3 text-xs font-medium text-slate-500">
                    {timeFrame === 'year'
                      ? chartBars.filter((_, i) => i % 2 === 0).map((bar, i) => (
                          <span key={i}>{bar.label}</span>
                        ))
                      : timeFrame === 'week'
                        ? chartBars.map((bar, i) => (
                            <span key={i}>{bar.label}</span>
                          ))
                        : chartBars.filter((b) => b.label).map((bar, i) => (
                            <span key={i}>{bar.label}</span>
                          ))
                    }
                  </div>
                </>
              );
            })() : (
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
                  <div key={s.id} class="bg-surface-dark rounded-xl p-4 border border-white/5 mb-2 space-y-3 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => setSelectedSession(s)}>
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

      {selectedSession && (
        <WorkoutDetail session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </div>
  );
}
